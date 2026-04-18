-- Migration 007: Employee dependents (cargas familiares)
-- Art. 6 y 7 Código de Trabajo Ecuador — cálculo 5% utilidades
-- Run directly in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.employee_dependents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL,
  employee_id       uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  full_name         text        NOT NULL,
  birth_date        date,
  identification    text,
  relationship      text        NOT NULL
    CHECK (relationship IN ('CONYUGE','UNION_HECHO','HIJO')),
  has_disability    boolean     DEFAULT false,
  is_active         boolean     DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_dependents_employee ON public.employee_dependents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_dependents_tenant   ON public.employee_dependents(tenant_id);

ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.employee_dependents
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Track when cargas were formally registered (deadline: 30 de marzo)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS dependents_registered_at date;

NOTIFY pgrst, 'reload schema';

-- Summary:
--   New table: public.employee_dependents
--     relationship: CONYUGE | UNION_HECHO | HIJO
--   New column: public.employees.dependents_registered_at (date)
