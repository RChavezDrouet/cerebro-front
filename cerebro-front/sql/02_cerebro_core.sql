-- HRCloud / CEREBRO - Core seeds and helper functions

create schema if not exists cerebro;

-- ------------------------------------------------------------
-- Helper: updated_at
-- ------------------------------------------------------------
create or replace function cerebro.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;

-- ------------------------------------------------------------
-- Password policy (RF-SEG-01 / RF-SEG-02)
-- ------------------------------------------------------------
create table if not exists cerebro.password_policies (
  id int primary key default 1,
  tenant_password_strength text not null default 'medium' check (tenant_password_strength in ('soft','medium','hard')),
  password_expiry_days int null check (password_expiry_days is null or password_expiry_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into cerebro.password_policies (id)
values (1)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_password_policies_updated') then
    create trigger trg_password_policies_updated before update on cerebro.password_policies
    for each row execute function cerebro.set_updated_at();
  end if;
end $$;

-- ------------------------------------------------------------
-- KPI catalog (admin-managed). Used by dynamic dashboard widgets.
-- ------------------------------------------------------------
create table if not exists cerebro.kpi_catalog (
  key text primary key,
  name text not null,
  description text,
  data_source text not null check (data_source in ('invoices','attendance')),
  default_chart text not null check (default_chart in ('line','bar','donut')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed KPI catalog (based on "Principales KPI de Cobro de Servicios")
insert into cerebro.kpi_catalog(key,name,description,data_source,default_chart)
values
  ('dso','DSO (Days Sales Outstanding)','Tiempo medio (días) para cobrar una factura. Menor es mejor.','invoices','line'),
  ('cei','CEI (Collection Effectiveness Index)','% de cuentas por cobrar efectivamente cobradas en el periodo. Mayor es mejor.','invoices','bar'),
  ('avg_overdue_days','Promedio de Días de Mora','Promedio de días vencidos más allá de la fecha de pago. Menor es mejor.','invoices','line'),
  ('bad_debt_ratio','Bad Debt Ratio','Proporción de ventas no cobrables. Menor es mejor.','invoices','donut'),
  ('high_risk_accounts','% Cuentas Alto Riesgo','Proporción de clientes con alta probabilidad de impago. Menor es mejor.','invoices','donut'),
  ('promise_to_pay','Tasa Conversión Promesas de Pago','Promesas cumplidas / promesas totales. Mayor es mejor.','invoices','bar'),
  ('arpu','ARPU','Ingreso promedio por tenant/cliente en el periodo.','invoices','bar'),
  ('churn','Churn Rate','% de clientes que cancelan / se desactivan en el periodo.','invoices','line'),
  ('active_tenants','Tenants Activos','Conteo de tenants activos.','invoices','donut'),
  ('punch_volume','Volumen de Marcaciones','Conteo de marcaciones en attendance.punches por periodo.','attendance','bar')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Roles and Permissions (19 granular permissions required)
-- ------------------------------------------------------------
insert into cerebro.roles(key,name,description) values
  ('admin','Administrador','Control total del panel Cerebro'),
  ('assistant','Asistente','Operación de clientes, cobranzas y soporte'),
  ('maintenance','Técnico','Mantenimiento y operación técnica')
on conflict (key) do nothing;

insert into cerebro.permissions(key,category,description) values
  ('clients.view','clients','Ver lista y detalle de clientes/tenants'),
  ('clients.create','clients','Crear cliente/tenant'),
  ('clients.edit','clients','Editar cliente/tenant'),
  ('clients.pause_resume','clients','Pausar / reactivar cliente (tenant status)'),
  ('clients.monitor','clients','Ver monitoreo operativo del tenant'),

  ('invoices.view','billing','Ver facturas'),
  ('invoices.create','billing','Crear facturas'),
  ('invoices.edit','billing','Editar facturas'),
  ('payments.view','billing','Ver pagos'),
  ('payments.create','billing','Registrar pagos'),
  ('billing.export','billing','Exportar reportes (Excel/PDF)'),

  ('settings.branding.edit','settings','Editar branding global'),
  ('settings.paused_message.edit','settings','Editar mensaje global de tenant paused'),
  ('settings.security.edit','settings','Editar configuración de seguridad'),
  ('settings.roles_permissions.edit','settings','Editar matriz de roles y permisos'),

  ('staff.view','staff','Ver usuarios internos (admin/assistant/maintenance)'),
  ('staff.create','staff','Crear usuario interno'),
  ('staff.edit','staff','Editar usuario interno'),
  ('staff.overrides.edit','staff','Gestionar overrides por usuario')
on conflict (key) do nothing;

-- Default permission grants
-- Admin: everything
insert into cerebro.role_permissions(role_key, permission_key, allowed)
select 'admin', p.key, true from cerebro.permissions p
on conflict (role_key, permission_key) do update set allowed = excluded.allowed, updated_at = now();

-- Assistant: common operations
insert into cerebro.role_permissions(role_key, permission_key, allowed) values
  ('assistant','clients.view',true),
  ('assistant','clients.edit',true),
  ('assistant','clients.monitor',true),
  ('assistant','invoices.view',true),
  ('assistant','payments.view',true),
  ('assistant','billing.export',true)
on conflict (role_key, permission_key) do update set allowed = excluded.allowed, updated_at = now();

-- Maintenance: monitoring + security view (no billing)
insert into cerebro.role_permissions(role_key, permission_key, allowed) values
  ('maintenance','clients.view',true),
  ('maintenance','clients.monitor',true),
  ('maintenance','settings.security.edit',true)
on conflict (role_key, permission_key) do update set allowed = excluded.allowed, updated_at = now();
