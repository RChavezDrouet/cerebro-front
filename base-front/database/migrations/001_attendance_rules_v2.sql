-- HRCloud Base Enterprise Attendance v2
-- Multi-tenant safe additions for attendance configuration

create schema if not exists attendance;

create extension if not exists pgcrypto;

create table if not exists attendance.attendance_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  timezone text not null default 'America/Guayaquil',
  grace_entry_minutes integer not null default 5 check (grace_entry_minutes between 0 and 180),
  grace_exit_minutes integer not null default 5 check (grace_exit_minutes between 0 and 180),
  rounding_policy text not null default 'none' check (rounding_policy in ('none','5m','10m','15m','nearest_schedule')),
  max_punches_per_day integer not null default 8 check (max_punches_per_day between 1 and 20),
  allow_duplicates boolean not null default false,
  duplicate_window_seconds integer not null default 60 check (duplicate_window_seconds between 5 and 3600),
  geo_enabled boolean not null default false,
  geo_radius_m numeric(10,2),
  geo_point_lat numeric(10,7),
  geo_point_lng numeric(10,7),
  face_required boolean not null default false,
  device_required boolean not null default false,
  allow_remote boolean not null default true,
  ai_enabled boolean not null default false,
  ai_provider text,
  ai_model text,
  ai_sensitivity_level text not null default 'medium' check (ai_sensitivity_level in ('low','medium','high')),
  overtime_requires_approval boolean not null default true,
  break_tracking_enabled boolean not null default true,
  late_threshold_minutes integer not null default 1 check (late_threshold_minutes between 0 and 240),
  absence_cutoff_minutes integer not null default 240 check (absence_cutoff_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (tenant_id)
);

comment on table attendance.attendance_rules_v2 is 'Enterprise attendance rules by tenant. One active row per tenant.';

create or replace function attendance.set_updated_at_attendance_rules_v2()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_attendance_rules_v2_updated_at on attendance.attendance_rules_v2;
create trigger trg_attendance_rules_v2_updated_at
before update on attendance.attendance_rules_v2
for each row execute function attendance.set_updated_at_attendance_rules_v2();

insert into attendance.attendance_rules_v2 (
  tenant_id,
  timezone,
  grace_entry_minutes,
  grace_exit_minutes,
  rounding_policy,
  max_punches_per_day,
  allow_duplicates,
  geo_enabled,
  face_required,
  device_required,
  allow_remote,
  ai_enabled,
  ai_provider,
  ai_model,
  ai_sensitivity_level
)
select
  t.id,
  coalesce(s.timezone, 'America/Guayaquil'),
  5,
  5,
  'none',
  8,
  false,
  coalesce(s.geo_enabled, false),
  coalesce(s.face_enabled, false),
  false,
  true,
  false,
  null,
  null,
  'medium'
from public.tenants t
left join attendance.settings s on s.tenant_id = t.id
on conflict (tenant_id) do nothing;
