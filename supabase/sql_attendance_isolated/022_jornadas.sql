-- =============================================================
-- CIRA V2.0 — attendance.jornadas + jornada_asignaciones
-- =============================================================

-- ── 1. attendance.jornadas ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance.jornadas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  nombre      text        NOT NULL,
  alias       text,
  color       text        NOT NULL DEFAULT '#3B82F6',
  dias_semana int[]       NOT NULL DEFAULT '{1,2,3,4,5}',
  bloques     jsonb       NOT NULL DEFAULT '[{"entrada":"08:00","salida":"17:00"}]',
  break_habilitado         boolean     NOT NULL DEFAULT true,
  break_inicio             time,
  break_fin                time,
  tolerancia_entrada_min   int         NOT NULL DEFAULT 5,
  tolerancia_break_entrada int         NOT NULL DEFAULT 5,
  tolerancia_break_salida  int         NOT NULL DEFAULT 5,
  tolerancia_salida_min    int         NOT NULL DEFAULT 5,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jornadas_tenant_nombre_uq UNIQUE (tenant_id, nombre)
);

-- ── 2. attendance.jornada_asignaciones ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance.jornada_asignaciones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  employee_id uuid        NOT NULL,
  jornada_id  uuid        NOT NULL
              REFERENCES attendance.jornadas(id) ON DELETE CASCADE,
  fecha       date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jornada_asig_emp_fecha_uq UNIQUE (tenant_id, employee_id, fecha)
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jornadas_tenant
  ON attendance.jornadas (tenant_id);

CREATE INDEX IF NOT EXISTS idx_jornada_asig_tenant_emp
  ON attendance.jornada_asignaciones (tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_jornada_asig_fecha
  ON attendance.jornada_asignaciones (fecha);

-- ── 4. Trigger updated_at en jornadas ────────────────────────────────────────

CREATE TRIGGER trg_jornadas_updated_at
  BEFORE UPDATE ON attendance.jornadas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 5. Grants ─────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON attendance.jornadas             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance.jornada_asignaciones TO authenticated;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE attendance.jornadas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance.jornada_asignaciones ENABLE ROW LEVEL SECURITY;

-- jornadas
CREATE POLICY "jornadas_select"
  ON attendance.jornadas FOR SELECT TO authenticated
  USING (tenant_id = attendance.current_tenant_id());

CREATE POLICY "jornadas_manage"
  ON attendance.jornadas FOR ALL TO authenticated
  USING    (tenant_id = attendance.current_tenant_id() AND attendance.can_manage_attendance())
  WITH CHECK (tenant_id = attendance.current_tenant_id() AND attendance.can_manage_attendance());

-- jornada_asignaciones
CREATE POLICY "jornada_asig_select"
  ON attendance.jornada_asignaciones FOR SELECT TO authenticated
  USING (tenant_id = attendance.current_tenant_id());

CREATE POLICY "jornada_asig_manage"
  ON attendance.jornada_asignaciones FOR ALL TO authenticated
  USING    (tenant_id = attendance.current_tenant_id() AND attendance.can_manage_attendance())
  WITH CHECK (tenant_id = attendance.current_tenant_id() AND attendance.can_manage_attendance());

-- ── 7. Reload PostgREST schema cache ──────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
