-- HRCloud / Base
-- 01_feature_flags_y_ficha_extendida.sql

create schema if not exists attendance;

-- -------------------------------------------------------------------
-- 1. Feature flags por tenant
-- -------------------------------------------------------------------
alter table public.tenants
  add column if not exists payroll_enabled boolean not null default false,
  add column if not exists performance_enabled boolean not null default false,
  add column if not exists training_enabled boolean not null default false,
  add column if not exists employee_portal_enabled boolean not null default false;

comment on column public.tenants.payroll_enabled is 'Habilita módulo de nómina en Base';
comment on column public.tenants.performance_enabled is 'Habilita submódulo de evaluación del desempeño';
comment on column public.tenants.training_enabled is 'Habilita submódulo de capacitación por brechas';
comment on column public.tenants.employee_portal_enabled is 'Habilita autoservicio ampliado en PWA';

-- -------------------------------------------------------------------
-- 2. Helpers
-- -------------------------------------------------------------------
create or replace function attendance.get_my_tenant_id()
returns uuid
language sql
security definer
set search_path = public, attendance
as $$
  select p.tenant_id
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active, true) = true
  limit 1;
$$;

create or replace function attendance.is_tenant_admin()
returns boolean
language sql
security definer
set search_path = public, attendance
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.tenant_id = attendance.get_my_tenant_id()
      and coalesce(p.is_active, true) = true
      and coalesce(p.role, '') in ('tenant_admin','hr_admin','payroll_admin','performance_admin')
  );
$$;

create or replace function attendance.tenant_feature_enabled(p_feature text, p_tenant_id uuid default null)
returns boolean
language sql
security definer
set search_path = public, attendance
as $$
  with t as (
    select *
    from public.tenants
    where id = coalesce(p_tenant_id, attendance.get_my_tenant_id())
  )
  select case p_feature
    when 'payroll' then coalesce((select payroll_enabled from t), false)
    when 'performance' then coalesce((select performance_enabled from t), false)
    when 'training' then coalesce((select training_enabled from t), false)
    when 'employee_portal' then coalesce((select employee_portal_enabled from t), false)
    else false
  end;
$$;

-- -------------------------------------------------------------------
-- 3. Extensión sobre ficha del colaborador
-- -------------------------------------------------------------------
alter table public.employees
  add column if not exists employee_code text,
  add column if not exists full_name text,
  add column if not exists hire_date date,
  add column if not exists termination_date date,
  add column if not exists employment_status text,
  add column if not exists work_modality text,
  add column if not exists base_salary numeric(14,2) default 0,
  add column if not exists payment_frequency text default 'MONTHLY',
  add column if not exists bank_name text,
  add column if not exists bank_account_type text,
  add column if not exists bank_account_number text,
  add column if not exists iess_affiliation_number text,
  add column if not exists iess_start_date date,
  add column if not exists sri_withholding_mode text,
  add column if not exists reserve_fund_policy text,
  add column if not exists payroll_group text,
  add column if not exists cost_center_code text,
  add column if not exists performance_profile_code text,
  add column if not exists eligible_for_bonus boolean not null default false,
  add column if not exists eligible_for_promotion boolean not null default false;

create table if not exists attendance.employee_dependents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  dependent_type text not null,
  full_name text not null,
  identification text,
  birth_date date,
  disability_pct numeric(5,2),
  education_level text,
  is_economic_dependent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.employee_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  contract_type text not null,
  contract_number text,
  start_date date not null,
  end_date date,
  salary numeric(14,2) not null default 0,
  payroll_group text,
  job_title text,
  org_unit_name text,
  working_day_name text,
  weekly_hours numeric(8,2),
  status text not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.employee_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  action_type text not null,
  action_reason text,
  effective_date date not null,
  old_value jsonb,
  new_value jsonb,
  approved_by uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists attendance.employee_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  fiscal_year integer not null,
  projected_other_income numeric(14,2) not null default 0,
  projected_personal_expenses numeric(14,2) not null default 0,
  tax_credit_amount numeric(14,2) not null default 0,
  has_disability_benefit boolean not null default false,
  withholding_mode text not null default 'PROJECTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, employee_id, fiscal_year)
);

create table if not exists attendance.employee_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  bank_name text not null,
  account_type text not null,
  account_number text not null,
  interbank_account_number text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_contracts_tenant_employee
  on attendance.employee_contracts(tenant_id, employee_id);

create index if not exists idx_employee_dependents_tenant_employee
  on attendance.employee_dependents(tenant_id, employee_id);