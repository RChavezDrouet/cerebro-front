-- =======================================================
-- HRCloud Base - Approval Flows Engine
-- Fecha: 2026-04-20
-- Scope:
-- - Catalogo extensible de procesos aprobables
-- - Definiciones parametrizables de flujo por tenant
-- - Motor genérico de aprobacion con fallback
-- - Auditoria completa y bandeja de aprobaciones
-- - Tablas base de negocio para justificaciones y solicitudes
-- =======================================================

begin;

create extension if not exists pgcrypto;
create schema if not exists attendance;

-- -------------------------------------------------------
-- 1) Helpers de contexto
-- -------------------------------------------------------

create or replace function attendance.approval_current_tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    attendance.current_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = auth.uid() limit 1)
  );
$$;

create or replace function attendance.approval_current_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(attendance.current_user_role(), ''),
    (select p.role from public.profiles p where p.id = auth.uid() limit 1),
    'employee'
  );
$$;

create or replace function attendance.approval_current_employee_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (select p.employee_id from public.profiles p where p.id = auth.uid() limit 1),
    (
      select e.id
      from public.employees e
      where e.user_id = auth.uid()
        and e.tenant_id = attendance.approval_current_tenant_id()
      limit 1
    )
  );
$$;

create or replace function attendance.approval_can_manage_config()
returns boolean
language sql
stable
as $$
  select attendance.approval_current_role() in (
    'tenant_admin',
    'hr_admin',
    'admin',
    'payroll_admin',
    'payroll_manager'
  );
$$;

create or replace function attendance.approval_employee_user_id(p_employee_id uuid)
returns uuid
language sql
stable
as $$
  select coalesce(
    (
      select p.id
      from public.profiles p
      where p.employee_id = p_employee_id
      order by p.id
      limit 1
    ),
    (
      select e.user_id
      from public.employees e
      where e.id = p_employee_id
      limit 1
    )
  );
$$;

create or replace function attendance.approval_employee_display_name(p_employee_id uuid)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select trim(concat_ws(' ', e.first_name, e.last_name))
      from public.employees e
      where e.id = p_employee_id
      limit 1
    ),
    p_employee_id::text
  );
$$;

create or replace function attendance.approval_user_display_name(p_user_id uuid)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select trim(concat_ws(' ', e.first_name, e.last_name))
      from public.profiles p
      join public.employees e on e.id = p.employee_id
      where p.id = p_user_id
      limit 1
    ),
    (
      select trim(concat_ws(' ', e.first_name, e.last_name))
      from public.employees e
      where e.user_id = p_user_id
      limit 1
    ),
    p_user_id::text
  );
$$;

create or replace function attendance.approval_get_manager_employee_id(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_depth integer default 1
)
returns uuid
language plpgsql
stable
as $$
declare
  v_depth integer := greatest(coalesce(p_depth, 1), 1);
  v_cursor_employee uuid := p_employee_id;
  v_result uuid;
  v_assignment record;
begin
  while v_depth > 0 loop
    v_result := null;

    select
      a.supervisor_employee_id,
      a.org_unit_id
    into v_assignment
    from attendance.employee_org_assignments a
    where a.tenant_id = p_tenant_id
      and a.employee_id = v_cursor_employee
      and a.effective_to is null
    order by a.effective_from desc
    limit 1;

    if v_assignment.supervisor_employee_id is not null
       and v_assignment.supervisor_employee_id <> v_cursor_employee then
      v_result := v_assignment.supervisor_employee_id;
    elsif v_assignment.org_unit_id is not null then
      with recursive unit_chain as (
        select ou.id, ou.parent_id, ou.responsible_employee_id, 0 as depth_level
        from attendance.org_units ou
        where ou.id = v_assignment.org_unit_id
          and ou.tenant_id = p_tenant_id
          and ou.is_active = true
        union all
        select parent.id, parent.parent_id, parent.responsible_employee_id, unit_chain.depth_level + 1
        from attendance.org_units parent
        join unit_chain on parent.id = unit_chain.parent_id
        where parent.tenant_id = p_tenant_id
          and parent.is_active = true
      )
      select uc.responsible_employee_id
      into v_result
      from unit_chain uc
      where uc.responsible_employee_id is not null
        and uc.responsible_employee_id <> v_cursor_employee
      order by uc.depth_level
      limit 1;
    end if;

    if v_result is null then
      return null;
    end if;

    v_cursor_employee := v_result;
    v_depth := v_depth - 1;
  end loop;

  return v_cursor_employee;
end;
$$;

-- -------------------------------------------------------
-- 2) Catalogo base de procesos aprobables
-- -------------------------------------------------------

create table if not exists attendance.approval_flow_catalog (
  flow_code text primary key,
  flow_name text not null,
  applies_to_module text not null,
  source_table text not null,
  description text null,
  fallback_strategy jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into attendance.approval_flow_catalog (
  flow_code,
  flow_name,
  applies_to_module,
  source_table,
  description,
  fallback_strategy
)
values
  (
    'attendance_late_justification',
    'Justificacion de atraso',
    'attendance',
    'attendance_justifications',
    'Flujo para justificar atrasos detectados por marcacion.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  ),
  (
    'attendance_absence_justification',
    'Justificacion de falta',
    'attendance',
    'attendance_justifications',
    'Flujo para justificar faltas e inasistencias.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  ),
  (
    'attendance_early_exit_justification',
    'Justificacion de salida anticipada',
    'attendance',
    'attendance_justifications',
    'Flujo para justificar salidas antes del horario.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  ),
  (
    'attendance_early_break_justification',
    'Justificacion de ingreso anticipado a break',
    'attendance',
    'attendance_justifications',
    'Flujo para justificar ingreso anticipado a tiempo de descanso.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  ),
  (
    'permission_request',
    'Solicitud de permisos',
    'rrhh',
    'permission_requests',
    'Flujo para permisos por horas o dias.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  ),
  (
    'loan_request',
    'Solicitud de prestamos',
    'payroll',
    'loan_requests',
    'Flujo para prestamos internos al colaborador.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      ),
      jsonb_build_object(
        'step_order', 2,
        'step_name', 'Revision RRHH',
        'approver_type', 'hr_responsible',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  ),
  (
    'salary_advance_request',
    'Solicitud de adelanto de sueldo',
    'payroll',
    'salary_advance_requests',
    'Flujo para anticipo o adelanto de sueldo.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      ),
      jsonb_build_object(
        'step_order', 2,
        'step_name', 'Revision RRHH',
        'approver_type', 'hr_responsible',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  ),
  (
    'vacation_request',
    'Solicitud de vacaciones',
    'rrhh',
    'vacation_requests',
    'Flujo para vacaciones con validacion previa de saldo.',
    jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'step_name', 'Supervisor inmediato',
        'approver_type', 'manager',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      ),
      jsonb_build_object(
        'step_order', 2,
        'step_name', 'Revision RRHH',
        'approver_type', 'hr_responsible',
        'is_required', true,
        'allow_delegate', false,
        'candidate_resolution', 'shared_queue',
        'parallel_group', null
      )
    )
  )
on conflict (flow_code) do update set
  flow_name = excluded.flow_name,
  applies_to_module = excluded.applies_to_module,
  source_table = excluded.source_table,
  description = excluded.description,
  fallback_strategy = excluded.fallback_strategy,
  is_active = true;

-- -------------------------------------------------------
-- 3) Tablas de configuracion del motor
-- -------------------------------------------------------

create table if not exists attendance.approval_flow_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flow_code text not null references attendance.approval_flow_catalog(flow_code),
  flow_name text not null,
  is_active boolean not null default true,
  applies_to_module text not null,
  description text null,
  execution_mode text not null default 'sequential'
    constraint approval_flow_definitions_execution_mode_chk
    check (execution_mode in ('sequential', 'parallel')),
  reject_any_step_closes boolean not null default true,
  activate_next_on_approval boolean not null default true,
  allow_auto_first_step boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint approval_flow_definitions_tenant_flow_uk unique (tenant_id, flow_code)
);

create table if not exists attendance.approval_approver_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  group_kind text not null default 'generic'
    constraint approval_approver_groups_group_kind_chk
    check (group_kind in ('generic', 'hr_responsible', 'payroll_responsible')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_approver_groups_tenant_code_uk unique (tenant_id, code)
);

create table if not exists attendance.approval_approver_group_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null references attendance.approval_approver_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint approval_approver_group_members_group_user_uk unique (group_id, user_id)
);

create table if not exists attendance.approval_flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_definition_id uuid not null references attendance.approval_flow_definitions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_name text not null,
  approver_type text not null
    constraint approval_flow_steps_approver_type_chk
    check (approver_type in (
      'role',
      'manager',
      'manager_of_manager',
      'hr_responsible',
      'payroll_responsible',
      'specific_user',
      'approver_group'
    )),
  approver_role_code text null,
  approver_user_id uuid null references auth.users(id) on delete set null,
  approver_group_id uuid null references attendance.approval_approver_groups(id) on delete set null,
  is_required boolean not null default true,
  allow_delegate boolean not null default false,
  parallel_group text null,
  candidate_resolution text not null default 'shared_queue'
    constraint approval_flow_steps_candidate_resolution_chk
    check (candidate_resolution in ('shared_queue', 'first_available')),
  auto_rule_enabled boolean not null default false,
  auto_rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_flow_steps_definition_order_uk unique (flow_definition_id, step_order),
  constraint approval_flow_steps_assignment_chk check (
    (approver_type = 'role' and approver_role_code is not null and approver_user_id is null)
    or (approver_type = 'specific_user' and approver_user_id is not null and approver_role_code is null)
    or (approver_type = 'approver_group' and approver_group_id is not null and approver_role_code is null and approver_user_id is null)
    or (approver_type in ('manager', 'manager_of_manager', 'hr_responsible', 'payroll_responsible') and approver_role_code is null and approver_user_id is null)
  )
);

create table if not exists attendance.approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flow_definition_id uuid null references attendance.approval_flow_definitions(id) on delete set null,
  flow_code text not null references attendance.approval_flow_catalog(flow_code),
  source_table text not null,
  source_record_id uuid not null,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  requested_by_employee_id uuid null references public.employees(id) on delete set null,
  current_step_order integer null,
  overall_status text not null default 'pendiente'
    constraint approval_requests_overall_status_chk
    check (overall_status in ('borrador', 'pendiente', 'en_aprobacion', 'aprobado', 'rechazado', 'cancelado')),
  execution_mode text not null default 'sequential'
    constraint approval_requests_execution_mode_chk
    check (execution_mode in ('sequential', 'parallel')),
  reject_any_step_closes boolean not null default true,
  activate_next_on_approval boolean not null default true,
  final_decision_at timestamptz null,
  final_decision_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_requests_source_uk unique (tenant_id, flow_code, source_table, source_record_id)
);

create table if not exists attendance.approval_request_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  approval_request_id uuid not null references attendance.approval_requests(id) on delete cascade,
  flow_step_id uuid null references attendance.approval_flow_steps(id) on delete set null,
  step_order integer not null check (step_order > 0),
  step_name text not null,
  approver_type text not null
    constraint approval_request_steps_approver_type_chk
    check (approver_type in (
      'role',
      'manager',
      'manager_of_manager',
      'hr_responsible',
      'payroll_responsible',
      'specific_user',
      'approver_group'
    )),
  assigned_user_id uuid null references auth.users(id) on delete set null,
  assigned_role_code text null,
  assigned_group_id uuid null references attendance.approval_approver_groups(id) on delete set null,
  candidate_user_ids uuid[] not null default '{}'::uuid[],
  candidate_resolution text not null default 'shared_queue'
    constraint approval_request_steps_candidate_resolution_chk
    check (candidate_resolution in ('shared_queue', 'first_available')),
  status text not null default 'pendiente'
    constraint approval_request_steps_status_chk
    check (status in ('pendiente', 'aprobado', 'rechazado', 'omitido')),
  activated_at timestamptz null,
  acted_at timestamptz null,
  acted_by_user_id uuid null references auth.users(id) on delete set null,
  comments text null,
  is_required boolean not null default true,
  allow_delegate boolean not null default false,
  parallel_group text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_request_steps_request_order_uk unique (approval_request_id, step_order)
);

create table if not exists attendance.approval_action_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  approval_request_id uuid not null references attendance.approval_requests(id) on delete cascade,
  approval_request_step_id uuid null references attendance.approval_request_steps(id) on delete set null,
  action text not null
    constraint approval_action_audit_action_chk
    check (action in ('submit', 'approve', 'reject', 'cancel', 'reassign', 'auto_approve')),
  acted_by_user_id uuid null references auth.users(id) on delete set null,
  comments text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------
-- 4) Tablas de negocio conectables al motor
-- -------------------------------------------------------

create table if not exists attendance.attendance_justifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  justification_type text not null
    constraint attendance_justifications_type_chk
    check (justification_type in ('late', 'absence', 'early_exit', 'early_break')),
  work_date date not null,
  related_punch_id uuid null references attendance.punches(id) on delete set null,
  reason text not null,
  attachment_url text null,
  request_status text not null default 'borrador'
    constraint attendance_justifications_request_status_chk
    check (request_status in ('borrador', 'pendiente', 'en_aprobacion', 'aprobado', 'rechazado', 'cancelado')),
  approval_request_id uuid null references attendance.approval_requests(id) on delete set null,
  submitted_at timestamptz null,
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.permission_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_type text not null default 'general',
  start_date date not null,
  end_date date not null,
  start_time time null,
  end_time time null,
  hours_requested numeric null,
  reason text not null,
  attachment_url text null,
  request_status text not null default 'borrador'
    constraint permission_requests_request_status_chk
    check (request_status in ('borrador', 'pendiente', 'en_aprobacion', 'aprobado', 'rechazado', 'cancelado')),
  approval_request_id uuid null references attendance.approval_requests(id) on delete set null,
  submitted_at timestamptz null,
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_requests_dates_chk check (end_date >= start_date)
);

create table if not exists attendance.loan_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  amount_requested numeric not null check (amount_requested > 0),
  currency_code text not null default 'USD',
  installments integer not null default 1 check (installments > 0),
  reason text not null,
  request_status text not null default 'borrador'
    constraint loan_requests_request_status_chk
    check (request_status in ('borrador', 'pendiente', 'en_aprobacion', 'aprobado', 'rechazado', 'cancelado')),
  approval_request_id uuid null references attendance.approval_requests(id) on delete set null,
  submitted_at timestamptz null,
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.salary_advance_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  amount_requested numeric not null check (amount_requested > 0),
  currency_code text not null default 'USD',
  requested_pay_date date null,
  reason text not null,
  request_status text not null default 'borrador'
    constraint salary_advance_requests_request_status_chk
    check (request_status in ('borrador', 'pendiente', 'en_aprobacion', 'aprobado', 'rechazado', 'cancelado')),
  approval_request_id uuid null references attendance.approval_requests(id) on delete set null,
  submitted_at timestamptz null,
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days_requested numeric not null check (days_requested > 0),
  available_balance_days numeric null,
  reason text null,
  request_status text not null default 'borrador'
    constraint vacation_requests_request_status_chk
    check (request_status in ('borrador', 'pendiente', 'en_aprobacion', 'aprobado', 'rechazado', 'cancelado')),
  approval_request_id uuid null references attendance.approval_requests(id) on delete set null,
  submitted_at timestamptz null,
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vacation_requests_dates_chk check (end_date >= start_date)
);

-- -------------------------------------------------------
-- 5) Indices
-- -------------------------------------------------------

create index if not exists idx_approval_flow_definitions_tenant on attendance.approval_flow_definitions (tenant_id, flow_code);
create index if not exists idx_approval_flow_steps_definition on attendance.approval_flow_steps (flow_definition_id, step_order);
create index if not exists idx_approval_approver_groups_tenant on attendance.approval_approver_groups (tenant_id, group_kind, is_active);
create index if not exists idx_approval_approver_group_members_group on attendance.approval_approver_group_members (group_id);
create index if not exists idx_approval_requests_tenant_status on attendance.approval_requests (tenant_id, overall_status, current_step_order, created_at desc);
create index if not exists idx_approval_requests_source on attendance.approval_requests (tenant_id, source_table, source_record_id);
create index if not exists idx_approval_request_steps_request on attendance.approval_request_steps (approval_request_id, step_order, status);
create index if not exists idx_approval_request_steps_assigned_user on attendance.approval_request_steps (tenant_id, assigned_user_id, status, activated_at);
create index if not exists idx_approval_request_steps_assigned_group on attendance.approval_request_steps (tenant_id, assigned_group_id, status, activated_at);
create index if not exists idx_approval_request_steps_candidate_users on attendance.approval_request_steps using gin (candidate_user_ids);
create index if not exists idx_approval_action_audit_request on attendance.approval_action_audit (approval_request_id, created_at desc);
create index if not exists idx_attendance_justifications_tenant_employee on attendance.attendance_justifications (tenant_id, employee_id, work_date desc);
create index if not exists idx_permission_requests_tenant_employee on attendance.permission_requests (tenant_id, employee_id, start_date desc);
create index if not exists idx_loan_requests_tenant_employee on attendance.loan_requests (tenant_id, employee_id, created_at desc);
create index if not exists idx_salary_advance_requests_tenant_employee on attendance.salary_advance_requests (tenant_id, employee_id, created_at desc);
create index if not exists idx_vacation_requests_tenant_employee on attendance.vacation_requests (tenant_id, employee_id, start_date desc);

-- -------------------------------------------------------
-- 6) Triggers de updated_at
-- -------------------------------------------------------

drop trigger if exists trg_approval_flow_definitions_updated_at on attendance.approval_flow_definitions;
create trigger trg_approval_flow_definitions_updated_at
before update on attendance.approval_flow_definitions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_approval_flow_steps_updated_at on attendance.approval_flow_steps;
create trigger trg_approval_flow_steps_updated_at
before update on attendance.approval_flow_steps
for each row execute function public.touch_updated_at();

drop trigger if exists trg_approval_approver_groups_updated_at on attendance.approval_approver_groups;
create trigger trg_approval_approver_groups_updated_at
before update on attendance.approval_approver_groups
for each row execute function public.touch_updated_at();

drop trigger if exists trg_approval_requests_updated_at on attendance.approval_requests;
create trigger trg_approval_requests_updated_at
before update on attendance.approval_requests
for each row execute function public.touch_updated_at();

drop trigger if exists trg_approval_request_steps_updated_at on attendance.approval_request_steps;
create trigger trg_approval_request_steps_updated_at
before update on attendance.approval_request_steps
for each row execute function public.touch_updated_at();

drop trigger if exists trg_attendance_justifications_updated_at on attendance.attendance_justifications;
create trigger trg_attendance_justifications_updated_at
before update on attendance.attendance_justifications
for each row execute function public.touch_updated_at();

drop trigger if exists trg_permission_requests_updated_at on attendance.permission_requests;
create trigger trg_permission_requests_updated_at
before update on attendance.permission_requests
for each row execute function public.touch_updated_at();

drop trigger if exists trg_loan_requests_updated_at on attendance.loan_requests;
create trigger trg_loan_requests_updated_at
before update on attendance.loan_requests
for each row execute function public.touch_updated_at();

drop trigger if exists trg_salary_advance_requests_updated_at on attendance.salary_advance_requests;
create trigger trg_salary_advance_requests_updated_at
before update on attendance.salary_advance_requests
for each row execute function public.touch_updated_at();

drop trigger if exists trg_vacation_requests_updated_at on attendance.vacation_requests;
create trigger trg_vacation_requests_updated_at
before update on attendance.vacation_requests
for each row execute function public.touch_updated_at();

-- -------------------------------------------------------
-- 7) Grants
-- -------------------------------------------------------

grant select on attendance.approval_flow_catalog to authenticated;
grant select on attendance.approval_flow_definitions to authenticated;
grant select on attendance.approval_flow_steps to authenticated;
grant select, insert, update, delete on attendance.approval_approver_groups to authenticated;
grant select, insert, update, delete on attendance.approval_approver_group_members to authenticated;
grant select on attendance.approval_requests to authenticated;
grant select on attendance.approval_request_steps to authenticated;
grant select on attendance.approval_action_audit to authenticated;

grant select, insert, update, delete on attendance.attendance_justifications to authenticated;
grant select, insert, update, delete on attendance.permission_requests to authenticated;
grant select, insert, update, delete on attendance.loan_requests to authenticated;
grant select, insert, update, delete on attendance.salary_advance_requests to authenticated;
grant select, insert, update, delete on attendance.vacation_requests to authenticated;

-- -------------------------------------------------------
-- 8) Helpers de resolucion y seguridad del motor
-- -------------------------------------------------------

create or replace function attendance.approval_role_candidates(
  p_tenant_id uuid,
  p_role_code text
)
returns uuid[]
language sql
stable
as $$
  with resolved_users as (
    select m.user_id as user_id
    from attendance.memberships m
    where m.tenant_id = p_tenant_id
      and m.role = p_role_code
    union
    select p.id as user_id
    from public.profiles p
    where p.tenant_id = p_tenant_id
      and p.role = p_role_code
  )
  select coalesce(array_agg(ru.user_id order by ru.user_id::text), '{}'::uuid[])
  from (
    select distinct user_id
    from resolved_users
    where user_id is not null
  ) ru;
$$;

create or replace function attendance.approval_group_candidates(
  p_tenant_id uuid,
  p_group_id uuid
)
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(src.user_id order by src.user_id::text), '{}'::uuid[])
  from (
    select distinct gm.user_id
    from attendance.approval_approver_group_members gm
    join attendance.approval_approver_groups g
      on g.id = gm.group_id
     and g.tenant_id = gm.tenant_id
    where gm.tenant_id = p_tenant_id
      and gm.group_id = p_group_id
      and g.is_active = true
      and gm.user_id is not null
  ) src;
$$;

create or replace function attendance.approval_special_candidates(
  p_tenant_id uuid,
  p_group_kind text
)
returns uuid[]
language plpgsql
stable
as $$
declare
  v_candidates uuid[];
begin
  select coalesce(array_agg(src.user_id order by src.user_id::text), '{}'::uuid[])
  into v_candidates
  from (
    select distinct gm.user_id
    from attendance.approval_approver_groups g
    join attendance.approval_approver_group_members gm
      on gm.group_id = g.id
     and gm.tenant_id = g.tenant_id
    where g.tenant_id = p_tenant_id
      and g.group_kind = p_group_kind
      and g.is_active = true
      and gm.user_id is not null
  ) src;

  if coalesce(array_length(v_candidates, 1), 0) > 0 then
    return v_candidates;
  end if;

  if p_group_kind = 'hr_responsible' then
    return attendance.approval_role_candidates(p_tenant_id, 'hr_admin')
      || attendance.approval_role_candidates(p_tenant_id, 'tenant_admin')
      || attendance.approval_role_candidates(p_tenant_id, 'admin');
  end if;

  if p_group_kind = 'payroll_responsible' then
    return attendance.approval_role_candidates(p_tenant_id, 'payroll_admin')
      || attendance.approval_role_candidates(p_tenant_id, 'payroll_manager')
      || attendance.approval_role_candidates(p_tenant_id, 'tenant_admin')
      || attendance.approval_role_candidates(p_tenant_id, 'admin');
  end if;

  return '{}'::uuid[];
end;
$$;

create or replace function attendance.approval_resolve_step_assignment(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_approver_type text,
  p_approver_role_code text default null,
  p_approver_user_id uuid default null,
  p_approver_group_id uuid default null,
  p_candidate_resolution text default 'shared_queue'
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_manager_employee_id uuid;
  v_candidates uuid[] := '{}'::uuid[];
  v_primary_user_id uuid := null;
  v_assigned_group_id uuid := null;
  v_assigned_role_code text := null;
  v_shared_queue boolean := false;
begin
  case p_approver_type
    when 'specific_user' then
      if p_approver_user_id is null then
        raise exception 'El paso requiere approver_user_id para specific_user';
      end if;
      v_candidates := array[p_approver_user_id];
      v_primary_user_id := p_approver_user_id;

    when 'manager' then
      v_manager_employee_id := attendance.approval_get_manager_employee_id(p_tenant_id, p_employee_id, 1);
      if v_manager_employee_id is null then
        raise exception 'No se pudo resolver el supervisor inmediato para el empleado %', p_employee_id;
      end if;
      v_primary_user_id := attendance.approval_employee_user_id(v_manager_employee_id);
      if v_primary_user_id is null then
        raise exception 'El supervisor inmediato no tiene usuario asociado';
      end if;
      v_candidates := array[v_primary_user_id];

    when 'manager_of_manager' then
      v_manager_employee_id := attendance.approval_get_manager_employee_id(p_tenant_id, p_employee_id, 2);
      if v_manager_employee_id is null then
        raise exception 'No se pudo resolver el jefe del jefe para el empleado %', p_employee_id;
      end if;
      v_primary_user_id := attendance.approval_employee_user_id(v_manager_employee_id);
      if v_primary_user_id is null then
        raise exception 'El jefe del jefe no tiene usuario asociado';
      end if;
      v_candidates := array[v_primary_user_id];

    when 'role' then
      v_candidates := attendance.approval_role_candidates(p_tenant_id, p_approver_role_code);
      v_assigned_role_code := p_approver_role_code;

    when 'approver_group' then
      v_candidates := attendance.approval_group_candidates(p_tenant_id, p_approver_group_id);
      v_assigned_group_id := p_approver_group_id;

    when 'hr_responsible' then
      v_candidates := attendance.approval_special_candidates(p_tenant_id, 'hr_responsible');

    when 'payroll_responsible' then
      v_candidates := attendance.approval_special_candidates(p_tenant_id, 'payroll_responsible');

    else
      raise exception 'Tipo de aprobador no soportado: %', p_approver_type;
  end case;

  select coalesce(array_agg(x order by x::text), '{}'::uuid[])
  into v_candidates
  from (
    select distinct x
    from unnest(coalesce(v_candidates, '{}'::uuid[])) as x
    where x is not null
  ) dedup;

  if coalesce(array_length(v_candidates, 1), 0) = 0 then
    raise exception 'No se pudo resolver ningun aprobador para el tipo %', p_approver_type;
  end if;

  if coalesce(array_length(v_candidates, 1), 0) = 1 then
    v_primary_user_id := v_candidates[1];
    v_shared_queue := false;
  elsif coalesce(p_candidate_resolution, 'shared_queue') = 'first_available' then
    v_primary_user_id := v_candidates[1];
    v_shared_queue := false;
  else
    v_primary_user_id := null;
    v_shared_queue := true;
  end if;

  return jsonb_build_object(
    'candidate_user_ids', to_jsonb(v_candidates),
    'assigned_user_id', v_primary_user_id,
    'assigned_group_id', v_assigned_group_id,
    'assigned_role_code', v_assigned_role_code,
    'shared_queue', v_shared_queue
  );
end;
$$;

create or replace function attendance.approval_user_can_act_on_request(
  p_approval_request_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
begin
  if p_user_id is null or v_tenant_id is null then
    return false;
  end if;

  return exists (
    select 1
    from attendance.approval_requests r
    join attendance.approval_request_steps s
      on s.approval_request_id = r.id
     and s.tenant_id = r.tenant_id
    where r.id = p_approval_request_id
      and r.tenant_id = v_tenant_id
      and r.overall_status = 'en_aprobacion'
      and s.status = 'pendiente'
      and s.activated_at is not null
      and (
        s.assigned_user_id = p_user_id
        or p_user_id = any(s.candidate_user_ids)
      )
  );
end;
$$;

create or replace function attendance.approval_user_can_view_request(
  p_approval_request_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = attendance, public
as $$
declare
  v_current_employee_id uuid := attendance.approval_current_employee_id();
  v_tenant_id uuid := attendance.approval_current_tenant_id();
begin
  if p_user_id is null or v_tenant_id is null then
    return false;
  end if;

  if attendance.approval_can_manage_config() then
    return exists (
      select 1
      from attendance.approval_requests r
      where r.id = p_approval_request_id
        and r.tenant_id = v_tenant_id
    );
  end if;

  return exists (
    select 1
    from attendance.approval_requests r
    where r.id = p_approval_request_id
      and r.tenant_id = v_tenant_id
      and (
        r.requested_by_user_id = p_user_id
        or (v_current_employee_id is not null and r.requested_by_employee_id = v_current_employee_id)
        or attendance.approval_user_can_act_on_request(r.id, p_user_id)
      )
  );
end;
$$;

create or replace function attendance.approval_update_source_request_status(
  p_source_table text,
  p_source_record_id uuid,
  p_request_status text,
  p_approval_request_id uuid default null,
  p_submitted_at timestamptz default null,
  p_resolved_at timestamptz default null,
  p_resolved_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
begin
  if p_source_table not in (
    'attendance_justifications',
    'permission_requests',
    'loan_requests',
    'salary_advance_requests',
    'vacation_requests'
  ) then
    raise exception 'Tabla origen no permitida: %', p_source_table;
  end if;

  execute format(
    'update attendance.%I
        set request_status = $1,
            approval_request_id = coalesce($2, approval_request_id),
            submitted_at = coalesce($3, submitted_at),
            resolved_at = $4,
            resolved_by = $5,
            updated_at = now()
      where id = $6
        and tenant_id = $7',
    p_source_table
  )
  using
    p_request_status,
    p_approval_request_id,
    p_submitted_at,
    p_resolved_at,
    p_resolved_by,
    p_source_record_id,
    v_tenant_id;

  if p_source_table = 'attendance_justifications' then
    update attendance.attendance_justifications
       set reviewed_at = p_resolved_at,
           reviewed_by = p_resolved_by
     where id = p_source_record_id
       and tenant_id = v_tenant_id;
  end if;
end;
$$;

create or replace function attendance.approval_get_source_record(
  p_source_table text,
  p_source_record_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
  v_payload jsonb;
begin
  if p_source_table not in (
    'attendance_justifications',
    'permission_requests',
    'loan_requests',
    'salary_advance_requests',
    'vacation_requests'
  ) then
    return '{}'::jsonb;
  end if;

  execute format(
    'select to_jsonb(t) from attendance.%I t where t.id = $1 and t.tenant_id = $2',
    p_source_table
  )
  into v_payload
  using p_source_record_id, v_tenant_id;

  return coalesce(v_payload, '{}'::jsonb);
end;
$$;

create or replace function attendance.approval_finalize_request_state(
  p_approval_request_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_request attendance.approval_requests%rowtype;
  v_has_active_pending boolean;
  v_has_inactive_pending boolean;
  v_has_required_rejection boolean;
  v_next_step_order integer;
begin
  select *
  into v_request
  from attendance.approval_requests r
  where r.id = p_approval_request_id;

  if not found then
    raise exception 'Solicitud de aprobacion no encontrada';
  end if;

  select exists (
    select 1
    from attendance.approval_request_steps s
    where s.approval_request_id = p_approval_request_id
      and s.status = 'pendiente'
      and s.activated_at is not null
  )
  into v_has_active_pending;

  select exists (
    select 1
    from attendance.approval_request_steps s
    where s.approval_request_id = p_approval_request_id
      and s.status = 'pendiente'
      and s.activated_at is null
  )
  into v_has_inactive_pending;

  select exists (
    select 1
    from attendance.approval_request_steps s
    where s.approval_request_id = p_approval_request_id
      and s.is_required = true
      and s.status = 'rechazado'
  )
  into v_has_required_rejection;

  if v_request.reject_any_step_closes and v_has_required_rejection then
    update attendance.approval_request_steps
       set status = 'omitido',
           updated_at = now()
     where approval_request_id = p_approval_request_id
       and status = 'pendiente';

    update attendance.approval_requests
       set overall_status = 'rechazado',
           current_step_order = null,
           final_decision_at = now(),
           final_decision_by = p_actor_user_id,
           updated_at = now()
     where id = p_approval_request_id;

    perform attendance.approval_update_source_request_status(
      v_request.source_table,
      v_request.source_record_id,
      'rechazado',
      v_request.id,
      null,
      now(),
      p_actor_user_id
    );
    return;
  end if;

  if v_has_active_pending then
    update attendance.approval_requests
       set current_step_order = (
             select min(s.step_order)
             from attendance.approval_request_steps s
             where s.approval_request_id = p_approval_request_id
               and s.status = 'pendiente'
               and s.activated_at is not null
           ),
           overall_status = 'en_aprobacion',
           updated_at = now()
     where id = p_approval_request_id;
    return;
  end if;

  if v_request.execution_mode = 'sequential'
     and v_request.activate_next_on_approval
     and not v_has_required_rejection
     and v_has_inactive_pending then
    select min(s.step_order)
    into v_next_step_order
    from attendance.approval_request_steps s
    where s.approval_request_id = p_approval_request_id
      and s.status = 'pendiente'
      and s.activated_at is null;

    update attendance.approval_request_steps
       set activated_at = now(),
           updated_at = now()
     where approval_request_id = p_approval_request_id
       and step_order = v_next_step_order
       and status = 'pendiente';

    update attendance.approval_requests
       set current_step_order = v_next_step_order,
           overall_status = 'en_aprobacion',
           updated_at = now()
     where id = p_approval_request_id;
    return;
  end if;

  if v_has_required_rejection then
    update attendance.approval_request_steps
       set status = 'omitido',
           updated_at = now()
     where approval_request_id = p_approval_request_id
       and status = 'pendiente';

    update attendance.approval_requests
       set overall_status = 'rechazado',
           current_step_order = null,
           final_decision_at = now(),
           final_decision_by = p_actor_user_id,
           updated_at = now()
     where id = p_approval_request_id;

    perform attendance.approval_update_source_request_status(
      v_request.source_table,
      v_request.source_record_id,
      'rechazado',
      v_request.id,
      null,
      now(),
      p_actor_user_id
    );
    return;
  end if;

  update attendance.approval_requests
     set overall_status = 'aprobado',
         current_step_order = null,
         final_decision_at = now(),
         final_decision_by = p_actor_user_id,
         updated_at = now()
   where id = p_approval_request_id;

  perform attendance.approval_update_source_request_status(
    v_request.source_table,
    v_request.source_record_id,
    'aprobado',
    v_request.id,
    null,
    now(),
    p_actor_user_id
  );
end;
$$;

-- -------------------------------------------------------
-- 9) Vista resumen para UI de configuracion
-- -------------------------------------------------------

create or replace view attendance.v_approval_flow_summary as
select
  c.flow_code,
  c.flow_name as catalog_flow_name,
  c.applies_to_module,
  c.source_table,
  c.description,
  d.id as flow_definition_id,
  d.tenant_id,
  d.flow_name as tenant_flow_name,
  d.is_active as configured_is_active,
  d.execution_mode,
  d.reject_any_step_closes,
  d.activate_next_on_approval,
  d.allow_auto_first_step,
  d.updated_at,
  (d.id is not null) as is_configured,
  coalesce(sc.step_count, jsonb_array_length(c.fallback_strategy), 0) as level_count,
  coalesce(fs.step_name, c.fallback_strategy -> 0 ->> 'step_name') as first_step_name,
  coalesce(fs.approver_type, c.fallback_strategy -> 0 ->> 'approver_type') as first_approver_type
from attendance.approval_flow_catalog c
left join attendance.approval_flow_definitions d
  on d.flow_code = c.flow_code
 and d.tenant_id = attendance.approval_current_tenant_id()
left join lateral (
  select count(*)::int as step_count
  from attendance.approval_flow_steps s
  where s.flow_definition_id = d.id
) sc on true
left join lateral (
  select s.step_name, s.approver_type
  from attendance.approval_flow_steps s
  where s.flow_definition_id = d.id
  order by s.step_order
  limit 1
) fs on true
where c.is_active = true;

grant select on attendance.v_approval_flow_summary to authenticated;

-- -------------------------------------------------------
-- 10) RLS
-- -------------------------------------------------------

alter table attendance.approval_flow_definitions enable row level security;
alter table attendance.approval_approver_groups enable row level security;
alter table attendance.approval_approver_group_members enable row level security;
alter table attendance.approval_flow_steps enable row level security;
alter table attendance.approval_requests enable row level security;
alter table attendance.approval_request_steps enable row level security;
alter table attendance.approval_action_audit enable row level security;
alter table attendance.attendance_justifications enable row level security;
alter table attendance.permission_requests enable row level security;
alter table attendance.loan_requests enable row level security;
alter table attendance.salary_advance_requests enable row level security;
alter table attendance.vacation_requests enable row level security;

drop policy if exists approval_flow_definitions_select on attendance.approval_flow_definitions;
create policy approval_flow_definitions_select
on attendance.approval_flow_definitions
for select to authenticated
using (tenant_id = attendance.approval_current_tenant_id());

drop policy if exists approval_approver_groups_select on attendance.approval_approver_groups;
create policy approval_approver_groups_select
on attendance.approval_approver_groups
for select to authenticated
using (tenant_id = attendance.approval_current_tenant_id());

drop policy if exists approval_approver_groups_write on attendance.approval_approver_groups;
create policy approval_approver_groups_write
on attendance.approval_approver_groups
for all to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and attendance.approval_can_manage_config()
)
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and attendance.approval_can_manage_config()
);

drop policy if exists approval_approver_group_members_select on attendance.approval_approver_group_members;
create policy approval_approver_group_members_select
on attendance.approval_approver_group_members
for select to authenticated
using (tenant_id = attendance.approval_current_tenant_id());

drop policy if exists approval_approver_group_members_write on attendance.approval_approver_group_members;
create policy approval_approver_group_members_write
on attendance.approval_approver_group_members
for all to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and attendance.approval_can_manage_config()
)
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and attendance.approval_can_manage_config()
);

drop policy if exists approval_flow_steps_select on attendance.approval_flow_steps;
create policy approval_flow_steps_select
on attendance.approval_flow_steps
for select to authenticated
using (tenant_id = attendance.approval_current_tenant_id());

drop policy if exists approval_requests_select on attendance.approval_requests;
create policy approval_requests_select
on attendance.approval_requests
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and attendance.approval_user_can_view_request(id)
);

drop policy if exists approval_request_steps_select on attendance.approval_request_steps;
create policy approval_request_steps_select
on attendance.approval_request_steps
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and attendance.approval_user_can_view_request(approval_request_id)
);

drop policy if exists approval_action_audit_select on attendance.approval_action_audit;
create policy approval_action_audit_select
on attendance.approval_action_audit
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and attendance.approval_user_can_view_request(approval_request_id)
);

drop policy if exists attendance_justifications_select on attendance.attendance_justifications;
create policy attendance_justifications_select
on attendance.attendance_justifications
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
    or (
      approval_request_id is not null
      and attendance.approval_user_can_view_request(approval_request_id)
    )
  )
);

drop policy if exists attendance_justifications_insert on attendance.attendance_justifications;
create policy attendance_justifications_insert
on attendance.attendance_justifications
for insert to authenticated
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
  )
);

drop policy if exists attendance_justifications_update on attendance.attendance_justifications;
create policy attendance_justifications_update
on attendance.attendance_justifications
for update to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
)
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
);

drop policy if exists attendance_justifications_delete on attendance.attendance_justifications;
create policy attendance_justifications_delete
on attendance.attendance_justifications
for delete to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado', 'cancelado')
    )
  )
);

drop policy if exists permission_requests_select on attendance.permission_requests;
create policy permission_requests_select
on attendance.permission_requests
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
    or (
      approval_request_id is not null
      and attendance.approval_user_can_view_request(approval_request_id)
    )
  )
);

drop policy if exists permission_requests_insert on attendance.permission_requests;
create policy permission_requests_insert
on attendance.permission_requests
for insert to authenticated
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
  )
);

drop policy if exists permission_requests_update on attendance.permission_requests;
create policy permission_requests_update
on attendance.permission_requests
for update to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
)
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
);

drop policy if exists permission_requests_delete on attendance.permission_requests;
create policy permission_requests_delete
on attendance.permission_requests
for delete to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado', 'cancelado')
    )
  )
);

drop policy if exists loan_requests_select on attendance.loan_requests;
create policy loan_requests_select
on attendance.loan_requests
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
    or (
      approval_request_id is not null
      and attendance.approval_user_can_view_request(approval_request_id)
    )
  )
);

drop policy if exists loan_requests_insert on attendance.loan_requests;
create policy loan_requests_insert
on attendance.loan_requests
for insert to authenticated
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
  )
);

drop policy if exists loan_requests_update on attendance.loan_requests;
create policy loan_requests_update
on attendance.loan_requests
for update to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
)
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
);

drop policy if exists loan_requests_delete on attendance.loan_requests;
create policy loan_requests_delete
on attendance.loan_requests
for delete to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado', 'cancelado')
    )
  )
);

drop policy if exists salary_advance_requests_select on attendance.salary_advance_requests;
create policy salary_advance_requests_select
on attendance.salary_advance_requests
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
    or (
      approval_request_id is not null
      and attendance.approval_user_can_view_request(approval_request_id)
    )
  )
);

drop policy if exists salary_advance_requests_insert on attendance.salary_advance_requests;
create policy salary_advance_requests_insert
on attendance.salary_advance_requests
for insert to authenticated
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
  )
);

drop policy if exists salary_advance_requests_update on attendance.salary_advance_requests;
create policy salary_advance_requests_update
on attendance.salary_advance_requests
for update to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
)
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
);

drop policy if exists salary_advance_requests_delete on attendance.salary_advance_requests;
create policy salary_advance_requests_delete
on attendance.salary_advance_requests
for delete to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado', 'cancelado')
    )
  )
);

drop policy if exists vacation_requests_select on attendance.vacation_requests;
create policy vacation_requests_select
on attendance.vacation_requests
for select to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
    or (
      approval_request_id is not null
      and attendance.approval_user_can_view_request(approval_request_id)
    )
  )
);

drop policy if exists vacation_requests_insert on attendance.vacation_requests;
create policy vacation_requests_insert
on attendance.vacation_requests
for insert to authenticated
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    employee_id = attendance.approval_current_employee_id()
    or attendance.approval_can_manage_config()
  )
);

drop policy if exists vacation_requests_update on attendance.vacation_requests;
create policy vacation_requests_update
on attendance.vacation_requests
for update to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
)
with check (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado')
    )
  )
);

drop policy if exists vacation_requests_delete on attendance.vacation_requests;
create policy vacation_requests_delete
on attendance.vacation_requests
for delete to authenticated
using (
  tenant_id = attendance.approval_current_tenant_id()
  and (
    attendance.approval_can_manage_config()
    or (
      employee_id = attendance.approval_current_employee_id()
      and request_status in ('borrador', 'rechazado', 'cancelado')
    )
  )
);

-- -------------------------------------------------------
-- 11) RPCs del motor
-- -------------------------------------------------------

create or replace function attendance.rpc_upsert_flow_definition(
  p_flow_code text,
  p_flow_name text,
  p_applies_to_module text,
  p_description text default null,
  p_is_active boolean default true,
  p_execution_mode text default 'sequential',
  p_reject_any_step_closes boolean default true,
  p_activate_next_on_approval boolean default true,
  p_allow_auto_first_step boolean default false,
  p_steps jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
  v_definition_id uuid;
  v_row jsonb;
  v_step_order integer := 0;
begin
  if v_tenant_id is null then
    raise exception 'No se pudo resolver el tenant activo';
  end if;

  if not attendance.approval_can_manage_config() then
    raise exception 'No autorizado para configurar flujos';
  end if;

  if not exists (
    select 1
    from attendance.approval_flow_catalog c
    where c.flow_code = p_flow_code
      and c.is_active = true
  ) then
    raise exception 'Flow code no existe o esta inactivo: %', p_flow_code;
  end if;

  insert into attendance.approval_flow_definitions (
    tenant_id,
    flow_code,
    flow_name,
    is_active,
    applies_to_module,
    description,
    execution_mode,
    reject_any_step_closes,
    activate_next_on_approval,
    allow_auto_first_step,
    created_by,
    updated_by
  )
  values (
    v_tenant_id,
    p_flow_code,
    p_flow_name,
    coalesce(p_is_active, true),
    p_applies_to_module,
    p_description,
    coalesce(p_execution_mode, 'sequential'),
    coalesce(p_reject_any_step_closes, true),
    coalesce(p_activate_next_on_approval, true),
    coalesce(p_allow_auto_first_step, false),
    auth.uid(),
    auth.uid()
  )
  on conflict (tenant_id, flow_code) do update set
    flow_name = excluded.flow_name,
    is_active = excluded.is_active,
    applies_to_module = excluded.applies_to_module,
    description = excluded.description,
    execution_mode = excluded.execution_mode,
    reject_any_step_closes = excluded.reject_any_step_closes,
    activate_next_on_approval = excluded.activate_next_on_approval,
    allow_auto_first_step = excluded.allow_auto_first_step,
    updated_by = auth.uid(),
    updated_at = now()
  returning id into v_definition_id;

  delete from attendance.approval_flow_steps
  where flow_definition_id = v_definition_id;

  if jsonb_typeof(coalesce(p_steps, '[]'::jsonb)) <> 'array' then
    raise exception 'p_steps debe ser un arreglo JSON';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb))
  loop
    v_step_order := coalesce((v_row ->> 'step_order')::integer, v_step_order + 1);

    insert into attendance.approval_flow_steps (
      flow_definition_id,
      tenant_id,
      step_order,
      step_name,
      approver_type,
      approver_role_code,
      approver_user_id,
      approver_group_id,
      is_required,
      allow_delegate,
      parallel_group,
      candidate_resolution,
      auto_rule_enabled,
      auto_rule
    )
    values (
      v_definition_id,
      v_tenant_id,
      v_step_order,
      coalesce(nullif(v_row ->> 'step_name', ''), 'Nivel ' || v_step_order),
      nullif(v_row ->> 'approver_type', ''),
      nullif(v_row ->> 'approver_role_code', ''),
      nullif(v_row ->> 'approver_user_id', '')::uuid,
      nullif(v_row ->> 'approver_group_id', '')::uuid,
      coalesce((v_row ->> 'is_required')::boolean, true),
      coalesce((v_row ->> 'allow_delegate')::boolean, false),
      nullif(v_row ->> 'parallel_group', ''),
      coalesce(nullif(v_row ->> 'candidate_resolution', ''), 'shared_queue'),
      coalesce((v_row ->> 'auto_rule_enabled')::boolean, false),
      coalesce(v_row -> 'auto_rule', '{}'::jsonb)
    );
  end loop;

  return v_definition_id;
end;
$$;

create or replace function attendance.rpc_submit_approval_request(
  p_flow_code text,
  p_source_table text,
  p_source_record_id uuid,
  p_requested_by_user_id uuid,
  p_requested_by_employee_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
  v_definition attendance.approval_flow_definitions%rowtype;
  v_request_id uuid;
  v_effective_employee_id uuid;
  v_catalog attendance.approval_flow_catalog%rowtype;
  v_assignment jsonb;
  v_step_row record;
  v_should_activate_all boolean;
  v_initial_step_order integer;
  v_source_exists boolean;
  v_source_employee_id uuid;
  v_vacation_days_requested numeric;
  v_vacation_balance numeric;
begin
  if v_tenant_id is null then
    raise exception 'No se pudo resolver el tenant activo';
  end if;

  if auth.uid() is distinct from p_requested_by_user_id
     and not attendance.approval_can_manage_config() then
    raise exception 'No autorizado para enviar solicitudes por otro usuario';
  end if;

  select *
  into v_catalog
  from attendance.approval_flow_catalog c
  where c.flow_code = p_flow_code
    and c.is_active = true;

  if not found then
    raise exception 'No existe catalogo activo para el flujo %', p_flow_code;
  end if;

  if v_catalog.source_table <> p_source_table then
    raise exception 'Flow % debe usarse con la tabla % y no con %', p_flow_code, v_catalog.source_table, p_source_table;
  end if;

  execute format(
    'select exists(select 1 from attendance.%I t where t.id = $1 and t.tenant_id = $2)',
    p_source_table
  )
  into v_source_exists
  using p_source_record_id, v_tenant_id;

  if not coalesce(v_source_exists, false) then
    raise exception 'No existe registro origen % en % para el tenant actual', p_source_record_id, p_source_table;
  end if;

  v_effective_employee_id := coalesce(
    p_requested_by_employee_id,
    attendance.approval_current_employee_id(),
    (
      select e.id
      from public.employees e
      where e.user_id = p_requested_by_user_id
        and e.tenant_id = v_tenant_id
      limit 1
    )
  );

  execute format(
    'select t.employee_id from attendance.%I t where t.id = $1 and t.tenant_id = $2',
    p_source_table
  )
  into v_source_employee_id
  using p_source_record_id, v_tenant_id;

  if not attendance.approval_can_manage_config()
     and v_source_employee_id is distinct from v_effective_employee_id then
    raise exception 'El usuario actual no puede enviar solicitudes de otro colaborador';
  end if;

  if p_source_table = 'vacation_requests' then
    select vr.days_requested, vr.available_balance_days
    into v_vacation_days_requested, v_vacation_balance
    from attendance.vacation_requests vr
    where vr.id = p_source_record_id
      and vr.tenant_id = v_tenant_id;

    if v_vacation_balance is not null
       and v_vacation_days_requested > v_vacation_balance then
      raise exception 'La solicitud excede el saldo disponible de vacaciones';
    end if;
  end if;

  select *
  into v_definition
  from attendance.approval_flow_definitions d
  where d.tenant_id = v_tenant_id
    and d.flow_code = p_flow_code
    and d.is_active = true;

  insert into attendance.approval_requests (
    tenant_id,
    flow_definition_id,
    flow_code,
    source_table,
    source_record_id,
    requested_by_user_id,
    requested_by_employee_id,
    overall_status,
    execution_mode,
    reject_any_step_closes,
    activate_next_on_approval,
    metadata
  )
  values (
    v_tenant_id,
    v_definition.id,
    p_flow_code,
    p_source_table,
    p_source_record_id,
    p_requested_by_user_id,
    v_effective_employee_id,
    'en_aprobacion',
    coalesce(v_definition.execution_mode, 'sequential'),
    coalesce(v_definition.reject_any_step_closes, true),
    coalesce(v_definition.activate_next_on_approval, true),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (tenant_id, flow_code, source_table, source_record_id) do update set
    flow_definition_id = excluded.flow_definition_id,
    requested_by_user_id = excluded.requested_by_user_id,
    requested_by_employee_id = excluded.requested_by_employee_id,
    current_step_order = null,
    overall_status = 'en_aprobacion',
    execution_mode = excluded.execution_mode,
    reject_any_step_closes = excluded.reject_any_step_closes,
    activate_next_on_approval = excluded.activate_next_on_approval,
    final_decision_at = null,
    final_decision_by = null,
    metadata = coalesce(attendance.approval_requests.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id into v_request_id;

  delete from attendance.approval_request_steps
  where approval_request_id = v_request_id;

  v_should_activate_all := coalesce(v_definition.execution_mode, 'sequential') = 'parallel'
    or coalesce(v_definition.activate_next_on_approval, true) = false;

  if v_definition.id is not null then
    for v_step_row in
      select *
      from attendance.approval_flow_steps s
      where s.flow_definition_id = v_definition.id
      order by s.step_order
    loop
      v_assignment := attendance.approval_resolve_step_assignment(
        v_tenant_id,
        v_effective_employee_id,
        v_step_row.approver_type,
        v_step_row.approver_role_code,
        v_step_row.approver_user_id,
        v_step_row.approver_group_id,
        v_step_row.candidate_resolution
      );

      insert into attendance.approval_request_steps (
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
        is_required,
        allow_delegate,
        parallel_group
      )
      values (
        v_tenant_id,
        v_request_id,
        v_step_row.id,
        v_step_row.step_order,
        v_step_row.step_name,
        v_step_row.approver_type,
        nullif(v_assignment ->> 'assigned_user_id', '')::uuid,
        nullif(v_assignment ->> 'assigned_role_code', ''),
        nullif(v_assignment ->> 'assigned_group_id', '')::uuid,
        coalesce(
          array(
            select jsonb_array_elements_text(coalesce(v_assignment -> 'candidate_user_ids', '[]'::jsonb))::uuid
          ),
          '{}'::uuid[]
        ),
        v_step_row.candidate_resolution,
        'pendiente',
        case
          when v_should_activate_all or v_step_row.step_order = 1 then now()
          else null
        end,
        v_step_row.is_required,
        v_step_row.allow_delegate,
        v_step_row.parallel_group
      );
    end loop;
  else
    for v_step_row in
      select value as fallback_step
      from jsonb_array_elements(v_catalog.fallback_strategy)
    loop
      v_assignment := attendance.approval_resolve_step_assignment(
        v_tenant_id,
        v_effective_employee_id,
        nullif(v_step_row.fallback_step ->> 'approver_type', ''),
        nullif(v_step_row.fallback_step ->> 'approver_role_code', ''),
        nullif(v_step_row.fallback_step ->> 'approver_user_id', '')::uuid,
        nullif(v_step_row.fallback_step ->> 'approver_group_id', '')::uuid,
        coalesce(nullif(v_step_row.fallback_step ->> 'candidate_resolution', ''), 'shared_queue')
      );

      insert into attendance.approval_request_steps (
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
        is_required,
        allow_delegate,
        parallel_group
      )
      values (
        v_tenant_id,
        v_request_id,
        null,
        coalesce((v_step_row.fallback_step ->> 'step_order')::integer, 1),
        coalesce(nullif(v_step_row.fallback_step ->> 'step_name', ''), 'Nivel fallback'),
        nullif(v_step_row.fallback_step ->> 'approver_type', ''),
        nullif(v_assignment ->> 'assigned_user_id', '')::uuid,
        nullif(v_assignment ->> 'assigned_role_code', ''),
        nullif(v_assignment ->> 'assigned_group_id', '')::uuid,
        coalesce(
          array(
            select jsonb_array_elements_text(coalesce(v_assignment -> 'candidate_user_ids', '[]'::jsonb))::uuid
          ),
          '{}'::uuid[]
        ),
        coalesce(nullif(v_step_row.fallback_step ->> 'candidate_resolution', ''), 'shared_queue'),
        'pendiente',
        case
          when v_should_activate_all or coalesce((v_step_row.fallback_step ->> 'step_order')::integer, 1) = 1 then now()
          else null
        end,
        coalesce((v_step_row.fallback_step ->> 'is_required')::boolean, true),
        coalesce((v_step_row.fallback_step ->> 'allow_delegate')::boolean, false),
        nullif(v_step_row.fallback_step ->> 'parallel_group', '')
      );
    end loop;
  end if;

  select min(s.step_order)
  into v_initial_step_order
  from attendance.approval_request_steps s
  where s.approval_request_id = v_request_id
    and s.status = 'pendiente'
    and s.activated_at is not null;

  update attendance.approval_requests
     set current_step_order = v_initial_step_order,
         overall_status = 'en_aprobacion',
         updated_at = now()
   where id = v_request_id;

  insert into attendance.approval_action_audit (
    tenant_id,
    approval_request_id,
    action,
    acted_by_user_id,
    comments,
    metadata
  )
  values (
    v_tenant_id,
    v_request_id,
    'submit',
    auth.uid(),
    null,
    jsonb_build_object(
      'flow_definition_id', v_definition.id,
      'used_fallback', v_definition.id is null
    )
  );

  perform attendance.approval_update_source_request_status(
    p_source_table,
    p_source_record_id,
    'en_aprobacion',
    v_request_id,
    now(),
    null,
    null
  );

  return v_request_id;
end;
$$;

create or replace function attendance.rpc_approve_request(
  p_approval_request_id uuid,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
  v_step attendance.approval_request_steps%rowtype;
begin
  if trim(coalesce(p_comment, '')) = '' then
    raise exception 'El comentario de aprobacion es obligatorio';
  end if;

  if v_tenant_id is null then
    raise exception 'No se pudo resolver el tenant activo';
  end if;

  select s.*
  into v_step
  from attendance.approval_request_steps s
  join attendance.approval_requests r on r.id = s.approval_request_id
  where s.approval_request_id = p_approval_request_id
    and s.tenant_id = v_tenant_id
    and r.overall_status = 'en_aprobacion'
    and s.status = 'pendiente'
    and s.activated_at is not null
    and (
      s.assigned_user_id = auth.uid()
      or auth.uid() = any(s.candidate_user_ids)
    )
  order by s.step_order
  limit 1;

  if not found then
    raise exception 'No existe un paso pendiente para el usuario actual';
  end if;

  update attendance.approval_request_steps
     set status = 'aprobado',
         acted_at = now(),
         acted_by_user_id = auth.uid(),
         comments = trim(p_comment),
         assigned_user_id = coalesce(assigned_user_id, auth.uid()),
         updated_at = now()
   where id = v_step.id;

  insert into attendance.approval_action_audit (
    tenant_id,
    approval_request_id,
    approval_request_step_id,
    action,
    acted_by_user_id,
    comments
  )
  values (
    v_tenant_id,
    p_approval_request_id,
    v_step.id,
    'approve',
    auth.uid(),
    trim(p_comment)
  );

  perform attendance.approval_finalize_request_state(p_approval_request_id, auth.uid());

  return p_approval_request_id;
end;
$$;

create or replace function attendance.rpc_reject_request(
  p_approval_request_id uuid,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
  v_step attendance.approval_request_steps%rowtype;
begin
  if trim(coalesce(p_comment, '')) = '' then
    raise exception 'El comentario de rechazo es obligatorio';
  end if;

  if v_tenant_id is null then
    raise exception 'No se pudo resolver el tenant activo';
  end if;

  select s.*
  into v_step
  from attendance.approval_request_steps s
  join attendance.approval_requests r on r.id = s.approval_request_id
  where s.approval_request_id = p_approval_request_id
    and s.tenant_id = v_tenant_id
    and r.overall_status = 'en_aprobacion'
    and s.status = 'pendiente'
    and s.activated_at is not null
    and (
      s.assigned_user_id = auth.uid()
      or auth.uid() = any(s.candidate_user_ids)
    )
  order by s.step_order
  limit 1;

  if not found then
    raise exception 'No existe un paso pendiente para el usuario actual';
  end if;

  update attendance.approval_request_steps
     set status = 'rechazado',
         acted_at = now(),
         acted_by_user_id = auth.uid(),
         comments = trim(p_comment),
         assigned_user_id = coalesce(assigned_user_id, auth.uid()),
         updated_at = now()
   where id = v_step.id;

  insert into attendance.approval_action_audit (
    tenant_id,
    approval_request_id,
    approval_request_step_id,
    action,
    acted_by_user_id,
    comments
  )
  values (
    v_tenant_id,
    p_approval_request_id,
    v_step.id,
    'reject',
    auth.uid(),
    trim(p_comment)
  );

  perform attendance.approval_finalize_request_state(p_approval_request_id, auth.uid());

  return p_approval_request_id;
end;
$$;

create or replace function attendance.rpc_get_pending_approvals()
returns table (
  approval_request_id uuid,
  approval_request_step_id uuid,
  flow_code text,
  flow_name text,
  source_table text,
  source_record_id uuid,
  collaborator_id uuid,
  collaborator_name text,
  requested_at timestamptz,
  current_step_order integer,
  current_step_name text,
  overall_status text,
  priority_visual text,
  pending_minutes integer
)
language sql
security definer
set search_path = attendance, public
as $$
  select
    r.id as approval_request_id,
    s.id as approval_request_step_id,
    r.flow_code,
    coalesce(d.flow_name, c.flow_name) as flow_name,
    r.source_table,
    r.source_record_id,
    r.requested_by_employee_id as collaborator_id,
    attendance.approval_employee_display_name(r.requested_by_employee_id) as collaborator_name,
    r.created_at as requested_at,
    s.step_order as current_step_order,
    s.step_name as current_step_name,
    r.overall_status,
    case
      when extract(epoch from now() - r.created_at) >= 60 * 60 * 72 then 'alta'
      when extract(epoch from now() - r.created_at) >= 60 * 60 * 24 then 'media'
      else 'normal'
    end as priority_visual,
    floor(extract(epoch from now() - coalesce(s.activated_at, r.created_at)) / 60)::integer as pending_minutes
  from attendance.approval_requests r
  join attendance.approval_request_steps s
    on s.approval_request_id = r.id
   and s.tenant_id = r.tenant_id
  join attendance.approval_flow_catalog c
    on c.flow_code = r.flow_code
  left join attendance.approval_flow_definitions d
    on d.id = r.flow_definition_id
  where r.tenant_id = attendance.approval_current_tenant_id()
    and r.overall_status = 'en_aprobacion'
    and s.status = 'pendiente'
    and s.activated_at is not null
    and (
      s.assigned_user_id = auth.uid()
      or auth.uid() = any(s.candidate_user_ids)
    )
  order by
    case
      when extract(epoch from now() - r.created_at) >= 60 * 60 * 72 then 1
      when extract(epoch from now() - r.created_at) >= 60 * 60 * 24 then 2
      else 3
    end,
    r.created_at asc;
$$;

create or replace function attendance.rpc_get_approval_history(
  p_approval_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_request attendance.approval_requests%rowtype;
  v_result jsonb;
begin
  if not attendance.approval_user_can_view_request(p_approval_request_id) then
    raise exception 'No autorizado para ver el historial';
  end if;

  select *
  into v_request
  from attendance.approval_requests r
  where r.id = p_approval_request_id
    and r.tenant_id = attendance.approval_current_tenant_id();

  if not found then
    raise exception 'Solicitud de aprobacion no encontrada';
  end if;

  select jsonb_build_object(
    'request', to_jsonb(v_request),
    'source_record', attendance.approval_get_source_record(v_request.source_table, v_request.source_record_id),
    'steps', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'step_order', s.step_order,
          'step_name', s.step_name,
          'approver_type', s.approver_type,
          'assigned_user_id', s.assigned_user_id,
          'assigned_user_name', case when s.assigned_user_id is not null then attendance.approval_user_display_name(s.assigned_user_id) else null end,
          'assigned_role_code', s.assigned_role_code,
          'assigned_group_id', s.assigned_group_id,
          'status', s.status,
          'activated_at', s.activated_at,
          'acted_at', s.acted_at,
          'acted_by_user_id', s.acted_by_user_id,
          'acted_by_user_name', case when s.acted_by_user_id is not null then attendance.approval_user_display_name(s.acted_by_user_id) else null end,
          'comments', s.comments,
          'candidate_user_ids', s.candidate_user_ids,
          'candidate_user_names', coalesce((
            select jsonb_agg(attendance.approval_user_display_name(candidate_user_id))
            from unnest(s.candidate_user_ids) as candidate_user_id
          ), '[]'::jsonb)
        )
        order by s.step_order
      )
      from attendance.approval_request_steps s
      where s.approval_request_id = p_approval_request_id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'action', a.action,
          'acted_by_user_id', a.acted_by_user_id,
          'acted_by_user_name', case when a.acted_by_user_id is not null then attendance.approval_user_display_name(a.acted_by_user_id) else null end,
          'comments', a.comments,
          'metadata', a.metadata,
          'created_at', a.created_at
        )
        order by a.created_at
      )
      from attendance.approval_action_audit a
      where a.approval_request_id = p_approval_request_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function attendance.rpc_get_approval_setup_context()
returns jsonb
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
  v_result jsonb;
begin
  if v_tenant_id is null then
    raise exception 'No se pudo resolver el tenant activo';
  end if;

  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(role_name order by role_name)
      from (
        select distinct m.role as role_name
        from attendance.memberships m
        where m.tenant_id = v_tenant_id
        union
        select distinct p.role as role_name
        from public.profiles p
        where p.tenant_id = v_tenant_id
          and p.role is not null
      ) roles
      where role_name is not null and role_name <> ''
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'employee_id', employee_id,
          'full_name', full_name,
          'employee_code', employee_code
        )
        order by full_name
      )
      from (
        select distinct
          v.user_id,
          v.id as employee_id,
          trim(concat_ws(' ', v.first_name, v.last_name)) as full_name,
          v.employee_code
        from public.v_employees_full v
        where v.tenant_id = v_tenant_id
          and v.user_id is not null
      ) users
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'code', g.code,
          'name', g.name,
          'description', g.description,
          'group_kind', g.group_kind,
          'is_active', g.is_active,
          'member_count', coalesce(member_count, 0)
        )
        order by g.name
      )
      from (
        select
          g.*,
          (
            select count(*)
            from attendance.approval_approver_group_members gm
            where gm.group_id = g.id
          ) as member_count
        from attendance.approval_approver_groups g
        where g.tenant_id = v_tenant_id
      ) g
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function attendance.approval_current_tenant_id() to authenticated;
grant execute on function attendance.approval_current_role() to authenticated;
grant execute on function attendance.approval_current_employee_id() to authenticated;
grant execute on function attendance.approval_can_manage_config() to authenticated;
grant execute on function attendance.approval_employee_user_id(uuid) to authenticated;
grant execute on function attendance.approval_employee_display_name(uuid) to authenticated;
grant execute on function attendance.approval_user_display_name(uuid) to authenticated;
grant execute on function attendance.approval_get_manager_employee_id(uuid,uuid,integer) to authenticated;
grant execute on function attendance.approval_user_can_view_request(uuid,uuid) to authenticated;
grant execute on function attendance.approval_user_can_act_on_request(uuid,uuid) to authenticated;
grant execute on function attendance.rpc_upsert_flow_definition(text,text,text,text,boolean,text,boolean,boolean,boolean,jsonb) to authenticated;
grant execute on function attendance.rpc_submit_approval_request(text,text,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function attendance.rpc_approve_request(uuid,text) to authenticated;
grant execute on function attendance.rpc_reject_request(uuid,text) to authenticated;
grant execute on function attendance.rpc_get_pending_approvals() to authenticated;
grant execute on function attendance.rpc_get_approval_history(uuid) to authenticated;
grant execute on function attendance.rpc_get_approval_setup_context() to authenticated;

notify pgrst, 'reload schema';

commit;
