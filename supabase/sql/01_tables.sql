-- ============================================================
-- CEREBRO (HRCloud) - Tablas base (idempotente)
-- ============================================================
-- Requisitos clave del usuario / PDFs:
-- - Roles internos: admin / assistant / maintenance (tabla user_roles por email)
-- - SMTP global singleton (tabla smtp_settings) + secreto en Vault (Edge Functions)
-- - KPI targets singleton (tabla kpi_targets)
-- - Tenants con billing_period + tolerancia + cortesías
-- - Auditoría (audit_logs)
--
-- IMPORTANTE:
-- Este script NO crea/gestiona Auth. Los usuarios se crean por Edge Function
-- (admin-create-user / admin-create-tenant) usando Service Role.

-- EXTENSIONES (las más comunes)
create extension if not exists "pgcrypto";

-- =====================
-- APP SETTINGS (Brand)
-- =====================
create table if not exists public.app_settings (
  id int primary key default 1,
  company_name text,
  company_ruc text,
  company_logo text,
  primary_color text,
  secondary_color text,
  accent_color text,
  login_message_title text,
  login_message_body text,
  paused_message_title text,
  paused_message_body text,
  created_at timestamptz not null default now()
);

-- Asegura singleton (id=1)
insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

-- =====================
-- SMTP SETTINGS (global)
-- =====================
create table if not exists public.smtp_settings (
  id int primary key default 1,
  host text,
  port int,
  username text,
  from_email text,
  from_name text,
  secure boolean not null default false,
  secret_name text not null default 'cerebro_smtp_password',
  has_secret boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.smtp_settings (id)
values (1)
on conflict (id) do nothing;

-- =====================
-- BILLING SETTINGS (singleton)
-- =====================
create table if not exists public.billing_settings (
  id int primary key default 1,
  currency text not null default 'USD',
  tax_percent numeric not null default 0,
  invoice_footer text,
  created_at timestamptz not null default now()
);

insert into public.billing_settings (id)
values (1)
on conflict (id) do nothing;

-- =====================
-- KPI TARGETS (singleton)
-- =====================
create table if not exists public.kpi_targets (
  id int primary key default 1,
  expected_revenue_monthly numeric not null default 0,
  expected_new_clients_monthly int not null default 0,
  green_change_pct numeric not null default 0,
  yellow_change_pct numeric not null default -5,
  created_at timestamptz not null default now()
);

insert into public.kpi_targets (id)
values (1)
on conflict (id) do nothing;

-- =====================
-- SECURITY SETTINGS (singleton)
-- =====================
create table if not exists public.security_settings (
  id int primary key default 1,
  password_level text not null default 'medium',
  min_length int not null default 10,
  require_upper boolean not null default true,
  require_number boolean not null default true,
  require_special boolean not null default true,
  rotation_enabled boolean not null default false,
  rotation_days_default int not null default 90,
  created_at timestamptz not null default now()
);

insert into public.security_settings (id)
values (1)
on conflict (id) do nothing;

-- =====================
-- USER ROLES (internos) - Opción B: solo email
-- =====================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null,
  created_at timestamptz not null default now()
);

-- Roles permitidos (soft constraint; si ya existe, no falla)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_roles_role_chk'
  ) then
    alter table public.user_roles
      add constraint user_roles_role_chk check (role in ('admin','assistant','maintenance'));
  end if;
exception when others then
  -- no-op
end$$;

-- =====================
-- ROLE PERMISSIONS (matriz)
-- =====================
create table if not exists public.role_permissions (
  role text primary key,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Seed por defecto
insert into public.role_permissions (role, permissions)
values
  ('admin', '{"__all": true}'::jsonb),
  ('assistant', '{"dashboard": true, "tenants": true, "invoices": true, "compose_message": true}'::jsonb),
  ('maintenance', '{"dashboard": true, "audit": true}'::jsonb)
on conflict (role) do nothing;

-- =====================
-- PLANS
-- =====================
create table if not exists public.plans (

  code text primary key,
  name text not null,
  description text not null default '',
  billing_model text not null default 'flat',
  constraint plans_billing_model_check check (billing_model = any (array['flat'::text,'per_user_active'::text,'usage'::text])),
  price_model text not null default 'fixed',
  price numeric not null default 0,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()

);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_price_model_chk') then
    alter table public.plans
      add constraint plans_price_model_chk check (price_model in ('fixed','usage'));
  end if;
exception when others then
end$$;

insert into public.plans (code, name, description, price_model, price, unit_price)
values
  ('basic', 'Básico', 'Plan base', 'fixed', 0, 0)
on conflict (code) do nothing;

-- =====================
-- TENANTS
-- =====================
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ruc text not null,
  contact_email text not null,
  plan text not null default 'basic' references public.plans(code) on update cascade,
  status text not null default 'active',
  bio_serial text,
  bio_location text,
  billing_period text not null default 'monthly',
  grace_days int not null default 0,
  pause_after_grace boolean not null default true,
  courtesy_users int not null default 0,
  courtesy_discount_pct numeric not null default 0,
  courtesy_duration text not null default 'one_time',
  courtesy_periods int not null default 1,
  created_at timestamptz not null default now()
);

-- Constraints (idempotentes)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_status_chk') then
    alter table public.tenants
      add constraint tenants_status_chk check (status in ('active','trial','paused'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_billing_period_chk') then
    alter table public.tenants
      add constraint tenants_billing_period_chk check (billing_period in ('weekly','biweekly','monthly','semiannual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_courtesy_duration_chk') then
    alter table public.tenants
      add constraint tenants_courtesy_duration_chk check (courtesy_duration in ('one_time','periods','contract'));
  end if;
exception when others then
end$$;

create index if not exists tenants_status_idx on public.tenants(status);
create index if not exists tenants_created_at_idx on public.tenants(created_at);
create index if not exists tenants_contact_email_idx on public.tenants(contact_email);

-- =====================
-- INVOICES
-- =====================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number text,
  period_start date,
  period_end date,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_status_chk') then
    alter table public.invoices
      add constraint invoices_status_chk check (status in ('pending','paid','overdue','void'));
  end if;
exception when others then
end$$;

create index if not exists invoices_tenant_id_idx on public.invoices(tenant_id);
create index if not exists invoices_created_at_idx on public.invoices(created_at);

-- =====================
-- MESSAGES (in-app)
-- =====================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  priority text not null default 'normal',
  target_roles text[] not null default array['assistant']::text[],
  created_by text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_priority_chk') then
    alter table public.messages
      add constraint messages_priority_chk check (priority in ('normal','urgent'));
  end if;
exception when others then
end$$;

create index if not exists messages_created_at_idx on public.messages(created_at);

-- Mensaje leído por usuario
create table if not exists public.message_reads (
  user_id uuid not null,
  message_id uuid not null references public.messages(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

-- =====================
-- AUDIT LOGS
-- =====================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at);
