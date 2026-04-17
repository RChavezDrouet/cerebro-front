-- =============================================================
-- CIRA V2.0 — Seed datos de prueba
-- Tenant: 4bddfca3-04b4-47f0-bff6-3e3145ec095c (New4)
-- Requiere: migraciones C-1 (labor_regime_config) ✅
--           migraciones C-2 (fine_config)
--           migraciones C-5 (overtime_requests)
-- =============================================================

-- ── 1. Empleados de prueba ─────────────────────────────────────────────
-- UUIDs fijos para referencias consistentes en este seed.

INSERT INTO attendance.employees
  (id, tenant_id, employee_code, first_name, last_name, status, first_login_pending)
VALUES
  ('a1000000-0000-0000-0000-000000000001',
   '4bddfca3-04b4-47f0-bff6-3e3145ec095c', 'EMP001', 'Ana',    'García', 'active', false),
  ('a1000000-0000-0000-0000-000000000002',
   '4bddfca3-04b4-47f0-bff6-3e3145ec095c', 'EMP002', 'Carlos', 'Pérez',  'active', false),
  ('a1000000-0000-0000-0000-000000000003',
   '4bddfca3-04b4-47f0-bff6-3e3145ec095c', 'EMP003', 'Juan',   'Torres', 'active', false)
ON CONFLICT (id) DO NOTHING;

-- ── 2. fine_config ────────────────────────────────────────────────────

INSERT INTO attendance.fine_config
  (id, tenant_id, incident_type, calc_method, value, grace_minutes, is_active)
VALUES
  (gen_random_uuid(), '4bddfca3-04b4-47f0-bff6-3e3145ec095c',
   'ATRASO_ENTRADA',         'per_minute',   0.05,  5,  true),
  (gen_random_uuid(), '4bddfca3-04b4-47f0-bff6-3e3145ec095c',
   'ATRASO_ALMUERZO',        'fixed',        2.00,  10, true),
  (gen_random_uuid(), '4bddfca3-04b4-47f0-bff6-3e3145ec095c',
   'SALIDA_TEMPRANA',        'proportional', 1.00,  0,  true),
  (gen_random_uuid(), '4bddfca3-04b4-47f0-bff6-3e3145ec095c',
   'AUSENCIA_INJUSTIFICADA', 'fixed',        20.00, 0,  true)
ON CONFLICT (tenant_id, incident_type) DO UPDATE SET
  calc_method   = EXCLUDED.calc_method,
  value         = EXCLUDED.value,
  grace_minutes = EXCLUDED.grace_minutes,
  is_active     = EXCLUDED.is_active;

-- ── 3. overtime_requests ──────────────────────────────────────────────

INSERT INTO attendance.overtime_requests
  (id, tenant_id, employee_id, requested_date, hours_requested,
   hour_type, justification, status, compensate_as_time,
   reviewed_by, review_note, created_at, updated_at)
VALUES
  (gen_random_uuid(),
   '4bddfca3-04b4-47f0-bff6-3e3145ec095c',
   'a1000000-0000-0000-0000-000000000001',
   '2026-04-14', 2.5, 'SUPLEMENTARIA',
   'Cierre de proyecto cliente urgente — coordinación con equipo externo.',
   'pending', false, null, null,
   now() - interval '2 days', now() - interval '2 days'),

  (gen_random_uuid(),
   '4bddfca3-04b4-47f0-bff6-3e3145ec095c',
   'a1000000-0000-0000-0000-000000000002',
   '2026-04-10', 4.0, 'EXTRAORDINARIA',
   'Mantenimiento preventivo de servidores programado para fin de semana.',
   'approved', false,
   'a1000000-0000-0000-0000-000000000001',
   'Aprobado. Coordinado con TI y registrado en bitácora.',
   now() - interval '6 days', now() - interval '5 days'),

  (gen_random_uuid(),
   '4bddfca3-04b4-47f0-bff6-3e3145ec095c',
   'a1000000-0000-0000-0000-000000000003',
   '2026-04-08', 3.0, 'SUPLEMENTARIA',
   'Apoyo en inventario de bodega por ausencia de compañero.',
   'rejected', false,
   'a1000000-0000-0000-0000-000000000001',
   'Rechazado. No existe autorización previa del jefe de área.',
   now() - interval '8 days', now() - interval '7 days')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Verificación rápida ────────────────────────────────────────────

SELECT 'employees'          AS tabla, count(*) AS filas
  FROM attendance.employees
  WHERE tenant_id = '4bddfca3-04b4-47f0-bff6-3e3145ec095c'
UNION ALL
SELECT 'fine_config',        count(*)
  FROM attendance.fine_config
  WHERE tenant_id = '4bddfca3-04b4-47f0-bff6-3e3145ec095c'
UNION ALL
SELECT 'overtime_requests',  count(*)
  FROM attendance.overtime_requests
  WHERE tenant_id = '4bddfca3-04b4-47f0-bff6-3e3145ec095c'
UNION ALL
SELECT 'labor_regime_config', count(*)
  FROM attendance.labor_regime_config
  WHERE tenant_id = '4bddfca3-04b4-47f0-bff6-3e3145ec095c';

-- ── 5. Reload PostgREST schema cache ──────────────────────────────────

NOTIFY pgrst, 'reload schema';
