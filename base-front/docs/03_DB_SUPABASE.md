# Supabase — DB/RLS para Asistencia (multi-tenant)

## Requisito
Debes tener una forma de resolver el tenant del usuario:
- O un **claim `tenant_id`** en el JWT, o
- Una tabla `profiles` con columnas: `user_id (uuid)` y `tenant_id (uuid)`.

Este proyecto asume por defecto `profiles`.

## Ejecutar scripts
En Supabase SQL Editor:
1) `supabase/sql/001_attendance_core.sql`
2) `supabase/sql/002_attendance_rls.sql`
3) `supabase/sql/003_seed_attendance_defaults.sql`

## Semilla de defaults por tenant
Ejecuta:

```sql
select public.seed_attendance_defaults('<TENANT_UUID>'::uuid);
```

## Tablas
- `attendance_turns`
- `attendance_schedules`
- `employees`

Cada una tiene `tenant_id` y RLS habilitado.
