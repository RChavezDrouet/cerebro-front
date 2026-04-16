# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**HRCloud** — multi-tenant SaaS for HR management and attendance control. Two layers:

- **SaaS layer (Cerebro)** — managed by the provider. Handles tenants, billing, global config.
- **Tenant layer (Base + PWA)** — used by each customer. Manages employees, schedules, attendance, reports.

---

## Monorepo Structure

No workspace tooling (no Turborepo). Each sub-project is fully independent with its own `package.json`.

```
cerebro-front/   React + Vite 4    SaaS provider panel
base-front/      React + Vite 5    Tenant HR admin panel (TanStack Query v5, Zustand v5)
pwa/             React + Vite 5    Employee PWA (HTTPS required; GPS + selfie)
adms-gateway/    Node.js/Express   ZKTeco iClock biometric gateway (also Python/Flask alt)
app_face_v2.py   Python/OpenCV     Facial verification microservice (Haar Cascade + LBPH)
supabase/        Deno edge funcs   11 edge functions + SQL migrations
```

The canonical SQL migrations live in `supabase/supabase/migrations/`. Copies under `adms-gateway/supabase/sql/`, `base-front/sql/`, and `pwa/sql/` are for reference only.

---

## Development Commands

### cerebro-front (port 5173)
```bash
cd cerebro-front && npm install
cp .env.example .env.local   # fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev

npm run test            # vitest
npm run test:coverage   # vitest coverage
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run build           # production build
```

### base-front (port 5174)
```bash
cd base-front && npm install
cp .env.example .env.local
npm run dev
npm run build   # also copies dist/index.html → dist/404.html for DigitalOcean SPA routing
```

### pwa (port 5173, HTTPS via auto-signed cert)
```bash
cd pwa && npm install
cp .env.example .env.local
npm run dev    # opens https://localhost:5173 — camera/GPS require HTTPS
npm run build
```

### adms-gateway (port 3005)
```bash
cd adms-gateway && npm install
cp .env.example .env
npm start      # node src/index.js
# Alt Python implementation:
pip install flask flask-cors requests && python app.py
```

### app_face_v2.py (port 5001)
```bash
pip install flask flask-cors requests numpy opencv-contrib-python-headless
export SUPABASE_URL=... SUPABASE_SERVICE_KEY=... API_SECRET=...
python app_face_v2.py
```

### supabase (local, requires Docker)
```bash
cd supabase
supabase start          # starts local Postgres + Studio (54321/54322/54323)
supabase db push        # apply migrations
supabase functions serve                        # all edge functions locally
supabase functions deploy <function-name>       # deploy single function to prod
supabase link --project-ref <ref>               # link to remote project
```

---

## Architecture & Key Patterns

### Database Schemas
Two completely isolated schemas:
- **`public`** — used only by `cerebro-front`. Contains `tenants`, `invoices`, billing, SaaS config.
- **`attendance`** — used only by `base-front` and `pwa`. Contains `employees`, `punches`, `punch_evidence`, `user_accounts`, `memberships`, `schedules`, `turns`, etc.

All tables have RLS enabled. Each tenant only accesses its own data via `tenant_id` row filtering.

### Frontend Auth Pattern
- All three frontends use Supabase Auth (JWT).
- **base-front**: Auth state via `AuthContext` + `useAuth()` hook (`src/contexts/AuthContext.tsx`). Tenant ID and role stored in `useTenantStore` (Zustand). The `@/config/supabase.ts` exports `supabase` client and `ATT_SCHEMA` constant.
- **cerebro-front**: Auth + role/permissions all in a single `AuthContext` in `App.tsx` (no separate context file). Uses `getUserRole()`, `getRolePermissions()` from `src/config/supabase.ts`.
- **pwa**: Auth in `src/hooks/useAuth.ts`; attendance state in `src/hooks/useAttendance.ts`.

### base-front Feature Architecture
```
src/
  features/
    attendance/   components/, hooks/, services/, types/
    auth/
    config/
    dashboard/
    employees/
    kpis/
    reports/
  pages/          thin route-level pages that compose feature components
  lib/            env.ts, accessRoles.ts, tenant.ts, time.ts, export/, usb/
  store/          useTenantStore (Zustand) — holds tenantId, role, primaryColor
```

`src/lib/env.ts` centralizes all `VITE_*` env reads with safe defaults. Use `ENV.*` getters instead of `import.meta.env` directly.

### Attendance Punch Flow (PWA)
1. Employee opens PWA → GPS geofence check
2. Captures selfie → uploads to Supabase Storage (`punch-selfies` bucket)
3. Calls `face-verify` edge function → which calls `app_face_v2.py` with shared `API_SECRET`
4. On verification pass: calls `register_web_punch()` RPC → inserts into `attendance.punches` (`source='web'`)
5. Evidence stored in `punch_evidence` table (`verification_status`: `pending` → `verified` | `rejected`)

`VITE_FACE_VERIFY_MODE=strict` blocks punch on face mismatch; `mvp` allows it through.

### ZKTeco Biometric Flow
Devices POST to `adms-gateway` via iClock protocol (`/iclock/cdata`). Gateway writes to `attendance.biometric_raw` and `attendance.punches` (`source='biometric'`) using the Supabase Service Role Key (bypasses RLS).

### Edge Functions (`supabase/functions/`)
| Function | Purpose |
|---|---|
| `face-verify` | Proxies facial verification to `app_face_v2.py` |
| `attendance-ai-analyze` | Google Gemini analysis of attendance anomalies |
| `admin-create-tenant` | Provision new tenant (Cerebro → public schema) |
| `admin-create-user` / `admin-invite-staff` | User provisioning with email invite |
| `biometric-gatekeeper` | Validates biometric device registration |
| `broadcast-email` | Tenant-wide email broadcasts |
| `smtp-settings` / `smtp-test` | Tenant SMTP configuration |
| `tenant-ai-settings-save` | Persist AI settings per tenant |

Shared utilities live in `supabase/functions/_shared/`.

### Production Deployment (DigitalOcean App Platform)
Each sub-project is a separate component with its `Source Directory`. Static React apps require `dist/404.html` (copy of `index.html`) for SPA routing. The face verify service runs as: `gunicorn -w 2 -b 0.0.0.0:$PORT --timeout 60 app_face_v2:app`.

---

## Security Notes
- `Service Role Key` is only used in `adms-gateway` and `app_face_v2.py` (backends). Never in frontends.
- `Anon Key` is safe in frontends because RLS restricts all access.
- `API_SECRET` must be changed from the default (`hrcloud-face-2026`) in production.
- `.env` files with real secrets must never be committed. Only `.env.example` files are tracked.

---

# HRCloud — Prompt Maestro de Evolución v2.0
> Grounded en: ARCHITECTURE.md · DATABASE_SCHEMA.md · BACKEND.md · 2026-04-14
> Uso: prepend el BLOQUE A en cada sesión. Reemplaza el BLOQUE B con el módulo a trabajar.

---

## ══ BLOQUE A: CONTEXTO PERMANENTE (siempre incluir) ══

Actúas como **Arquitecto Senior + Tech Lead** del sistema **HRCloud**, un SaaS HR
multi-tenant en producción. Antes de escribir cualquier línea de código, internaliza
este bloque completo. Las reglas aquí son inviolables.

---

### STACK REAL (no inferir — usar exactamente esto)

| Capa | Tecnología |
|---|---|
| Frontend PWA | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Zustand 5 + TanStack Query v5 |
| Frontend base-front | React 18 + TypeScript + Vite 5 + Tailwind + jsPDF + xlsx + docx + html2canvas |
| Frontend cerebro | React 18 + TypeScript + Vite 4 + Tailwind + Recharts 2 + React Hook Form + Zod |
| Backend | Supabase (PostgreSQL · Auth GoTrue · RLS · Edge Functions Deno/TS) |
| SDK | `@supabase/supabase-js` v2.98.x |
| Gateway biométrico | Python Flask · DigitalOcean App Platform · puerto 8080 |
| Face service | Python + OpenCV (Haar Cascade + LBPH) · puerto 5001 |
| IA | Google Gemini `gemini-2.5-flash` · clave AES-GCM cifrada en `public.tenant_ai_settings` |
| Storage | Supabase buckets: `employee_photos`, `punch-selfies`, `request-evidence` |

---

### REGLA CRÍTICA: supabase-js v2.97.x+

`supabase.functions.invoke()` **NO envía el header `apikey`** en esta versión.
→ Todas las llamadas a Edge Functions DEBEN usar `XMLHttpRequest` o `fetch` manual
  con header `Authorization: Bearer <token>` + `apikey: <anon_key>`.
→ NUNCA usar `supabase.functions.invoke()` para llamadas a Edge Functions.

---

### ARQUITECTURA DE ESQUEMAS (crítico — no mezclar)

```
Supabase PostgreSQL
├── schema: public          ← Cerebro SaaS (tenants, billing, staff, audit)
│   ├── tenants             ← status: active|trial|paused
│   ├── plans               ← code PK, billing_model, price
│   ├── invoices            ← tenant_id FK, status: pending|paid|overdue|void
│   ├── user_roles          ← roles Cerebro: admin|assistant|maintenance
│   ├── role_permissions    ← jsonb permissions por role
│   ├── profiles            ← tenant users (id = auth.uid(), tenant_id, role, employee_id)
│   ├── employees           ← datos HR extendidos (employment_status, facial_photo_url)
│   ├── biometric_devices   ← usa serial_number (Cerebro view)
│   ├── tenant_ai_settings  ← is_enabled, provider='gemini', api_key_encrypted, model
│   ├── app_settings        ← branding global (singleton id=1, paused_message_*)
│   ├── audit_logs          ← append-only, escrito por Edge Functions
│   └── messages / message_reads
│
└── schema: attendance      ← HR operacional (aislado de Cerebro)
    ├── settings            ← (tenant_id PK, mode, timezone) — INCOMPLETO, ver gaps
    ├── employees           ← id, tenant_id, employee_code, status, schedule_id,
    │                          biometric_employee_code, first_login_pending
    ├── employee_profile    ← employee_id PK, work_mode, allow_remote_pwa,
    │                          geofence_lat/lng/radius_m, pwa_self_service_*
    ├── turns               ← type: diurno|vespertino|nocturno
    ├── schedules           ← entry_time, exit_time, crosses_midnight, meal_*
    ├── biometric_devices   ← usa serial_no (NO serial_number), last_seen_at
    ├── biometric_raw       ← audit log raw iClock
    ├── punches             ← source: web|biometric|import; verification: JSONB
    ├── punch_evidence      ← selfie, GPS, geofence_ok, verification_status: pending|ok|failed|skipped
    ├── punch_attempts      ← audit de intentos (ok/fail + reason)
    ├── permission_requests ← solicitudes empleado: pending|approved|rejected
    ├── justifications      ← ausencias/atrasos: late|absence
    ├── holidays            ← por tenant
    ├── kpi_settings        ← ranking_limit, chart_type, dashboard_widgets jsonb
    ├── memberships         ← (tenant_id, user_id, role) — SOLO via view my_memberships
    └── novelties           ← EXISTE en arquitectura, SIN definición formal en schema
                               (gap real — ver sección GAPS)
```

**Regla de schema targeting:**
```typescript
// ✅ CORRECTO para tablas attendance.*
supabase.schema('attendance').from('employees').select(...)

// ✅ CORRECTO para tablas public.*
supabase.from('profiles').select(...)   // public es default

// ❌ NUNCA
supabase.schema('cerebro')...   // no existe
```

---

### NOMBRES DE COLUMNA CRÍTICOS (no inventar sinónimos)

| Tabla | Columna CORRECTA | Columna INCORRECTA (no usar) |
|---|---|---|
| `attendance.biometric_devices` | `serial_no` | `serial_number` |
| `attendance.employees` | `status` (enum: active\|inactive) | `employment_status` |
| `attendance.employees` | `employee_code` | `employee_number` |
| `attendance.employees` | `biometric_employee_code` | `device_pin`, `pin` |
| `attendance.employees` | `work_mode` (en employee_profile) | `work_modality` |
| `attendance.employee_profile` | `photo_meta` jsonb | `photo_path`, `facial_photo_url` |
| `public.employees` | `employment_status` | `status` |
| `public.employees` | `facial_photo_url` | `photo_path` |
| `public.biometric_devices` | `serial_number` | `serial_no` |
| `attendance.punches` | `verification` (JSONB) | — no usar ->> sobre columnas INTEGER |
| `public.profiles` | `id` (= auth.uid()) | `user_id` |

---

### FUNCIONES EXISTENTES (NO reimplementar — invocar las que ya existen)

```sql
-- public schema
public.current_tenant_id()         → uuid
public.is_admin()                   → boolean
public.is_internal()                → boolean
public.seed_attendance_defaults(uuid) → void
public.touch_updated_at()           → trigger

-- attendance schema
attendance.current_tenant_id()     → uuid   (via my_memberships)
attendance.current_user_role()     → text
attendance.current_employee_id()   → uuid
attendance.can_manage_attendance() → boolean   (role IN tenant_admin|hr_admin|admin)
attendance.assert_tenant_access(uuid) → void   ⚠️ NO usar en SQL Editor (falla como superuser)
attendance.register_web_punch(...)  → uuid   (transaccional, escribe punch + attempt)
attendance.upsert_employee_full(...) → uuid
attendance.upsert_employee_pwa_self_service_settings(...) → table
attendance.get_my_pwa_self_service_profile() → table
attendance.save_my_pwa_self_service_profile(...) → table
attendance.attendance_tenant_timezone() → text
attendance.resolve_marking_type_label(text,text,text) → text
```

---

### EDGE FUNCTIONS EXISTENTES (NO recrear — extender si es necesario)

| Función | Estado | Notas |
|---|---|---|
| `admin-create-tenant` | ✅ Producción | Requiere `--no-verify-jwt` en deploy |
| `admin-create-user` | ✅ Producción | |
| `admin-invite-staff` | ✅ Producción | |
| `face-verify` | ✅ Producción | `FACE_VERIFY_ALLOW_FALLBACK=true` activo |
| `attendance-ai-analyze` | ✅ Producción | Gemini 2.5-flash, soporta: attendance_summary\|novelties_summary\|attendance_and_novelties\|employee_risk\|daily_exceptions |
| `tenant-ai-settings-save` | ✅ Producción | Cifra API key con AES-GCM |
| `biometric-gatekeeper` | ✅ Producción | |
| `broadcast-email` | ✅ Producción | |
| `smtp-settings` / `smtp-test` | ✅ Producción | |
| `base-create-employee-user` | ✅ Producción | |

---

### AUTENTICACIÓN (dos sistemas separados — no mezclar)

**Usuarios Cerebro/HR:**
- Supabase GoTrue (email/password + magic link)
- JWT claims: `tenant_id`, `app_role`
- Sesión en localStorage key por defecto

**Empleados PWA:**
- SHA-256 via RPC `public.verify_employee_password()` (NO Supabase Auth)
- `storageKey: 'hrcloud_pwa_session'` — OBLIGATORIO para aislar de Cerebro
- Autenticación via `public.employees.password_hash`
- Bootstrap: SOLO evento `INITIAL_SESSION`; filtrar `TOKEN_REFRESHED` para no re-lanzar bootstrap

---

### REGLAS SQL OBLIGATORIAS

```sql
-- 1. Después de ANY cambio de schema o firma de función:
NOTIFY pgrst, 'reload schema';

-- 2. RLS: siempre filtrar por tenant_id en queries manuales
WHERE tenant_id = attendance.current_tenant_id()

-- 3. Orden de migración: extensions → tables → rls → grants → seed

-- 4. NO usar assert_tenant_access() en funciones ejecutadas como superuser en SQL Editor

-- 5. punches.verification es JSONB → acceder con operadores ->, ->>, #>
--    NUNCA tratar como integer
```

---

### TENANT GATE (implementar en TODO frontend)

```typescript
// Al cargar la app, verificar:
const { data: tenant } = await supabase
  .from('tenants')
  .select('status, is_suspended')
  .eq('id', tenantId)
  .single();

if (tenant?.status === 'paused' || tenant?.is_suspended) {
  // Mostrar mensaje de public.app_settings.paused_message_title/body
  // Bloquear toda navegación
}
```

---

## ══ GAPS REALES IDENTIFICADOS (estado 2026-04-14) ══

Estos son los gaps confirmados comparando ARCHITECTURE.md vs DATABASE_SCHEMA.md.
NO pedir la implementación de lo que ya existe.

### GAP-1 · `attendance.settings` — Incompleto
**Estado actual**: solo tiene `mode` y `timezone`.
**Falta**: grace_entry_minutes, grace_exit_minutes, rounding_policy,
  max_punches_per_day, allow_duplicates, geo_enabled, geo_radius_m,
  face_required, device_required, allow_remote.
**Acción**: `ALTER TABLE attendance.settings ADD COLUMN ...` (no crear tabla nueva).

### GAP-2 · `attendance.novelties` — Sin definición formal
**Estado actual**: referenciada en ARCHITECTURE.md pero sin tabla documentada en schema.
**Falta**: Confirmar si existe en DB; si no, crear con:
  `(id, tenant_id, employee_id, punch_id, type, severity, detected_by, details jsonb, date, created_at)`.
**Tipos sugeridos**: ATRASO | AUSENCIA | DOBLE_MARCACION | FUERA_GEOFENCE |
  SOSPECHOSO | PATRON_IRREGULAR | SIN_SALIDA | HORARIO_NOCTURNO_INUSUAL.

### GAP-3 · UI Módulo de Configuración de Asistencia
**Estado actual**: `attendance.settings` existe pero UI incompleta en base-front.
**Falta**: Formulario CRUD completo para los campos del GAP-1.
**Depende de**: GAP-1 resuelto primero.

### GAP-4 · UI Ficha Empleado (tabs enterprise)
**Estado actual**: datos existen en 3 tablas (`public.employees` +
  `attendance.employees` + `attendance.employee_profile`).
**Falta**: Componente tabbed que unifique los 3 registros via `upsert_employee_full()`.
**Tabs**: Datos personales | Datos laborales | Biometría/GPS | Historial | Documentos.

### GAP-5 · Módulo de Reportes (exportación real)
**Estado actual**: jsPDF + xlsx + docx ya en dependencies de base-front.
**Falta**: UI de reportes con filtros + exportación Excel/PDF usando esas libs.
**Reportes prioritarios**: Asistencia diaria | Novedades | Ranking puntualidad | Cumplimiento por área.

### GAP-6 · Dashboard KPI Semáforo
**Estado actual**: `attendance.kpi_settings` existe (`ranking_limit`, `chart_type`,
  `dashboard_widgets` jsonb).
**Falta**: UI dinámica con Recharts que consuma kpi_settings + attendance-ai-analyze.
**Regla semáforo**: verde/amarillo/rojo basado en umbrales configurables.

### GAP-7 · Tenant Gate en Frontend
**Estado actual**: lógica no implementada en pwa ni base-front.
**Falta**: Hook `useTenantGate()` que verifique `public.tenants.status` al arrancar.
**Ver**: sección TENANT GATE arriba.

### GAP-8 · Rate Limiting en Edge Functions
**Estado actual**: ninguna Edge Function tiene rate limiting.
**Falta**: Middleware de rate limit en `face-verify` y `attendance-ai-analyze`
  usando `punch_attempts` como tabla de control.

---

## ══ BLOQUE B: TAREA DEL MÓDULO (reemplazar en cada sesión) ══

```
## MÓDULO: [NOMBRE — ej. "GAP-1: Extensión attendance.settings"]

### Objetivo
[Una oración que describa el resultado final verificable]

### Alcance exacto de esta sesión
1. [Feature 1 — criterio de éxito concreto, ej. "ALTER TABLE ejecutable en SQL Editor"]
2. [Feature 2 — criterio de éxito concreto]
3. [Feature 3 — criterio de éxito concreto]

### Tablas fuente (input)
- [tabla existente que se lee o extiende]

### Output esperado
- [tabla nueva / columnas / RPC / componente / hook]

### Restricciones específicas de este módulo
- [cualquier constraint adicional, ej. "no tocar register_web_punch"]
- [dependencias: "requiere GAP-1 resuelto"]

### Lo que NO se implementa en esta sesión
- [módulos fuera de alcance — para evitar scope creep]

### Orden de entrega
1. SQL (con RLS + NOTIFY pgrst)
2. TypeScript service/hook
3. Componente React completo
```

---

## ══ REGLAS DE ENTREGA OBLIGATORIAS ══

1. **Archivos completos** — nunca snippets, nunca `// ... resto igual`
2. **SQL ejecutable** — copiar-pegar directo en Supabase SQL Editor sin modificar
3. **Todo multi-tenant** — `tenant_id` en cada query, INSERT, RLS policy
4. **Versionar** — si reemplaza archivo existente, sufijo `_v[N]` en nombre
5. **RLS incluida** — toda tabla nueva incluye sus policies en el mismo script
6. **No romper** — las funciones listadas en "FUNCIONES EXISTENTES" no se modifican
   a menos que la tarea lo requiera explícitamente
7. **Orden lógico de dependencias** — SQL → hooks → UI (nunca al revés)
8. **TypeScript strict** — no usar `any`, tipos explícitos en todas las props

---

## ══ ORDEN RECOMENDADO DE MÓDULOS (por dependencias) ══

```
Sesión 1 → GAP-2: Crear/confirmar attendance.novelties
Sesión 2 → GAP-1: Extender attendance.settings + UI config (depende de GAP-2)
Sesión 3 → GAP-7: Tenant Gate hook (independiente, riesgo alto si no está)
Sesión 4 → GAP-4: Ficha empleado tabs (UI pura, datos ya existen)
Sesión 5 → GAP-5: Módulo reportes base-front (consume tablas estables)
Sesión 6 → GAP-6: Dashboard KPI semáforo (consume todo lo anterior)
Sesión 7 → GAP-8: Rate limiting Edge Functions (transversal, al final)
Sesión 8 → GAP-3: UI config asistencia (depende GAP-1)
```

---

## ══ REFERENCIA RÁPIDA DE ENTORNO ══

| Variable | Valor |
|---|---|
| Supabase Project ID | `qymoohwtxceggtvgjfsv` |
| Admin user UUID | `89b81e6c-2849-467b-8878-b3c886462672` |
| Tenant prueba (New4) | `4bddfca3-04b4-47f0-bff6-3e3145ec095c` |
| ADMS Gateway | `67.205.144.124:8080` (DigitalOcean NYC1) |
| Storage key PWA | `hrcloud_pwa_session` |
| AI provider | Google Gemini `gemini-2.5-flash` |
| Deploy | DigitalOcean App Platform (estático + Python workers) |

---

## ══ BLOQUE C: MÓDULO CIRA V2.0 — MOTOR DE CÁLCULO NORMATIVO ══
> ERS Fecha: 2026-04-16 · Versión 2.0 (Post-Análisis Legal)
> DOMINIO: Cálculo horario, recargos legales, multas, vacaciones (Ecuador)
> PRIORIDAD: Alta — bloqueante legal para clientes en producción

---

### CONTEXTO LEGAL OBLIGATORIO (Ecuador)

Este módulo opera bajo **dos regímenes laborales** que el LLM debe distinguir siempre:

| Concepto | LOSEP (Sector Público) | Código de Trabajo (Privado) |
|---|---|---|
| Hora suplementaria | HB × 1.25 | HB × 1.50 |
| Hora suplementaria nocturna | HB × 1.56 (1.25²) | HB × 1.875 (1.25×1.50) |
| Hora extraordinaria (feriado/fin semana) | HB × 2.00 | HB × 2.00 |
| Hora extraordinaria nocturna | HB × 2.50 (2.00×1.25) | HB × 2.50 (2.00×1.25) |
| Recargo nocturno (jornada regular) | HB × 1.25 | HB × 1.25 |
| Límite horas suplem./mes | 60 h (parametrizable) | 48 h suplem. (parametrizable) |
| Límite horas suplem./día | 4 h (parametrizable) | 4 h (parametrizable) |
| Fórmula monto vacaciones | Ingresos_12_meses / 24 | Ingresos_12_meses / 24 |
| Franja nocturna por defecto | 19:00 – 06:00 (cruce día siguiente) | 19:00 – 06:00 |

**HB (Hora Base)** = Sueldo_Mensual / 240

**Regla clave**: Los porcentajes de la tabla NO son hardcodeados. Viven en
`attendance.surcharge_rules` para que cambios legales sean solo un UPDATE, no un deploy.

---

### TABLAS NUEVAS REQUERIDAS POR CIRA V2.0

Todas en schema `attendance`. Todas con `tenant_id` + RLS.

```sql
-- 1. Configuración de régimen laboral por tenant
attendance.labor_regime_config
  tenant_id          uuid PK FK
  regime             text NOT NULL  -- 'LOSEP' | 'CODIGO_TRABAJO'
  night_start        time NOT NULL  DEFAULT '19:00'
  night_end          time NOT NULL  DEFAULT '06:00'  -- puede cruzar medianoche
  max_suplem_daily_h numeric        DEFAULT 4
  max_suplem_monthly_h numeric      DEFAULT 48
  fine_cap_pct       numeric        DEFAULT 10  -- % del salario mensual
  reincidence_threshold int         DEFAULT 3   -- atrasos antes de escalar multa
  reincidence_multiplier numeric    DEFAULT 1.5
  updated_at         timestamptz    DEFAULT now()

-- 2. Tabla parametrizable de recargos (NO hardcodear porcentajes)
attendance.surcharge_rules
  id                 uuid PK
  tenant_id          uuid NOT NULL
  regime             text NOT NULL  -- 'LOSEP' | 'CODIGO_TRABAJO'
  hour_type          text NOT NULL  -- 'NORMAL_DIURNA' | 'NORMAL_NOCTURNA' |
                                    -- 'SUPLEMENTARIA' | 'SUPLEMENTARIA_NOCTURNA' |
                                    -- 'EXTRAORDINARIA' | 'EXTRAORDINARIA_NOCTURNA'
  multiplier         numeric NOT NULL  -- ej: 1.25, 1.50, 1.875, 2.00, 2.50
  is_active          boolean DEFAULT true
  valid_from         date
  created_at         timestamptz DEFAULT now()
  UNIQUE (tenant_id, regime, hour_type)

-- 3. Bloques de horario (extiende schedules para jornadas multi-bloque)
attendance.schedule_blocks
  id                 uuid PK
  schedule_id        uuid NOT NULL FK → attendance.schedules(id)
  tenant_id          uuid NOT NULL
  block_order        int NOT NULL    -- 1, 2, 3... para ordenar segmentos
  start_time         time NOT NULL
  end_time           time NOT NULL
  crosses_midnight   boolean DEFAULT false
  created_at         timestamptz DEFAULT now()
  UNIQUE (schedule_id, block_order)

-- También: ALTER TABLE attendance.schedules ADD COLUMN
--   schedule_type text DEFAULT 'diurna' CHECK (IN ('diurna','nocturna','mixta'))

-- 4. Solicitudes de horas extras (workflow aprobación)
attendance.overtime_requests
  id                 uuid PK
  tenant_id          uuid NOT NULL
  employee_id        uuid NOT NULL FK
  requested_date     date NOT NULL
  hours_requested    numeric NOT NULL
  hour_type          text NOT NULL  -- 'SUPLEMENTARIA' | 'EXTRAORDINARIA'
  justification      text NOT NULL
  status             text DEFAULT 'pending'  -- pending|approved|rejected|compensated
  compensate_as_time boolean DEFAULT false  -- true = canjear por permiso en lugar de pago
  reviewed_by        uuid  -- employee_id del aprobador
  review_note        text
  created_at         timestamptz DEFAULT now()
  updated_at         timestamptz DEFAULT now()

-- 5. Config granular de multas por tipo de incidencia
attendance.fine_config
  id                 uuid PK
  tenant_id          uuid NOT NULL
  incident_type      text NOT NULL  -- 'ATRASO_ENTRADA' | 'ATRASO_ALMUERZO' |
                                    -- 'SALIDA_TEMPRANA' | 'AUSENCIA_INJUSTIFICADA'
  calc_method        text NOT NULL  -- 'per_minute' | 'fixed' | 'proportional'
  value              numeric NOT NULL  -- $ por minuto, monto fijo, o factor proporcional
  grace_minutes      int DEFAULT 0
  is_active          boolean DEFAULT true
  created_at         timestamptz DEFAULT now()
  UNIQUE (tenant_id, incident_type)

-- 6. Registro contable de multas aplicadas
attendance.fine_ledger
  id                 uuid PK
  tenant_id          uuid NOT NULL
  employee_id        uuid NOT NULL FK
  punch_id           uuid FK        -- referencia al punch que generó la multa
  incident_date      date NOT NULL
  incident_type      text NOT NULL
  calculated_amount  numeric NOT NULL  -- multa bruta calculada
  applied_amount     numeric NOT NULL  -- multa real (capada al tope legal si aplica)
  was_capped         boolean DEFAULT false  -- true si se capó al límite legal
  cap_excess         numeric DEFAULT 0     -- excedente que no se cobró (auditoría)
  month_year         text NOT NULL  -- 'YYYY-MM' para acumulados mensuales
  created_at         timestamptz DEFAULT now()

-- 7. Registro de horas extra liquidadas + acumulado para vacaciones
attendance.overtime_ledger
  id                 uuid PK
  tenant_id          uuid NOT NULL
  employee_id        uuid NOT NULL FK
  period_date        date NOT NULL        -- fecha de la jornada
  month_year         text NOT NULL        -- 'YYYY-MM'
  normal_hours       numeric DEFAULT 0
  night_hours        numeric DEFAULT 0    -- horas normales nocturnas
  suplem_hours       numeric DEFAULT 0
  suplem_night_hours numeric DEFAULT 0
  extra_hours        numeric DEFAULT 0
  extra_night_hours  numeric DEFAULT 0
  base_hourly_rate   numeric NOT NULL     -- HB al momento del cálculo
  total_amount       numeric NOT NULL     -- total calculado con recargos
  is_paid            boolean DEFAULT false
  overtime_request_id uuid FK             -- si fue aprobada via workflow
  created_at         timestamptz DEFAULT now()

-- 8. Saldo y movimientos de vacaciones
attendance.vacation_ledger
  id                 uuid PK
  tenant_id          uuid NOT NULL
  employee_id        uuid NOT NULL FK
  movement_type      text NOT NULL  -- 'ACCRUAL' | 'USED' | 'REVERSAL' | 'PAYOUT'
  days_delta         numeric NOT NULL  -- positivo = suma, negativo = resta
  reference_date     date NOT NULL
  amount_usd         numeric          -- monto calculado si es PAYOUT
  income_base_usd    numeric          -- Ingresos_12_meses usados en cálculo
  permission_request_id uuid FK       -- FK a permission_requests si aplica
  notes              text
  created_at         timestamptz DEFAULT now()
```

---

### FUNCIONES SQL NUEVAS REQUERIDAS

```sql
-- Motor de cálculo: clasifica cada minuto trabajado según régimen y franja
attendance.classify_work_minute(
  p_tenant_id     uuid,
  p_minute        timestamptz,
  p_schedule_id   uuid
) RETURNS text  -- 'NORMAL_DIURNA' | 'NORMAL_NOCTURNA' | 'SUPLEMENTARIA' |
                --  'SUPLEMENTARIA_NOCTURNA' | 'EXTRAORDINARIA' | 'EXTRAORDINARIA_NOCTURNA'

-- Motor principal: calcula el día completo de un empleado
attendance.calculate_day_totals(
  p_tenant_id    uuid,
  p_employee_id  uuid,
  p_date         date
) RETURNS TABLE (
  hour_type      text,
  minutes        numeric,
  hours          numeric,
  multiplier     numeric,
  base_rate      numeric,
  amount         numeric
)

-- Calcula multa del día con validación de tope legal mensual
attendance.calculate_daily_fine(
  p_tenant_id   uuid,
  p_employee_id uuid,
  p_date        date,
  p_incident    text
) RETURNS TABLE (
  calculated_amount numeric,
  applied_amount    numeric,
  was_capped        boolean,
  cap_excess        numeric
)

-- Calcula monto a pagar en vacaciones (fórmula legal)
attendance.calculate_vacation_payout(
  p_tenant_id   uuid,
  p_employee_id uuid
) RETURNS TABLE (
  income_12_months numeric,
  vacation_amount  numeric,  -- income_12_months / 24
  accrued_days     numeric
)
```

---

### REGLAS DE NEGOCIO CRÍTICAS (implementar exactamente)

**Motor de clasificación de horas:**
```
1. ¿Es feriado o fin de semana? → EXTRAORDINARIA (+ nocturna si aplica)
2. ¿Está dentro de la jornada asignada?
   SÍ → ¿Está dentro de franja nocturna (19:00-06:00)? → NORMAL_NOCTURNA / NORMAL_DIURNA
   NO → ¿Horas fuera ≤ límite diario suplementario (4h)?
        SÍ → SUPLEMENTARIA (+ nocturna si aplica)
        NO → EXTRAORDINARIA (+ nocturna si aplica)
```

**Cálculo de multa con tope:**
```
multa_bruta = calc_method_value × minutos_atraso (según fine_config)
multa_acumulada_mes = SUM(fine_ledger.applied_amount WHERE month_year = 'YYYY-MM')
tope = salario_mensual × (fine_cap_pct / 100)

Si (multa_acumulada_mes + multa_bruta) > tope:
  applied_amount = tope - multa_acumulada_mes  (lo que queda hasta el tope)
  was_capped = true
  cap_excess = multa_bruta - applied_amount
Else:
  applied_amount = multa_bruta
```

**Fórmula vacaciones (NO modificar, es ley):**
```
Ingresos_12_meses = SUM(overtime_ledger.total_amount últimos 12 meses)
                  + SUM(salario_base mensual 12 meses)
                  EXCLUYE: décimos, utilidades, fondos de reserva
Monto_Vacaciones = Ingresos_12_meses / 24
```

**Anulación de vacaciones:**
```
SI fecha_fin_permiso > HOY:
  → REVERSAL: days_delta = +días_originales (devolver saldo)
SI fecha_fin_permiso ≤ HOY:
  → NO modificar saldo de días
  → Crear registro de Nota de Crédito interna (movement_type = 'REVERSAL' con notes)
  → NO es automático — requiere confirmación del HR admin
```

---

### SCHEMA DE REPORTES REQUERIDOS POR ERS

**FR-09: Reporte de Asistencia con 3 pestañas (base-front)**

```
Pestaña 1 — Resumen del Día:
  empleado | fecha | horas_normales | horas_suplementarias | horas_extraordinarias | total_a_pagar_estimado

Pestaña 2 — Detalle Marcaciones y Multas:
  hora_entrada | minutos_atraso | multa_atraso_usd | hora_salida_almuerzo | multa_almuerzo_usd

Pestaña 3 — Acumulados Legales:
  horas_suplem_mes | limite_mensual | porcentaje_avance (barra visual)
  saldo_vacaciones_dias | total_multas_mes_usd
```

**FR-10: Export Ministerio de Trabajo (Excel predefinido)**

Columnas exactas:
`Cédula | Nombres | Fecha | Hora_Inicio | Hora_Fin | Tipo_Hora`

Usar librería `xlsx` ya disponible en `base-front`.

---

### GAPS EN SCHEMA ACTUAL QUE CIRA V2.0 NECESITA RESOLVER

| Tabla actual | Gap | Solución requerida |
|---|---|---|
| `attendance.schedules` | No tiene `schedule_type` (diurna/nocturna/mixta) | `ALTER TABLE ADD COLUMN schedule_type text DEFAULT 'diurna'` |
| `attendance.schedules` | Solo un par entry_time/exit_time (no multi-bloque) | Crear `attendance.schedule_blocks` (tabla separada, N bloques por schedule) |
| `public.employees` | No tiene `salary` accesible para calcular HB | Confirmar campo `salary numeric` en `public.employees` (ya existe en schema) |
| `attendance.settings` | No tiene franja nocturna configurable | Cubierto por `attendance.labor_regime_config` |
| `attendance.permission_requests` | No distingue vacaciones de otros permisos | Agregar `request_type text CHECK IN ('vacation','leave','medical','other')` |

---

### ORDEN DE IMPLEMENTACIÓN CIRA V2.0

```
Sesión C-1 → labor_regime_config + surcharge_rules + seed data por defecto (Código de Trabajo)
Sesión C-2 → ALTER schedules + schedule_blocks + fine_config
Sesión C-3 → classify_work_minute() + calculate_day_totals() (motor SQL)
Sesión C-4 → fine_ledger + calculate_daily_fine() con tope legal
Sesión C-5 → overtime_requests + workflow aprobación (UI + notificaciones)
Sesión C-6 → vacation_ledger + calculate_vacation_payout() + anulación
Sesión C-7 → overtime_ledger + integración con reporte FR-09 (3 pestañas)
Sesión C-8 → Export FR-10 (formato Ministerio de Trabajo)
```
