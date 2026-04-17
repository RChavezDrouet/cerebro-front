-- HRCloud / Base
-- 03_performance_and_training.sql

create table if not exists attendance.performance_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  cycle_type text not null default 'ANNUAL',
  start_date date not null,
  end_date date not null,
  publish_date date,
  status text not null default 'DRAFT',
  allow_self_evaluation boolean not null default true,
  allow_recalification boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code)
);

create table if not exists attendance.performance_scales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  scale_type text not null default 'NUMERIC',
  min_value numeric(10,2) not null default 0,
  max_value numeric(10,2) not null default 100,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code)
);

create table if not exists attendance.performance_scale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  performance_scale_id uuid not null references attendance.performance_scales(id) on delete cascade,
  code text not null,
  label text not null,
  value_from numeric(10,2) not null,
  value_to numeric(10,2) not null,
  weight_factor numeric(10,4) not null default 1,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists attendance.performance_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  template_type text not null default 'GOALS_COMPETENCIES',
  performance_scale_id uuid references attendance.performance_scales(id) on delete set null,
  target_scope text not null default 'EMPLOYEE',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code)
);

create table if not exists attendance.performance_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  performance_template_id uuid not null references attendance.performance_templates(id) on delete cascade,
  component_type text not null check (component_type in ('COMPETENCY','GOAL','KPI','BEHAVIOR')),
  code text not null,
  name text not null,
  description text,
  weight_pct numeric(7,2) not null default 0,
  min_required_score numeric(10,2),
  training_catalog_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.performance_template_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  performance_template_id uuid not null references attendance.performance_templates(id) on delete cascade,
  assignment_scope text not null,
  scope_ref text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists attendance.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  performance_cycle_id uuid not null references attendance.performance_cycles(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  performance_template_id uuid not null references attendance.performance_templates(id) on delete restrict,
  reviewer_user_id uuid,
  manager_user_id uuid,
  status text not null default 'PENDING',
  self_score numeric(10,2),
  reviewer_score numeric(10,2),
  final_score numeric(10,2),
  final_result_label text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, performance_cycle_id, employee_id)
);

create table if not exists attendance.performance_review_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  performance_review_id uuid not null references attendance.performance_reviews(id) on delete cascade,
  performance_component_id uuid not null references attendance.performance_components(id) on delete restrict,
  self_score numeric(10,2),
  reviewer_score numeric(10,2),
  final_score numeric(10,2),
  comments text,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.performance_recalifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  performance_review_id uuid not null references attendance.performance_reviews(id) on delete cascade,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  status text not null default 'REQUESTED',
  reason text not null,
  resolution_notes text
);

create table if not exists attendance.performance_improvement_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  performance_review_id uuid references attendance.performance_reviews(id) on delete set null,
  owner_user_id uuid,
  title text not null,
  description text,
  due_date date,
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.performance_gaps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  performance_review_item_id uuid references attendance.performance_review_items(id) on delete set null,
  gap_type text not null default 'TRAINING',
  gap_code text,
  gap_name text not null,
  severity text not null default 'MEDIUM',
  current_score numeric(10,2),
  target_score numeric(10,2),
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance.training_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  training_type text not null default 'COURSE',
  provider_name text,
  duration_hours numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code)
);

create table if not exists attendance.training_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  performance_gap_id uuid references attendance.performance_gaps(id) on delete set null,
  training_catalog_id uuid references attendance.training_catalog(id) on delete set null,
  title text not null,
  planned_start_date date,
  planned_end_date date,
  status text not null default 'PLANNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);