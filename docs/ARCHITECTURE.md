# HRCloud — Architecture Reference

> Monorepo: `ProyectoRLeon`  
> Product: **HRCloud** — Multi-tenant HR & Attendance SaaS platform  
> Last updated: 2026-04-14

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Tech Stack per Subproject](#2-tech-stack-per-subproject)
3. [Inter-Module Connections](#3-inter-module-connections)
4. [Supabase: Tables & Functions](#4-supabase-tables--functions)
5. [ASCII Architecture Diagram](#5-ascii-architecture-diagram)

---

## 1. Module Overview

| Module | Type | Purpose |
|---|---|---|
| `cerebro-front` | Web SPA | **Provider admin panel.** Manages the SaaS platform itself: creates/suspends tenants, handles billing & invoices, configures SMTP, monitors KPIs, manages internal staff roles, and broadcasts messages. Only Cerebro-role users (admin/assistant/maintenance) can access this. |
| `base-front` | Web SPA | **Tenant HR desktop app.** Used by HR admins and managers inside each tenant company. Manages employees, org structure, biometric devices, work turns & schedules, attendance records, novelties, reports (PDF/Excel), and facial recognition configuration. |
| `pwa` | PWA (mobile-first SPA) | **Employee self-service app.** Employees clock in/out via web (with GPS and optional selfie), view their own attendance history, submit requests (time-off, etc.), and receive notifications. Also doubles as the HR operator app for smaller deployments. Installable on Android/iOS. |
| `adms-gateway` | Python microservice | **ZKTeco biometric gateway.** Listens for the iClock protocol (ZKTeco ADMS) on `/iclock/cdata` and `/iclock/getrequest`. Parses tab-separated ATTLOG records, resolves employees by biometric PIN, converts local device time to UTC, and writes raw + parsed punch records directly to Supabase via REST API. |
| `app_face_v2.py` | Python microservice | **Face verification service (v2).** Two-layer OpenCV pipeline: Layer 1 = Haar Cascade face detection on the selfie; Layer 2 = LBPH face recognizer comparison against the employee reference photo stored in Supabase Storage. Updates `punch_evidence` rows with `verified / rejected / failed / error` status. |
| `supabase/` | Backend (BaaS) | **Central data layer.** PostgreSQL database (two schemas: `public` for Cerebro, `attendance` for HR/attendance), Supabase Auth, Row Level Security policies, Storage buckets, and Deno/TypeScript Edge Functions for server-side business logic. |
| `base-front/face-service/` | Python microservice | **Face service (embedded in base-front).** Older/alternative face verify microservice co-located with base-front, used during local development. Shares the same logic as `app_face_v2.py`. |

---

## 2. Tech Stack per Subproject

### `cerebro-front` — Provider Admin Panel

| Layer | Technology |
|---|---|
| Framework | React 18, TypeScript |
| Build | Vite 4, Terser |
| Styling | Tailwind CSS 3, PostCSS |
| Routing | React Router DOM v6 |
| Backend client | Supabase JS v2 |
| Forms | React Hook Form + Zod |
| Charts | Recharts 2 |
| Testing | Vitest, Testing Library, jsdom |
| Deploy | DigitalOcean App Platform (static) |

### `base-front` — Tenant HR Desktop App

| Layer | Technology |
|---|---|
| Framework | React 18, TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router DOM v6 |
| Backend client | Supabase JS v2 |
| Server state | TanStack React Query v5 |
| Client state | Zustand v5 |
| Validation | Zod 3 |
| Reports | jsPDF + jsPDF-AutoTable, xlsx, docx, html2canvas |
| Password strength | zxcvbn |
| Deploy | DigitalOcean App Platform (static, with `_redirects` + `404.html` for SPA routing) |

### `pwa` — Employee Self-Service PWA

| Layer | Technology |
|---|---|
| Framework | React 18, TypeScript |
| Build | Vite 5, vite-plugin-pwa (Workbox) |
| Styling | Tailwind CSS 3 |
| Routing | React Router DOM v6 |
| Backend client | Supabase JS v2 |
| Server state | TanStack React Query v5 |
| Client state | Zustand v5 |
| Validation | Zod 4 |
| Geo | Browser Geolocation API (`lib/geolocation.ts`) |
| Face capture | Browser MediaDevices / Canvas API (`FaceCaptureModal.tsx`) |
| PWA | vite-plugin-pwa, Workbox, Web App Manifest |
| Local TLS (dev) | mkcert + `@vitejs/plugin-basic-ssl` |
| Deploy | DigitalOcean App Platform (static) |

### `adms-gateway` — ZKTeco ADMS Gateway

| Layer | Technology |
|---|---|
| Runtime | Python 3 (zoneinfo, dataclasses) |
| Web server | Flask + flask-cors |
| HTTP client | requests |
| Time handling | `zoneinfo` (IANA tz), UTC conversion |
| Protocol | ZKTeco iClock (plain HTTP, tab-separated ATTLOG) |
| Auth method parsing | verify_type codes (1=fingerprint, 3=pin, 15=face) |
| Deploy | DigitalOcean App Platform (Python worker, port 8080) |

### `app_face_v2.py` — Face Verification Service

| Layer | Technology |
|---|---|
| Runtime | Python 3 |
| Web server | Flask |
| Vision Layer 1 | OpenCV Haar Cascade (`haarcascade_frontalface_default.xml`) |
| Vision Layer 2 | OpenCV LBPH Face Recognizer (`cv2.face.LBPHFaceRecognizer`) |
| Matrix math | NumPy |
| HTTP client | requests (Supabase Storage + REST) |
| Endpoints | `POST /verify`, `POST /verify-pwa`, `POST /process-pending`, `GET /health` |
| Deploy | Standalone Python service (port 5001) |

### `supabase/` — Backend

| Layer | Technology |
|---|---|
| Database | PostgreSQL (via Supabase) |
| DB Schemas | `public` (Cerebro), `attendance` (HR/attendance isolated) |
| Auth | Supabase GoTrue (JWT, magic links, email/password) |
| Edge Functions | Deno / TypeScript (deployed to Supabase Edge Runtime) |
| Storage | Supabase Storage buckets (`employee_photos`, `punch-selfies`) |
| RLS | Row Level Security policies per table |
| Encryption | AES-GCM (AI API keys encrypted at rest, decrypted in Edge Functions) |

---

## 3. Inter-Module Connections

```
Module                   Connects To                   Method / Protocol
─────────────────────────────────────────────────────────────────────────
cerebro-front        →  Supabase (public schema)       supabase-js SDK (REST + Realtime)
cerebro-front        →  Edge: admin-create-tenant      HTTP POST (Bearer JWT)
cerebro-front        →  Edge: admin-create-user        HTTP POST (Bearer JWT)
cerebro-front        →  Edge: admin-invite-staff       HTTP POST (Bearer JWT)
cerebro-front        →  Edge: broadcast-email          HTTP POST (Bearer JWT)
cerebro-front        →  Edge: smtp-settings            HTTP POST (Bearer JWT)
cerebro-front        →  Edge: smtp-test                HTTP POST (Bearer JWT)

base-front           →  Supabase (attendance schema)   supabase-js SDK
base-front           →  Supabase (public schema)       supabase-js SDK
base-front           →  app_face_v2.py /verify         HTTP POST (API secret)
base-front           →  base-front/face-service        HTTP POST (local dev only)
base-front           →  Edge: face-verify              HTTP POST (Bearer JWT)
base-front           →  Edge: attendance-ai-analyze    HTTP POST (Bearer JWT)

pwa                  →  Supabase (attendance schema)   supabase-js SDK
pwa                  →  Edge: attendance-ai-analyze    HTTP POST (Bearer JWT)
pwa                  →  Edge: face-verify              HTTP POST (Bearer JWT)
pwa                  →  Supabase Storage               Upload selfie images

adms-gateway         →  Supabase REST /rest/v1         HTTP (Service Role Key)
adms-gateway         ←  ZKTeco Biometric Device        iClock protocol (HTTP GET/POST)
adms-gateway reads:     attendance.biometric_devices   (device/tenant lookup)
adms-gateway reads:     attendance.employees           (PIN→employee_id resolution)
adms-gateway writes:    attendance.biometric_raw       (raw audit log)
adms-gateway writes:    attendance.punches             (parsed punch records)
adms-gateway updates:   attendance.biometric_devices   (last_seen_at)

app_face_v2.py       →  Supabase REST /rest/v1         HTTP (Service Role Key)
app_face_v2.py reads:   attendance.employees           (photo_path lookup)
app_face_v2.py reads:   attendance.punch_evidence      (pending evidence)
app_face_v2.py reads:   Supabase Storage               (download selfie + reference photo)
app_face_v2.py writes:  attendance.punch_evidence      (verification_status, score, notes)

Edge: biometric-gatekeeper → Supabase attendance schema  supabase-js (Service Role)
Edge: attendance-ai-analyze → Google Gemini API          HTTP (decrypted API key)
Edge: attendance-ai-analyze → Supabase attendance.punches supabase-js
```

**Auth flow:**
- Cerebro staff authenticate via Supabase Auth → JWT carries email, checked against `public.user_roles`
- Tenant users (HR admins, employees) authenticate via Supabase Auth → JWT carries `tenant_id` + `app_role` claims, enforced by RLS
- Service-to-service calls (adms-gateway, face service) use `SUPABASE_SERVICE_ROLE_KEY` — bypass RLS

---

## 4. Supabase: Tables & Functions

### Schema: `public` (Cerebro — SaaS provider layer)

| Table | Description |
|---|---|
| `app_settings` | Global branding singleton (company name, logo, colors, login messages) |
| `smtp_settings` | Global SMTP configuration singleton (host, port, from, secret_name) |
| `billing_settings` | Global billing config singleton (currency, tax %, invoice footer) |
| `kpi_targets` | KPI target thresholds singleton (revenue, clients, alert %) |
| `security_settings` | Password policy singleton (complexity, rotation) |
| `user_roles` | Internal Cerebro staff roles: `admin` / `assistant` / `maintenance` |
| `role_permissions` | JSONB permissions matrix per Cerebro role |
| `plans` | Service plan catalog (basic, flat/per_user/usage billing models) |
| `tenants` | Client companies (name, RUC, plan, status, billing_period, grace_days) |
| `invoices` | Tenant billing invoices (period, subtotal, tax, total, status) |
| `messages` | In-app broadcast messages (title, body, priority, target_roles) |
| `message_reads` | Per-user read receipts for messages |
| `audit_logs` | Append-only audit trail (user_email, action, details, timestamp) |
| `profiles` | Tenant user profiles linked to Supabase Auth (tenant_id, role, is_active) |
| `biometric_devices` | Registered biometric devices per tenant (serial, name, is_active) |
| `tenant_ai_settings` | Per-tenant AI config (provider=gemini, model, encrypted API key, system_prompt) |
| `v_tenant_ia_status` | View: tenant name + whether AI is available/enabled |

### Schema: `attendance` (HR & Attendance — isolated)

| Table / View | Description |
|---|---|
| `memberships` | User → tenant + role mapping (`tenant_admin` / `hr_admin` / `admin` / `employee`) |
| `my_memberships` | Security-barrier view: current user's own memberships |
| `settings` | Per-tenant attendance settings (mode: biometric/web, timezone) |
| `turns` | Work turn definitions (diurno / vespertino / nocturno, days of week) |
| `schedules` | Work schedules linked to turns (entry/exit times, meal breaks, crosses_midnight) |
| `employees` | Employees per tenant (employee_code, name, schedule_id, biometric_code, photo_path) |
| `biometric_devices` | ZKTeco devices per tenant (serial_no, name, device_timezone, last_seen_at) |
| `biometric_raw` | Raw iClock payloads for audit/troubleshooting (headers, body, query) |
| `punches` | Unified punch log — all sources (web / biometric / import): employee_id, punched_at, source, meta |
| `punch_evidence` | Selfie + geo evidence for web punches; face verification result (status, score, notes) |
| `novelties` | HR-reviewed attendance novelties (tardiness, absence, justification, status) |
| `requests` | Employee self-service requests (time-off, etc.) |
| `departments` | Organizational departments per tenant |
| `org_units` | Organizational units (hierarchy nodes) |
| `tenant_reports_config` | Per-tenant report configuration |

### SQL Helper Functions (PostgreSQL)

| Function | Schema | Description |
|---|---|---|
| `current_tenant_id()` | `public` / `attendance` | Returns tenant UUID from JWT claim or profiles fallback |
| `current_user_role()` | `attendance` | Returns app_role from JWT or memberships fallback |
| `can_manage_attendance()` | `attendance` | Returns true for tenant_admin / hr_admin / admin roles |
| `attendance_tenant_timezone()` | `public` | Returns timezone string for current tenant |

### Edge Functions (Deno/TypeScript)

| Function | Caller | Description |
|---|---|---|
| `admin-create-tenant` | cerebro-front | Creates tenant row, optional biometric device, optional admin Auth user + profile. Requires Cerebro admin JWT. |
| `admin-create-user` | cerebro-front | Creates Cerebro internal staff user (admin/assistant/maintenance) in Supabase Auth + user_roles. |
| `admin-invite-staff` | cerebro-front | Invites staff via magic link email. |
| `attendance-ai-analyze` | base-front / pwa | Fetches punches for a date range, derives novelties (duplicates, odd IN/OUT counts, missing geo), builds a prompt, calls Google Gemini API with AES-GCM decrypted key, returns structured HR analysis JSON. |
| `biometric-gatekeeper` | ZKTeco / adms-gateway | Alternative biometric punch ingestion path. Resolves device serial → tenant, PIN → employee_id, inserts into `attendance.punches`. |
| `broadcast-email` | cerebro-front | Sends bulk emails to tenant contacts using configured SMTP settings. |
| `face-verify` | base-front / pwa | Entry point for face verification (delegates to `app_face_v2.py` or processes inline). |
| `smtp-settings` | cerebro-front | Reads/writes SMTP configuration. Stores password in Supabase Vault. |
| `smtp-test` | cerebro-front | Sends a test email to verify SMTP configuration. |
| `tenant-ai-settings-save` | base-front / pwa | Encrypts AI API key with AES-GCM (32-byte key from env), saves `tenant_ai_settings`. |

### Storage Buckets

| Bucket | Used By | Content |
|---|---|---|
| `employee_photos` | base-front, app_face_v2.py | Reference photos for face verification |
| `punch-selfies` | pwa, app_face_v2.py | Selfie captures taken during web punch |

---

## 5. ASCII Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                          HRCloud — System Architecture                          ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  USERS / CLIENTS                  FRONTENDS                   BACKEND SERVICES
  ─────────────────                ─────────────────           ──────────────────

  ┌─────────────────┐              ┌──────────────────────┐
  │  Cerebro Admin  │─── HTTPS ───▶│   cerebro-front      │
  │  (SaaS staff)   │              │   React+Vite SPA     │
  └─────────────────┘              │   (DigitalOcean)     │
                                   └──────────┬───────────┘
                                              │ supabase-js
                                              │ Bearer JWT
                                              ▼
  ┌─────────────────┐              ┌──────────────────────┐      ┌────────────────────┐
  │  HR Admin /     │─── HTTPS ───▶│   base-front         │      │  app_face_v2.py    │
  │  Tenant Manager │              │   React+Vite SPA     │─────▶│  Flask + OpenCV    │
  └─────────────────┘              │   (DigitalOcean)     │      │  HaarCascade+LBPH  │
                                   └──────────┬───────────┘      │  port :5001        │
                                              │ supabase-js       └────────┬───────────┘
                                              │                            │ REST (SvcKey)
  ┌─────────────────┐              ┌──────────────────────┐               │
  │  Employee       │─── HTTPS ───▶│   pwa                │               │
  │  (mobile/web)   │              │   React PWA          │               │
  │  [GPS + Selfie] │              │   (DigitalOcean)     │               │
  └─────────────────┘              └──────────┬───────────┘               │
                                              │ supabase-js               │
                                              │                            │
  ┌─────────────────┐              ┌──────────────────────┐               │
  │  ZKTeco         │─── iClock ──▶│   adms-gateway       │               │
  │  Biometric      │   HTTP/TCP   │   Python Flask       │               │
  │  Device         │              │   port :8080         │               │
  └─────────────────┘              └──────────┬───────────┘               │
                                              │ REST (SvcKey)              │
                                              ▼                            ▼
  ══════════════════════════════════════════════════════════════════════════════
                              SUPABASE (PostgreSQL + BaaS)
  ══════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────┐     ┌────────────────────────────────────┐
    │  Schema: public (Cerebro)   │     │  Schema: attendance (HR/Punches)   │
    │─────────────────────────────│     │────────────────────────────────────│
    │  tenants                    │     │  memberships                       │
    │  plans                      │     │  employees                         │
    │  invoices                   │     │  turns + schedules                 │
    │  user_roles                 │     │  biometric_devices                 │
    │  role_permissions           │     │  biometric_raw  (audit)            │
    │  profiles                   │     │  punches  ◄── all sources          │
    │  app_settings  (brand)      │     │  punch_evidence (selfie + face AI) │
    │  smtp_settings              │     │  novelties                         │
    │  billing_settings           │     │  requests                          │
    │  kpi_targets                │     │  departments + org_units           │
    │  security_settings          │     │  settings (mode, timezone)         │
    │  tenant_ai_settings         │     │  tenant_reports_config             │
    │  v_tenant_ia_status (view)  │     │                                    │
    │  messages + message_reads   │     │  Views:                            │
    │  audit_logs                 │     │  attendance_v_punch_report         │
    │  biometric_devices          │     │  my_memberships                    │
    └─────────────────────────────┘     └────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │  Edge Functions (Deno/TypeScript)                                        │
    │─────────────────────────────────────────────────────────────────────────│
    │  admin-create-tenant    admin-create-user    admin-invite-staff          │
    │  broadcast-email        smtp-settings        smtp-test                   │
    │  biometric-gatekeeper   face-verify                                      │
    │  attendance-ai-analyze ──────────────────────────────────┐              │
    │  tenant-ai-settings-save (AES-GCM encrypt)               │              │
    └──────────────────────────────────────────────────────────┼──────────────┘
                                                               │ HTTPS
                                                               ▼
                                                    ┌─────────────────────┐
                                                    │  Google Gemini API  │
                                                    │  (gemini-2.5-flash) │
                                                    │  HR analysis AI     │
                                                    └─────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │  Storage Buckets                                                          │
    │  employee_photos   ──── downloaded by ──── app_face_v2.py (reference)   │
    │  punch-selfies     ──── uploaded by   ──── pwa (web punches)            │
    │                    ──── downloaded by ──── app_face_v2.py (verify)      │
    └─────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │  Supabase Auth (GoTrue)                                                   │
    │  • Email/password + magic link                                            │
    │  • JWT claims: tenant_id, app_role                                        │
    │  • RLS enforces tenant isolation on all attendance.* tables               │
    │  • Service Role Key used by adms-gateway + app_face_v2.py (bypass RLS)   │
    └─────────────────────────────────────────────────────────────────────────┘

  ══════════════════════════════════════════════════════════════════════════════
                          DATA FLOW — Attendance Punch
  ══════════════════════════════════════════════════════════════════════════════

  [Biometric punch]
  ZKTeco Device
    │ iClock POST /iclock/cdata
    ▼
  adms-gateway (Python)
    │ Lookup: biometric_devices → tenant_id
    │ Lookup: employees → employee_id (by biometric_employee_code/PIN)
    │ Insert: biometric_raw (raw audit)
    │ Insert: punches (source=biometric)
    ▼
  attendance.punches

  [Web punch — employee self-service]
  PWA (browser)
    │ Captures GPS + selfie (canvas)
    │ Uploads selfie → punch-selfies bucket
    │ Calls register_web_punch RPC
    ▼
  attendance.punches + punch_evidence (status=pending)
    │
    ▼
  app_face_v2.py POST /verify-pwa
    │ Downloads selfie + employee reference photo
    │ Layer 1: Haar Cascade (face detection)
    │ Layer 2: LBPH comparison (score vs threshold)
    ▼
  attendance.punch_evidence.verification_status = verified|rejected|failed

  [AI Analysis — HR manager]
  base-front / pwa
    │ POST attendance-ai-analyze Edge Function
    │ Date range + tenant_id
    ▼
  Edge Function
    │ Fetches attendance.punches
    │ Derives novelties (duplicate, odd IN/OUT, missing geo)
    │ Decrypts Gemini API key (AES-GCM)
    │ Builds managerial HR prompt
    ▼
  Google Gemini API → returns structured JSON analysis
    │
    ▼
  Front-end renders: summary, findings, critical_employees, recommendations
```

---

## Deployment Notes

- All frontends deploy as **static sites on DigitalOcean App Platform**, each as a separate Source Directory component.
- `adms-gateway` and `app_face_v2.py` deploy as **Python workers** on DigitalOcean App Platform.
- TLS is terminated by DigitalOcean; services run plain HTTP internally.
- Environment secrets (`SUPABASE_SERVICE_ROLE_KEY`, `API_SECRET`, `AI_SETTINGS_ENCRYPTION_KEY`) are injected via DigitalOcean App environment variables — never committed to source.
- SPA routing is handled by a `_redirects` file (Netlify-style) + `404.html` copy of `index.html`.
