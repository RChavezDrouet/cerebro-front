# README_IMPLEMENTACION

## Estructura del paquete
- `/database/migrations`: SQL incremental.
- `/edge-functions`: funciones Supabase listas para desplegar.
- `/frontend/src`: páginas, servicios, hooks y componentes de integración.
- `/docs`: documentación técnica de continuidad.

## Orden recomendado de instalación
1. Ejecutar migraciones SQL en orden numérico.
2. Desplegar Edge Functions con `--no-verify-jwt` para mantener consistencia con el stack actual de HRCloud/Cerebro. Ese patrón ya está documentado para las funciones existentes del proyecto.
3. Integrar frontend:
   - copiar `frontend/src/components/*`
   - copiar `frontend/src/hooks/*`
   - copiar `frontend/src/services/attendanceService.ts`
   - copiar `frontend/src/pages/*`
   - registrar rutas nuevas en el router principal de Base
4. En el bootstrap del frontend, invocar `useTenantGate` antes de renderizar rutas protegidas.
5. Conectar menú Base:
   - Configuración → Asistencia avanzada
   - Reportes → Asistencia Pro
   - Colaboradores → Ficha Enterprise

## Variables requeridas para Edge Functions
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` o `GEMINI_API_KEY`

## Deploy sugerido
```bash
supabase functions deploy attendance-punch --project-ref qymoohwtxceggtvgjfsv --no-verify-jwt
supabase functions deploy attendance-ai-analyze --project-ref qymoohwtxceggtvgjfsv --no-verify-jwt
supabase functions deploy audit-log --project-ref qymoohwtxceggtvgjfsv --no-verify-jwt
```

## Mapeo funcional entregado
- Configuración avanzada de asistencia.
- Motor de novedades con IA.
- Reportes profesionales con dataset exportable.
- Ficha enterprise de colaborador.
- Dashboard inteligente.
- Seguridad OWASP base.
- Tenant gate.
- Refactor técnico mínimo viable para Base.

## Notas de compatibilidad
- El motor actual de reporte diario en `attendance.get_daily_attendance_report()` se conserva y sigue siendo la fuente primaria del consolidado diario. Eso ya forma parte del backend operativo documentado en Base v4.6.3.
- El estado `paused` del tenant y el mensaje global provienen del ecosistema Cerebro/Base compartido. Ese contrato ya está definido en la documentación ejecutiva del proyecto.
- La ficha enterprise propuesta amplía la ficha del colaborador con datos personales, emergencia, salud, geofence y biometría, alineándose con el SRS del proyecto y con las estructuras de ficha de personal analizadas.
