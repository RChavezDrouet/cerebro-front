# Changelog — Reporte completo de asistencia

## Ajustes aplicados

- Se actualizó la pantalla real usada por la app: `src/pages/attendance/DailyAttendanceReportPage.tsx`.
- Se removió el enfoque anterior de resumen redundante para priorizar el reporte operativo solicitado.
- La tabla ahora muestra exactamente estas columnas:
  - Fecha de la marcación
  - Empleado nombre
  - Departamento / Jefatura asignada
  - Hora de ingreso
  - Hora de inicio de comida
  - Hora de fin de comida
  - Hora de salida
  - Tipo de marcación
  - Novedad
- La columna **Novedad** abre un modal con el detalle.
- La exportación a Excel y PDF usa los mismos encabezados del reporte visible.
- El tipo de marcación se deriva desde `attendance.get_punch_sources_summary(...)`, soportando:
  - Facial
  - Huella digital
  - Código
  - Tarjeta
  - Remota
  - USB
  - Biométrico

## Fuente de datos

- Horas y novedad: `attendance.get_daily_attendance_report(...)`
- Tipo de marcación: `attendance.get_punch_sources_summary(...)`

## Nota técnica

Si la RPC `get_punch_sources_summary(...)` no está disponible, el reporte sigue funcionando para horas y novedad, pero el tipo de marcación puede quedar incompleto.
