-- ============================================================
-- MIGRACIÓN: Mejoras al módulo de empleados
-- Version: v4.5.0
-- Fecha: 2026-03-01
-- Descripción: Agrega campos de empleado, departamentos y
--              configuración de reconocimiento facial
-- ============================================================

-- ============================================================
-- 1. TABLA: Departamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Índice de rendimiento
CREATE INDEX IF NOT EXISTS idx_departments_tenant_id
  ON public.departments (tenant_id);

-- ============================================================
-- 2. NUEVOS CAMPOS EN public.employees
-- ============================================================

-- Número de empleado (único por tenant)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

-- Cédula de identidad
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cedula TEXT;

-- Departamento
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Jefe de departamento
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_department_head BOOLEAN NOT NULL DEFAULT false;

-- Fotografía facial (URL en Supabase Storage)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS facial_photo_url TEXT;

-- Discapacidad
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS has_disability BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS disability_card_number TEXT;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS disability_percentage NUMERIC(5,2)
    CHECK (disability_percentage IS NULL OR (disability_percentage >= 0 AND disability_percentage <= 100));

-- Restricción: número de empleado único por tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_tenant_employee_number_key'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_tenant_employee_number_key
      UNIQUE (tenant_id, employee_number);
  END IF;
END $$;

-- ============================================================
-- 3. TABLA: Configuración de Reconocimiento Facial / Calidad de Foto
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance.facial_recognition_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Calidad de imagen
  min_brightness        INTEGER NOT NULL DEFAULT 40
    CHECK (min_brightness BETWEEN 0 AND 255),
  max_brightness        INTEGER NOT NULL DEFAULT 220
    CHECK (max_brightness BETWEEN 0 AND 255),
  min_contrast          INTEGER NOT NULL DEFAULT 30
    CHECK (min_contrast BETWEEN 0 AND 100),
  min_sharpness         INTEGER NOT NULL DEFAULT 50
    CHECK (min_sharpness BETWEEN 0 AND 100),

  -- Dimensiones mínimas de captura
  min_face_width_px     INTEGER NOT NULL DEFAULT 100
    CHECK (min_face_width_px > 0),
  min_face_height_px    INTEGER NOT NULL DEFAULT 100
    CHECK (min_face_height_px > 0),

  -- Ángulo máximo permitido (grados)
  max_tilt_angle        INTEGER NOT NULL DEFAULT 15
    CHECK (max_tilt_angle BETWEEN 0 AND 45),

  -- Número de fotos para captura múltiple
  capture_count         INTEGER NOT NULL DEFAULT 3
    CHECK (capture_count BETWEEN 1 AND 10),

  -- Tiempo de espera entre capturas (segundos)
  capture_interval_sec  INTEGER NOT NULL DEFAULT 2
    CHECK (capture_interval_sec BETWEEN 1 AND 10),

  -- Forzar validación de calidad al registrar empleado
  enforce_on_enrollment BOOLEAN NOT NULL DEFAULT true,

  -- Forzar validación de calidad al marcar asistencia
  enforce_on_attendance BOOLEAN NOT NULL DEFAULT true,

  -- Requiere detección de vivacidad (liveness)
  require_liveness      BOOLEAN NOT NULL DEFAULT false,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_facial_recognition_config_tenant
  ON attendance.facial_recognition_config (tenant_id);

-- ============================================================
-- 4. TRIGGERS de updated_at
-- ============================================================

-- Reutilizamos la función si ya existe
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para departments
DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para facial_recognition_config
DROP TRIGGER IF EXISTS trg_facial_recognition_config_updated_at ON attendance.facial_recognition_config;
CREATE TRIGGER trg_facial_recognition_config_updated_at
  BEFORE UPDATE ON attendance.facial_recognition_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Departamentos
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_tenant_isolation" ON public.departments;
CREATE POLICY "departments_tenant_isolation" ON public.departments
  USING (tenant_id = (
    SELECT tenant_id FROM public.employees
    WHERE user_id = auth.uid()
    LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE user_id = auth.uid()
      AND tenant_id = departments.tenant_id
  ));

-- Reconocimiento facial config
ALTER TABLE attendance.facial_recognition_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facial_config_tenant_isolation" ON attendance.facial_recognition_config;
CREATE POLICY "facial_config_tenant_isolation" ON attendance.facial_recognition_config
  USING (tenant_id = (
    SELECT tenant_id FROM public.employees
    WHERE user_id = auth.uid()
    LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE user_id = auth.uid()
      AND tenant_id = facial_recognition_config.tenant_id
  ));

-- ============================================================
-- 6. GRANTS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments
  TO authenticated;

GRANT SELECT, INSERT, UPDATE ON attendance.facial_recognition_config
  TO authenticated;

-- ============================================================
-- 7. STORAGE BUCKET para fotos faciales
-- ============================================================
-- Ejecutar en Supabase Dashboard > Storage > New Bucket:
-- Nombre: employee-photos
-- Public: false
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- Max file size: 5 MB

-- Policy SQL para el bucket (ejecutar en SQL Editor):
/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-photos',
  'employee-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "employee_photos_tenant_access" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::text FROM public.employees
      WHERE user_id = auth.uid() LIMIT 1
    )
  );
*/

-- ============================================================
-- 8. DATOS SEMILLA - Config de reconocimiento facial por defecto
-- Se inserta automáticamente al crear un nuevo tenant
-- (Agregar en la Edge Function base-create-tenant)
-- ============================================================
-- INSERT INTO attendance.facial_recognition_config (tenant_id)
-- VALUES ('<tenant_id>');
-- El ON CONFLICT (tenant_id) DO NOTHING protege de duplicados.

-- FIN DE MIGRACIÓN
