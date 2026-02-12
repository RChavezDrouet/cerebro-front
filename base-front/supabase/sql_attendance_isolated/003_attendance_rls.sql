-- =======================================================
-- HRCloud Base — Asistencia (AISLADO)
-- 003_attendance_rls.sql
-- Grants + RLS policies (OWASP: Broken Access Control)
-- =======================================================

grant usage on schema attendance to anon, authenticated;

-- membership table: nadie la lee directo (solo vía view)
revoke all on table attendance.memberships from anon, authenticated;

-- view para resolver tenant/rol
grant select on attendance.my_memberships to authenticated;

-- grants a tablas principales
grant select, insert, update, delete on attendance.settings  to authenticated;
grant select, insert, update, delete on attendance.turns     to authenticated;
grant select, insert, update, delete on attendance.schedules to authenticated;
grant select, insert, update, delete on attendance.employees to authenticated;

grant execute on function attendance.current_tenant_id()     to authenticated;
grant execute on function attendance.current_user_role()     to authenticated;
grant execute on function attendance.can_manage_attendance() to authenticated;

alter table attendance.settings  enable row level security;
alter table attendance.turns     enable row level security;
alter table attendance.schedules enable row level security;
alter table attendance.employees enable row level security;

-- SETTINGS

drop policy if exists settings_select on attendance.settings;
create policy settings_select on attendance.settings
for select to authenticated
using (tenant_id = attendance.current_tenant_id());

drop policy if exists settings_insert on attendance.settings;
create policy settings_insert on attendance.settings
for insert to authenticated
with check (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance());

drop policy if exists settings_update on attendance.settings;
create policy settings_update on attendance.settings
for update to authenticated
using (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance())
with check (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance());

-- TURNS

drop policy if exists turns_select on attendance.turns;
create policy turns_select on attendance.turns
for select to authenticated
using (tenant_id = attendance.current_tenant_id());

drop policy if exists turns_write on attendance.turns;
create policy turns_write on attendance.turns
for all to authenticated
using (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance())
with check (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance());

-- SCHEDULES

drop policy if exists schedules_select on attendance.schedules;
create policy schedules_select on attendance.schedules
for select to authenticated
using (tenant_id = attendance.current_tenant_id());

drop policy if exists schedules_write on attendance.schedules;
create policy schedules_write on attendance.schedules
for all to authenticated
using (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance())
with check (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance());

-- EMPLOYEES

drop policy if exists employees_select on attendance.employees;
create policy employees_select on attendance.employees
for select to authenticated
using (
  tenant_id = attendance.current_tenant_id()
  and (
    attendance.can_manage_attendance()
    or user_id = auth.uid()
  )
);

drop policy if exists employees_write on attendance.employees;
create policy employees_write on attendance.employees
for all to authenticated
using (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance())
with check (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance());
