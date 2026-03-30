-- HRCloud / CEREBRO - RLS policies
-- Objective: staff-only access + permission-based enforcement (prompt requirement).

create schema if not exists cerebro;

-- Enable RLS on cerebro objects managed by Cerebro
alter table cerebro.tenants enable row level security;
alter table cerebro.app_settings enable row level security;
alter table cerebro.plans enable row level security;
alter table cerebro.invoices enable row level security;
alter table cerebro.payments enable row level security;
alter table cerebro.biometric_devices enable row level security;
alter table cerebro.audit_logs enable row level security;
alter table cerebro.user_roles enable row level security;
alter table cerebro.permissions enable row level security;
alter table cerebro.roles enable row level security;
alter table cerebro.role_permissions enable row level security;
alter table cerebro.user_overrides enable row level security;
alter table cerebro.dashboard_layouts enable row level security;
alter table cerebro.password_policies enable row level security;
alter table cerebro.kpi_catalog enable row level security;

-- Helper: current email from JWT
create or replace function cerebro.current_email() returns text as $$
  select nullif(auth.jwt() ->> 'email', '');
$$ language sql stable;

-- Helper: staff membership
create or replace function cerebro.is_staff() returns boolean as $$
  select exists(
    select 1 from cerebro.user_roles ur
    where ur.email = cerebro.current_email()
      and ur.is_active = true
  );
$$ language sql stable;

create or replace function cerebro.current_staff_role() returns text as $$
  select ur.role
  from cerebro.user_roles ur
  where ur.email = cerebro.current_email()
    and ur.is_active = true
  limit 1;
$$ language sql stable;

create or replace function cerebro.is_admin() returns boolean as $$
  select cerebro.current_staff_role() = 'admin';
$$ language sql stable;

-- Permission evaluation with override precedence
create or replace function cerebro.has_permission(p_key text) returns boolean as $$
  with base_role as (
    select cerebro.current_staff_role() as role_key
  ),
  override as (
    select uo.allowed
    from cerebro.user_overrides uo
    where uo.user_email = cerebro.current_email()
      and uo.permission_key = p_key
      and (uo.expires_at is null or uo.expires_at > now())
    limit 1
  ),
  role_allowed as (
    select rp.allowed
    from base_role r
    join cerebro.role_permissions rp on rp.role_key = r.role_key
    where rp.permission_key = p_key
    limit 1
  )
  select coalesce((select allowed from override), (select allowed from role_allowed), false);
$$ language sql stable;

-- ------------------------------------------------------------
-- BASE RULE: everything requires staff membership
-- Then tighten with has_permission() for writes.
-- ------------------------------------------------------------

-- Tenants
create policy if not exists tenants_read
on cerebro.tenants for select to authenticated
using (cerebro.is_staff() and cerebro.has_permission('clients.view'));

create policy if not exists tenants_create
on cerebro.tenants for insert to authenticated
with check (cerebro.is_staff() and cerebro.has_permission('clients.create'));

create policy if not exists tenants_update
on cerebro.tenants for update to authenticated
using (cerebro.is_staff() and cerebro.has_permission('clients.edit'))
with check (cerebro.is_staff() and cerebro.has_permission('clients.edit'));

-- App settings (global paused message + branding)
create policy if not exists app_settings_read
on cerebro.app_settings for select to authenticated
using (cerebro.is_staff());

create policy if not exists app_settings_update
on cerebro.app_settings for update to authenticated
using (cerebro.is_staff() and (cerebro.has_permission('settings.branding.edit') or cerebro.has_permission('settings.paused_message.edit') or cerebro.has_permission('settings.security.edit')))
with check (cerebro.is_staff());

-- Invoices / Payments
create policy if not exists invoices_read
on cerebro.invoices for select to authenticated
using (cerebro.is_staff() and cerebro.has_permission('invoices.view'));

create policy if not exists invoices_write
on cerebro.invoices for insert to authenticated
with check (cerebro.is_staff() and cerebro.has_permission('invoices.create'));

create policy if not exists invoices_update
on cerebro.invoices for update to authenticated
using (cerebro.is_staff() and cerebro.has_permission('invoices.edit'))
with check (cerebro.is_staff() and cerebro.has_permission('invoices.edit'));

create policy if not exists payments_read
on cerebro.payments for select to authenticated
using (cerebro.is_staff() and cerebro.has_permission('payments.view'));

create policy if not exists payments_write
on cerebro.payments for insert to authenticated
with check (cerebro.is_staff() and cerebro.has_permission('payments.create'));

-- Audit logs (append-only)
create policy if not exists audit_read
on cerebro.audit_logs for select to authenticated
using (cerebro.is_staff());

create policy if not exists audit_insert
on cerebro.audit_logs for insert to authenticated
with check (cerebro.is_staff());

-- Staff roles table (admin-only manage)
create policy if not exists staff_read
on cerebro.user_roles for select to authenticated
using (cerebro.is_admin() or (cerebro.current_email() = email));

create policy if not exists staff_admin_write
on cerebro.user_roles for all to authenticated
using (cerebro.is_admin())
with check (cerebro.is_admin());

-- Roles/permissions (admin-only write; staff read)
create policy if not exists perms_read
on cerebro.permissions for select to authenticated
using (cerebro.is_staff());

create policy if not exists roles_read
on cerebro.roles for select to authenticated
using (cerebro.is_staff());

create policy if not exists role_perms_read
on cerebro.role_permissions for select to authenticated
using (cerebro.is_staff());

create policy if not exists roles_admin_write
on cerebro.roles for all to authenticated
using (cerebro.is_admin() and cerebro.has_permission('settings.roles_permissions.edit'))
with check (cerebro.is_admin() and cerebro.has_permission('settings.roles_permissions.edit'));

create policy if not exists perms_admin_write
on cerebro.permissions for all to authenticated
using (cerebro.is_admin() and cerebro.has_permission('settings.roles_permissions.edit'))
with check (cerebro.is_admin() and cerebro.has_permission('settings.roles_permissions.edit'));

create policy if not exists role_perms_admin_write
on cerebro.role_permissions for all to authenticated
using (cerebro.is_admin() and cerebro.has_permission('settings.roles_permissions.edit'))
with check (cerebro.is_admin() and cerebro.has_permission('settings.roles_permissions.edit'));

-- User overrides (admin-only manage; user can read own)
create policy if not exists overrides_read
on cerebro.user_overrides for select to authenticated
using (cerebro.is_admin() or user_email = cerebro.current_email());

create policy if not exists overrides_admin_write
on cerebro.user_overrides for all to authenticated
using (cerebro.is_admin() and cerebro.has_permission('staff.overrides.edit'))
with check (cerebro.is_admin() and cerebro.has_permission('staff.overrides.edit'));

-- Dashboard layouts (each staff manages own)
create policy if not exists dashboard_layouts_readwrite
on cerebro.dashboard_layouts for all to authenticated
using (cerebro.is_staff() and user_email = cerebro.current_email())
with check (cerebro.is_staff() and user_email = cerebro.current_email());

-- Password policies / KPI catalog (admin write, staff read)
create policy if not exists password_policies_read
on cerebro.password_policies for select to authenticated
using (cerebro.is_staff());

create policy if not exists password_policies_admin_write
on cerebro.password_policies for update to authenticated
using (cerebro.is_admin() and cerebro.has_permission('settings.security.edit'))
with check (cerebro.is_admin() and cerebro.has_permission('settings.security.edit'));

create policy if not exists kpi_catalog_read
on cerebro.kpi_catalog for select to authenticated
using (cerebro.is_staff());

create policy if not exists kpi_catalog_admin_write
on cerebro.kpi_catalog for all to authenticated
using (cerebro.is_admin())
with check (cerebro.is_admin());
