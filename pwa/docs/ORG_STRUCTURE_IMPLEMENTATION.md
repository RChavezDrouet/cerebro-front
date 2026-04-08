# HRCloud Base — Horarios, Turnos y Estructura Organizacional

## Incluido en este paquete
- Página de configuración de **Estructura organizacional** con hasta 7 niveles.
- Rutas nuevas:
  - `/config/organizacional`
  - `/config/horarios`
  - `/config/turnos`
- Ficha del empleado ampliada para:
  - unidad organizacional principal
  - supervisor inmediato
  - jefatura de unidad
  - turno efectivo
- Detalle del empleado ampliado con:
  - ruta jerárquica visible
  - unidad actual
  - supervisor inmediato
  - jefatura
  - historial organizacional y de turnos
- Migración SQL:
  - `supabase/sql/040_org_structure_turns_hierarchy.sql`

## Importante
La parte visual del frontend queda lista en este ZIP.
Para persistir correctamente la nueva jerarquía y las asignaciones de turnos, primero debe ejecutarse la migración SQL incluida.

## Tablas nuevas esperadas
- `attendance.org_level_definitions`
- `attendance.org_units`
- `attendance.employee_org_assignments`
- `attendance.employee_shift_assignments`

## Compatibilidad
Se mantuvo la RPC existente `upsert_employee_full` para no romper el flujo actual de alta/edición de empleados.
Los nuevos datos organizacionales se guardan en tablas separadas para una evolución limpia y auditable.
