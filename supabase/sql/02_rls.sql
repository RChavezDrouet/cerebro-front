-- ============================================================
-- CEREBRO (HRCloud) - RLS / Policies (OWASP / Zero Trust)
-- ============================================================
-- Fix al error reportado:
--   "ERROR: 42601: syntax error at or near ',' ... for insert, update"
-- En Postgres, se crean políticas separadas para INSERT y UPDATE.

-- Helpers por email (Opción B: user_roles.email)
create or replace function public.current_email() returns text
language sql stable as $$
  select nullif(auth.jwt() ->> 'email', '')::text;
$$;

create or replace function public.has_role(_role text) returns boolean
language sql stable as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.email = public.current_email()
      and ur.role = _role
  );
$$;

create or replace function public.is_internal() returns boolean
language sql stable as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.email = public.current_email()
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.has_role('admin');
$$;

create or replace function public.is_assistant() returns boolean
language sql stable as $$
  select public.has_role('assistant');
$$;

create or replace function public.is_maintenance() returns boolean
language sql stable as $$
  select public.has_role('maintenance');
$$;

-- =====================
-- Habilitar RLS
-- =====================
alter table public.app_settings enable row level security;
alter table public.smtp_settings enable row level security;
alter table public.billing_settings enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.security_settings enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.invoices enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.audit_logs enable row level security;

-- =====================
-- app_settings (Brand) - solo lectura internos, escritura admin
-- =====================
drop policy if exists "app_settings_select_internal" on public.app_settings;
create policy "app_settings_select_internal" on public.app_settings
  for select to authenticated
  using (public.is_internal());

drop policy if exists "app_settings_admin_insert" on public.app_settings;
create policy "app_settings_admin_insert" on public.app_settings
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "app_settings_admin_update" on public.app_settings;
create policy "app_settings_admin_update" on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- smtp_settings - lectura internos, escritura admin
drop policy if exists "smtp_settings_select_internal" on public.smtp_settings;
create policy "smtp_settings_select_internal" on public.smtp_settings
  for select to authenticated
  using (public.is_internal());

drop policy if exists "smtp_settings_admin_upd" on public.smtp_settings;
create policy "smtp_settings_admin_upd" on public.smtp_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- billing_settings - lectura internos, escritura admin
drop policy if exists "billing_settings_select_internal" on public.billing_settings;
create policy "billing_settings_select_internal" on public.billing_settings
  for select to authenticated
  using (public.is_internal());

drop policy if exists "billing_settings_admin_upd" on public.billing_settings;
create policy "billing_settings_admin_upd" on public.billing_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- kpi_targets - lectura internos, escritura admin
drop policy if exists "kpi_targets_select_internal" on public.kpi_targets;
create policy "kpi_targets_select_internal" on public.kpi_targets
  for select to authenticated
  using (public.is_internal());

drop policy if exists "kpi_targets_admin_upd" on public.kpi_targets;
create policy "kpi_targets_admin_upd" on public.kpi_targets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- security_settings - lectura internos, escritura admin
drop policy if exists "security_settings_select_internal" on public.security_settings;
create policy "security_settings_select_internal" on public.security_settings
  for select to authenticated
  using (public.is_internal());

drop policy if exists "security_settings_admin_upd" on public.security_settings;
create policy "security_settings_admin_upd" on public.security_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_roles
-- * lectura: admin ve todos; cada usuario ve su propia fila (por email)
drop policy if exists "user_roles_select_self_or_admin" on public.user_roles;
create policy "user_roles_select_self_or_admin" on public.user_roles
  for select to authenticated
  using (public.is_admin() or email = public.current_email());

-- * admin gestiona
drop policy if exists "user_roles_admin_insert" on public.user_roles;
create policy "user_roles_admin_insert" on public.user_roles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "user_roles_admin_update" on public.user_roles;
create policy "user_roles_admin_update" on public.user_roles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete" on public.user_roles
  for delete to authenticated
  using (public.is_admin());

-- role_permissions: lectura interna, escritura admin
drop policy if exists "role_permissions_select_internal" on public.role_permissions;
create policy "role_permissions_select_internal" on public.role_permissions
  for select to authenticated
  using (public.is_internal());

drop policy if exists "role_permissions_admin_upd" on public.role_permissions;
create policy "role_permissions_admin_upd" on public.role_permissions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "role_permissions_admin_insert" on public.role_permissions;
create policy "role_permissions_admin_insert" on public.role_permissions
  for insert to authenticated
  with check (public.is_admin());

-- plans: lectura interna, escritura admin
drop policy if exists "plans_select_internal" on public.plans;
create policy "plans_select_internal" on public.plans
  for select to authenticated
  using (public.is_internal());

drop policy if exists "plans_admin_write" on public.plans;
create policy "plans_admin_write" on public.plans
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "plans_admin_update" on public.plans;
create policy "plans_admin_update" on public.plans
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- tenants: lectura admin/assistant, escritura admin/assistant
drop policy if exists "tenants_select_admin_assistant" on public.tenants;
create policy "tenants_select_admin_assistant" on public.tenants
  for select to authenticated
  using (public.is_admin() or public.is_assistant());

drop policy if exists "tenants_insert_admin_assistant" on public.tenants;
create policy "tenants_insert_admin_assistant" on public.tenants
  for insert to authenticated
  with check (public.is_admin() or public.is_assistant());

drop policy if exists "tenants_update_admin_assistant" on public.tenants;
create policy "tenants_update_admin_assistant" on public.tenants
  for update to authenticated
  using (public.is_admin() or public.is_assistant())
  with check (public.is_admin() or public.is_assistant());

-- invoices: lectura admin/assistant, escritura admin/assistant
drop policy if exists "invoices_select_admin_assistant" on public.invoices;
create policy "invoices_select_admin_assistant" on public.invoices
  for select to authenticated
  using (public.is_admin() or public.is_assistant());

drop policy if exists "invoices_write_admin_assistant" on public.invoices;
create policy "invoices_write_admin_assistant" on public.invoices
  for insert to authenticated
  with check (public.is_admin() or public.is_assistant());

drop policy if exists "invoices_update_admin_assistant" on public.invoices;
create policy "invoices_update_admin_assistant" on public.invoices
  for update to authenticated
  using (public.is_admin() or public.is_assistant())
  with check (public.is_admin() or public.is_assistant());

-- messages: lectura para roles destino, escritura admin/assistant
drop policy if exists "messages_select_target_roles" on public.messages;
create policy "messages_select_target_roles" on public.messages
  for select to authenticated
  using (
    public.is_internal()
    and (
      'all' = any(target_roles)
      or (public.is_admin() and 'admin' = any(target_roles))
      or (public.is_assistant() and 'assistant' = any(target_roles))
      or (public.is_maintenance() and 'maintenance' = any(target_roles))
    )
  );

drop policy if exists "messages_insert_admin_assistant" on public.messages;
create policy "messages_insert_admin_assistant" on public.messages
  for insert to authenticated
  with check (public.is_admin() or public.is_assistant());

-- message_reads: cada usuario maneja sus lecturas
drop policy if exists "message_reads_rw_self" on public.message_reads;
create policy "message_reads_rw_self" on public.message_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_logs: insert interno; select admin/maintenance
drop policy if exists "audit_logs_insert_internal" on public.audit_logs;
create policy "audit_logs_insert_internal" on public.audit_logs
  for insert to authenticated
  with check (public.is_internal());

drop policy if exists "audit_logs_select_admin_maintenance" on public.audit_logs;
create policy "audit_logs_select_admin_maintenance" on public.audit_logs
  for select to authenticated
  using (public.is_admin() or public.is_maintenance());
