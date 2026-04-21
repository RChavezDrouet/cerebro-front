-- =============================================================
-- 042_seed_requests_dashboard_demo.sql
-- Seed de solicitudes y aprobaciones para dashboard/reportes.
-- Usa el MISMO tenant del sistema, no un proyecto separado.
--
-- Reejecutable:
-- - limpia solo los registros marcados con seed_tag
-- - reutiliza empleados y perfiles reales del tenant
--
-- Requisito previo:
-- - haber aplicado 040_approval_flows.sql
-- =============================================================

begin;

do $$
declare
  v_tenant_id constant uuid := '8cb84ecf-4d74-4aac-84cc-0c66da4aa656';
  v_seed_tag constant text := 'seed-dashboard-requests-v1';
  v_seed_prefix constant text := '[seed-dashboard-requests-v1]';
  v_today date := (now() at time zone 'America/Guayaquil')::date;
  v_now timestamptz := now();
  v_admin_user_id uuid;
  v_admin_employee_id uuid;
  v_manager_user_id uuid;
  v_manager_employee_id uuid;
  v_hr_user_id uuid;
  v_hr_employee_id uuid;
  v_candidate_user_ids uuid[];
  v_employee_count integer;
  v_profile_count integer;
  v_has_approval_engine boolean;
  v_permission_has_request_scope boolean;
  v_permission_has_legacy_shape boolean;
begin
  if not exists (
    select 1
    from public.tenants
    where id = v_tenant_id
  ) then
    raise exception 'Tenant % no existe. Ajusta v_tenant_id antes de ejecutar este script.', v_tenant_id;
  end if;

  if to_regclass('attendance.attendance_justifications') is null
     or to_regclass('attendance.permission_requests') is null
     or to_regclass('attendance.loan_requests') is null
     or to_regclass('attendance.salary_advance_requests') is null
     or to_regclass('attendance.vacation_requests') is null then
    raise exception 'Faltan tablas de solicitudes. Ejecuta primero supabase/sql_attendance_isolated/040_approval_flows.sql.';
  end if;

  v_has_approval_engine :=
    to_regclass('attendance.approval_flow_catalog') is not null
    and to_regclass('attendance.approval_requests') is not null
    and to_regclass('attendance.approval_request_steps') is not null;

  if not v_has_approval_engine then
    raise exception 'El motor de aprobaciones esta incompleto. Ejecuta primero supabase/sql_attendance_isolated/040_approval_flows.sql.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'attendance'
      and table_name = 'permission_requests'
      and column_name = 'request_scope'
  )
  into v_permission_has_request_scope;

  v_permission_has_legacy_shape :=
    v_permission_has_request_scope
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'attendance'
        and table_name = 'permission_requests'
        and column_name = 'date_from'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'attendance'
        and table_name = 'permission_requests'
        and column_name = 'date_to'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'attendance'
        and table_name = 'permission_requests'
        and column_name = 'request_date'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'attendance'
        and table_name = 'permission_requests'
        and column_name = 'time_from'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'attendance'
        and table_name = 'permission_requests'
        and column_name = 'time_to'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'attendance'
        and table_name = 'permission_requests'
        and column_name = 'status'
    );

  create temp table tmp_seed_profiles on commit drop as
  select
    p.id as user_id,
    p.employee_id,
    coalesce(nullif(trim(p.role), ''), 'employee') as role,
    coalesce(nullif(trim(concat_ws(' ', e.first_name, e.last_name)), ''), p.id::text) as full_name,
    row_number() over (
      order by
        case
          when p.role in ('tenant_admin', 'hr_admin', 'admin') then 1
          when p.role in ('manager', 'supervisor') then 2
          when p.role in ('payroll_admin', 'payroll_responsible') then 3
          else 4
        end,
        coalesce(nullif(trim(concat_ws(' ', e.first_name, e.last_name)), ''), p.id::text)
    ) as rn
  from public.profiles p
  left join public.employees e
    on e.id = p.employee_id
  where p.tenant_id = v_tenant_id;

  select count(*) into v_profile_count from tmp_seed_profiles;

  if v_profile_count = 0 then
    raise exception 'No hay perfiles en public.profiles para el tenant %. Se requiere al menos un usuario del tenant.', v_tenant_id;
  end if;

  select user_id, employee_id
  into v_admin_user_id, v_admin_employee_id
  from tmp_seed_profiles
  order by
    case
      when role in ('tenant_admin', 'hr_admin', 'admin') then 1
      else 2
    end,
    rn
  limit 1;

  select user_id, employee_id
  into v_manager_user_id, v_manager_employee_id
  from tmp_seed_profiles
  order by
    case
      when role in ('manager', 'supervisor', 'tenant_admin', 'admin') then 1
      else 2
    end,
    rn
  limit 1;

  select user_id, employee_id
  into v_hr_user_id, v_hr_employee_id
  from tmp_seed_profiles
  order by
    case
      when role in ('hr_admin', 'tenant_admin', 'admin') then 1
      else 2
    end,
    rn
  limit 1;

  if v_manager_user_id is null then
    v_manager_user_id := v_admin_user_id;
    v_manager_employee_id := v_admin_employee_id;
  end if;

  if v_hr_user_id is null then
    v_hr_user_id := coalesce(v_admin_user_id, v_manager_user_id);
    v_hr_employee_id := coalesce(v_admin_employee_id, v_manager_employee_id);
  end if;

  select array_agg(user_id order by rn)
  into v_candidate_user_ids
  from tmp_seed_profiles;

  create temp table tmp_seed_employees on commit drop as
  with base as (
    select
      e.id as employee_id,
      coalesce(nullif(trim(concat_ws(' ', e.first_name, e.last_name)), ''), e.email, e.id::text) as full_name,
      e.employee_code,
      coalesce(ep.user_id, v_admin_user_id) as requester_user_id,
      row_number() over (
        order by
          coalesce(e.employee_code, 'ZZZ'),
          coalesce(nullif(trim(concat_ws(' ', e.first_name, e.last_name)), ''), e.id::text)
      ) as rn
    from public.employees e
    left join lateral (
      select p.id as user_id
      from public.profiles p
      where p.tenant_id = v_tenant_id
        and p.employee_id = e.id
      order by p.id
      limit 1
    ) ep on true
    where e.tenant_id = v_tenant_id
      and coalesce(e.employment_status, 'active') = 'active'
  )
  select *
  from base;

  select count(*) into v_employee_count from tmp_seed_employees;

  if v_employee_count = 0 then
    raise exception 'No hay colaboradores activos en public.employees para el tenant %.', v_tenant_id;
  end if;

  insert into attendance.approval_flow_catalog (
    flow_code,
    flow_name,
    applies_to_module,
    source_table,
    description,
    fallback_strategy,
    is_active
  )
  values
    (
      'attendance_late_justification',
      'Justificacion de atraso',
      'attendance',
      'attendance_justifications',
      'Flujo base para atrasos.',
      jsonb_build_array(jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )),
      true
    ),
    (
      'attendance_absence_justification',
      'Justificacion de falta',
      'attendance',
      'attendance_justifications',
      'Flujo base para faltas.',
      jsonb_build_array(jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )),
      true
    ),
    (
      'attendance_early_exit_justification',
      'Justificacion de salida anticipada',
      'attendance',
      'attendance_justifications',
      'Flujo base para salida anticipada.',
      jsonb_build_array(jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )),
      true
    ),
    (
      'attendance_early_break_justification',
      'Justificacion de break anticipado',
      'attendance',
      'attendance_justifications',
      'Flujo base para break anticipado.',
      jsonb_build_array(jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )),
      true
    ),
    (
      'permission_request',
      'Solicitud de permiso',
      'requests',
      'permission_requests',
      'Flujo base de permisos.',
      jsonb_build_array(jsonb_build_object(
        'step_order', 1,
        'step_name', 'Jefe inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )),
      true
    ),
    (
      'loan_request',
      'Solicitud de prestamo',
      'requests',
      'loan_requests',
      'Flujo base de prestamos.',
      jsonb_build_array(
        jsonb_build_object(
          'step_order', 1,
          'step_name', 'Jefe inmediato',
          'approver_type', 'manager',
          'is_required', true,
          'allow_delegate', false,
          'candidate_resolution', 'shared_queue',
          'parallel_group', null
        ),
        jsonb_build_object(
          'step_order', 2,
          'step_name', 'RRHH',
          'approver_type', 'hr_responsible',
          'is_required', true,
          'allow_delegate', false,
          'candidate_resolution', 'shared_queue',
          'parallel_group', null
        )
      ),
      true
    ),
    (
      'salary_advance_request',
      'Solicitud de adelanto',
      'requests',
      'salary_advance_requests',
      'Flujo base de adelantos.',
      jsonb_build_array(
        jsonb_build_object(
          'step_order', 1,
          'step_name', 'Jefe inmediato',
          'approver_type', 'manager',
          'is_required', true,
          'allow_delegate', false,
          'candidate_resolution', 'shared_queue',
          'parallel_group', null
        ),
        jsonb_build_object(
          'step_order', 2,
          'step_name', 'RRHH',
          'approver_type', 'hr_responsible',
          'is_required', true,
          'allow_delegate', false,
          'candidate_resolution', 'shared_queue',
          'parallel_group', null
        )
      ),
      true
    ),
    (
      'vacation_request',
      'Solicitud de vacaciones',
      'requests',
      'vacation_requests',
      'Flujo base de vacaciones.',
      jsonb_build_array(
        jsonb_build_object(
          'step_order', 1,
          'step_name', 'Jefe inmediato',
          'approver_type', 'manager',
          'is_required', true,
          'allow_delegate', false,
          'candidate_resolution', 'shared_queue',
          'parallel_group', null
        ),
        jsonb_build_object(
          'step_order', 2,
          'step_name', 'RRHH',
          'approver_type', 'hr_responsible',
          'is_required', true,
          'allow_delegate', false,
          'candidate_resolution', 'shared_queue',
          'parallel_group', null
        )
      ),
      true
    )
  on conflict (flow_code) do update set
    flow_name = excluded.flow_name,
    applies_to_module = excluded.applies_to_module,
    source_table = excluded.source_table,
    description = excluded.description,
    fallback_strategy = excluded.fallback_strategy,
    is_active = true;

  delete from attendance.approval_request_steps
  where approval_request_id in (
    select id
    from attendance.approval_requests
    where tenant_id = v_tenant_id
      and metadata ->> 'seed_tag' = v_seed_tag
  );

  delete from attendance.approval_requests
  where tenant_id = v_tenant_id
    and metadata ->> 'seed_tag' = v_seed_tag;

  delete from attendance.attendance_justifications
  where tenant_id = v_tenant_id
    and reason like v_seed_prefix || '%';

  delete from attendance.permission_requests
  where tenant_id = v_tenant_id
    and reason like v_seed_prefix || '%';

  delete from attendance.loan_requests
  where tenant_id = v_tenant_id
    and reason like v_seed_prefix || '%';

  delete from attendance.salary_advance_requests
  where tenant_id = v_tenant_id
    and reason like v_seed_prefix || '%';

  delete from attendance.vacation_requests
  where tenant_id = v_tenant_id
    and coalesce(reason, '') like v_seed_prefix || '%';

  create temp table tmp_seed_justifications on commit drop as
  with base as (
    select
      e.employee_id,
      e.full_name,
      e.requester_user_id,
      e.rn,
      slots.slot,
      v_now - make_interval(
        days => (((e.rn * 2 + slots.slot * 4) % 50) + 2)::int,
        hours => (slots.slot + 1)::int
      ) as created_at
    from tmp_seed_employees e
    cross join generate_series(1, 4) as slots(slot)
    where e.rn <= least(10, v_employee_count)
  ),
  prepared as (
    select
      gen_random_uuid() as id,
      employee_id,
      requester_user_id,
      justification_type,
      work_date,
      reason,
      request_status,
      created_at
    from (
      select
        employee_id,
        requester_user_id,
        created_at,
        case slot
          when 1 then 'late'
          when 2 then 'absence'
          when 3 then 'early_exit'
          else 'early_break'
        end as justification_type,
        (v_today - ((((rn * 2) + (slot * 3)) % 45) + 2)::int)::date as work_date,
        format(
          '%s Justificacion %s para visual del dashboard (%s)',
          v_seed_prefix,
          case slot
            when 1 then 'de atraso'
            when 2 then 'de falta'
            when 3 then 'de salida anticipada'
            else 'de break anticipado'
          end,
          full_name
        ) as reason,
        case
          when slot = 1 then 'aprobado'
          when slot = 2 then case when rn % 3 = 0 then 'pendiente' else 'en_aprobacion' end
          when slot = 3 then case when rn % 2 = 0 then 'rechazado' else 'aprobado' end
          else case when rn % 2 = 0 then 'cancelado' else 'borrador' end
        end as request_status
      from base
    ) q
  )
  select
    id,
    employee_id,
    requester_user_id,
    justification_type,
    work_date,
    reason,
    request_status,
    created_at,
    case
      when request_status = 'borrador' then null
      else created_at + interval '1 hour'
    end as submitted_at,
    case
      when request_status in ('aprobado', 'rechazado') then created_at + interval '30 hours'
      when request_status = 'cancelado' then created_at + interval '12 hours'
      else null
    end as resolved_at,
    case
      when request_status in ('aprobado', 'rechazado') then coalesce(v_hr_user_id, v_admin_user_id)
      when request_status = 'cancelado' then requester_user_id
      else null
    end as resolved_by_user_id,
    case
      when request_status in ('aprobado', 'rechazado') then created_at + interval '30 hours'
      else null
    end as reviewed_at,
    case
      when request_status in ('aprobado', 'rechazado') then coalesce(v_manager_user_id, v_admin_user_id)
      else null
    end as reviewed_by_user_id
  from prepared;

  create temp table tmp_seed_permissions on commit drop as
  with base as (
    select
      e.employee_id,
      e.full_name,
      e.requester_user_id,
      e.rn,
      slots.slot,
      v_now - make_interval(
        days => (((e.rn * 3 + slots.slot * 5) % 42) + 3)::int,
        hours => ((slots.slot * 2) + 2)::int
      ) as created_at
    from tmp_seed_employees e
    cross join generate_series(1, 2) as slots(slot)
    where e.rn <= least(10, v_employee_count)
  ),
  prepared as (
    select
      gen_random_uuid() as id,
      employee_id,
      requester_user_id,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      hours_requested,
      reason,
      request_status,
      created_at
    from (
      select
        employee_id,
        requester_user_id,
        created_at,
        case (rn + slot) % 4
          when 0 then 'medico'
          when 1 then 'personal'
          when 2 then 'general'
          else 'estudios'
        end as request_type,
        case
          when slot = 1 then (v_today - (((rn + slot) % 9)::int))::date
          else (v_today - ((((rn * 2) + slot) % 24 + 8)::int))::date
        end as start_date,
        case
          when slot = 1 and rn % 2 = 0 then ((v_today - (((rn + slot) % 9)::int)) + 1)::date
          when slot = 1 then (v_today - (((rn + slot) % 9)::int))::date
          else (v_today - ((((rn * 2) + slot) % 24 + 8)::int))::date
        end as end_date,
        case when slot = 1 then '09:00'::time else '14:00'::time end as start_time,
        case when slot = 1 then '13:00'::time else '18:00'::time end as end_time,
        case when slot = 1 then 4::numeric else 4::numeric end as hours_requested,
        format(
          '%s Permiso %s para analitica de solicitudes (%s)',
          v_seed_prefix,
          case (rn + slot) % 4
            when 0 then 'medico'
            when 1 then 'personal'
            when 2 then 'general'
            else 'de estudios'
          end,
          full_name
        ) as reason,
        case
          when slot = 1 then
            case
              when rn % 5 = 0 then 'cancelado'
              when rn % 3 = 0 then 'pendiente'
              else 'en_aprobacion'
            end
          else
            case
              when rn % 4 = 0 then 'rechazado'
              else 'aprobado'
            end
        end as request_status
      from base
    ) q
  )
  select
    id,
    employee_id,
    requester_user_id,
    request_type,
    start_date,
    end_date,
    start_time,
    end_time,
    hours_requested,
    reason,
    request_status,
    created_at,
    case
      when request_status = 'borrador' then null
      else created_at + interval '1 hour'
    end as submitted_at,
    case
      when request_status in ('aprobado', 'rechazado') then created_at + interval '20 hours'
      when request_status = 'cancelado' then created_at + interval '8 hours'
      else null
    end as resolved_at,
    case
      when request_status in ('aprobado', 'rechazado') then coalesce(v_hr_user_id, v_admin_user_id)
      when request_status = 'cancelado' then requester_user_id
      else null
    end as resolved_by_user_id
  from prepared;

  create temp table tmp_seed_loans on commit drop as
  with base as (
    select
      e.employee_id,
      e.full_name,
      e.requester_user_id,
      e.rn,
      v_now - make_interval(days => ((e.rn * 6) + 10)::int, hours => 3) as created_at
    from tmp_seed_employees e
    where e.rn <= least(6, v_employee_count)
  )
  select
    gen_random_uuid() as id,
    employee_id,
    requester_user_id,
    (250 + rn * 85)::numeric(10,2) as amount_requested,
    'USD'::text as currency_code,
    ((rn % 4) + 1)::integer as installments,
    format('%s Prestamo interno sembrado para dashboard (%s)', v_seed_prefix, full_name) as reason,
    case
      when rn % 5 = 0 then 'cancelado'
      when rn % 4 = 0 then 'pendiente'
      when rn % 3 = 0 then 'rechazado'
      when rn % 2 = 0 then 'en_aprobacion'
      else 'aprobado'
    end as request_status,
    created_at,
    created_at + interval '2 hours' as submitted_at,
    case
      when rn % 5 = 0 then created_at + interval '10 hours'
      when rn % 4 = 0 then null
      when rn % 3 = 0 then created_at + interval '36 hours'
      when rn % 2 = 0 then null
      else created_at + interval '42 hours'
    end as resolved_at,
    case
      when rn % 5 = 0 then requester_user_id
      when rn % 4 = 0 then null
      when rn % 3 = 0 then coalesce(v_hr_user_id, v_admin_user_id)
      when rn % 2 = 0 then null
      else coalesce(v_hr_user_id, v_admin_user_id)
    end as resolved_by_user_id
  from base;

  create temp table tmp_seed_advances on commit drop as
  with base as (
    select
      e.employee_id,
      e.full_name,
      e.requester_user_id,
      e.rn,
      v_now - make_interval(days => ((e.rn * 5) + 7)::int, hours => 4) as created_at
    from tmp_seed_employees e
    where e.rn <= least(6, v_employee_count)
  )
  select
    gen_random_uuid() as id,
    employee_id,
    requester_user_id,
    (120 + rn * 40)::numeric(10,2) as amount_requested,
    'USD'::text as currency_code,
    (v_today + (((rn % 3) * 3)::int))::date as requested_pay_date,
    format('%s Adelanto de sueldo sembrado para dashboard (%s)', v_seed_prefix, full_name) as reason,
    case
      when rn % 4 = 0 then 'cancelado'
      when rn % 3 = 0 then 'en_aprobacion'
      when rn % 2 = 0 then 'aprobado'
      else 'pendiente'
    end as request_status,
    created_at,
    created_at + interval '90 minutes' as submitted_at,
    case
      when rn % 4 = 0 then created_at + interval '8 hours'
      when rn % 3 = 0 then null
      when rn % 2 = 0 then created_at + interval '30 hours'
      else null
    end as resolved_at,
    case
      when rn % 4 = 0 then requester_user_id
      when rn % 3 = 0 then null
      when rn % 2 = 0 then coalesce(v_hr_user_id, v_admin_user_id)
      else null
    end as resolved_by_user_id
  from base;

  create temp table tmp_seed_vacations on commit drop as
  with base as (
    select
      e.employee_id,
      e.full_name,
      e.requester_user_id,
      e.rn
    from tmp_seed_employees e
    where e.rn <= least(8, v_employee_count)
  )
  select
    gen_random_uuid() as id,
    employee_id,
    requester_user_id,
    start_date,
    end_date,
    days_requested,
    available_balance_days,
    format('%s Vacaciones sembradas para timeline y heatmap (%s)', v_seed_prefix, full_name) as reason,
    request_status,
    created_at,
    submitted_at,
    resolved_at,
    resolved_by_user_id
  from (
    select
      employee_id,
      requester_user_id,
      full_name,
      case rn
        when 1 then (v_today - 1)
        when 2 then v_today
        when 3 then (v_today + 6)
        when 4 then (v_today + 12)
        when 5 then (v_today - 9)
        when 6 then (v_today + 20)
        when 7 then (v_today + 26)
        else (v_today + 30)
      end as start_date,
      case rn
        when 1 then (v_today + 2)
        when 2 then (v_today + 4)
        when 3 then (v_today + 10)
        when 4 then (v_today + 16)
        when 5 then (v_today - 5)
        when 6 then (v_today + 24)
        when 7 then (v_today + 29)
        else (v_today + 34)
      end as end_date,
      case rn
        when 1 then 4::numeric
        when 2 then 5::numeric
        when 3 then 5::numeric
        when 4 then 5::numeric
        when 5 then 5::numeric
        when 6 then 5::numeric
        when 7 then 4::numeric
        else 5::numeric
      end as days_requested,
      (18 - rn)::numeric as available_balance_days,
      case rn
        when 1 then 'aprobado'
        when 2 then 'aprobado'
        when 3 then 'aprobado'
        when 4 then 'en_aprobacion'
        when 5 then 'rechazado'
        when 6 then 'pendiente'
        when 7 then 'cancelado'
        else 'borrador'
      end as request_status,
      v_now - make_interval(days => ((rn * 7) + 4)::int, hours => 2) as created_at,
      v_now - make_interval(days => ((rn * 7) + 4)::int, hours => 1) as submitted_at,
      case
        when rn in (1, 2, 3) then v_now - make_interval(days => ((rn * 7) + 2)::int)
        when rn = 5 then v_now - make_interval(days => ((rn * 7) + 1)::int)
        when rn = 7 then v_now - make_interval(days => ((rn * 7) + 3)::int)
        else null
      end as resolved_at,
      case
        when rn in (1, 2, 3, 5) then coalesce(v_hr_user_id, v_admin_user_id)
        when rn = 7 then requester_user_id
        else null
      end as resolved_by_user_id
    from base
  ) q;

  insert into attendance.attendance_justifications (
    id,
    tenant_id,
    employee_id,
    justification_type,
    work_date,
    related_punch_id,
    reason,
    attachment_url,
    request_status,
    approval_request_id,
    submitted_at,
    resolved_at,
    resolved_by,
    reviewed_at,
    reviewed_by,
    created_at,
    updated_at
  )
  select
    id,
    v_tenant_id,
    employee_id,
    justification_type,
    work_date,
    null,
    reason,
    null,
    request_status,
    null,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    reviewed_at,
    reviewed_by_user_id,
    created_at,
    coalesce(resolved_at, submitted_at, created_at)
  from tmp_seed_justifications;

  if v_permission_has_legacy_shape then
    insert into attendance.permission_requests (
      id,
      tenant_id,
      employee_id,
      request_scope,
      date_from,
      date_to,
      request_date,
      time_from,
      time_to,
      status,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      hours_requested,
      reason,
      attachment_url,
      request_status,
      approval_request_id,
      submitted_at,
      resolved_at,
      resolved_by,
      created_at,
      updated_at
    )
    select
      id,
      v_tenant_id,
      employee_id,
      case
        when start_time is not null or end_time is not null or coalesce(hours_requested, 0) > 0 then 'hour'
        else 'day'
      end as request_scope,
      case
        when start_time is null and end_time is null and coalesce(hours_requested, 0) = 0 then start_date
        else null
      end as date_from,
      case
        when start_time is null and end_time is null and coalesce(hours_requested, 0) = 0 then end_date
        else null
      end as date_to,
      case
        when start_time is not null or end_time is not null or coalesce(hours_requested, 0) > 0 then start_date
        else null
      end as request_date,
      case
        when start_time is not null or end_time is not null or coalesce(hours_requested, 0) > 0 then start_time
        else null
      end as time_from,
      case
        when start_time is not null or end_time is not null or coalesce(hours_requested, 0) > 0 then end_time
        else null
      end as time_to,
      case request_status
        when 'aprobado' then 'approved'
        when 'rechazado' then 'rejected'
        else 'pending'
      end as status,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      hours_requested,
      reason,
      null,
      request_status,
      null,
      submitted_at,
      resolved_at,
      resolved_by_user_id,
      created_at,
      coalesce(resolved_at, submitted_at, created_at)
    from tmp_seed_permissions;
  elsif v_permission_has_request_scope then
    insert into attendance.permission_requests (
      id,
      tenant_id,
      employee_id,
      request_scope,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      hours_requested,
      reason,
      attachment_url,
      request_status,
      approval_request_id,
      submitted_at,
      resolved_at,
      resolved_by,
      created_at,
      updated_at
    )
    select
      id,
      v_tenant_id,
      employee_id,
      case
        when start_time is not null or end_time is not null or coalesce(hours_requested, 0) > 0 then 'hour'
        else 'day'
      end as request_scope,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      hours_requested,
      reason,
      null,
      request_status,
      null,
      submitted_at,
      resolved_at,
      resolved_by_user_id,
      created_at,
      coalesce(resolved_at, submitted_at, created_at)
    from tmp_seed_permissions;
  else
    insert into attendance.permission_requests (
      id,
      tenant_id,
      employee_id,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      hours_requested,
      reason,
      attachment_url,
      request_status,
      approval_request_id,
      submitted_at,
      resolved_at,
      resolved_by,
      created_at,
      updated_at
    )
    select
      id,
      v_tenant_id,
      employee_id,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      hours_requested,
      reason,
      null,
      request_status,
      null,
      submitted_at,
      resolved_at,
      resolved_by_user_id,
      created_at,
      coalesce(resolved_at, submitted_at, created_at)
    from tmp_seed_permissions;
  end if;

  insert into attendance.loan_requests (
    id,
    tenant_id,
    employee_id,
    amount_requested,
    currency_code,
    installments,
    reason,
    request_status,
    approval_request_id,
    submitted_at,
    resolved_at,
    resolved_by,
    created_at,
    updated_at
  )
  select
    id,
    v_tenant_id,
    employee_id,
    amount_requested,
    currency_code,
    installments,
    reason,
    request_status,
    null,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    created_at,
    coalesce(resolved_at, submitted_at, created_at)
  from tmp_seed_loans;

  insert into attendance.salary_advance_requests (
    id,
    tenant_id,
    employee_id,
    amount_requested,
    currency_code,
    requested_pay_date,
    reason,
    request_status,
    approval_request_id,
    submitted_at,
    resolved_at,
    resolved_by,
    created_at,
    updated_at
  )
  select
    id,
    v_tenant_id,
    employee_id,
    amount_requested,
    currency_code,
    requested_pay_date,
    reason,
    request_status,
    null,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    created_at,
    coalesce(resolved_at, submitted_at, created_at)
  from tmp_seed_advances;

  insert into attendance.vacation_requests (
    id,
    tenant_id,
    employee_id,
    start_date,
    end_date,
    days_requested,
    available_balance_days,
    reason,
    request_status,
    approval_request_id,
    submitted_at,
    resolved_at,
    resolved_by,
    created_at,
    updated_at
  )
  select
    id,
    v_tenant_id,
    employee_id,
    start_date,
    end_date,
    days_requested,
    available_balance_days,
    reason,
    request_status,
    null,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    created_at,
    coalesce(resolved_at, submitted_at, created_at)
  from tmp_seed_vacations;

  create temp table tmp_seed_source_requests on commit drop as
  select
    'attendance_justifications'::text as source_table,
    id as source_record_id,
    employee_id,
    requester_user_id as requested_by_user_id,
    employee_id as requested_by_employee_id,
    request_status,
    case justification_type
      when 'late' then 'attendance_late_justification'
      when 'absence' then 'attendance_absence_justification'
      when 'early_exit' then 'attendance_early_exit_justification'
      else 'attendance_early_break_justification'
    end as flow_code,
    created_at,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    1 as total_steps,
    1 as active_step_order,
    'Supervisor inmediato'::text as step1_name,
    null::text as step2_name
  from tmp_seed_justifications
  where request_status in ('pendiente', 'en_aprobacion', 'aprobado', 'rechazado')

  union all

  select
    'permission_requests'::text,
    id,
    employee_id,
    requester_user_id,
    employee_id,
    request_status,
    'permission_request'::text,
    created_at,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    1,
    1,
    'Jefe inmediato'::text,
    null::text
  from tmp_seed_permissions
  where request_status in ('pendiente', 'en_aprobacion', 'aprobado', 'rechazado')

  union all

  select
    'loan_requests'::text,
    id,
    employee_id,
    requester_user_id,
    employee_id,
    request_status,
    'loan_request'::text,
    created_at,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    2,
    case
      when request_status in ('en_aprobacion', 'aprobado', 'rechazado') then 2
      else 1
    end,
    'Jefe inmediato'::text,
    'RRHH'::text
  from tmp_seed_loans
  where request_status in ('pendiente', 'en_aprobacion', 'aprobado', 'rechazado')

  union all

  select
    'salary_advance_requests'::text,
    id,
    employee_id,
    requester_user_id,
    employee_id,
    request_status,
    'salary_advance_request'::text,
    created_at,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    2,
    case
      when request_status in ('en_aprobacion', 'aprobado', 'rechazado') then 2
      else 1
    end,
    'Jefe inmediato'::text,
    'RRHH'::text
  from tmp_seed_advances
  where request_status in ('pendiente', 'en_aprobacion', 'aprobado', 'rechazado')

  union all

  select
    'vacation_requests'::text,
    id,
    employee_id,
    requester_user_id,
    employee_id,
    request_status,
    'vacation_request'::text,
    created_at,
    submitted_at,
    resolved_at,
    resolved_by_user_id,
    2,
    case
      when request_status in ('en_aprobacion', 'aprobado', 'rechazado') then 2
      else 1
    end,
    'Jefe inmediato'::text,
    'RRHH'::text
  from tmp_seed_vacations
  where request_status in ('pendiente', 'en_aprobacion', 'aprobado', 'rechazado');

  create temp table tmp_seed_approval_requests on commit drop as
  select
    gen_random_uuid() as approval_request_id,
    *
  from tmp_seed_source_requests;

  insert into attendance.approval_requests (
    id,
    tenant_id,
    flow_definition_id,
    flow_code,
    source_table,
    source_record_id,
    requested_by_user_id,
    requested_by_employee_id,
    current_step_order,
    overall_status,
    execution_mode,
    reject_any_step_closes,
    activate_next_on_approval,
    final_decision_at,
    final_decision_by,
    metadata,
    created_at,
    updated_at
  )
  select
    approval_request_id,
    v_tenant_id,
    null,
    flow_code,
    source_table,
    source_record_id,
    requested_by_user_id,
    requested_by_employee_id,
    active_step_order,
    case
      when request_status in ('pendiente', 'en_aprobacion') then 'en_aprobacion'
      else request_status
    end,
    'sequential',
    true,
    true,
    case
      when request_status in ('aprobado', 'rechazado') then resolved_at
      else null
    end,
    case
      when request_status in ('aprobado', 'rechazado') then coalesce(resolved_by_user_id, v_hr_user_id, v_admin_user_id)
      else null
    end,
    jsonb_build_object(
      'seed_tag', v_seed_tag,
      'seed_source', '042_seed_requests_dashboard_demo.sql',
      'source_table', source_table
    ),
    coalesce(submitted_at, created_at),
    coalesce(resolved_at, submitted_at, created_at)
  from tmp_seed_approval_requests;

  insert into attendance.approval_request_steps (
    id,
    tenant_id,
    approval_request_id,
    flow_step_id,
    step_order,
    step_name,
    approver_type,
    assigned_user_id,
    assigned_role_code,
    assigned_group_id,
    candidate_user_ids,
    candidate_resolution,
    status,
    activated_at,
    acted_at,
    acted_by_user_id,
    comments,
    is_required,
    allow_delegate,
    parallel_group,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    v_tenant_id,
    approval_request_id,
    null,
    1,
    step1_name,
    'manager',
    case
      when total_steps = 1 and request_status in ('aprobado', 'rechazado') then coalesce(v_manager_user_id, v_admin_user_id)
      else null
    end,
    null,
    null,
    case
      when total_steps = 1 and request_status in ('pendiente', 'en_aprobacion') then coalesce(v_candidate_user_ids, array[v_admin_user_id]::uuid[])
      when total_steps = 2 and request_status = 'pendiente' then coalesce(v_candidate_user_ids, array[v_admin_user_id]::uuid[])
      else coalesce(array[coalesce(v_manager_user_id, v_admin_user_id)]::uuid[], '{}'::uuid[])
    end,
    case
      when total_steps = 1 and request_status in ('pendiente', 'en_aprobacion') then 'shared_queue'
      when total_steps = 2 and request_status = 'pendiente' then 'shared_queue'
      else 'first_available'
    end,
    case
      when total_steps = 2 and request_status in ('en_aprobacion', 'aprobado', 'rechazado') then 'aprobado'
      when total_steps = 1 and request_status = 'aprobado' then 'aprobado'
      when total_steps = 1 and request_status = 'rechazado' then 'rechazado'
      else 'pendiente'
    end,
    coalesce(submitted_at, created_at),
    case
      when total_steps = 2 and request_status in ('en_aprobacion', 'aprobado', 'rechazado') then coalesce(submitted_at, created_at) + interval '8 hours'
      when total_steps = 1 and request_status in ('aprobado', 'rechazado') then resolved_at
      else null
    end,
    case
      when total_steps = 2 and request_status in ('en_aprobacion', 'aprobado', 'rechazado') then coalesce(v_manager_user_id, v_admin_user_id)
      when total_steps = 1 and request_status in ('aprobado', 'rechazado') then coalesce(v_manager_user_id, v_admin_user_id)
      else null
    end,
    case
      when total_steps = 1 and request_status = 'rechazado' then 'Devuelto por jefatura en data de demostracion'
      when total_steps = 2 and request_status in ('en_aprobacion', 'aprobado', 'rechazado') then 'Paso 1 atendido en seed de dashboard'
      else null
    end,
    true,
    false,
    null,
    created_at,
    coalesce(
      case
        when total_steps = 2 and request_status in ('en_aprobacion', 'aprobado', 'rechazado') then coalesce(submitted_at, created_at) + interval '8 hours'
        when total_steps = 1 and request_status in ('aprobado', 'rechazado') then resolved_at
        else submitted_at
      end,
      created_at
    )
  from tmp_seed_approval_requests;

  insert into attendance.approval_request_steps (
    id,
    tenant_id,
    approval_request_id,
    flow_step_id,
    step_order,
    step_name,
    approver_type,
    assigned_user_id,
    assigned_role_code,
    assigned_group_id,
    candidate_user_ids,
    candidate_resolution,
    status,
    activated_at,
    acted_at,
    acted_by_user_id,
    comments,
    is_required,
    allow_delegate,
    parallel_group,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    v_tenant_id,
    approval_request_id,
    null,
    2,
    step2_name,
    'hr_responsible',
    case
      when request_status in ('en_aprobacion', 'aprobado', 'rechazado') then coalesce(v_hr_user_id, v_admin_user_id)
      else null
    end,
    null,
    null,
    case
      when request_status = 'en_aprobacion' then coalesce(v_candidate_user_ids, array[v_admin_user_id]::uuid[])
      when request_status in ('aprobado', 'rechazado') then array[coalesce(v_hr_user_id, v_admin_user_id)]::uuid[]
      else '{}'::uuid[]
    end,
    case
      when request_status = 'en_aprobacion' then 'shared_queue'
      else 'first_available'
    end,
    case
      when request_status = 'aprobado' then 'aprobado'
      when request_status = 'rechazado' then 'rechazado'
      else 'pendiente'
    end,
    case
      when request_status in ('en_aprobacion', 'aprobado', 'rechazado') then coalesce(submitted_at, created_at) + interval '8 hours'
      else null
    end,
    case
      when request_status in ('aprobado', 'rechazado') then resolved_at
      else null
    end,
    case
      when request_status in ('aprobado', 'rechazado') then coalesce(v_hr_user_id, v_admin_user_id)
      else null
    end,
    case
      when request_status = 'rechazado' then 'Cierre negativo en RRHH para pruebas'
      when request_status = 'aprobado' then 'Cierre positivo en RRHH para pruebas'
      else null
    end,
    true,
    false,
    null,
    created_at,
    coalesce(resolved_at, submitted_at, created_at)
  from tmp_seed_approval_requests
  where total_steps = 2;

  update attendance.attendance_justifications t
  set approval_request_id = s.approval_request_id
  from tmp_seed_approval_requests s
  where s.source_table = 'attendance_justifications'
    and t.id = s.source_record_id;

  update attendance.permission_requests t
  set approval_request_id = s.approval_request_id
  from tmp_seed_approval_requests s
  where s.source_table = 'permission_requests'
    and t.id = s.source_record_id;

  update attendance.loan_requests t
  set approval_request_id = s.approval_request_id
  from tmp_seed_approval_requests s
  where s.source_table = 'loan_requests'
    and t.id = s.source_record_id;

  update attendance.salary_advance_requests t
  set approval_request_id = s.approval_request_id
  from tmp_seed_approval_requests s
  where s.source_table = 'salary_advance_requests'
    and t.id = s.source_record_id;

  update attendance.vacation_requests t
  set approval_request_id = s.approval_request_id
  from tmp_seed_approval_requests s
  where s.source_table = 'vacation_requests'
    and t.id = s.source_record_id;

  raise notice 'Seed completado para tenant % con % empleados base y % perfiles.', v_tenant_id, v_employee_count, v_profile_count;
end;
$$;

select
  source_table,
  request_status,
  count(*) as total
from (
  select 'attendance_justifications'::text as source_table, request_status
  from attendance.attendance_justifications
  where tenant_id = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
    and reason like '[seed-dashboard-requests-v1]%'

  union all

  select 'permission_requests'::text, request_status
  from attendance.permission_requests
  where tenant_id = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
    and reason like '[seed-dashboard-requests-v1]%'

  union all

  select 'loan_requests'::text, request_status
  from attendance.loan_requests
  where tenant_id = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
    and reason like '[seed-dashboard-requests-v1]%'

  union all

  select 'salary_advance_requests'::text, request_status
  from attendance.salary_advance_requests
  where tenant_id = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
    and reason like '[seed-dashboard-requests-v1]%'

  union all

  select 'vacation_requests'::text, request_status
  from attendance.vacation_requests
  where tenant_id = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
    and coalesce(reason, '') like '[seed-dashboard-requests-v1]%'
) seeded
group by source_table, request_status
order by source_table, request_status;

select
  overall_status,
  count(*) as total
from attendance.approval_requests
where tenant_id = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
  and metadata ->> 'seed_tag' = 'seed-dashboard-requests-v1'
group by overall_status
order by overall_status;

select
  count(*) as vacations_active_today
from attendance.vacation_requests
where tenant_id = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
  and request_status = 'aprobado'
  and start_date <= (now() at time zone 'America/Guayaquil')::date
  and end_date >= (now() at time zone 'America/Guayaquil')::date
  and coalesce(reason, '') like '[seed-dashboard-requests-v1]%';

commit;
