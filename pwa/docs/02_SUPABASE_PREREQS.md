# 02 — Supabase: requisitos mínimos (DB + RLS + Storage)

> Objetivo: que la PWA pueda **login**, resolver **tenant/employee**, validar **paused**, subir **selfie** y **insertar punch**.

---

## 1) Concepto: qué usa la PWA

### 1.1 Auth
- Supabase Auth (email/password)

### 1.2 Perfil del usuario (tenant/employee)
Primera opción (recomendada):
- `public.profiles` con:
  - `id` (uuid) = `auth.users.id`
  - `tenant_id` (uuid)
  - `employee_id` (uuid)
  - `full_name` (text, opcional)

Fallback (si no tienes profiles):
- `public.employees` con:
  - `user_id` (uuid) = `auth.users.id`
  - `tenant_id` (uuid)
  - `id` (uuid) = employee_id

### 1.3 Tenant Gate (paused)
- `public.tenants` debe exponer:
  - `id` (uuid)
  - `name` (text)
  - `status` (text) → esperado: `active|paused`
  - `paused_message` (text, opcional)

Si `status = paused`, la PWA bloquea.

### 1.4 Marcaciones
- Schema: `attendance`
- Tabla: `attendance.punches`

Campos mínimos:
- `id` uuid (default)
- `tenant_id` uuid
- `employee_id` uuid
- `punched_at` timestamptz
- `source` text
- `serial` (nullable)
- `status` text
- `verification` (int/text según tu implementación)
- `evidence` (jsonb/text según tu implementación)
- `created_at` timestamptz

La PWA inserta:
- `source = 'web'`
- `evidence.action` ∈ `clock_in|clock_out|break_start|break_end`
- `evidence.geo`, `evidence.selfie`, `evidence.device`, etc.

### 1.4.1 Reconocimiento facial (BACKEND)
La PWA llama a una Edge Function **antes de capturar GPS**:
- Nombre por defecto: `face-verify` (configurable en `VITE_FACE_VERIFY_FUNCTION`)
- Debe retornar JSON:
```json
{ "match": true, "score": 0.91, "threshold": 0.6, "provider": "aws_rekognition" }
```

Si `match=false`, la PWA no toma GPS y no inserta `attendance.punches`.

> Para DEV, puedes poner `VITE_FACE_VERIFY_MODE=mvp` y permitirá marcar si el backend no responde.

### 1.5 Settings (MVP)
En el MVP, la PWA NO depende de tablas de settings (para evitar 404 y bloquear marcación).
La configuración se toma de `.env.local` / defaults en frontend:
- `VITE_GEO_MAX_METERS`
- `VITE_MIN_GPS_ACCURACY`
- `VITE_FACE_THRESHOLD`
- `VITE_FACE_VERIFY_MODE`

En una fase 2, se puede centralizar configuración por tenant desde Base.

---

## 1.6 Intentos fallidos (opcional pero recomendado)
Crear tabla `attendance.punch_attempts` para guardar intentos fallidos (y exitosos si quieres):
- rostro no coincide
- GPS inválido / baja precisión / fuera de geocerca
- fallo al insertar

La UI muestra "OK" y "Fallidas" si esta tabla existe.

## 1.7 Solicitudes del empleado (MVP)
Crear tabla `attendance.employee_requests`.
La pestaña **SOLICITUD** crea registros y muestra el seguimiento (status).

---

## 2) Storage (Selfies)

### 2.1 Bucket
Crea un bucket **privado**:
- `punch-selfies`

### 2.2 Convención de path
La PWA sube con path:
```
<tenant_id>/<employee_id>/YYYY-MM-DD/<uuid>.jpg
```

Esto ayuda a:
- aislar evidencias por tenant
- aplicar policies por prefijo

---

## 3) RLS (policies) — Recomendación base

> ⚠️ Las policies reales dependen de tu modelo. Aquí un baseline típico.

### 3.1 attendance.punches
- El empleado debe:
  - INSERT solo con su `tenant_id` y `employee_id`
  - SELECT solo sus registros

Ejemplo conceptual (ajusta a tus funciones/claims):
```sql
alter table attendance.punches enable row level security;

-- SELECT: solo sus punches
create policy "punches_select_own"
on attendance.punches
for select
to authenticated
using (
  employee_id = (select employee_id from public.profiles where id = auth.uid())
);

-- INSERT: solo su tenant/employee
create policy "punches_insert_own"
on attendance.punches
for insert
to authenticated
with check (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
  and
  employee_id = (select employee_id from public.profiles where id = auth.uid())
);
```

### 3.2 public.profiles
```sql
alter table public.profiles enable row level security;

create policy "profiles_read_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());
```

### 3.3 public.tenants
Lo más simple: permitir lectura a authenticated (o por tenant_id).
```sql
alter table public.tenants enable row level security;

create policy "tenants_read_authenticated"
on public.tenants
for select
to authenticated
using (true);
```
Mejor: filtrar por el tenant del usuario (si lo puedes resolver).

### 3.4 Storage bucket punch-selfies
Policy típica:
- Insert (upload) si el path empieza con `<tenant_id>/<employee_id>/`
- Read (download) solo para ese mismo usuario o para rol admin (si existe)

En Supabase Storage, las policies se configuran sobre la tabla `storage.objects`.

---

## 4) Parámetros recomendados (calidad)

- GPS:
  - `VITE_MIN_GPS_ACCURACY=50` (m)
  - `geo_max_m=400` (m) para geocerca (ajusta por tenant)
- Selfie:
  - `selfie_required=true` (MVP)
- Face:
  - en MVP se marca como “selfie_only_mvp”
  - más adelante puedes integrar Face Liveness / Rekognition

