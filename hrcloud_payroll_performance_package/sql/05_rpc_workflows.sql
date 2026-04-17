-- HRCloud / Base
-- 05_rpc_workflows.sql

create or replace function attendance.fn_get_payroll_setting_json(
  p_tenant_id uuid,
  p_setting_code text
) returns jsonb
language sql
security definer
set search_path = public, attendance
as $$
  select ps.setting_value
  from attendance.payroll_settings ps
  where ps.tenant_id = p_tenant_id
    and ps.setting_code = p_setting_code
    and ps.is_active = true
  order by ps.valid_from desc
  limit 1;
$$;

create or replace function attendance.rpc_create_payroll_period(
  p_code text,
  p_period_year integer,
  p_period_month integer,
  p_start_date date,
  p_end_date date,
  p_payment_date date
) returns uuid
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_id uuid;
  v_tenant_id uuid := attendance.get_my_tenant_id();
begin
  if not attendance.tenant_feature_enabled('payroll', v_tenant_id) then
    raise exception 'Payroll no habilitado para el tenant';
  end if;

  insert into attendance.payroll_periods(
    tenant_id, code, period_year, period_month, start_date, end_date, payment_date
  )
  values (
    v_tenant_id, p_code, p_period_year, p_period_month, p_start_date, p_end_date, p_payment_date
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function attendance.rpc_create_payroll_run(
  p_payroll_period_id uuid,
  p_run_type text default 'REGULAR'
) returns uuid
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_id uuid;
  v_tenant_id uuid := attendance.get_my_tenant_id();
  v_run_no integer;
begin
  select coalesce(max(run_no),0)+1
    into v_run_no
  from attendance.payroll_runs
  where tenant_id = v_tenant_id
    and payroll_period_id = p_payroll_period_id;

  insert into attendance.payroll_runs(
    tenant_id, payroll_period_id, run_no, run_type, status
  )
  values (
    v_tenant_id, p_payroll_period_id, v_run_no, coalesce(p_run_type,'REGULAR'), 'DRAFT'
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function attendance.rpc_calculate_payroll_run(
  p_payroll_run_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_run attendance.payroll_runs%rowtype;
  v_emp record;
  v_prc_id uuid;
begin
  select * into v_run
  from attendance.payroll_runs
  where id = p_payroll_run_id
    and tenant_id = attendance.get_my_tenant_id();

  if not found then
    raise exception 'Payroll run no encontrado';
  end if;

  update attendance.payroll_runs
     set status = 'CALCULATING',
         calculation_started_at = now()
   where id = p_payroll_run_id;

  delete from attendance.payroll_run_items
   where payroll_run_collaborator_id in (
     select id from attendance.payroll_run_collaborators
     where payroll_run_id = p_payroll_run_id
   );

  delete from attendance.payroll_run_collaborators
   where payroll_run_id = p_payroll_run_id;

  for v_emp in
    select e.id, e.tenant_id, e.employee_code, coalesce(e.full_name, concat_ws(' ', e.first_name, e.last_name)) as collaborator_name,
           coalesce(e.base_salary,0) as base_salary
    from public.employees e
    where e.tenant_id = v_run.tenant_id
      and coalesce(e.is_active, true) = true
  loop
    insert into attendance.payroll_run_collaborators(
      tenant_id, payroll_run_id, employee_id, employee_code, collaborator_name,
      base_salary, total_earnings, total_deductions, total_employer_contributions, total_provisions, net_pay, validation_status
    )
    values (
      v_run.tenant_id, p_payroll_run_id, v_emp.id, v_emp.employee_code, v_emp.collaborator_name,
      v_emp.base_salary,
      v_emp.base_salary,
      round(v_emp.base_salary * 0.0945, 2),
      round(v_emp.base_salary * 0.1115, 2),
      round(v_emp.base_salary * 0.1666, 2),
      round(v_emp.base_salary - (v_emp.base_salary * 0.0945), 2),
      'OK'
    )
    returning id into v_prc_id;

    -- Línea base sueldo
    insert into attendance.payroll_run_items(
      tenant_id, payroll_run_collaborator_id, payroll_concept_id, concept_code, concept_name, quantity, rate, amount, source_type
    )
    select v_run.tenant_id, v_prc_id, pc.id, pc.code, pc.name, 1, 1, v_emp.base_salary, 'SYSTEM'
    from attendance.payroll_concepts pc
    where pc.tenant_id = v_run.tenant_id
      and pc.code = 'BASE_SALARY'
    limit 1;
  end loop;

  update attendance.payroll_runs
     set status = 'CALCULATED',
         calculation_finished_at = now()
   where id = p_payroll_run_id;

  return jsonb_build_object(
    'ok', true,
    'payroll_run_id', p_payroll_run_id,
    'status', 'CALCULATED'
  );
end;
$$;

create or replace function attendance.rpc_close_payroll_run(
  p_payroll_run_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_run attendance.payroll_runs%rowtype;
begin
  select * into v_run
  from attendance.payroll_runs
  where id = p_payroll_run_id
    and tenant_id = attendance.get_my_tenant_id();

  if not found then
    raise exception 'Payroll run no encontrado';
  end if;

  if v_run.status <> 'CALCULATED' then
    raise exception 'El payroll run debe estar CALCULATED antes de cerrar';
  end if;

  update attendance.payroll_runs
     set status = 'CLOSED',
         closed_by = auth.uid(),
         closed_at = now()
   where id = p_payroll_run_id;

  update attendance.payroll_periods
     set status = 'CLOSED',
         is_closed = true
   where id = v_run.payroll_period_id;

  return jsonb_build_object('ok', true, 'status', 'CLOSED');
end;
$$;

create or replace function attendance.rpc_create_performance_cycle(
  p_code text,
  p_name text,
  p_start_date date,
  p_end_date date
) returns uuid
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_id uuid;
  v_tenant_id uuid := attendance.get_my_tenant_id();
begin
  if not attendance.tenant_feature_enabled('performance', v_tenant_id) then
    raise exception 'Performance no habilitado para el tenant';
  end if;

  insert into attendance.performance_cycles(
    tenant_id, code, name, start_date, end_date
  )
  values (
    v_tenant_id, p_code, p_name, p_start_date, p_end_date
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function attendance.rpc_assign_performance_reviews(
  p_performance_cycle_id uuid,
  p_template_id uuid
) returns integer
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_count integer := 0;
  v_emp record;
begin
  for v_emp in
    select e.id, e.tenant_id
    from public.employees e
    where e.tenant_id = attendance.get_my_tenant_id()
      and coalesce(e.is_active, true) = true
  loop
    insert into attendance.performance_reviews(
      tenant_id, performance_cycle_id, employee_id, performance_template_id, reviewer_user_id, manager_user_id, status
    )
    values (
      v_emp.tenant_id, p_performance_cycle_id, v_emp.id, p_template_id, auth.uid(), auth.uid(), 'PENDING'
    )
    on conflict (tenant_id, performance_cycle_id, employee_id) do nothing;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function attendance.rpc_publish_performance_review(
  p_performance_review_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_review attendance.performance_reviews%rowtype;
begin
  select * into v_review
  from attendance.performance_reviews
  where id = p_performance_review_id
    and tenant_id = attendance.get_my_tenant_id();

  if not found then
    raise exception 'Performance review no encontrado';
  end if;

  update attendance.performance_reviews
     set status = 'PUBLISHED',
         published_at = now()
   where id = p_performance_review_id;

  insert into attendance.performance_improvement_plans(
    tenant_id, employee_id, performance_review_id, owner_user_id, title, description, due_date, status
  )
  select v_review.tenant_id, v_review.employee_id, v_review.id, auth.uid(),
         'Plan de mejora automático',
         'Generado por score bajo umbral',
         current_date + interval '60 days',
         'OPEN'
  where coalesce(v_review.final_score, 0) < 70
    and not exists (
      select 1 from attendance.performance_improvement_plans p
      where p.performance_review_id = v_review.id
    );

  return jsonb_build_object('ok', true, 'status', 'PUBLISHED');
end;
$$;