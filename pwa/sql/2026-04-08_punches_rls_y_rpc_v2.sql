-- ============================================================
-- HRCloud — attendance.punches RLS + RPC extendida
-- Archivo: 2026-04-08_punches_rls_y_rpc_v2.sql
-- Ejecutar en Supabase SQL Editor (rol postgres/service_role)
-- ============================================================
-- CONTEXTO:
--   attendance.punches actualmente NO tiene RLS.
--   Cualquier usuario autenticado puede leer marcaciones de
--   otros tenants — riesgo crítico en producción multi-tenant.
--
-- CAMBIOS EN ESTE SCRIPT:
--   1. Habilitar RLS en attendance.punches
--   2. Políticas tenant-scoped (lectura y escritura)
--   3. Política especial para punch_attempts (si no existe ya)
--   4. Extender register_web_punch para aceptar photo_url
--      y accuracy_m en el jsonb de evidence (retrocompatible)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RLS en attendance.punches
-- ────────────────────────────────────────────────────────────

-- Asegurarse de que RLS existe en la tabla
ALTER TABLE attendance.punches ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas para recrearlas limpias
DROP POLICY IF EXISTS "punches_select_own_tenant"  ON attendance.punches;
DROP POLICY IF EXISTS "punches_insert_own_tenant"  ON attendance.punches;
DROP POLICY IF EXISTS "punches_update_own_tenant"  ON attendance.punches;
DROP POLICY IF EXISTS "punches_delete_own_tenant"  ON attendance.punches;

-- SELECT: el empleado solo ve sus propias marcaciones del tenant correcto
-- NOTA: public.current_tenant_id() ya existe en el proyecto (001_current_tenant_and_first_login.sql)
CREATE POLICY "punches_select_own_tenant"
  ON attendance.punches
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

-- INSERT: solo a través de la RPC register_web_punch (security definer).
-- Bloqueamos insert directo del cliente para forzar el flujo validado.
-- Si necesitas permitir inserts directos para testing, comenta esta policy
-- y usa una permisiva temporalmente.
CREATE POLICY "punches_insert_own_tenant"
  ON attendance.punches
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

-- UPDATE / DELETE: deshabilitado para empleados.
-- Solo roles administrativos (service_role) pueden modificar marcaciones.
-- Si en el futuro CEREBRO necesita corregir marcaciones desde el panel,
-- se debe crear una RPC security definer para ese flujo.
-- (No crear políticas UPDATE/DELETE aquí evita el riesgo de edición accidental.)

-- ────────────────────────────────────────────────────────────
-- 2. RLS en attendance.punch_attempts (si no tiene ya)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Solo aplica si la tabla existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'attendance'
      AND table_name = 'punch_attempts'
  ) THEN
    EXECUTE 'ALTER TABLE attendance.punch_attempts ENABLE ROW LEVEL SECURITY';

    -- Drop previas si existen
    EXECUTE 'DROP POLICY IF EXISTS "attempts_select_own" ON attendance.punch_attempts';
    EXECUTE 'DROP POLICY IF EXISTS "attempts_insert_own" ON attendance.punch_attempts';

    -- SELECT: el empleado solo ve sus propios intentos
    EXECUTE $pol$
      CREATE POLICY "attempts_select_own"
        ON attendance.punch_attempts
        FOR SELECT
        TO authenticated
        USING (
          tenant_id = public.current_tenant_id()
          AND employee_id = (
            SELECT e.id FROM attendance.employees e
            WHERE e.user_id = auth.uid()
              AND e.tenant_id = public.current_tenant_id()
            LIMIT 1
          )
        )
    $pol$;

    -- INSERT: permitido (el hook registra intentos best-effort)
    EXECUTE $pol$
      CREATE POLICY "attempts_insert_own"
        ON attendance.punch_attempts
        FOR INSERT
        TO authenticated
        WITH CHECK (
          tenant_id = public.current_tenant_id()
          AND employee_id = (
            SELECT e.id FROM attendance.employees e
            WHERE e.user_id = auth.uid()
              AND e.tenant_id = public.current_tenant_id()
            LIMIT 1
          )
        )
    $pol$;

    RAISE NOTICE 'RLS habilitado en attendance.punch_attempts';
  ELSE
    RAISE NOTICE 'attendance.punch_attempts no existe — saltando RLS';
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. register_web_punch v2 — retrocompatible
-- Cambios:
--   - Acepta p_photo_url TEXT (URL de la selfie en Storage)
--   - Acepta p_accuracy_m INT (precisión GPS en metros)
--   - Los guarda dentro de p_evidence si el caller no los envía
--     ya en el jsonb (el hook actual los mete en evidence.selfie y evidence.geo)
--   - Sin cambios en la firma de parámetros existentes (retrocompatible)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION attendance.register_web_punch(
  p_action        text,
  p_punched_at    timestamptz  DEFAULT now(),
  p_evidence      jsonb        DEFAULT '{}'::jsonb,
  p_verification  jsonb        DEFAULT '{}'::jsonb,
  p_serial_no     text         DEFAULT NULL,
  -- NUEVOS parámetros opcionales (v2) — el frontend puede enviarlos
  -- independientemente o dentro de p_evidence. La función los combina.
  p_photo_url     text         DEFAULT NULL,
  p_accuracy_m    int          DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = attendance, public
AS $$
DECLARE
  v_tenant_id       uuid;
  v_employee_id     uuid;
  v_employee_status text;
  v_tenant_status   text;
  v_is_suspended    boolean;
  v_last_action     text;
  v_punch_id        uuid := gen_random_uuid();
  v_meta            jsonb;
  v_evidence        jsonb;
BEGIN
  v_tenant_id := public.current_tenant_id();

  -- Resolver employee
  SELECT e.id, lower(coalesce(e.status, ''))
    INTO v_employee_id, v_employee_status
  FROM attendance.employees e
  WHERE e.user_id = auth.uid()
    AND e.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_LINKED';
  END IF;

  IF v_employee_status NOT IN ('active','probation','permanent','contract','activo') THEN
    RAISE EXCEPTION 'EMPLOYEE_INACTIVE';
  END IF;

  -- Verificar tenant activo
  SELECT lower(coalesce(t.status, '')), coalesce(t.is_suspended, false)
    INTO v_tenant_status, v_is_suspended
  FROM public.tenants t
  WHERE t.id = v_tenant_id
  LIMIT 1;

  IF v_tenant_status <> 'active' OR v_is_suspended = true THEN
    RAISE EXCEPTION 'TENANT_BLOCKED';
  END IF;

  -- Última acción del día (para validación de secuencia)
  SELECT coalesce((p.evidence ->> 'action'), '')
    INTO v_last_action
  FROM attendance.punches p
  WHERE p.tenant_id = v_tenant_id
    AND p.employee_id = v_employee_id
    AND p.punched_at::date = p_punched_at::date
  ORDER BY p.punched_at DESC
  LIMIT 1;

  -- Validación de secuencia
  IF p_action = 'clock_in'    AND v_last_action = 'clock_in'    THEN RAISE EXCEPTION 'SEQUENCE_CLOCK_IN'; END IF;
  IF p_action = 'clock_out'   AND v_last_action <> 'clock_in'   THEN RAISE EXCEPTION 'SEQUENCE_CLOCK_OUT'; END IF;
  IF p_action = 'break_start' AND v_last_action <> 'clock_in'   THEN RAISE EXCEPTION 'SEQUENCE_BREAK_START'; END IF;
  IF p_action = 'break_end'   AND v_last_action <> 'break_start' THEN RAISE EXCEPTION 'SEQUENCE_BREAK_END'; END IF;

  -- Combinar evidence con los nuevos parámetros opcionales
  -- Si el hook ya los incluyó en p_evidence, no se sobreescriben.
  v_evidence := p_evidence;

  -- photo_url: si viene como parámetro y no está en evidence.selfie.path, lo añadimos
  IF p_photo_url IS NOT NULL AND (v_evidence -> 'selfie') IS NULL THEN
    v_evidence := jsonb_set(v_evidence, '{selfie}', jsonb_build_object('url', p_photo_url));
  END IF;

  -- accuracy_m: si viene como parámetro y evidence.geo.accuracy_m no existe, lo inyectamos
  IF p_accuracy_m IS NOT NULL THEN
    IF (v_evidence -> 'geo') IS NOT NULL THEN
      -- geo ya existe, añadir/actualizar accuracy_m
      v_evidence := jsonb_set(
        v_evidence,
        '{geo,accuracy_m}',
        to_jsonb(p_accuracy_m),
        true  -- create if missing
      );
    ELSE
      -- geo no existe, crear objeto mínimo
      v_evidence := jsonb_set(
        v_evidence,
        '{geo}',
        jsonb_build_object('accuracy_m', p_accuracy_m)
      );
    END IF;
  END IF;

  v_meta := jsonb_build_object('status', 'OK', 'verify_type', '15', 'rpc_version', '2');

  INSERT INTO attendance.punches (
    id,
    tenant_id,
    employee_id,
    punched_at,
    source,
    serial_no,
    verification,
    evidence,
    meta
  ) VALUES (
    v_punch_id,
    v_tenant_id,
    v_employee_id,
    p_punched_at,
    'web',
    p_serial_no,
    p_verification,
    v_evidence,
    v_meta
  );

  -- Registrar intento exitoso (best-effort)
  BEGIN
    INSERT INTO attendance.punch_attempts (
      tenant_id, employee_id, attempted_at, action, ok, step, reason, meta
    ) VALUES (
      v_tenant_id, v_employee_id, now(), p_action, true, 'insert', null,
      jsonb_build_object('punch_id', v_punch_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_punch_id;

EXCEPTION WHEN OTHERS THEN
  -- Registrar intento fallido (best-effort)
  BEGIN
    INSERT INTO attendance.punch_attempts (
      tenant_id, employee_id, attempted_at, action, ok, step, reason, meta
    ) VALUES (
      coalesce(v_tenant_id, public.current_tenant_id()),
      v_employee_id,
      now(), p_action, false, 'insert', sqlerrm,
      jsonb_build_object('evidence', p_evidence, 'verification', p_verification)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END;
$$;

-- Revocar y regregar permisos (idempotente)
REVOKE ALL ON FUNCTION attendance.register_web_punch(text, timestamptz, jsonb, jsonb, text, text, int)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION attendance.register_web_punch(text, timestamptz, jsonb, jsonb, text, text, int)
  TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. Recargar schema PostgREST (siempre al final de migraciones)
-- ────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN RÁPIDA (ejecutar por separado para confirmar)
-- ────────────────────────────────────────────────────────────
/*
-- Verificar que RLS está activo:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'attendance'
  AND tablename IN ('punches', 'punch_attempts');

-- Verificar políticas creadas:
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'attendance'
  AND tablename IN ('punches', 'punch_attempts')
ORDER BY tablename, policyname;

-- Verificar firma nueva de la función:
SELECT p.proname, pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'attendance'
  AND p.proname = 'register_web_punch';
*/
