# CHANGELOG

## HRCloud Base Enterprise Attendance Evolution

### Added
- `attendance.attendance_rules_v2` con configuración avanzada por tenant.
- `attendance.attendance_novelties` para gestión de anomalías detectadas por reglas e IA.
- `attendance.audit_logs` y `attendance.punch_attempts` para trazabilidad OWASP.
- `attendance.employee_enterprise_profile` y `attendance.employee_biometric_links`.
- RLS multi-tenant y RPC `attendance.rpc_upsert_attendance_rules_v2`.
- Edge Functions:
  - `attendance-punch`
  - `attendance-ai-analyze`
  - `audit-log`
- Frontend listo para integrar:
  - Configuración avanzada de asistencia.
  - Reportes ejecutivos.
  - Ficha enterprise de colaborador.
  - Tenant gate con modal de bloqueo.
  - Error boundary para estabilizar UI.

### Fixed
- Prevención estructural del error de Router al encapsular rutas dentro de `BrowserRouter` en el bootstrap de ejemplo.
- Reducción del riesgo del `Selection error` centralizando errores de render en `AppErrorBoundary` y evitando manipulación manual del DOM.
- Estandarización del acceso a Supabase desde un `AttendanceService` único.
