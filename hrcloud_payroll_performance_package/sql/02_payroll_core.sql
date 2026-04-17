-- HRCloud / Base
-- 02_payroll_core.sql

create table if not exists attendance.payroll_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  setting_code text not null,
  setting_value jsonb not null default '{}'::jsonb,
  valid_from date not null default current_date,
  valid_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, setting_code, valid_from)
);

create table if not exists attendance.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  period_year integer not null,
  period_month integer not null,
  start_date date not null,
  end_date date not null,
  payment_date date,
  period_type text not null default 'MONTHLY',
  status text not null default 'DRAFT',
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code),
  unique(tenant_id, period_year, period_month, period_type)
);

create table if not exists attendance.payroll_concepts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('EARNING','DEDUCTION','EMPLOYER_CONTRIBUTION','PROVISION','INFORMATIONAL')),
  calculation_mode text not null default 'MANUAL',
  formula_code text,
  taxable_iess boolean not null default false,
  taxable_income_tax boolean not null default false,
  affects_net_pay boolean not null default true,
  affects_reserve_fund boolean not null default false,
  affects_13th boolean not null default false,
  affects_14th boolean not null default false,
  sort_order integer not null default 100,
  is_system boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code)
);

create table if not exists attendance.payroll_formulas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  expression_text text not null,
  output_type text not null default 'NUMERIC',
  is_active boolean not null default true,
  version_no integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code, version_no)
);

create table if not exists attendance.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_period_id uuid not null references attendance.payroll_periods(id) on delete cascade,
  run_no integer not null default 1,
  run_type text not null default 'REGULAR',
  status text not null default 'DRAFT',
  calculation_started_at timestamptz,
  calculation_finished_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, payroll_period_id, run_no)
);

create table if not exists attendance.payroll_run_collaborators (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_id uuid not null references attendance.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_code text,
  collaborator_name text,
  base_salary numeric(14,2) not null default 0,
  total_earnings numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  total_employer_contributions numeric(14,2) not null default 0,
  total_provisions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  validation_status text not null default 'PENDING',
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, payroll_run_id, employee_id)
);

create table if not exists attendance.payroll_run_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_collaborator_id uuid not null references attendance.payroll_run_collaborators(id) on delete cascade,
  payroll_concept_id uuid not null references attendance.payroll_concepts(id) on delete restrict,
  concept_code text not null,
  concept_name text not null,
  quantity numeric(14,4) not null default 1,
  rate numeric(14,6) not null default 0,
  amount numeric(14,2) not null default 0,
  source_type text not null default 'SYSTEM',
  source_ref_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists attendance.payroll_loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  loan_type text not null,
  principal_amount numeric(14,2) not null,
  installment_amount numeric(14,2) not null,
  installments_count integer not null,
  balance_amount numeric(14,2) not null,
  start_period_code text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.payroll_advances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_date date not null default current_date,
  amount numeric(14,2) not null,
  status text not null default 'APPROVED',
  payroll_period_code text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists attendance.payroll_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_collaborator_id uuid not null references attendance.payroll_run_collaborators(id) on delete cascade,
  receipt_number text,
  published_at timestamptz,
  published_by uuid,
  pdf_storage_path text,
  is_visible_to_employee boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists attendance.payroll_iess_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_period_id uuid references attendance.payroll_periods(id) on delete set null,
  export_type text not null,
  file_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'GENERATED',
  created_at timestamptz not null default now()
);

create table if not exists attendance.payroll_sri_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fiscal_year integer not null,
  export_type text not null,
  file_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'GENERATED',
  created_at timestamptz not null default now()
);

create index if not exists idx_payroll_runs_tenant_period on attendance.payroll_runs(tenant_id, payroll_period_id);
create index if not exists idx_payroll_run_collaborators_run on attendance.payroll_run_collaborators(payroll_run_id);
create index if not exists idx_payroll_run_items_prc on attendance.payroll_run_items(payroll_run_collaborator_id);