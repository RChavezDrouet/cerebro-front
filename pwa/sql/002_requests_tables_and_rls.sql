-- 002_requests_tables_and_rls.sql
-- Ejecutar segundo. Crea permisos, justificaciones y su RLS.

create table if not exists attendance.permission_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  request_scope text not null check (request_scope in ('day','hour')),
  date_from date null,
  date_to date null,
  request_date date null,
  time_from time null,
  time_to time null,
  reason text not null,
  observations text null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_day_shape_chk check (
    (request_scope = 'day' and date_from is not null and date_to is not null and request_date is null and time_from is null and time_to is null)
    or
    (request_scope = 'hour' and request_date is not null and time_from is not null and time_to is not null and date_from is null and date_to is null)
  )
);

create index if not exists permission_requests_tenant_employee_idx
  on attendance.permission_requests (tenant_id, employee_id, created_at desc);

create table if not exists attendance.justifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null,
  justification_type text not null check (justification_type in ('late','absence')),
  affected_date date not null,
  reason text not null,
  observations text null,
  evidence_path text null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists justifications_tenant_employee_idx
  on attendance.justifications (tenant_id, employee_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_permission_requests_updated_at on attendance.permission_requests;
create trigger trg_permission_requests_updated_at
before update on attendance.permission_requests
for each row execute function public.touch_updated_at();

drop trigger if exists trg_justifications_updated_at on attendance.justifications;
create trigger trg_justifications_updated_at
before update on attendance.justifications
for each row execute function public.touch_updated_at();

alter table attendance.permission_requests enable row level security;
alter table attendance.justifications enable row level security;

drop policy if exists permission_requests_select_self on attendance.permission_requests;
create policy permission_requests_select_self
on attendance.permission_requests
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
);

drop policy if exists permission_requests_insert_self on attendance.permission_requests;
create policy permission_requests_insert_self
on attendance.permission_requests
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
);

drop policy if exists permission_requests_update_pending_self on attendance.permission_requests;
create policy permission_requests_update_pending_self
on attendance.permission_requests
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
  and status = 'pending'
)
with check (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
  and status = 'pending'
);

drop policy if exists justifications_select_self on attendance.justifications;
create policy justifications_select_self
on attendance.justifications
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
);

drop policy if exists justifications_insert_self on attendance.justifications;
create policy justifications_insert_self
on attendance.justifications
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
);

drop policy if exists justifications_update_pending_self on attendance.justifications;
create policy justifications_update_pending_self
on attendance.justifications
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
  and status = 'pending'
)
with check (
  tenant_id = public.current_tenant_id()
  and employee_id = attendance.current_employee_id()
  and status = 'pending'
);

comment on table attendance.employee_requests is
'LEGACY. Reemplazada por attendance.permission_requests y attendance.justifications.';
