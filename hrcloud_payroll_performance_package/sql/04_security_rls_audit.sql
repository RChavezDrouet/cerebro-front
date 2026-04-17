-- HRCloud / Base
-- 04_security_rls_audit.sql

create table if not exists attendance.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_user_id uuid,
  event_type text not null,
  entity_name text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function attendance.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'employee_dependents',
    'employee_contracts',
    'employee_tax_profiles',
    'employee_payment_accounts',
    'payroll_settings',
    'payroll_periods',
    'payroll_concepts',
    'payroll_formulas',
    'payroll_runs',
    'payroll_run_collaborators',
    'payroll_loans',
    'performance_cycles',
    'performance_scales',
    'performance_templates',
    'performance_components',
    'performance_reviews',
    'performance_review_items',
    'performance_improvement_plans',
    'performance_gaps',
    'training_catalog',
    'training_plans'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated_at on attendance.%s;', t, t);
    execute format('create trigger trg_%s_updated_at before update on attendance.%s for each row execute function attendance.tg_set_updated_at();', t, t);
  end loop;
end $$;

create or replace function attendance.tg_audit_generic()
returns trigger
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(
    case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end,
    attendance.get_my_tenant_id()
  );

  insert into attendance.audit_events (
    tenant_id, actor_user_id, event_type, entity_name, entity_id, old_data, new_data
  )
  values (
    v_tenant_id,
    auth.uid(),
    tg_op,
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return case when tg_op='DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'employee_contracts',
    'employee_tax_profiles',
    'payroll_periods',
    'payroll_runs',
    'payroll_run_collaborators',
    'payroll_run_items',
    'performance_reviews',
    'performance_review_items',
    'performance_recalifications',
    'performance_improvement_plans',
    'performance_gaps',
    'training_plans'
  ]
  loop
    execute format('drop trigger if exists trg_%s_audit on attendance.%s;', t, t);
    execute format('create trigger trg_%s_audit after insert or update or delete on attendance.%s for each row execute function attendance.tg_audit_generic();', t, t);
  end loop;
end $$;

-- RLS
alter table attendance.employee_dependents enable row level security;
alter table attendance.employee_contracts enable row level security;
alter table attendance.employee_actions enable row level security;
alter table attendance.employee_tax_profiles enable row level security;
alter table attendance.employee_payment_accounts enable row level security;
alter table attendance.payroll_settings enable row level security;
alter table attendance.payroll_periods enable row level security;
alter table attendance.payroll_concepts enable row level security;
alter table attendance.payroll_formulas enable row level security;
alter table attendance.payroll_runs enable row level security;
alter table attendance.payroll_run_collaborators enable row level security;
alter table attendance.payroll_run_items enable row level security;
alter table attendance.payroll_loans enable row level security;
alter table attendance.payroll_advances enable row level security;
alter table attendance.payroll_receipts enable row level security;
alter table attendance.payroll_iess_exports enable row level security;
alter table attendance.payroll_sri_exports enable row level security;
alter table attendance.performance_cycles enable row level security;
alter table attendance.performance_scales enable row level security;
alter table attendance.performance_scale_items enable row level security;
alter table attendance.performance_templates enable row level security;
alter table attendance.performance_components enable row level security;
alter table attendance.performance_template_assignments enable row level security;
alter table attendance.performance_reviews enable row level security;
alter table attendance.performance_review_items enable row level security;
alter table attendance.performance_recalifications enable row level security;
alter table attendance.performance_improvement_plans enable row level security;
alter table attendance.performance_gaps enable row level security;
alter table attendance.training_catalog enable row level security;
alter table attendance.training_plans enable row level security;
alter table attendance.audit_events enable row level security;

create or replace function attendance.can_access_employee(p_employee_id uuid)
returns boolean
language sql
security definer
set search_path = public, attendance
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.tenant_id = attendance.get_my_tenant_id()
  );
$$;

-- Create broad tenant policies for authenticated users from same tenant.
do $$
declare
  t text;
begin
  foreach t in array array[
    'employee_dependents','employee_contracts','employee_actions',
    'employee_tax_profiles','employee_payment_accounts',
    'payroll_settings','payroll_periods','payroll_concepts','payroll_formulas',
    'payroll_runs','payroll_run_collaborators','payroll_run_items',
    'payroll_loans','payroll_advances','payroll_receipts','payroll_iess_exports',
    'payroll_sri_exports','performance_cycles','performance_scales',
    'performance_scale_items','performance_templates','performance_components',
    'performance_template_assignments','performance_reviews','performance_review_items',
    'performance_recalifications','performance_improvement_plans','performance_gaps',
    'training_catalog','training_plans','audit_events'
  ]
  loop
    execute format('drop policy if exists %I_tenant_select on attendance.%I;', t, t);
    execute format('drop policy if exists %I_tenant_modify on attendance.%I;', t, t);

    execute format(
      'create policy %I_tenant_select on attendance.%I for select using (tenant_id = attendance.get_my_tenant_id());',
      t, t
    );

    execute format(
      'create policy %I_tenant_modify on attendance.%I for all using (tenant_id = attendance.get_my_tenant_id()) with check (tenant_id = attendance.get_my_tenant_id());',
      t, t
    );
  end loop;
end $$;