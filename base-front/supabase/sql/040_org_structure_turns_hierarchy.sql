-- 040_org_structure_turns_hierarchy.sql
-- HRCloud Base / Attendance
-- Jerarquía organizacional multi-tenant + asignaciones efectivas de turnos

create schema if not exists attendance;

create table if not exists attendance.org_level_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  level_no int not null check (level_no between 1 and 7),
  level_key text not null,
  display_name text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, level_no)
);

create table if not exists attendance.org_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  level_no int not null check (level_no between 1 and 7),
  parent_id uuid null references attendance.org_units(id),
  code text not null,
  name text not null,
  description text null,
  responsible_employee_id uuid null references public.employees(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists idx_org_units_tenant_parent on attendance.org_units (tenant_id, parent_id);
create index if not exists idx_org_units_tenant_level on attendance.org_units (tenant_id, level_no);

create table if not exists attendance.employee_org_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  org_unit_id uuid null references attendance.org_units(id),
  supervisor_employee_id uuid null references public.employees(id),
  is_unit_leader boolean not null default false,
  lead_org_unit_id uuid null references attendance.org_units(id),
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_employee_org_assignments_open on attendance.employee_org_assignments (tenant_id, employee_id, effective_to);

create table if not exists attendance.employee_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_id uuid not null references attendance.turns(id),
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_employee_shift_assignments_open on attendance.employee_shift_assignments (tenant_id, employee_id, effective_to);

-- defaults 1..7 por tenant
insert into attendance.org_level_definitions (tenant_id, level_no, level_key, display_name, is_enabled)
select t.id, x.level_no, 'LEVEL_' || x.level_no, x.display_name, x.is_enabled
from public.tenants t
cross join (
  values
    (1, 'Dirección / Gerencia', true),
    (2, 'Departamento', true),
    (3, 'Área', true),
    (4, 'Subárea', false),
    (5, 'Unidad', false),
    (6, 'Sección', false),
    (7, 'Equipo / Frente / Célula', false)
) as x(level_no, display_name, is_enabled)
on conflict (tenant_id, level_no) do nothing;

alter table attendance.org_level_definitions enable row level security;
alter table attendance.org_units enable row level security;
alter table attendance.employee_org_assignments enable row level security;
alter table attendance.employee_shift_assignments enable row level security;

drop policy if exists org_level_definitions_tenant_select on attendance.org_level_definitions;
create policy org_level_definitions_tenant_select on attendance.org_level_definitions
for select using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);
drop policy if exists org_level_definitions_tenant_write on attendance.org_level_definitions;
create policy org_level_definitions_tenant_write on attendance.org_level_definitions
for all using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
)
with check (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);

drop policy if exists org_units_tenant_select on attendance.org_units;
create policy org_units_tenant_select on attendance.org_units
for select using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);
drop policy if exists org_units_tenant_write on attendance.org_units;
create policy org_units_tenant_write on attendance.org_units
for all using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
)
with check (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);

drop policy if exists employee_org_assignments_tenant_select on attendance.employee_org_assignments;
create policy employee_org_assignments_tenant_select on attendance.employee_org_assignments
for select using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);
drop policy if exists employee_org_assignments_tenant_write on attendance.employee_org_assignments;
create policy employee_org_assignments_tenant_write on attendance.employee_org_assignments
for all using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
)
with check (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);

drop policy if exists employee_shift_assignments_tenant_select on attendance.employee_shift_assignments;
create policy employee_shift_assignments_tenant_select on attendance.employee_shift_assignments
for select using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);
drop policy if exists employee_shift_assignments_tenant_write on attendance.employee_shift_assignments;
create policy employee_shift_assignments_tenant_write on attendance.employee_shift_assignments
for all using (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
)
with check (
  tenant_id = coalesce((auth.jwt()->'user_metadata'->>'tenant_id')::uuid, (select p.tenant_id from public.profiles p where p.id = auth.uid()))
);
