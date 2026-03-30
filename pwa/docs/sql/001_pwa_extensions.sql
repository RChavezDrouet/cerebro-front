-- ============================================================
-- HRCloud PWA — Extensiones DB para PWA (punch_attempts + requests)
-- ============================================================
-- Objetivo:
-- 1) Registrar intentos fallidos/exitosos de marcación (auditoría anti-abuso)
-- 2) Registrar solicitudes del empleado y permitir seguimiento
--
-- Requisitos previos:
-- - public.profiles(id = auth.uid()) con tenant_id y employee_id
-- - schema attendance existente

-- ----------
-- 1) attendance.punch_attempts
-- ----------
create table if not exists attendance.punch_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  attempted_at timestamptz not null default now(),
  action text not null check (action in ('clock_in','clock_out','break_start','break_end')),
  ok boolean not null default false,
  step text not null default 'unknown' check (step in ('face','gps','insert','rule','unknown')),
  reason text null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_punch_attempts_tenant_employee_day
  on attendance.punch_attempts (tenant_id, employee_id, attempted_at desc);

alter table attendance.punch_attempts enable row level security;

drop policy if exists employee_select_own_attempts on attendance.punch_attempts;
create policy employee_select_own_attempts
on attendance.punch_attempts
for select
to authenticated
using (
  tenant_id = (select p.tenant_id from public.profiles p where p.id = auth.uid())
  and employee_id = (select p.employee_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists employee_insert_own_attempts on attendance.punch_attempts;
create policy employee_insert_own_attempts
on attendance.punch_attempts
for insert
to authenticated
with check (
  tenant_id = (select p.tenant_id from public.profiles p where p.id = auth.uid())
  and employee_id = (select p.employee_id from public.profiles p where p.id = auth.uid())
);

-- ----------
-- 2) attendance.employee_requests (Solicitudes)
-- ----------
create table if not exists attendance.employee_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  type text not null,
  subject text not null,
  detail text not null,
  status text not null default 'open' check (status in ('open','in_review','approved','rejected','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_requests_tenant_employee
  on attendance.employee_requests (tenant_id, employee_id, created_at desc);

-- updated_at trigger
create or replace function attendance.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employee_requests_updated_at on attendance.employee_requests;
create trigger trg_employee_requests_updated_at
before update on attendance.employee_requests
for each row
execute function attendance.tg_set_updated_at();

alter table attendance.employee_requests enable row level security;

drop policy if exists employee_select_own_requests on attendance.employee_requests;
create policy employee_select_own_requests
on attendance.employee_requests
for select
to authenticated
using (
  tenant_id = (select p.tenant_id from public.profiles p where p.id = auth.uid())
  and employee_id = (select p.employee_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists employee_insert_own_requests on attendance.employee_requests;
create policy employee_insert_own_requests
on attendance.employee_requests
for insert
to authenticated
with check (
  tenant_id = (select p.tenant_id from public.profiles p where p.id = auth.uid())
  and employee_id = (select p.employee_id from public.profiles p where p.id = auth.uid())
);

-- (Opcional) permitir update SOLO a roles internos (admin) desde Base.
-- Aquí no se crea policy de update para authenticated.
