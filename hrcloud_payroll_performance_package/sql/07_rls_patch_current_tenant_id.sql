-- ============================================================
-- HRCloud / Base
-- 07_rls_patch_current_tenant_id.sql
--
-- Reemplaza las policies creadas en 04_security_rls_audit.sql
-- (que usaban attendance.get_my_tenant_id()) por policies que
-- usan attendance.current_tenant_id(), que es la función
-- canónica definida en el schema attendance de producción.
--
-- Aplica a: todas las tablas payroll_* y sus dependientes.
-- Idempotente: usa DROP POLICY IF EXISTS antes de CREATE.
-- ============================================================

-- ─── payroll_periods ─────────────────────────────────────────

ALTER TABLE attendance.payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_periods_tenant_select   ON attendance.payroll_periods;
DROP POLICY IF EXISTS payroll_periods_tenant_modify   ON attendance.payroll_periods;
DROP POLICY IF EXISTS "payroll_periods_all"           ON attendance.payroll_periods;

CREATE POLICY "payroll_periods_all"
  ON attendance.payroll_periods
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_settings ────────────────────────────────────────

ALTER TABLE attendance.payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_settings_tenant_select  ON attendance.payroll_settings;
DROP POLICY IF EXISTS payroll_settings_tenant_modify  ON attendance.payroll_settings;
DROP POLICY IF EXISTS "payroll_settings_all"          ON attendance.payroll_settings;

CREATE POLICY "payroll_settings_all"
  ON attendance.payroll_settings
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_concepts ────────────────────────────────────────

ALTER TABLE attendance.payroll_concepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_concepts_tenant_select  ON attendance.payroll_concepts;
DROP POLICY IF EXISTS payroll_concepts_tenant_modify  ON attendance.payroll_concepts;
DROP POLICY IF EXISTS "payroll_concepts_all"          ON attendance.payroll_concepts;

CREATE POLICY "payroll_concepts_all"
  ON attendance.payroll_concepts
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_formulas ────────────────────────────────────────

ALTER TABLE attendance.payroll_formulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_formulas_tenant_select  ON attendance.payroll_formulas;
DROP POLICY IF EXISTS payroll_formulas_tenant_modify  ON attendance.payroll_formulas;
DROP POLICY IF EXISTS "payroll_formulas_all"          ON attendance.payroll_formulas;

CREATE POLICY "payroll_formulas_all"
  ON attendance.payroll_formulas
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_runs ─────────────────────────────────────────────

ALTER TABLE attendance.payroll_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_runs_tenant_select      ON attendance.payroll_runs;
DROP POLICY IF EXISTS payroll_runs_tenant_modify      ON attendance.payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_all"              ON attendance.payroll_runs;

CREATE POLICY "payroll_runs_all"
  ON attendance.payroll_runs
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_run_collaborators ────────────────────────────────

ALTER TABLE attendance.payroll_run_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_run_collaborators_tenant_select ON attendance.payroll_run_collaborators;
DROP POLICY IF EXISTS payroll_run_collaborators_tenant_modify ON attendance.payroll_run_collaborators;
DROP POLICY IF EXISTS "payroll_run_collaborators_all"         ON attendance.payroll_run_collaborators;

CREATE POLICY "payroll_run_collaborators_all"
  ON attendance.payroll_run_collaborators
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_run_items ────────────────────────────────────────

ALTER TABLE attendance.payroll_run_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_run_items_tenant_select ON attendance.payroll_run_items;
DROP POLICY IF EXISTS payroll_run_items_tenant_modify ON attendance.payroll_run_items;
DROP POLICY IF EXISTS "payroll_run_items_all"         ON attendance.payroll_run_items;

CREATE POLICY "payroll_run_items_all"
  ON attendance.payroll_run_items
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_loans ────────────────────────────────────────────

ALTER TABLE attendance.payroll_loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_loans_tenant_select     ON attendance.payroll_loans;
DROP POLICY IF EXISTS payroll_loans_tenant_modify     ON attendance.payroll_loans;
DROP POLICY IF EXISTS "payroll_loans_all"             ON attendance.payroll_loans;

CREATE POLICY "payroll_loans_all"
  ON attendance.payroll_loans
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_advances ─────────────────────────────────────────

ALTER TABLE attendance.payroll_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_advances_tenant_select  ON attendance.payroll_advances;
DROP POLICY IF EXISTS payroll_advances_tenant_modify  ON attendance.payroll_advances;
DROP POLICY IF EXISTS "payroll_advances_all"          ON attendance.payroll_advances;

CREATE POLICY "payroll_advances_all"
  ON attendance.payroll_advances
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_receipts ─────────────────────────────────────────

ALTER TABLE attendance.payroll_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_receipts_tenant_select  ON attendance.payroll_receipts;
DROP POLICY IF EXISTS payroll_receipts_tenant_modify  ON attendance.payroll_receipts;
DROP POLICY IF EXISTS "payroll_receipts_all"          ON attendance.payroll_receipts;

CREATE POLICY "payroll_receipts_all"
  ON attendance.payroll_receipts
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_iess_exports ─────────────────────────────────────

ALTER TABLE attendance.payroll_iess_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_iess_exports_tenant_select ON attendance.payroll_iess_exports;
DROP POLICY IF EXISTS payroll_iess_exports_tenant_modify ON attendance.payroll_iess_exports;
DROP POLICY IF EXISTS "payroll_iess_exports_all"         ON attendance.payroll_iess_exports;

CREATE POLICY "payroll_iess_exports_all"
  ON attendance.payroll_iess_exports
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── payroll_sri_exports ──────────────────────────────────────

ALTER TABLE attendance.payroll_sri_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_sri_exports_tenant_select ON attendance.payroll_sri_exports;
DROP POLICY IF EXISTS payroll_sri_exports_tenant_modify ON attendance.payroll_sri_exports;
DROP POLICY IF EXISTS "payroll_sri_exports_all"         ON attendance.payroll_sri_exports;

CREATE POLICY "payroll_sri_exports_all"
  ON attendance.payroll_sri_exports
  FOR ALL TO authenticated
  USING      (tenant_id = attendance.current_tenant_id())
  WITH CHECK (tenant_id = attendance.current_tenant_id());

-- ─── Recargar PostgREST ───────────────────────────────────────

NOTIFY pgrst, 'reload schema';
