-- =======================================================
-- HRCloud Base — Asistencia (MVP)
-- Core tables + constraints (multi-tenant)
-- =======================================================

create extension if not exists pgcrypto;

-- Helper: resolve current tenant id.
-- Prefer claim tenant_id; fallback to profiles.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'tenant_id')::uuid,
    (select p.tenant_id from public.profiles p where p.user_id = auth.uid() limit 1)
  );
$$;

-- Types
do $$ begin
  create type public.attendance_turn_type as enum ('diurno', 'vespertino', 'nocturno');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.employee_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

-- =========================
-- attendance_turns
-- =========================
create table if not exists public.attendance_turns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  name text not null,
  type public.attendance_turn_type not null,
  color text not null,
  days int[] not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.attendance_turns
  add constraint attendance_turns_tenant_id_id_uk unique (tenant_id, id);

alter table public.attendance_turns
  add constraint attendance_turns_tenant_name_uk unique (tenant_id, name);

-- =========================
-- attendance_schedules
-- =========================
create table if not exists public.attendance_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  turn_id uuid not null,
  name text not null,
  color text not null,
  entry_time time not null,
  exit_time time not null,
  crosses_midnight boolean not null default false,
  meal_enabled boolean not null default false,
  meal_start time null,
  meal_end time null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint attendance_schedules_meal_chk check (
    (meal_enabled = false and meal_start is null and meal_end is null)
    or
    (meal_enabled = true and meal_start is not null and meal_end is not null)
  )
);

alter table public.attendance_schedules
  add constraint attendance_schedules_tenant_id_id_uk unique (tenant_id, id);

alter table public.attendance_schedules
  add constraint attendance_schedules_tenant_name_uk unique (tenant_id, name);

alter table public.attendance_schedules
  add constraint attendance_schedules_turn_fk
  foreign key (tenant_id, turn_id)
  references public.attendance_turns (tenant_id, id)
  on delete restrict;

-- =========================
-- employees
-- =========================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  employee_code text not null,
  first_name text not null,
  last_name text not null,
  status public.employee_status not null default 'active',
  schedule_id uuid not null,
  biometric_employee_code text null,
  created_at timestamptz not null default now()
);

alter table public.employees
  add constraint employees_tenant_id_id_uk unique (tenant_id, id);

alter table public.employees
  add constraint employees_tenant_employee_code_uk unique (tenant_id, employee_code);

alter table public.employees
  add constraint employees_schedule_fk
  foreign key (tenant_id, schedule_id)
  references public.attendance_schedules (tenant_id, id)
  on delete restrict;

-- Helpful indexes
create index if not exists idx_turns_tenant on public.attendance_turns (tenant_id);
create index if not exists idx_schedules_tenant on public.attendance_schedules (tenant_id);
create index if not exists idx_employees_tenant on public.employees (tenant_id);
