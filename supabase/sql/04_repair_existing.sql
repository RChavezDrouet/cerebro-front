-- ============================================================
-- CEREBRO SaaS - Repair Script (Settings + Tenants + RLS)
-- ============================================================
-- Objetivo:
-- - Corregir errores típicos vistos en consola:
--   * 404 en billing_settings/kpi_targets/security_settings (tablas no creadas)
--   * 400 PGRST204 (columnas faltantes en app_settings/tenants)
--   * 403 (RLS/GRANT faltantes en smtp_settings)
-- - Script idempotente: se puede ejecutar varias veces.
--
-- IMPORTANTE:
-- 1) Ejecútalo en Supabase SQL Editor.
-- 2) Luego ve a Settings → API → Reload schema.
-- ============================================================

-- ---------------------
-- 1) Tablas core (si faltan)
-- ---------------------

create table if not exists public.app_settings (
  id bigint primary key,
  company_name text,
  company_ruc text,
  company_logo text,
  primary_color text,
  secondary_color text,
  accent_color text,
  login_message_title text,
  login_message_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smtp_settings (
  id bigint primary key,
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_pass text,
  smtp_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_settings (
  id bigint primary key,
  currency text default 'USD',
  tax_percent numeric(5,2) default 0,
  invoice_prefix text default 'INV',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kpi_targets (
  id bigint primary key,
  unresolved_red_hours int default 72,
  unresolved_yellow_hours int default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_settings (
  id bigint primary key,
  password_level text default 'medium',
  min_length int default 10,
  require_upper boolean default true,
  require_lower boolean default true,
  require_number boolean default true,
  require_special boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tenants: si ya existe con menos columnas, las agregamos.
-- (No intentamos recrear la tabla completa para no perder datos.)
alter table public.tenants
  add column if not exists name text,
  add column if not exists ruc text,
  add column if not exists contact_email text,
  add column if not exists plan text,
  add column if not exists status text,
  add column if not exists bio_serial text,
  add column if not exists bio_location text,
  add column if not exists billing_period text,
  add column if not exists grace_days int,
  add column if not exists pause_after_grace boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- app_settings: si ya existe pero con columnas antiguas (ruc/logo_url), agregamos las nuevas.
alter table public.app_settings
  add column if not exists company_ruc text,
  add column if not exists company_logo text,
  add column if not exists login_message_title text,
  add column if not exists login_message_body text,
  add column if not exists primary_color text,
  add column if not exists secondary_color text,
  add column if not exists accent_color text,
  add column if not exists company_name text,
  add column if not exists updated_at timestamptz;

-- Migración suave desde columnas antiguas si existen
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='app_settings' and column_name='ruc'
  ) then
    execute 'update public.app_settings set company_ruc = coalesce(company_ruc, ruc)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='app_settings' and column_name='logo_url'
  ) then
    execute 'update public.app_settings set company_logo = coalesce(company_logo, logo_url)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='app_settings' and column_name='login_title'
  ) then
    execute 'update public.app_settings set login_message_title = coalesce(login_message_title, login_title)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='app_settings' and column_name='login_body'
  ) then
    execute 'update public.app_settings set login_message_body = coalesce(login_message_body, login_body)';
  end if;
end $$;

-- ---------------------
-- 2) Semillas singleton (evita que UPSERT caiga en INSERT sin policy)
-- ---------------------
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
insert into public.smtp_settings (id) values (1) on conflict (id) do nothing;
insert into public.billing_settings (id) values (1) on conflict (id) do nothing;
insert into public.kpi_targets (id) values (1) on conflict (id) do nothing;
insert into public.security_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------
-- 3) Helpers RLS (case-insensitive + SECURITY DEFINER)
-- ---------------------

create or replace function public.current_email() returns text
language sql stable as $$
  select nullif(auth.jwt() ->> 'email', '')::text;
$$;

create or replace function public.has_role(_role text) returns boolean
language sql stable
security definer
set search_path = public, auth
as $$
  select exists(
    select 1
    from public.user_roles ur
    where lower(ur.email) = lower(public.current_email())
      and ur.role = _role
  );
$$;

create or replace function public.is_internal() returns boolean
language sql stable
security definer
set search_path = public, auth
as $$
  select exists(
    select 1
    from public.user_roles ur
    where lower(ur.email) = lower(public.current_email())
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable
security definer
set search_path = public, auth
as $$
  select public.has_role('admin');
$$;

-- ---------------------
-- 4) GRANTS (necesarios además de policies)
-- ---------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.current_email() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_internal() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------
-- 5) RLS + Policies mínimas para Settings (lectura internos / escritura admin)
-- ---------------------

alter table public.app_settings enable row level security;
alter table public.smtp_settings enable row level security;
alter table public.billing_settings enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.security_settings enable row level security;
alter table public.tenants enable row level security;

-- app_settings
DROP POLICY IF EXISTS app_settings_select_internal ON public.app_settings;
CREATE POLICY app_settings_select_internal ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_internal());

DROP POLICY IF EXISTS app_settings_admin_insert ON public.app_settings;
CREATE POLICY app_settings_admin_insert ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
CREATE POLICY app_settings_admin_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- smtp_settings
DROP POLICY IF EXISTS smtp_settings_select_internal ON public.smtp_settings;
CREATE POLICY smtp_settings_select_internal ON public.smtp_settings
  FOR SELECT TO authenticated
  USING (public.is_internal());

DROP POLICY IF EXISTS smtp_settings_admin_insert ON public.smtp_settings;
CREATE POLICY smtp_settings_admin_insert ON public.smtp_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS smtp_settings_admin_update ON public.smtp_settings;
CREATE POLICY smtp_settings_admin_update ON public.smtp_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- billing_settings
DROP POLICY IF EXISTS billing_settings_select_internal ON public.billing_settings;
CREATE POLICY billing_settings_select_internal ON public.billing_settings
  FOR SELECT TO authenticated
  USING (public.is_internal());

DROP POLICY IF EXISTS billing_settings_admin_insert ON public.billing_settings;
CREATE POLICY billing_settings_admin_insert ON public.billing_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS billing_settings_admin_update ON public.billing_settings;
CREATE POLICY billing_settings_admin_update ON public.billing_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- kpi_targets
DROP POLICY IF EXISTS kpi_targets_select_internal ON public.kpi_targets;
CREATE POLICY kpi_targets_select_internal ON public.kpi_targets
  FOR SELECT TO authenticated
  USING (public.is_internal());

DROP POLICY IF EXISTS kpi_targets_admin_insert ON public.kpi_targets;
CREATE POLICY kpi_targets_admin_insert ON public.kpi_targets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS kpi_targets_admin_update ON public.kpi_targets;
CREATE POLICY kpi_targets_admin_update ON public.kpi_targets
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- security_settings
DROP POLICY IF EXISTS security_settings_select_internal ON public.security_settings;
CREATE POLICY security_settings_select_internal ON public.security_settings
  FOR SELECT TO authenticated
  USING (public.is_internal());

DROP POLICY IF EXISTS security_settings_admin_insert ON public.security_settings;
CREATE POLICY security_settings_admin_insert ON public.security_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS security_settings_admin_update ON public.security_settings;
CREATE POLICY security_settings_admin_update ON public.security_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- tenants (admin full)
DROP POLICY IF EXISTS tenants_admin_all ON public.tenants;
CREATE POLICY tenants_admin_all ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------
-- 6) Checks rápidos (debe devolver TRUE para admin)
-- ---------------------
-- SELECT public.is_admin();
-- SELECT public.is_internal();



-- =====================
-- Patch: Paused message (Base) + Plans billing_model
-- =====================
-- app_settings: mensaje global cuando tenant está en pausa (consumido por Base)
alter table public.app_settings add column if not exists paused_message_title text;
alter table public.app_settings add column if not exists paused_message_body  text;

update public.app_settings
   set paused_message_title = coalesce(paused_message_title, 'Servicio pausado'),
       paused_message_body  = coalesce(paused_message_body,  'Tu empresa se encuentra en estado PAUSADO. Contacta al administrador para reactivar el servicio.')
 where id = 1;

-- defaults (no falla si ya existen)
alter table public.app_settings alter column paused_message_title set default 'Servicio pausado';
alter table public.app_settings alter column paused_message_body  set default 'Tu empresa se encuentra en estado PAUSADO. Contacta al administrador para reactivar el servicio.';

-- plans: billing_model compatible con CHECK (flat/per_user_active/usage)
alter table public.plans add column if not exists billing_model text;

-- backfill NULLs con un valor permitido
update public.plans
   set billing_model = coalesce(billing_model, 'flat')
 where billing_model is null;

-- default seguro
alter table public.plans alter column billing_model set default 'flat';

-- constraint (solo si no existe)
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'plans_billing_model_check'
       and conrelid = 'public.plans'::regclass
  ) then
    alter table public.plans
      add constraint plans_billing_model_check
      check (billing_model = any (array['flat'::text,'per_user_active'::text,'usage'::text]));
  end if;
end $$;
