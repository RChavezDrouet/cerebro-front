-- ============================================================
-- HRCloud CEREBRO v4.3.0 — Migration SQL
-- Ejecutar en Supabase SQL Editor después del schema base v4.2.1
-- ============================================================

-- ── 1. tenants: campos adicionales si no existen ──────────────
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS employee_count  integer DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspension_date timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS legal_rep_name  text;

-- ── 2. invoices: campo billing_period_start como date ─────────
-- (Ya existe en v421, solo asegurar índice para dashboard)
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON public.invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(billing_period_start);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status, is_suspended);

-- ── 3. RLS policies — user_roles (lectura para staff autenticado) ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'staff_read_own_role'
  ) THEN
    CREATE POLICY staff_read_own_role ON public.user_roles
      FOR SELECT TO authenticated
      USING (email = auth.jwt() ->> 'email');
  END IF;
END $$;

-- ── 4. RLS policies — tenants (solo staff de user_roles puede acceder) ──
DO $$ BEGIN
  -- Drop old permissive policies if any
  DROP POLICY IF EXISTS "allow_all_authenticated" ON public.tenants;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'cerebro_staff_tenants'
  ) THEN
    CREATE POLICY cerebro_staff_tenants ON public.tenants
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.email = auth.jwt() ->> 'email'
        )
      );
  END IF;
END $$;

-- ── 5. RLS policies — invoices ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'cerebro_staff_invoices'
  ) THEN
    CREATE POLICY cerebro_staff_invoices ON public.invoices
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.email = auth.jwt() ->> 'email'
        )
      );
  END IF;
END $$;

-- ── 6. RLS policies — audit_logs ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'cerebro_read_audit'
  ) THEN
    CREATE POLICY cerebro_read_audit ON public.audit_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.email = auth.jwt() ->> 'email'
        )
      );
  END IF;
END $$;

-- ── 7. RLS policies — plans (lectura libre para staff) ────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'cerebro_read_plans'
  ) THEN
    CREATE POLICY cerebro_read_plans ON public.plans
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── 8. RLS policies — app_settings ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'cerebro_settings'
  ) THEN
    CREATE POLICY cerebro_settings ON public.app_settings
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.email = auth.jwt() ->> 'email'
        )
      );
  END IF;
END $$;

-- ── 9. Helper function: current user is cerebro admin ─────────
CREATE OR REPLACE FUNCTION public.is_cerebro_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'admin'
  );
END;
$$;

-- ── 10. Updated_at trigger for tenants ───────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Done ──────────────────────────────────────────────────────
COMMENT ON TABLE public.user_roles IS 'CEREBRO staff roles — source of truth for admin panel access';
COMMENT ON TABLE public.tenants    IS 'Multi-tenant clients — each row = one company using HRCloud';
