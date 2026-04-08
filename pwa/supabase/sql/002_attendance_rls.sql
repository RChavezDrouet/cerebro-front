-- =======================================================
-- RLS policies (multi-tenant)
-- =======================================================

alter table public.attendance_turns enable row level security;
alter table public.attendance_schedules enable row level security;
alter table public.employees enable row level security;

-- NOTE:
-- current_tenant_id() must return non-null for authenticated users.

-- turns
drop policy if exists turns_select on public.attendance_turns;
create policy turns_select on public.attendance_turns
for select to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists turns_insert on public.attendance_turns;
create policy turns_insert on public.attendance_turns
for insert to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists turns_update on public.attendance_turns;
create policy turns_update on public.attendance_turns
for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists turns_delete on public.attendance_turns;
create policy turns_delete on public.attendance_turns
for delete to authenticated
using (tenant_id = public.current_tenant_id());

-- schedules
drop policy if exists schedules_select on public.attendance_schedules;
create policy schedules_select on public.attendance_schedules
for select to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists schedules_insert on public.attendance_schedules;
create policy schedules_insert on public.attendance_schedules
for insert to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists schedules_update on public.attendance_schedules;
create policy schedules_update on public.attendance_schedules
for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists schedules_delete on public.attendance_schedules;
create policy schedules_delete on public.attendance_schedules
for delete to authenticated
using (tenant_id = public.current_tenant_id());

-- employees
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
for select to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
for insert to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees
for delete to authenticated
using (tenant_id = public.current_tenant_id());
