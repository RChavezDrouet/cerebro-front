create schema if not exists attendance;
create extension if not exists pgcrypto;

create table if not exists attendance.attendance_novelties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  punch_id uuid,
  work_date date not null,
  type text not null check (type in (
    'ATRASO','AUSENCIA','DOBLE_MARCACION','FUERA_GEOFENCE','SOSPECHOSO','ENTRADA_SIN_SALIDA',
    'SALIDA_SIN_ENTRADA','EMPLEADO_INACTIVO','TENANT_PAUSED','DISPOSITIVO_REQUERIDO','FACE_REQUIRED',
    'PATRON_IRREGULAR','EXCESO_MARCACIONES','FUERA_JORNADA','BREAK_INCONSISTENTE'
  )),
  severity text not null check (severity in ('low','medium','high','critical')),
  detected_by text not null check (detected_by in ('rules','ai','manual')),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','reviewing','justified','dismissed','resolved')),
  confidence_score numeric(5,2),
  evidence jsonb not null default '{}'::jsonb,
  assigned_to uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_attendance_novelties_tenant_date on attendance.attendance_novelties(tenant_id, work_date desc);
create index if not exists idx_attendance_novelties_employee_date on attendance.attendance_novelties(employee_id, work_date desc);
create index if not exists idx_attendance_novelties_status on attendance.attendance_novelties(tenant_id, status);

create table if not exists attendance.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  actor_email text,
  module text not null,
  action text not null,
  entity_name text not null,
  entity_id text,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_attendance_audit_logs_tenant_date on attendance.audit_logs(tenant_id, created_at desc);

create table if not exists attendance.punch_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  employee_id uuid,
  requested_type text,
  source text,
  requested_at timestamptz not null default now(),
  success boolean not null default false,
  failure_reason text,
  ip inet,
  user_agent text,
  device_id text,
  geo_lat numeric(10,7),
  geo_lng numeric(10,7),
  geo_accuracy_m numeric(10,2),
  meta jsonb not null default '{}'::jsonb
);
create index if not exists idx_punch_attempts_tenant_date on attendance.punch_attempts(tenant_id, requested_at desc);
create index if not exists idx_punch_attempts_employee_date on attendance.punch_attempts(employee_id, requested_at desc);

create or replace function attendance.touch_updated_at_generic()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_attendance_novelties_updated_at on attendance.attendance_novelties;
create trigger trg_attendance_novelties_updated_at
before update on attendance.attendance_novelties
for each row execute function attendance.touch_updated_at_generic();
