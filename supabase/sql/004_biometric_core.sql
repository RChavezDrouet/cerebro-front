-- =======================================================
-- HRCloud Base — Biometría (ADMS) (MVP)
-- Tablas para registrar dispositivos, payload crudo y punches
-- (Multi-tenant, compatible con el esquema actual en public)
-- =======================================================

create extension if not exists pgcrypto;

-- Source enum (compatible con MVP)
do $$ begin
  create type public.attendance_punch_source as enum ('web', 'biometric', 'import');
exception when duplicate_object then null; end $$;

-- Settings por tenant (timezone)
create table if not exists public.attendance_settings (
  tenant_id uuid primary key default public.current_tenant_id(),
  timezone text not null default 'America/Guayaquil',
  created_at timestamptz not null default now()
);

create or replace function public.attendance_tenant_timezone()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.timezone from public.attendance_settings s where s.tenant_id = public.current_tenant_id() limit 1),
    'UTC'
  );
$$;

-- Dispositivos biométricos
create table if not exists public.attendance_biometric_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  serial_no text not null,
  name text not null,
  device_timezone text not null default 'America/Guayaquil',
  is_active boolean not null default true,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now()
);

-- Composite uniqueness (para FKs multi-tenant)
do $$ begin
  alter table public.attendance_biometric_devices
    add constraint attendance_biometric_devices_tenant_id_id_uk unique (tenant_id, id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.attendance_biometric_devices
    add constraint attendance_biometric_devices_tenant_serial_uk unique (tenant_id, serial_no);
exception when duplicate_object then null; end $$;

create index if not exists idx_bio_devices_tenant on public.attendance_biometric_devices (tenant_id);

-- Raw: para troubleshooting del protocolo (OWASP: audit trail)
create table if not exists public.attendance_biometric_raw (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  device_id uuid null,
  serial_no text null,
  method text not null,
  path text not null,
  query jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  body text null,
  received_at timestamptz not null default now()
);

create index if not exists idx_bio_raw_received on public.attendance_biometric_raw (received_at desc);

-- Punches unificados (web/biometric/import)
create table if not exists public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  employee_id uuid null,
  device_employee_code text null,
  punched_at timestamptz not null,
  source public.attendance_punch_source not null,
  device_id uuid null,
  raw jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

do $$ begin
  alter table public.attendance_punches
    add constraint attendance_punches_tenant_id_id_uk unique (tenant_id, id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.attendance_punches
    add constraint attendance_punches_employee_fk
    foreign key (tenant_id, employee_id)
    references public.employees (tenant_id, id)
    on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.attendance_punches
    add constraint attendance_punches_device_fk
    foreign key (tenant_id, device_id)
    references public.attendance_biometric_devices (tenant_id, id)
    on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists idx_punches_tenant_time on public.attendance_punches (tenant_id, punched_at desc);
create index if not exists idx_punches_device_code on public.attendance_punches (tenant_id, device_employee_code);

-- Report view (empleado, hora local, fuera de horario)
create or replace view public.attendance_v_punch_report as
select
  p.id,
  p.tenant_id,
  coalesce(e.employee_code, p.device_employee_code) as employee_code,
  case when e.id is null then null else (e.first_name || ' ' || e.last_name) end as employee_name,
  p.punched_at,
  (p.punched_at at time zone public.attendance_tenant_timezone()) as punched_at_local,
  p.source,
  d.serial_no as device_serial,
  s.id as schedule_id,
  s.name as schedule_name,
  t.name as turn_name,
  case
    when s.id is null then null
    else
      (
        case
          when s.crosses_midnight then
            not (
              ((p.punched_at at time zone public.attendance_tenant_timezone())::time >= s.entry_time)
              or
              ((p.punched_at at time zone public.attendance_tenant_timezone())::time <= s.exit_time)
            )
          else
            not (
              ((p.punched_at at time zone public.attendance_tenant_timezone())::time >= s.entry_time)
              and
              ((p.punched_at at time zone public.attendance_tenant_timezone())::time <= s.exit_time)
            )
        end
      )
  end as outside_schedule
from public.attendance_punches p
left join public.employees e
  on e.tenant_id = p.tenant_id
 and e.id = p.employee_id
left join public.attendance_schedules s
  on s.tenant_id = p.tenant_id
 and s.id = e.schedule_id
left join public.attendance_turns t
  on t.tenant_id = p.tenant_id
 and t.id = s.turn_id
left join public.attendance_biometric_devices d
  on d.tenant_id = p.tenant_id
 and d.id = p.device_id;
