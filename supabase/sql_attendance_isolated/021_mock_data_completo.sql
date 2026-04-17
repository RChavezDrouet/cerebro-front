-- =============================================================
-- HRCloud Mock Data — Tenant principal
-- Tenant: 8cb84ecf-4d74-4aac-84cc-0c66da4aa656
-- Schedule: ac000001-0000-0000-0000-000000000001 (Jornada Diurna)
-- Idempotente (ON CONFLICT DO NOTHING)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- SECCIÓN 1 — public.employees
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.employees
  (id, tenant_id, first_name, last_name, email, identification, hire_date, salary, employment_status)
VALUES
  ('a1000001-0000-0000-0000-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','Ana',    'Garcia',  'ana.garcia@empresa.com',   '0901234001','2023-01-15',460,'active'),
  ('a1000001-0000-0000-0000-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','Carlos', 'Perez',   'carlos.perez@empresa.com', '0901234002','2022-06-01',460,'active'),
  ('a1000001-0000-0000-0000-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','Maria',  'Lopez',   'maria.lopez@empresa.com',  '0901234003','2021-03-10',520,'active'),
  ('a1000001-0000-0000-0000-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','Juan',   'Torres',  'juan.torres@empresa.com',  '0901234004','2023-08-20',460,'active'),
  ('a1000001-0000-0000-0000-000000000005','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','Laura',  'Mendez',  'laura.mendez@empresa.com', '0901234005','2020-11-05',480,'active'),
  ('a1000001-0000-0000-0000-000000000006','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','Pedro',  'Sanchez', 'pedro.sanchez@empresa.com','0901234006','2019-02-28',600,'active')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SECCIÓN 2 — attendance.employees_legacy
-- ─────────────────────────────────────────────────────────────
INSERT INTO attendance.employees_legacy
  (id, tenant_id, employee_code, first_name, last_name, status, schedule_id, first_login_pending)
VALUES
  ('a1000001-0000-0000-0000-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','EMP001','Ana',    'Garcia',  'active','ac000001-0000-0000-0000-000000000001',false),
  ('a1000001-0000-0000-0000-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','EMP002','Carlos', 'Perez',   'active','ac000001-0000-0000-0000-000000000001',false),
  ('a1000001-0000-0000-0000-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','EMP003','Maria',  'Lopez',   'active','ac000001-0000-0000-0000-000000000001',false),
  ('a1000001-0000-0000-0000-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','EMP004','Juan',   'Torres',  'active','ac000001-0000-0000-0000-000000000001',false),
  ('a1000001-0000-0000-0000-000000000005','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','EMP005','Laura',  'Mendez',  'active','ac000001-0000-0000-0000-000000000001',false),
  ('a1000001-0000-0000-0000-000000000006','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','EMP006','Pedro',  'Sanchez', 'active','ac000001-0000-0000-0000-000000000001',false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SECCIÓN 3 — attendance.punches
-- Columna correcta: "type" 
-- Patrones:
--   Ana:   puntual lun, atraso 12 min mar, puntual mie
--   Carlos: normal lun/mie, sin salida mar (novelty)
--   Maria:  normal lun, salida temprana mar (15:45)
--   Juan:   jornada extendida hasta 19:32 mar (horas extra)
--   Laura:  par normal toda la semana
--   Pedro:  ausente lun, atraso 25 min mar
-- ─────────────────────────────────────────────────────────────
INSERT INTO attendance.punches
  (id, tenant_id, employee_id, punched_at, source, meta)
VALUES
-- Ana Garcia
  ('b0000001-0000-0000-0001-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000001','2026-04-13 08:00:00-05','web','{"type":"in"}'::jsonb),
  ('b0000001-0000-0000-0001-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000001','2026-04-13 17:05:00-05','web','{"type":"out"}'::jsonb),
  ('b0000001-0000-0000-0001-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000001','2026-04-14 08:12:00-05','web','{"type":"in"}'::jsonb),
  ('b0000001-0000-0000-0001-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000001','2026-04-14 17:10:00-05','web','{"type":"out"}'::jsonb),
  ('b0000001-0000-0000-0001-000000000005','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000001','2026-04-15 07:58:00-05','web','{"type":"in"}'::jsonb),
  ('b0000001-0000-0000-0001-000000000006','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000001','2026-04-15 17:00:00-05','web','{"type":"out"}'::jsonb),
-- Carlos Perez
  ('b0000002-0000-0000-0002-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000002','2026-04-13 08:05:00-05','web','{"type":"in"}'::jsonb),
  ('b0000002-0000-0000-0002-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000002','2026-04-13 17:15:00-05','web','{"type":"out"}'::jsonb),
  ('b0000002-0000-0000-0002-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000002','2026-04-14 08:03:00-05','web','{"type":"in"}'::jsonb),
  -- Sin salida el martes (novelty)
  ('b0000002-0000-0000-0002-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000002','2026-04-15 08:00:00-05','web','{"type":"in"}'::jsonb),
  ('b0000002-0000-0000-0002-000000000005','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000002','2026-04-15 17:20:00-05','web','{"type":"out"}'::jsonb),
-- Maria Lopez
  ('b0000003-0000-0000-0003-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000003','2026-04-13 08:02:00-05','web','{"type":"in"}'::jsonb),
  ('b0000003-0000-0000-0003-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000003','2026-04-13 17:00:00-05','web','{"type":"out"}'::jsonb),
  ('b0000003-0000-0000-0003-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000003','2026-04-14 08:01:00-05','web','{"type":"in"}'::jsonb),
  ('b0000003-0000-0000-0003-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000003','2026-04-14 15:45:00-05','web','{"type":"out"}'::jsonb),
  ('b0000003-0000-0000-0003-000000000005','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000003','2026-04-15 07:55:00-05','web','{"type":"in"}'::jsonb),
  ('b0000003-0000-0000-0003-000000000006','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000003','2026-04-15 17:05:00-05','web','{"type":"out"}'::jsonb),
-- Juan Torres
  ('b0000004-0000-0000-0004-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000004','2026-04-13 08:00:00-05','web','{"type":"in"}'::jsonb),
  ('b0000004-0000-0000-0004-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000004','2026-04-13 17:30:00-05','web','{"type":"out"}'::jsonb),
  ('b0000004-0000-0000-0004-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000004','2026-04-14 08:00:00-05','web','{"type":"in"}'::jsonb),
  ('b0000004-0000-0000-0004-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000004','2026-04-14 19:32:00-05','web','{"type":"out"}'::jsonb),
  ('b0000004-0000-0000-0004-000000000005','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000004','2026-04-15 08:10:00-05','web','{"type":"in"}'::jsonb),
  ('b0000004-0000-0000-0004-000000000006','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000004','2026-04-15 17:00:00-05','web','{"type":"out"}'::jsonb),
-- Laura Mendez
  ('b0000005-0000-0000-0005-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000005','2026-04-13 07:58:00-05','web','{"type":"in"}'::jsonb),
  ('b0000005-0000-0000-0005-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000005','2026-04-13 17:00:00-05','web','{"type":"out"}'::jsonb),
  ('b0000005-0000-0000-0005-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000005','2026-04-14 08:00:00-05','web','{"type":"in"}'::jsonb),
  ('b0000005-0000-0000-0005-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000005','2026-04-14 17:02:00-05','web','{"type":"out"}'::jsonb),
  ('b0000005-0000-0000-0005-000000000005','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000005','2026-04-15 08:01:00-05','web','{"type":"in"}'::jsonb),
  ('b0000005-0000-0000-0005-000000000006','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000005','2026-04-15 17:00:00-05','web','{"type":"out"}'::jsonb),
-- Pedro Sanchez (ausente lunes, atraso 25 min martes)
  ('b0000006-0000-0000-0006-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000006','2026-04-14 08:25:00-05','web','{"type":"in"}'::jsonb),
  ('b0000006-0000-0000-0006-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000006','2026-04-14 17:00:00-05','web','{"type":"out"}'::jsonb),
  ('b0000006-0000-0000-0006-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000006','2026-04-15 08:02:00-05','web','{"type":"in"}'::jsonb),
  ('b0000006-0000-0000-0006-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','a1000001-0000-0000-0000-000000000006','2026-04-15 17:10:00-05','web','{"type":"out"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SECCIÓN 4 — attendance.fine_config
-- ─────────────────────────────────────────────────────────────
INSERT INTO attendance.fine_config
  (id, tenant_id, incident_type, calc_method, value, grace_minutes, is_active)
VALUES
  ('c0000001-0000-0000-0000-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','ATRASO_ENTRADA',        'per_minute',  0.05, 5,  true),
  ('c0000001-0000-0000-0000-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','ATRASO_ALMUERZO',       'fixed',       2.00, 10, true),
  ('c0000001-0000-0000-0000-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','SALIDA_TEMPRANA',       'proportional',1.00, 0,  true),
  ('c0000001-0000-0000-0000-000000000004','8cb84ecf-4d74-4aac-84cc-0c66da4aa656','AUSENCIA_INJUSTIFICADA','fixed',       20.00,0,  true)
ON CONFLICT (tenant_id, incident_type) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SECCIÓN 5 — attendance.overtime_requests
-- ─────────────────────────────────────────────────────────────
INSERT INTO attendance.overtime_requests
  (id, tenant_id, employee_id, requested_date, hours_requested,
   hour_type, justification, status, compensate_as_time)
VALUES
  ('d0000001-0000-0000-0000-000000000001','8cb84ecf-4d74-4aac-84cc-0c66da4aa656',
   'a1000001-0000-0000-0000-000000000001','2026-04-13',2.5,
   'SUPLEMENTARIA','Cierre de reportes mensuales','pending',false),
  ('d0000001-0000-0000-0000-000000000002','8cb84ecf-4d74-4aac-84cc-0c66da4aa656',
   'a1000001-0000-0000-0000-000000000004','2026-04-14',2.53,
   'SUPLEMENTARIA','Soporte urgente cliente externo','approved',false),
  ('d0000001-0000-0000-0000-000000000003','8cb84ecf-4d74-4aac-84cc-0c66da4aa656',
   'a1000001-0000-0000-0000-000000000002','2026-04-10',4.0,
   'EXTRAORDINARIA','Trabajo fin de semana no autorizado','rejected',false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Verificacion
-- ─────────────────────────────────────────────────────────────
SELECT 'employees_legacy' AS tabla, COUNT(*)::int AS filas
FROM attendance.employees_legacy WHERE tenant_id='8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
UNION ALL
SELECT 'punches', COUNT(*)::int
FROM attendance.punches WHERE tenant_id='8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
UNION ALL
SELECT 'fine_config', COUNT(*)::int
FROM attendance.fine_config WHERE tenant_id='8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
UNION ALL
SELECT 'overtime_requests', COUNT(*)::int
FROM attendance.overtime_requests WHERE tenant_id='8cb84ecf-4d74-4aac-84cc-0c66da4aa656';

NOTIFY pgrst, 'reload schema';
