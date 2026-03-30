# HRCloud Base v4.2.1 — Guía de despliegue (Junior)

> Objetivo: levantar **Base** localmente y desplegar la **Edge Function `base-usb-import`** + SQL de soporte para importación USB, de forma segura (RLS + Service Role).

---

## 0) Requisitos previos

En tu PC:

- Node.js **18+** (recomendado 20 LTS)
- npm 9+ (o pnpm/yarn, pero esta guía asume npm)
- Git
- Supabase CLI (si vas a desplegar Edge Functions desde CLI)

Verificación rápida:

```bash
node -v
npm -v
supabase --version
```

---

## 1) Configurar variables de entorno (frontend)

1. Copia `.env.example` a `.env.local`
2. Completa:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ejemplo:

```bash
VITE_SUPABASE_URL=https://<TU_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<TU_ANON_KEY>
```

> ⚠️ **No** pongas la Service Role key en el frontend.

---

## 2) Instalar dependencias y correr Base

Desde la carpeta del proyecto:

```bash
npm install
npm run dev
```

Abrir:

- `http://localhost:5173`

---

## 3) Base: dónde se guardan los roles

En Base (schema `attendance`) el rol de usuario por tenant se resuelve en este orden:

1. `auth.jwt() ->> 'app_role'` (si en el JWT viene el claim `app_role`)
2. Si no existe, toma el rol desde `attendance.memberships` (por `auth.uid()`)
3. Fallback: `employee`

Consulta SQL (Postgres):

```sql
select *
from attendance.memberships
where user_id = auth.uid();
```

Ver el rol “actual” interpretado por Base:

```sql
select attendance.current_user_role() as role;
```

---

## 4) SQL obligatorio (USB Import)

Ejecuta en Supabase SQL Editor **en este orden**:

1. `supabase/sql_attendance_isolated/010_usb_import.sql`

Este script crea:

- `attendance.usb_import_batches`
- `attendance.usb_import_staging`
- `attendance.process_usb_import(p_batch_id uuid, p_allow_unknown_employee boolean)`
- RLS mínimo (staging sin acceso para usuarios; batches solo lectura para admins/asistentes)

---

## 5) Edge Function: `base-usb-import`

### 5.1) Secrets requeridos (en Supabase)

En Supabase → Edge Functions → **Secrets**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

> El código usa **SERVICE_ROLE** únicamente dentro de la Edge Function.

### 5.2) Deploy

Si usas Supabase CLI:

```bash
supabase login
supabase link --project-ref <TU_REF>

supabase functions deploy base-usb-import
```

---

## 6) Contrato HTTP (payload esperado del USB)

**Endpoint**:

- `POST https://<TU_REF>.supabase.co/functions/v1/base-usb-import`

**Headers**:

- `Authorization: Bearer <ACCESS_TOKEN>`  (token de sesión del usuario en Base)
- `Content-Type: application/json`

**Body**:

```json
{
  "tenant_id": "<uuid>",
  "device_serial": "ABC-123",
  "source_file": { "filename": "marcaciones_2026-02-27.csv", "sha256": "..." },
  "punches": [
    {
      "employee_code": "E-0001",
      "punched_at": "2026-02-27T13:05:00Z",
      "method": "USB",
      "device_serial": "ABC-123",
      "raw": { "line": 12, "original": "..." }
    }
  ],
  "options": {
    "dry_run": false,
    "allow_unknown_employee": false,
    "max_age_days": 365
  }
}
```

### Validaciones (servidor)

- `tenant_id` debe ser UUID
- `punches[]` obligatorio (1..5000)
- `employee_code` no vacío
- `punched_at` ISO válido
- Rechaza registros más antiguos que `max_age_days`
- Autoriza solo roles: `tenant_admin | hr_admin | admin | assistant` (tabla `attendance.memberships`)

---

## 7) Estrategia staging → dedupe → insert

1. **Batch**: crea registro en `attendance.usb_import_batches`
2. **Staging**: inserta filas en `attendance.usb_import_staging` (chunk de 1000)
3. **Process**: llama `attendance.process_usb_import(batch_id)`
   - Resuelve `employee_id` por `attendance.employees(employee_code)`
   - Si hay `employee_code` desconocido y `allow_unknown_employee=false` → falla
   - Dedupe best-effort contra `attendance.punches` por `(tenant_id, employee_id, punched_at, method)`
   - Inserta a `attendance.punches` con `source='usb'` y `meta.batch_id`

---

## 8) Smoke test (manual)

1. Loguéate en Base
2. En DevTools → Network toma tu `access_token`
3. Llama con curl:

```bash
curl -L -X POST 'https://<TU_REF>.supabase.co/functions/v1/base-usb-import' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data '{"tenant_id":"<UUID>","punches":[{"employee_code":"E-0001","punched_at":"2026-02-27T13:05:00Z"}]}'
```

Si responde `ok: true` tendrás:

- Batch `completed`
- Filas insertadas a `attendance.punches`

---

## 9) Troubleshooting común

- **403 Forbidden**: el usuario no tiene rol admin/assistant en `attendance.memberships`
- **Unknown employee_code**: falta el empleado en `attendance.employees` con ese `employee_code`
- **500 process_usb_import failed**: revisar que `attendance.punches` tenga columnas `tenant_id, employee_id, punched_at, source, method, meta`

---

## 10) Notas OWASP (mínimo recomendado)

- Nunca exponer Service Role en el cliente
- Validar tamaño del request (max 5000)
- Mantener RLS habilitado en tablas sensibles
- Logs sin PII (no imprimir tokens)
- CORS: si se habilita, restringir orígenes

