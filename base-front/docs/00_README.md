# HRCloud Base (Front) — Asistencia (MVP)

Este proyecto es el **frontend Base** (React + Vite + Tailwind + Supabase) para el módulo de **Asistencia/Marcaciones**.

Incluye CRUD de:
- Turnos (diurno/vespertino/nocturno)
- Horarios (entrada/salida/comida opcional, cruce de medianoche)
- Empleados (ficha con asignación de horario)

> Multi-tenant estricto: los datos no se mezclan entre empresas (tenant). Esto se asegura con RLS + constraints.

## Levantar local

1) Copiar variables:

```bash
cp .env.example .env.local
```

2) Instalar:

```bash
npm install
```

3) Levantar:

```bash
npm run dev
```

Abrir: http://localhost:5174

## Backend Supabase

Ejecuta los scripts:
- `supabase/sql/001_attendance_core.sql`
- `supabase/sql/002_attendance_rls.sql`
- `supabase/sql/003_seed_attendance_defaults.sql`

Ver: `docs/03_DB_SUPABASE.md`
