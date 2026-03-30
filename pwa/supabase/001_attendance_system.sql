-- =============================================
-- HRCloud Base - Sistema de Marcación Teletrabajo
-- SCRIPT SQL PARA SUPABASE
-- =============================================
-- INSTRUCCIONES:
-- 1. Ir al SQL Editor de Supabase
-- 2. Ejecutar este script COMPLETO
-- 3. Verificar que las tablas se crearon correctamente
-- =============================================

-- ========================================
-- PASO 1: Extensiones necesarias
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- PASO 2: Tabla de marcaciones (CORE)
-- ========================================
-- Esta tabla almacena cada punch (entrada/salida/descanso)
-- con geolocalización y metadatos de seguridad.

CREATE TABLE IF NOT EXISTS public.attendance_punches (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL,
  employee_id     uuid NOT NULL,
  punch_type      text NOT NULL CHECK (punch_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  punched_at      timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL DEFAULT 'web_pwa' CHECK (source IN ('web_pwa', 'biometric', 'manual', 'import')),
  
  -- Geolocalización
  latitude        double precision,
  longitude       double precision,
  accuracy        double precision,
  
  -- Metadatos de seguridad
  ip_address      text,
  user_agent      text,
  device_id       text,
  
  -- Validación de geocerca
  geofence_status text DEFAULT 'unknown' CHECK (geofence_status IN ('inside', 'outside', 'unknown')),
  
  -- Validación administrativa
  is_valid        boolean DEFAULT true,
  invalidation_reason text,
  
  -- Notas del empleado
  notes           text,

  -- Evidencia de verificación facial (opcional, configurable por tenant)
  selfie_path       text,
  face_match_score  numeric(5,4),
  liveness_score    numeric(5,4),
  face_required     boolean DEFAULT false,
  validation_details jsonb,
  
  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_punches_employee_date 
  ON public.attendance_punches (employee_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_punches_tenant_date 
  ON public.attendance_punches (tenant_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_punches_employee_type 
  ON public.attendance_punches (employee_id, punch_type, punched_at DESC);

-- ========================================
-- PASO 3: Asegurar columnas en employees
-- ========================================
-- Agregar columnas de geocerca y teletrabajo a la tabla employees
-- (solo si no existen ya)

DO $$
BEGIN
  -- Geocerca para teletrabajo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'geofence_lat'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN geofence_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'geofence_lng'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN geofence_lng double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'geofence_radius'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN geofence_radius double precision DEFAULT 200;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'telework_enabled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN telework_enabled boolean DEFAULT false;
  END IF;

  -- Foto y enrolamiento facial (NO guardar biometría cruda en BD)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'photo_path'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN photo_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'face_enrolled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN face_enrolled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'face_provider_ref'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN face_provider_ref text;
  END IF;
END $$;

-- ========================================
-- PASO 4: Tabla de resumen diario
-- ========================================
-- Almacena el resumen calculado por día por empleado

CREATE TABLE IF NOT EXISTS public.attendance_daily_summary (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL,
  employee_id     uuid NOT NULL,
  date            date NOT NULL,
  first_clock_in  timestamptz,
  last_clock_out  timestamptz,
  total_hours     numeric(5,2) DEFAULT 0,
  overtime_hours  numeric(5,2) DEFAULT 0,
  break_minutes   integer DEFAULT 0,
  status          text DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'early_leave', 'holiday', 'rest')),
  is_telework     boolean DEFAULT false,
  punch_count     integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  
  -- Un solo resumen por empleado por día
  CONSTRAINT unique_daily_summary UNIQUE (tenant_id, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_employee 
  ON public.attendance_daily_summary (employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summary_tenant 
  ON public.attendance_daily_summary (tenant_id, date DESC);

-- ========================================
-- PASO 5: Tabla de configuración de asistencia por tenant
-- ========================================
CREATE TABLE IF NOT EXISTS public.attendance_config (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                 uuid NOT NULL UNIQUE,
  geofence_enabled          boolean DEFAULT true,
  default_geofence_radius   integer DEFAULT 200,
  telework_geofence_radius  integer DEFAULT 500,
  require_gps_for_telework  boolean DEFAULT true,
  max_gps_accuracy          integer DEFAULT 50,
  allow_notes_on_punch      boolean DEFAULT true,
  late_tolerance_minutes    integer DEFAULT 5,
  overtime_threshold_hours  numeric(4,2) DEFAULT 8.00,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ========================================
-- PASO 5.1: Configuración de seguridad biométrica por tenant
-- ========================================
-- Esta tabla define si el tenant exige reconocimiento facial y/o liveness.
-- Importante: NO se almacenan embeddings ni biometría cruda en la BD.

CREATE TABLE IF NOT EXISTS public.attendance_security_settings (
  tenant_id              uuid PRIMARY KEY,
  face_enabled           boolean DEFAULT false,
  liveness_enabled       boolean DEFAULT false,
  face_match_threshold   numeric(5,4) DEFAULT 0.80,
  liveness_threshold     numeric(5,4) DEFAULT 0.80,
  provider               text DEFAULT 'none' CHECK (provider IN ('none','aws_rekognition','azure_face','faceapi_client')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ========================================
-- PASO 6.1: Tabla anti-abuso: intentos de marcación
-- ========================================

CREATE TABLE IF NOT EXISTS public.punch_attempts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL,
  employee_id uuid,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success     boolean NOT NULL DEFAULT false,
  reason      text,
  ip_address  text,
  user_agent  text,
  device_id   text,
  details     jsonb
);

CREATE INDEX IF NOT EXISTS idx_punch_attempts_employee_time
  ON public.punch_attempts (employee_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_punch_attempts_tenant_time
  ON public.punch_attempts (tenant_id, attempted_at DESC);

-- ========================================
-- PASO 6: Log de auditoría de marcaciones
-- ========================================
CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     uuid NOT NULL,
  employee_id   uuid,
  action        text NOT NULL,
  details       jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_tenant 
  ON public.attendance_audit_log (tenant_id, created_at DESC);

-- ========================================
-- PASO 7: Habilitar RLS (Row Level Security)
-- ========================================
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_attempts ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PASO 8: Función helper para obtener employee_id del user autenticado
-- ========================================
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  emp_id uuid;
BEGIN
  SELECT id INTO emp_id
  FROM public.employees
  WHERE email = auth.jwt() ->> 'email'
    AND status = 'active'
  LIMIT 1;
  RETURN emp_id;
END;
$$;

-- Función helper para obtener tenant_id del employee del user autenticado
CREATE OR REPLACE FUNCTION public.get_current_employee_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t_id uuid;
BEGIN
  SELECT tenant_id INTO t_id
  FROM public.employees
  WHERE email = auth.jwt() ->> 'email'
    AND status = 'active'
  LIMIT 1;
  RETURN t_id;
END;
$$;

-- ========================================
-- PASO 9: Políticas RLS para attendance_punches
-- ========================================
-- Empleados pueden ver sus propias marcaciones
CREATE POLICY "employees_select_own_punches"
  ON public.attendance_punches
  FOR SELECT
  USING (employee_id = public.get_current_employee_id());

-- Empleados pueden insertar sus propias marcaciones
CREATE POLICY "employees_insert_own_punches"
  ON public.attendance_punches
  FOR INSERT
  WITH CHECK (
    employee_id = public.get_current_employee_id()
    AND tenant_id = public.get_current_employee_tenant_id()
  );

-- Service role tiene acceso total (para supervisores/admin desde Base)
CREATE POLICY "service_role_all_punches"
  ON public.attendance_punches
  FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- PASO 10: Políticas RLS para attendance_daily_summary
-- ========================================
CREATE POLICY "employees_select_own_summary"
  ON public.attendance_daily_summary
  FOR SELECT
  USING (employee_id = public.get_current_employee_id());

CREATE POLICY "service_role_all_summary"
  ON public.attendance_daily_summary
  FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- PASO 11: Políticas RLS para attendance_config
-- ========================================
CREATE POLICY "employees_select_own_config"
  ON public.attendance_config
  FOR SELECT
  USING (tenant_id = public.get_current_employee_tenant_id());

CREATE POLICY "service_role_all_config"
  ON public.attendance_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- PASO 11.1: RLS para attendance_security_settings
-- ========================================
CREATE POLICY "employees_select_own_security_settings"
  ON public.attendance_security_settings
  FOR SELECT
  USING (tenant_id = public.get_current_employee_tenant_id());

CREATE POLICY "service_role_all_security_settings"
  ON public.attendance_security_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- PASO 11.2: RLS para punch_attempts
-- ========================================
CREATE POLICY "employees_select_own_attempts"
  ON public.punch_attempts
  FOR SELECT
  USING (employee_id = public.get_current_employee_id());

CREATE POLICY "service_role_all_attempts"
  ON public.punch_attempts
  FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- PASO 12: Storage Buckets (fotos)
-- ========================================
-- Nota: En Supabase, los buckets se registran en storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('punch-selfies', 'punch-selfies', false)
ON CONFLICT (id) DO NOTHING;

-- Policies Storage: permitir al usuario autenticado insertar/leer sus propios archivos
-- (owner = auth.uid())

DROP POLICY IF EXISTS "punch_selfies_owner_read" ON storage.objects;
CREATE POLICY "punch_selfies_owner_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'punch-selfies' AND owner = auth.uid());

DROP POLICY IF EXISTS "punch_selfies_owner_insert" ON storage.objects;
CREATE POLICY "punch_selfies_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'punch-selfies' AND owner = auth.uid());

DROP POLICY IF EXISTS "employee_photos_owner_read" ON storage.objects;
CREATE POLICY "employee_photos_owner_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "employee_photos_owner_insert" ON storage.objects;
CREATE POLICY "employee_photos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-photos' AND owner = auth.uid());

-- ========================================
-- PASO 12: Políticas RLS para attendance_audit_log
-- ========================================
CREATE POLICY "service_role_all_audit"
  ON public.attendance_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- PASO 13: Trigger para actualizar resumen diario
-- ========================================
CREATE OR REPLACE FUNCTION public.update_daily_summary_on_punch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  punch_date date;
  total_in   timestamptz;
  total_out  timestamptz;
  h_worked   numeric(5,2);
  p_count    integer;
BEGIN
  punch_date := (NEW.punched_at AT TIME ZONE 'America/Guayaquil')::date;
  
  -- Contar marcaciones del día
  SELECT 
    count(*),
    min(CASE WHEN punch_type = 'clock_in' THEN punched_at END),
    max(CASE WHEN punch_type = 'clock_out' THEN punched_at END)
  INTO p_count, total_in, total_out
  FROM public.attendance_punches
  WHERE employee_id = NEW.employee_id
    AND tenant_id = NEW.tenant_id
    AND (punched_at AT TIME ZONE 'America/Guayaquil')::date = punch_date;
  
  -- Calcular horas (simplificado)
  IF total_in IS NOT NULL AND total_out IS NOT NULL THEN
    h_worked := EXTRACT(EPOCH FROM (total_out - total_in)) / 3600.0;
  ELSE
    h_worked := 0;
  END IF;
  
  -- Upsert resumen
  INSERT INTO public.attendance_daily_summary (
    tenant_id, employee_id, date, first_clock_in, last_clock_out,
    total_hours, status, is_telework, punch_count, updated_at
  ) VALUES (
    NEW.tenant_id, NEW.employee_id, punch_date, total_in, total_out,
    h_worked, 
    CASE WHEN total_in IS NOT NULL THEN 'present' ELSE 'absent' END,
    NEW.source = 'web_pwa',
    p_count,
    now()
  )
  ON CONFLICT (tenant_id, employee_id, date)
  DO UPDATE SET
    first_clock_in = EXCLUDED.first_clock_in,
    last_clock_out = EXCLUDED.last_clock_out,
    total_hours = EXCLUDED.total_hours,
    status = EXCLUDED.status,
    is_telework = EXCLUDED.is_telework,
    punch_count = EXCLUDED.punch_count,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_update_daily_summary ON public.attendance_punches;
CREATE TRIGGER trg_update_daily_summary
  AFTER INSERT ON public.attendance_punches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_summary_on_punch();

-- ========================================
-- PASO 14: Trigger para auditoría
-- ========================================
CREATE OR REPLACE FUNCTION public.log_attendance_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.attendance_audit_log (
    tenant_id, employee_id, action, details, ip_address, user_agent
  ) VALUES (
    NEW.tenant_id,
    NEW.employee_id,
    'PUNCH_' || upper(NEW.punch_type),
    jsonb_build_object(
      'punch_id', NEW.id,
      'source', NEW.source,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'accuracy', NEW.accuracy,
      'geofence_status', NEW.geofence_status,
      'notes', NEW.notes
    ),
    NEW.ip_address,
    NEW.user_agent
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_audit ON public.attendance_punches;
CREATE TRIGGER trg_attendance_audit
  AFTER INSERT ON public.attendance_punches
  FOR EACH ROW
  EXECUTE FUNCTION public.log_attendance_audit();

-- ========================================
-- PASO 15: Habilitar Realtime
-- ========================================
-- Para que los cambios en attendance_punches se reflejen en tiempo real

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_punches;

-- ========================================
-- PASO 16: Datos de ejemplo (OPCIONAL)
-- ========================================
-- Descomenta las siguientes líneas si quieres insertar configuración inicial

-- INSERT INTO public.attendance_config (tenant_id, geofence_enabled, require_gps_for_telework)
-- VALUES ('TU-TENANT-ID-AQUI', true, true);

-- ========================================
-- ¡LISTO! El sistema de marcaciones está configurado.
-- ========================================
-- Siguiente paso: Configurar las variables de entorno en el frontend
-- y crear usuarios de prueba en Supabase Auth.
