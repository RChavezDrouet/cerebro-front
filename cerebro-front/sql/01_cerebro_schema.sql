-- HRCloud / CEREBRO
-- Canonical schema separation: create real tables in schema "cerebro".
-- Goal: isolate Cerebro namespace from base.* and attendance.* and eliminate PostgREST 400/401 drift.
--
-- IMPORTANT (Supabase): add schema "cerebro" to API exposed schemas in Project Settings → API.

begin;

create schema if not exists cerebro;

-- ------------------------------------------------------------------
-- 1) CORE TABLES (CEREBRO)
-- NOTE: These mirror the existing public.* contract but live in cerebro.*.
-- ------------------------------------------------------------------

create table if not exists cerebro.tenants (
  id uuid primary key default gen_random_uuid(),
  name text,
  business_name text not null,
  subdomain text,
  ruc text,
  legal_rep_email text,
  contact_email text,
  plan_type text,
  status text not null default 'active',
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cerebro.app_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references cerebro.tenants(id) on delete cascade,
  -- Legacy/global configuration fields used by Cerebro UI
  company_name text,
  company_ruc text,
  base_pwa_url text,
  paused_message_title text,
  paused_message_body text,
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_from_name text,
  smtp_from_email text,
  tax_rate numeric,
  suspension_days_threshold int,
  -- Newer JSON blocks (branding/security)
  brand jsonb not null default '{}'::jsonb,
  security jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id)
);

-- Ensure backward-compatible columns exist even if the table was created in a previous run.
alter table cerebro.app_settings add column if not exists company_name text;
alter table cerebro.app_settings add column if not exists company_ruc text;
alter table cerebro.app_settings add column if not exists base_pwa_url text;
alter table cerebro.app_settings add column if not exists paused_message_title text;
alter table cerebro.app_settings add column if not exists paused_message_body text;
alter table cerebro.app_settings add column if not exists smtp_host text;
alter table cerebro.app_settings add column if not exists smtp_port int;
alter table cerebro.app_settings add column if not exists smtp_user text;
alter table cerebro.app_settings add column if not exists smtp_from_name text;
alter table cerebro.app_settings add column if not exists smtp_from_email text;
alter table cerebro.app_settings add column if not exists tax_rate numeric;
alter table cerebro.app_settings add column if not exists suspension_days_threshold int;

create table if not exists cerebro.plans (
  id uuid primary key default gen_random_uuid(),
  plan_type text unique,
  name text,
  price numeric,
  currency text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cerebro.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references cerebro.tenants(id) on delete cascade,
  total numeric not null default 0,
  status text not null default 'pending',
  due_date date,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists cerebro.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references cerebro.invoices(id) on delete cascade,
  tenant_id uuid references cerebro.tenants(id) on delete cascade,
  amount numeric not null default 0,
  paid_at timestamptz,
  method text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cerebro.biometric_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references cerebro.tenants(id) on delete cascade,
  serial_number text not null,
  location text,
  warranty_until date,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tenant_id, serial_number)
);

create table if not exists cerebro.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  action text not null,
  description text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Staff roles (Cerebro internal)
create table if not exists cerebro.user_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('admin','assistant','maintenance')),
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 2) PERMISSIONS MODEL (Prompt requirement)
-- ------------------------------------------------------------------

create table if not exists cerebro.permissions (
  key text primary key,
  category text not null,
  description text not null
);

create table if not exists cerebro.roles (
  key text primary key,
  name text not null,
  description text
);

create table if not exists cerebro.role_permissions (
  role_key text references cerebro.roles(key) on delete cascade,
  permission_key text references cerebro.permissions(key) on delete cascade,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists cerebro.user_overrides (
  user_email text not null,
  permission_key text references cerebro.permissions(key) on delete cascade,
  allowed boolean not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_email, permission_key)
);

-- ------------------------------------------------------------------
-- 3) DASHBOARD PERSONALIZATION
-- ------------------------------------------------------------------
create table if not exists cerebro.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_email)
);

-- ------------------------------------------------------------------
-- 4) DATA MIGRATION FROM public.* (if exists) → cerebro.*
-- Safe to run multiple times.
-- ------------------------------------------------------------------

do $$
begin
  if to_regclass('public.tenants') is not null then
    insert into cerebro.tenants (id, name, business_name, subdomain, ruc, legal_rep_email, contact_email, plan_type, status, is_suspended, created_at, updated_at)
    select id, name, business_name, subdomain, ruc, legal_rep_email, contact_email, plan_type, coalesce(status,'active'), coalesce(is_suspended,false), created_at, updated_at
    from public.tenants
    on conflict (id) do update set
      name = excluded.name,
      business_name = excluded.business_name,
      subdomain = excluded.subdomain,
      ruc = excluded.ruc,
      legal_rep_email = excluded.legal_rep_email,
      contact_email = excluded.contact_email,
      plan_type = excluded.plan_type,
      status = excluded.status,
      is_suspended = excluded.is_suspended,
      updated_at = now();
  end if;

  if to_regclass('public.app_settings') is not null then
    insert into cerebro.app_settings (id, tenant_id, global_paused_title, global_paused_message, brand, security, created_at, updated_at)
    select id, tenant_id, global_paused_title, global_paused_message, coalesce(brand,'{}'::jsonb), coalesce(security,'{}'::jsonb), created_at, updated_at
    from public.app_settings
    on conflict (id) do update set
      tenant_id = excluded.tenant_id,
      global_paused_title = excluded.global_paused_title,
      global_paused_message = excluded.global_paused_message,
      brand = excluded.brand,
      security = excluded.security,
      updated_at = now();
  end if;

  if to_regclass('public.plans') is not null then
    insert into cerebro.plans (id, plan_type, name, price, currency, meta, created_at)
    select id, plan_type, name, price, currency, coalesce(meta,'{}'::jsonb), created_at
    from public.plans
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.invoices') is not null then
    insert into cerebro.invoices (id, tenant_id, total, status, due_date, created_at, meta)
    select id, tenant_id, total, status, due_date, created_at, coalesce(meta,'{}'::jsonb)
    from public.invoices
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.payments') is not null then
    insert into cerebro.payments (id, invoice_id, tenant_id, amount, paid_at, method, meta, created_at)
    select id, invoice_id, tenant_id, amount, paid_at, method, coalesce(meta,'{}'::jsonb), created_at
    from public.payments
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.biometric_devices') is not null then
    insert into cerebro.biometric_devices (id, tenant_id, serial_number, location, warranty_until, is_active, meta, created_at)
    select id, tenant_id, serial_number, location, warranty_until, coalesce(is_active,true), coalesce(meta,'{}'::jsonb), created_at
    from public.biometric_devices
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into cerebro.audit_logs (id, tenant_id, user_id, action, description, meta, created_at)
    select id, tenant_id, user_id, action, description, coalesce(meta,'{}'::jsonb), created_at
    from public.audit_logs
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.user_roles') is not null then
    insert into cerebro.user_roles (id, email, role, full_name, is_active, created_at, updated_at)
    select id, email, role, full_name, coalesce(is_active,true), created_at, updated_at
    from public.user_roles
    on conflict (email) do update set role = excluded.role, full_name = excluded.full_name, is_active = excluded.is_active, updated_at = now();
  end if;
end $$;

-- ------------------------------------------------------------------
-- 5) Backward compatibility (optional): create public views ONLY if the old tables do not exist.
-- ------------------------------------------------------------------

do $$
begin
  if to_regclass('public.tenants') is null then
    create view public.tenants as select * from cerebro.tenants;
  end if;
  if to_regclass('public.app_settings') is null then
    create view public.app_settings as select * from cerebro.app_settings;
  end if;
  if to_regclass('public.plans') is null then
    create view public.plans as select * from cerebro.plans;
  end if;
  if to_regclass('public.invoices') is null then
    create view public.invoices as select * from cerebro.invoices;
  end if;
  if to_regclass('public.payments') is null then
    create view public.payments as select * from cerebro.payments;
  end if;
  if to_regclass('public.biometric_devices') is null then
    create view public.biometric_devices as select * from cerebro.biometric_devices;
  end if;
  if to_regclass('public.audit_logs') is null then
    create view public.audit_logs as select * from cerebro.audit_logs;
  end if;
  if to_regclass('public.user_roles') is null then
    create view public.user_roles as select * from cerebro.user_roles;
  end if;
end $$;

commit;
