
-- =========================================================
-- HRCloud / CEREBRO - mejoras marzo 2026
-- =========================================================
-- 1) Apariencia extendida (botones / fondo / superficies)
-- 2) Catálogo de productos y tarifas
-- 3) Test biométrico
-- 4) Monitoreo de capacidad por tenant
-- 5) Ciclo de vida del tenant / baja / DAR
-- =========================================================

alter table if exists public.app_settings
  add column if not exists button_radius integer,
  add column if not exists button_style text,
  add column if not exists button_text_transform text,
  add column if not exists surface_style text,
  add column if not exists background_type text,
  add column if not exists background_color text,
  add column if not exists background_image_url text,
  add column if not exists background_overlay_opacity numeric(5,2);

alter table if exists public.tenants
  add column if not exists paused_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists reactivated_at timestamptz,
  add column if not exists deactivated_at timestamptz;

create table if not exists public.cerebro_products (
  id text primary key,
  code text not null unique,
  name text not null,
  description text,
  billing_mode text not null default 'package_or_consumption',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cerebro_product_rates (
  id text primary key,
  product_id text not null references public.cerebro_products(id) on delete cascade,
  name text not null,
  pricing_type text not null default 'package',
  min_users integer,
  max_users integer,
  flat_price numeric(12,2) not null default 0,
  unit_price numeric(12,4) not null default 0,
  currency text not null default 'USD',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storage_alert_settings (
  id integer primary key default 1,
  enabled boolean not null default true,
  threshold_gb numeric(12,2) not null default 8,
  threshold_percent numeric(5,2) not null default 80,
  notify_emails text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_alert_settings_singleton check (id = 1)
);

create table if not exists public.tenant_storage_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  tenant_name text,
  used_gb numeric(12,4) not null default 0,
  quota_gb numeric(12,4) not null default 0,
  measured_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_tenant_storage_usage_tenant_measured
  on public.tenant_storage_usage (tenant_id, measured_at desc);

create table if not exists public.tenant_lifecycle_settings (
  id integer primary key default 1,
  paused_months_before_deactivation integer not null default 6,
  allow_manual_suspend boolean not null default true,
  dar_format text not null default 'json',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_lifecycle_settings_singleton check (id = 1)
);

create table if not exists public.biometric_test_runs (
  id text primary key,
  tenant_id uuid,
  serial_no text,
  window_minutes integer not null default 15,
  executed_at timestamptz not null default now(),
  overall_status text not null default 'warning',
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_biometric_test_runs_executed
  on public.biometric_test_runs (executed_at desc);

-- RLS mínima defensiva (ajustar a roles reales del proyecto)
alter table if exists public.cerebro_products enable row level security;
alter table if exists public.cerebro_product_rates enable row level security;
alter table if exists public.storage_alert_settings enable row level security;
alter table if exists public.tenant_storage_usage enable row level security;
alter table if exists public.tenant_lifecycle_settings enable row level security;
alter table if exists public.biometric_test_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cerebro_products' and policyname = 'cerebro_products_select_all'
  ) then
    create policy cerebro_products_select_all on public.cerebro_products for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cerebro_products' and policyname = 'cerebro_products_modify_admin'
  ) then
    create policy cerebro_products_modify_admin on public.cerebro_products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cerebro_product_rates' and policyname = 'cerebro_product_rates_select_all'
  ) then
    create policy cerebro_product_rates_select_all on public.cerebro_product_rates for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cerebro_product_rates' and policyname = 'cerebro_product_rates_modify_admin'
  ) then
    create policy cerebro_product_rates_modify_admin on public.cerebro_product_rates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'storage_alert_settings' and policyname = 'storage_alert_settings_rw'
  ) then
    create policy storage_alert_settings_rw on public.storage_alert_settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'tenant_storage_usage' and policyname = 'tenant_storage_usage_rw'
  ) then
    create policy tenant_storage_usage_rw on public.tenant_storage_usage for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'tenant_lifecycle_settings' and policyname = 'tenant_lifecycle_settings_rw'
  ) then
    create policy tenant_lifecycle_settings_rw on public.tenant_lifecycle_settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'biometric_test_runs' and policyname = 'biometric_test_runs_rw'
  ) then
    create policy biometric_test_runs_rw on public.biometric_test_runs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

insert into public.storage_alert_settings (id, enabled, threshold_gb, threshold_percent, notify_emails)
values (1, true, 8, 80, '')
on conflict (id) do nothing;

insert into public.tenant_lifecycle_settings (id, paused_months_before_deactivation, allow_manual_suspend, dar_format)
values (1, 6, true, 'json')
on conflict (id) do nothing;
