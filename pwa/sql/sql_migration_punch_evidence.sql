-- ============================================================
-- HRCloud — attendance.punch_evidence table + RLS
-- Archivo: sql_migration_punch_evidence.sql
-- Ejecutar en Supabase SQL Editor (rol postgres/service_role)
-- ============================================================
-- PROPÓSITO:
--   Tabla de evidencia de marcaciones Web para verificación
--   asíncrona. Cada fila corresponde a un punch en
--   attendance.punches (relación 1:1 o 1:N por reintentos).
--
-- FLUJO:
--   1. PWA inserta punch → attendance.punches
--   2. PWA inserta evidencia → attendance.punch_evidence (best-effort)
--   3. Worker/cron cambia verification_status: pending → ok | failed
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Tabla attendance.punch_evidence
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance.punch_evidence (
  id                   uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  punch_id             uuid          NOT NULL REFERENCES attendance.punches(id) ON DELETE CASCADE,
  tenant_id            uuid          NOT NULL,
  employee_id          uuid          NOT NULL,

  -- Selfie en Storage
  selfie_bucket        text,
  selfie_path          text,
  selfie_uploaded_at   timestamptz,

  -- GPS
  latitude             numeric(10,7),
  longitude            numeric(10,7),
  gps_accuracy_m       integer,
  distance_to_fence_m  integer,
  geofence_ok          boolean,

  -- Dispositivo (jsonb: {device_id, ua, tz})
  device_info          jsonb,

  -- Estado de verificación asíncrona
  verification_status  text          NOT NULL DEFAULT 'pending',
    -- valores: 'pending' | 'ok' | 'failed' | 'skipped'

  -- Metadatos de la verificación (llenado por el worker)
  verification_at      timestamptz,
  verification_detail  jsonb,

  created_at           timestamptz   DEFAULT now()
);

COMMENT ON COLUMN attendance.punch_evidence.verification_status IS
  'pending=aún no verificado, ok=verificado OK, failed=falló, skipped=sin evidencia suficiente';

-- ────────────────────────────────────────────────────────────
-- 2. Índices
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS punch_evidence_punch_id_idx
  ON attendance.punch_evidence(punch_id);

CREATE INDEX IF NOT EXISTS punch_evidence_tenant_employee_idx
  ON attendance.punch_evidence(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS punch_evidence_status_idx
  ON attendance.punch_evidence(verification_status)
  WHERE verification_status = 'pending';

CREATE INDEX IF NOT EXISTS punch_evidence_created_at_idx
  ON attendance.punch_evidence(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 3. RLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE attendance.punch_evidence ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas (idempotente)
DROP POLICY IF EXISTS "punch_evidence_select_own" ON attendance.punch_evidence;
DROP POLICY IF EXISTS "punch_evidence_insert_own" ON attendance.punch_evidence;

-- SELECT: el empleado solo ve su propia evidencia del tenant correcto
CREATE POLICY "punch_evidence_select_own"
  ON attendance.punch_evidence
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND employee_id = (
      SELECT e.id
      FROM attendance.employees e
      WHERE e.user_id = auth.uid()
        AND e.tenant_id = public.current_tenant_id()
      LIMIT 1
    )
  );

-- INSERT: el empleado puede insertar su propia evidencia
CREATE POLICY "punch_evidence_insert_own"
  ON attendance.punch_evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND employee_id = (
      SELECT e.id
      FROM attendance.employees e
      WHERE e.user_id = auth.uid()
        AND e.tenant_id = public.current_tenant_id()
      LIMIT 1
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. Notificar PostgREST para recarga de schema
-- ────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN (ejecutar por separado)
-- ────────────────────────────────────────────────────────────
/*
-- Tabla y RLS activo:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'attendance' AND tablename = 'punch_evidence';

-- Políticas:
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'attendance' AND tablename = 'punch_evidence';

-- Columnas:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'attendance' AND table_name = 'punch_evidence'
ORDER BY ordinal_position;

-- Evidencia reciente (paso 4 del flujo de verificación):
SELECT * FROM attendance.punch_evidence ORDER BY created_at DESC LIMIT 5;
*/
