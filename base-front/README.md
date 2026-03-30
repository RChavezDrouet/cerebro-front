# HRCloud Base PWA — Mejoras 05-Mar-2026 (v4.7.1)

Este ZIP moderniza **Base** en look & feel (UI responsive con **menú hamburguesa**) y aplica correcciones de **contrato real** contra tu Supabase.

## Qué se corrigió vs v4.7.0 (importante)

- **Departamentos** están en `public.departments` (FK real desde `public.employees.department_id`).
- `attendance.employees` es **VIEW** de compatibilidad (no se recomienda escribir directo).
- `attendance.punches` **no** tiene columna `type`.
- `attendance.punches.status` y `attendance.punches.verify_type` son **GENERATED ALWAYS** desde `meta->>'status'` y `meta->>'verify_type'`.

Por estas razones, se agregó:
- `public.v_employees_full` (vista recomendada para lectura en frontend)
- `attendance.upsert_employee_full` (RPC transaccional para altas/ediciones)
- `attendance.import_usb_punches` alineada a `attendance.punches`


## Funcionalidades incluidas

### Empleados
- Listado con **búsqueda**, filtro por **Departamento**, y **columna Departamento**.
- Crear/Editar:
  - **Foto obligatoria** (reconocimiento facial) con validación básica de calidad (brillo/contraste/enfoque).
  - **Estado superior**: Activo / Vacaciones / Suspendido / Cesante.
  - **Fecha de contratación** y **Sueldo**.

> Escritura profesional: usa RPC `attendance.upsert_employee_full()` para actualizar **public.employees + attendance.employee_profile**.

### Asistencia
- Reporte diario: consume `attendance.get_daily_attendance_report`.
- Columna **Fuente de marcación** (WEB/BIOMETRIC/USB) via `attendance.get_punch_sources_summary`.
- **Exportación Excel + PDF**.
- **Importación USB**: XLSX/CSV + previsualización + RPC `attendance.import_usb_punches`.

### KPIs
- Pantalla **/kpis**:
  - KPI Asistencia por Turno.
  - KPI Asistencia por Departamento.
  - KPI Ranking Top X con **drill-down** por empleado.
  - Exportación Excel + PDF.
- Configuración **/config/kpis**:
  - Parametriza **Top X**, KPIs visibles y tipo de gráfica.

### Configuración
- CRUD de **Feriados** (descanso obligatorio) en `attendance.holidays`.

---

## 1) Instalación (para desarrollador Junior)

### Paso 1 — Dependencias

```bash
npm install
```

### Paso 2 — Variables de entorno

Copia `.env.example` a `.env.local` y completa:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Paso 3 — Ejecutar

```bash
npm run dev
```

Abrir: `http://localhost:5174`

---

## 2) SQL necesario (obligatorio)

En Supabase SQL Editor ejecuta:

- `sql/2026-03-05_base_mejoras_v471.sql`

Crea:
- `public.v_employees_full`
- RPC `attendance.upsert_employee_full(...)`
- `attendance.holidays` + RLS
- `attendance.kpi_settings` + RLS
- RPC:
  - `attendance.get_punch_sources_summary(...)`
  - `attendance.import_usb_punches(...)`
  - `attendance.get_kpi_attendance_by_turn(...)`
  - `attendance.get_kpi_attendance_by_department(...)`
  - `attendance.get_kpi_ranking(...)`

Si cambiaste vistas/funciones y PostgREST no refleja columnas nuevas:

```sql
notify pgrst, 'reload schema';
```

---

## 3) Storage (foto de empleado)

Crear bucket:

- `employee_photos`

Recomendación: bucket **Private**. La app usa **Signed URL** para visualizar.

---

## 4) Formato archivo USB

XLSX/CSV con columnas:

- `employee_code` (obligatorio)
- `punched_at` (obligatorio) — Ej: `2026-03-05 08:03` (interpreta TZ del tenant) o `2026-03-05T13:03:00Z`
- `source` (opcional) — default `USB`
- `status` (opcional) — se guarda en `meta.status` (columna `status` es GENERATED)
- `verify_type` (opcional) — se guarda en `meta.verify_type` (columna `verify_type` es GENERATED)
- `serial_no` o `sn` (opcional)
- `pin` o `biometric_employee_code` (opcional)

Si el empleado no existe, la RPC registra:
- `employee_id = NULL`
- `meta.unmatched = true`
- `meta.unmatched_reason = ...`

---

## 5) Estructura de carpetas

- `src/pages/auth/*` Login + reset + set password
- `src/pages/employees/*` Empleados
- `src/pages/attendance/*` Asistencia
- `src/pages/kpis/*` KPIs
- `src/pages/config/*` Configuración (Feriados + KPI settings)
- `src/components/*` UI + layout
