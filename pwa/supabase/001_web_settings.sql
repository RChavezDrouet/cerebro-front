-- =============================================
-- HRCloud Base - Marcaciones Web (PWA)
-- Tabla de configuración por tenant
-- =============================================

create schema if not exists attendance;

create table if not exists attendance.web_settings (
  tenant_id uuid primary key,
  geo_enabled boolean not null default true,
  geo_max_m integer not null default 400,
  face_enabled boolean not null default true,
  face_threshold real not null default 0.60,
  updated_at timestamptz not null default now()
);

-- (Opcional) Trigger updated_at si quieres

