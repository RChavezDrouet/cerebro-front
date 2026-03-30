# Reporte diario de marcación (Entrada / Comida / Salida) — v4.6.0

Este módulo implementa la **interpretación automática** de marcaciones por horario y genera un **reporte diario agregado** por empleado.

## 1) Cambios de base de datos

### Script

Ejecuta el script en este orden (después del core/rls/seed del esquema `attendance`):

- `supabase/sql/030_attendance_marking_logic_and_daily_report.sql`

> Si usas el stack “aislado” (carpeta `sql_attendance_isolated/`), ejecuta:
> - `supabase/sql_attendance_isolated/020_marking_logic_and_daily_report.sql`

### ¿Qué crea/modifica?

1. Extiende `attendance.employee_status` agregando el valor `vacation`.
2. Extiende `attendance.marking_parameters` agregando:
   - `entry_early_window_min` (default 60)
   - `exit_early_window_min` (default 180)
   - `lunch_start_early_window_min` (default 30)
   - `lunch_end_early_window_min` (default 30)
3. Crea helper `attendance.get_tenant_timezone(tenant_id)`.
4. Publica RPC:
   - `attendance.get_daily_attendance_report(p_date_from date, p_date_to date)`

## 2) Reglas de interpretación

Por cada empleado y día se calculan 4 eventos:

- **Entrada**: primera marcación dentro de `[hora_entrada - entry_early_window_min, hora_entrada + tolerance_entry_min]`
- **Salida**: última marcación dentro de `[hora_salida - exit_early_window_min, hora_salida + tolerance_exit_min]`
- **Inicio de comida** (si `meal_enabled=true`): primera marcación dentro de `[meal_start - lunch_start_early_window_min, meal_start + tolerance_lunch_exit_min]`
- **Fin de comida** (si `meal_enabled=true`): primera marcación dentro de `[meal_end - lunch_end_early_window_min, meal_end + tolerance_lunch_entry_min]`

Estados por evento:

- `ANTICIPADA`: marcación < hora oficial (pero dentro de la ventana aceptada)
- `A_TIEMPO`: dentro de tolerancia después de la hora oficial
- `ATRASADO`: > hora oficial + tolerancia
- `NOVEDAD`: no existe marcación (o empleado inactivo/vacaciones)

Estado global del día (prioridad): `NOVEDAD > ATRASADO > ANTICIPADA > A_TIEMPO`.

## 3) Cambios de UI

### Configuración → Parámetros de marcación

Se agregan 4 campos:

- Ventana antes de **Entrada**
- Ventana antes de **Salida**
- Ventana antes de **Inicio comida**
- Ventana antes de **Fin comida**

### Reportes → Reporte diario

Ruta: `/reports/diario`

Incluye:

- Número de empleado
- Nombre
- Departamento
- Entrada, inicio/fin comida, salida
- Estado global
- Novedad (detalle)
- Indicador de empleado activo

Exportación: Excel.

## 4) Smoke test (SQL)

En el SQL editor (con un usuario autenticado del tenant):

```sql
select *
from attendance.get_daily_attendance_report(current_date - 2, current_date)
limit 50;
```
