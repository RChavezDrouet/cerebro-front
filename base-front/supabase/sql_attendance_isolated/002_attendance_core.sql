-- =======================================================
-- HRCloud Base — Asistencia (AISLADO)
-- 002_attendance_core.sql
-- Tablas core + funciones auxiliares (NO toca public.*)
-- =======================================================

-- 1) Memberships (usuario -> tenant + rol)
create table if not exists attendance.memberships (
  tenant_id uuid not null,
  user_id uuid not null,
  role text not null default 'employee', -- tenant_admin | hr_admin | admin | employee
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- FK a auth.users (opcional, no afecta Cerebro)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'attendance_memberships_user_fk'
  ) then
    alter table attendance.memberships
      add constraint attendance_memberships_user_fk
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists attendance_memberships_user_idx
on attendance.memberships(user_id);

-- 2) View segura: memberships del usuario actual
create or replace view attendance.my_memberships
with (security_barrier = true) as
select tenant_id, role
from attendance.memberships
where user_id = auth.uid();

-- 3) Helpers (AISLADOS: no public.*)
create or replace function attendance.current_tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'tenant_id','')::uuid,
    (select tenant_id from attendance.my_memberships limit 1)
  );
$$;

create or replace function attendance.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_role',''),
    (select role from attendance.my_memberships limit 1),
    'employee'
  );
$$;

create or replace function attendance.can_manage_attendance()
returns boolean
language sql
stable
as $$
  select attendance.current_user_role() in ('tenant_admin','hr_admin','admin');
$$;

-- 4) Settings por tenant (modo excluyente biométrico vs web)
create table if not exists attendance.settings (
  tenant_id uuid primary key,
  mode attendance.mode not null default 'biometric',
  timezone text not null default 'America/Guayaquil',
  created_at timestamptz not null default now()
);

-- 5) Turnos
create table if not exists attendance.turns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default attendance.current_tenant_id(),
  name text not null,
  type attendance.turn_type not null,
  color text not null,
  days int[] not null, -- 1..7 (ISO): Lun=1 ... Dom=7
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint attendance_turns_days_chk check (
    array_length(days, 1) is not null
    and array_length(days, 1) >= 1
    and array_position(days, null) is null
    and days <@ ARRAY[1,2,3,4,5,6,7]::int[]
  )
);

-- Unicidad por tenant (usar UNIQUE INDEX para compatibilidad)
create unique index if not exists attendance_turns_tenant_id_id_uk
on attendance.turns (tenant_id, id);

create unique index if not exists attendance_turns_tenant_name_uk
on attendance.turns (tenant_id, name);

create index if not exists attendance_turns_tenant_idx
on attendance.turns (tenant_id);

-- 6) Horarios
create table if not exists attendance.schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default attendance.current_tenant_id(),
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

create unique index if not exists attendance_schedules_tenant_id_id_uk
on attendance.schedules (tenant_id, id);

create unique index if not exists attendance_schedules_tenant_name_uk
on attendance.schedules (tenant_id, name);

create index if not exists attendance_schedules_tenant_idx
on attendance.schedules (tenant_id);

-- FK compuesta: evita schedule->turn de otro tenant
-- (no existe IF NOT EXISTS para constraints, usamos pg_constraint)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_schedules_turn_fk') then
    alter table attendance.schedules
      add constraint attendance_schedules_turn_fk
      foreign key (tenant_id, turn_id)
      references attendance.turns (tenant_id, id)
      on delete restrict;
  end if;
end $$;

-- 7) Empleados
create table if not exists attendance.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default attendance.current_tenant_id(),
  user_id uuid null,
  employee_code text not null, -- único por tenant
  first_name text not null,
  last_name text not null,
  status attendance.employee_status not null default 'active',
  schedule_id uuid not null,
  biometric_employee_code text null,
  created_at timestamptz not null default now()
);

create unique index if not exists attendance_employees_tenant_id_id_uk
on attendance.employees (tenant_id, id);

create unique index if not exists attendance_employees_tenant_employee_code_uk
on attendance.employees (tenant_id, employee_code);

create index if not exists attendance_employees_tenant_idx
on attendance.employees (tenant_id);

create index if not exists attendance_employees_user_idx
on attendance.employees (user_id);

-- FK compuesta: evita employee->schedule de otro tenant
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_employees_schedule_fk') then
    alter table attendance.employees
      add constraint attendance_employees_schedule_fk
      foreign key (tenant_id, schedule_id)
      references attendance.schedules (tenant_id, id)
      on delete restrict;
  end if;
end $$;
