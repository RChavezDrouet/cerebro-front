# ARCHITECTURE_V2

## Objetivo
Elevar HRCloud Base de un módulo operativo de marcaciones a un producto SaaS de nivel enterprise, manteniendo compatibilidad con el esquema actual de asistencia y con el control multi-tenant existente.

## Principios
- Un solo `tenant_id` como eje de aislamiento.
- No romper `attendance.punches`, `attendance.employees`, `attendance.schedules` ni `attendance.get_daily_attendance_report()`.
- Toda regla configurable por tenant.
- Toda lógica crítica de enforcement en SQL o Edge Functions.
- Frontend desacoplado de la lógica de negocio.

## Capas

### 1. Persistencia
- `attendance.attendance_rules_v2`: reglas activas por tenant.
- `attendance.attendance_novelties`: backlog formal de anomalías.
- `attendance.audit_logs`: trazabilidad para acciones sensibles.
- `attendance.punch_attempts`: rastro de intentos, éxitos y fallos.
- `attendance.employee_enterprise_profile`: ficha enterprise extendida.
- `attendance.employee_biometric_links`: asociación entre colaborador y biométrico.

### 2. Enforcement operacional
- `attendance-punch`: puerta de entrada unificada para marcaciones web.
- Controles aplicados:
  - tenant pausado
  - colaborador inactivo
  - face required
  - device required
  - rate limiting temporal
  - detección de geofence inválida
- `attendance-ai-analyze`: enriquecimiento analítico diario con IA configurable.
- `audit-log`: endpoint simple para centralizar auditoría no transaccional.

### 3. Consumo frontend
- `AttendanceService`: único punto de acceso a RPC, vistas y funciones.
- `useTenantGate`: verifica bloqueo del tenant al bootstrap.
- `AttendanceSettingsPage`: CRUD funcional de reglas.
- `AttendanceReportsPage`: tableros y reportes profesionales.
- `EmployeeProfileEnterprisePage`: ficha ERP de colaborador.

## Modelo de evolución
1. Mantener motor SQL vigente para cálculo diario.
2. Añadir una segunda capa de configuración (`rules_v2`) sin romper settings legacy.
3. Añadir una segunda capa de inteligencia (`attendance_novelties`).
4. Añadir una tercera capa de UX ejecutiva y operativa.

## Seguridad
- RLS explícita en tablas nuevas.
- Service role solo en Edge Functions.
- Auditoría en alta sensibilidad.
- Soporte para evidencia técnica: IP, UA, geodata, score facial.

## Integración con Cerebro
Base depende del estado del tenant y del mensaje global de pausa, ya definidos en el ecosistema Cerebro/Base compartiendo `public.tenants` y `public.app_settings`. La separación entre aplicaciones y el uso de `public.tenants` y `attendance.*` ya existen en la arquitectura documentada.
