# HRCloud — Database Schema Reference

> Generated from: `supabase/sql/`, `supabase/sql_attendance_isolated/`, `supabase/functions/`, `pwa/sql/`, `base-front/sql/`  
> PostgreSQL via Supabase · Two schemas: `public` (Cerebro SaaS layer) and `attendance` (HR/punch layer)  
> Last updated: 2026-04-14

---

## Table of Contents

1. [Extensions & Config](#1-extensions--config)
2. [Schema: public (Cerebro)](#2-schema-public--cerebro)
3. [Schema: attendance (HR & Punches)](#3-schema-attendance--hr--punches)
4. [Views](#4-views)
5. [Enums](#5-enums)
6. [PostgreSQL Functions & Triggers](#6-postgresql-functions--triggers)
7. [Row Level Security (RLS) Summary](#7-row-level-security-rls-summary)
8. [Edge Functions](#8-edge-functions)
9. [Storage Buckets](#9-storage-buckets)
10. [Mermaid ERD Diagram](#10-mermaid-erd-diagram)

---

## 1. Extensions & Config

```sql
create extension if not exists pgcrypto;    -- UUIDs, crypto helpers
-- Vault extension (Dashboard: Database > Extensions > Vault)
-- Used to store SMTP password encrypted at rest
```

**Supabase project_id**: `cerebro-front`  
**API schemas exposed**: `public`, `graphql_public`  
**PostgREST max_rows**: 1000  

---

## 2. Schema: public (Cerebro)

The `public` schema is the **Cerebro SaaS provider layer**: manages tenants, billing, internal staff, settings, and audit.

---

### `public.app_settings` — Global Branding (singleton)

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PK | `1` (singleton) |
| `company_name` | `text` | | |
| `company_ruc` | `text` | | |
| `company_logo` | `text` | | |
| `primary_color` | `text` | | |
| `secondary_color` | `text` | | |
| `accent_color` | `text` | | |
| `login_message_title` | `text` | | |
| `login_message_body` | `text` | | |
| `paused_message_title` | `text` | | `'Servicio pausado'` |
| `paused_message_body` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | | |

**RLS**: SELECT → any internal user; INSERT/UPDATE → admin only  
**Note**: Always a single row with `id = 1`.

---

### `public.smtp_settings` — Global SMTP (singleton)

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PK | `1` (singleton) |
| `host` | `text` | | |
| `port` | `int` | | |
| `username` | `text` | | |
| `from_email` | `text` | | |
| `from_name` | `text` | | |
| `secure` | `boolean` | NOT NULL | `false` |
| `secret_name` | `text` | NOT NULL | `'cerebro_smtp_password'` |
| `has_secret` | `boolean` | NOT NULL | `false` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT → internal; UPDATE → admin  
**Note**: SMTP password stored in Supabase Vault under `secret_name`. The flag `has_secret` indicates whether the secret was saved.

---

### `public.billing_settings` — Billing Config (singleton)

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PK | `1` |
| `currency` | `text` | NOT NULL | `'USD'` |
| `tax_percent` | `numeric` | NOT NULL | `0` |
| `invoice_footer` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT → internal; INSERT/UPDATE → admin

---

### `public.kpi_targets` — KPI Targets (singleton)

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PK | `1` |
| `expected_revenue_monthly` | `numeric` | NOT NULL | `0` |
| `expected_new_clients_monthly` | `int` | NOT NULL | `0` |
| `green_change_pct` | `numeric` | NOT NULL | `0` |
| `yellow_change_pct` | `numeric` | NOT NULL | `-5` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT → internal; INSERT/UPDATE → admin

---

### `public.security_settings` — Password Policy (singleton)

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `int` | PK | `1` |
| `password_level` | `text` | NOT NULL | `'medium'` |
| `min_length` | `int` | NOT NULL | `10` |
| `require_upper` | `boolean` | NOT NULL | `true` |
| `require_number` | `boolean` | NOT NULL | `true` |
| `require_special` | `boolean` | NOT NULL | `true` |
| `rotation_enabled` | `boolean` | NOT NULL | `false` |
| `rotation_days_default` | `int` | NOT NULL | `90` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT → internal; INSERT/UPDATE → admin

---

### `public.user_roles` — Cerebro Staff Roles

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `email` | `text` | NOT NULL, UNIQUE | |
| `role` | `text` | NOT NULL, CHECK | `admin\|assistant\|maintenance` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT → admin sees all, each user sees own email row; INSERT/UPDATE/DELETE → admin  
**Indexes**: unique on `email`

---

### `public.role_permissions` — Permissions Matrix

| Column | Type | Constraints | Default |
|---|---|---|---|
| `role` | `text` | PK | |
| `permissions` | `jsonb` | NOT NULL | `'{}'` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Seed data**:
- `admin` → `{"__all": true}`
- `assistant` → `{"dashboard": true, "tenants": true, "invoices": true, "compose_message": true}`
- `maintenance` → `{"dashboard": true, "audit": true}`

**RLS**: SELECT → internal; INSERT/UPDATE → admin

---

### `public.plans` — Service Plan Catalog

| Column | Type | Constraints | Default |
|---|---|---|---|
| `code` | `text` | PK | |
| `name` | `text` | NOT NULL | |
| `description` | `text` | NOT NULL | `''` |
| `billing_model` | `text` | NOT NULL, CHECK | `flat\|per_user_active\|usage`, default `'flat'` |
| `price_model` | `text` | NOT NULL, CHECK | `fixed\|usage`, default `'fixed'` |
| `price` | `numeric` | NOT NULL | `0` |
| `unit_price` | `numeric` | NOT NULL | `0` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT → internal; INSERT/UPDATE → admin  
**Seed**: `('basic', 'Básico', 'Plan base', 'flat', 'fixed', 0, 0)`

---

### `public.tenants` — Client Companies

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `name` | `text` | NOT NULL | |
| `ruc` | `text` | NOT NULL | |
| `contact_email` | `text` | NOT NULL | |
| `plan` | `text` | NOT NULL, FK → `plans(code)` | `'basic'` |
| `status` | `text` | NOT NULL, CHECK | `active\|trial\|paused`, default `'active'` |
| `bio_serial` | `text` | | |
| `bio_location` | `text` | | |
| `billing_period` | `text` | NOT NULL, CHECK | `weekly\|biweekly\|monthly\|semiannual`, default `'monthly'` |
| `grace_days` | `int` | NOT NULL | `0` |
| `pause_after_grace` | `boolean` | NOT NULL | `true` |
| `courtesy_users` | `int` | NOT NULL | `0` |
| `courtesy_discount_pct` | `numeric` | NOT NULL | `0` |
| `courtesy_duration` | `text` | NOT NULL, CHECK | `one_time\|periods\|contract`, default `'one_time'` |
| `courtesy_periods` | `int` | NOT NULL | `1` |
| `is_suspended` | `boolean` | | `false` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Foreign Keys**: `plan` → `public.plans(code)` ON UPDATE CASCADE  
**Indexes**: `status_idx`, `created_at_idx`, `contact_email_idx`  
**RLS**: SELECT/INSERT/UPDATE → admin or assistant

---

### `public.invoices` — Billing Invoices

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL, FK → `tenants(id)` ON DELETE CASCADE | |
| `number` | `text` | | |
| `period_start` | `date` | | |
| `period_end` | `date` | | |
| `subtotal` | `numeric` | NOT NULL | `0` |
| `tax` | `numeric` | NOT NULL | `0` |
| `total` | `numeric` | NOT NULL | `0` |
| `status` | `text` | NOT NULL, CHECK | `pending\|paid\|overdue\|void`, default `'pending'` |
| `paid_at` | `timestamptz` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes**: `tenant_id_idx`, `created_at_idx`  
**RLS**: SELECT/INSERT/UPDATE → admin or assistant

---

### `public.messages` — In-App Broadcast Messages

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `title` | `text` | NOT NULL | |
| `body` | `text` | NOT NULL | |
| `priority` | `text` | NOT NULL, CHECK | `normal\|urgent`, default `'normal'` |
| `target_roles` | `text[]` | NOT NULL | `ARRAY['assistant']` |
| `created_by` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes**: `created_at_idx`  
**RLS**: SELECT → internal users whose role matches `target_roles`; INSERT → admin or assistant

---

### `public.message_reads` — Message Read Receipts

| Column | Type | Constraints |
|---|---|---|
| `user_id` | `uuid` | NOT NULL |
| `message_id` | `uuid` | NOT NULL, FK → `messages(id)` ON DELETE CASCADE |
| `read_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**Primary Key**: `(user_id, message_id)`  
**RLS**: ALL → `user_id = auth.uid()` (users manage their own reads only)

---

### `public.audit_logs` — Audit Trail

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `user_email` | `text` | | |
| `action` | `text` | NOT NULL | |
| `details` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes**: `created_at_idx`  
**RLS**: INSERT → internal users; SELECT → admin or maintenance  
**Note**: Append-only. Written by Edge Functions (CREATE_TENANT, INSERT, etc.).

---

### `public.profiles` — Tenant User Profiles

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK (= `auth.users.id`) | |
| `tenant_id` | `uuid` | | |
| `role` | `text` | | `tenant_admin\|hr_admin\|employee` |
| `employee_id` | `uuid` | | |
| `is_active` | `boolean` | NOT NULL | `true` |
| `first_login_pending` | `boolean` | NOT NULL | `false` |
| `created_at` | `timestamptz` | | `now()` |

**Note**: Created by `admin-create-tenant` (for tenant admin) and `base-create-employee-user` (for employees).

---

### `public.employees` — Extended Employee Record

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | NOT NULL |
| `first_name` | `text` | NOT NULL |
| `last_name` | `text` | NOT NULL |
| `email` | `text` | |
| `phone` | `text` | Added 2026-04-07 |
| `address` | `text` | Added 2026-04-07 |
| `identification` | `text` | |
| `department_id` | `uuid` | |
| `hire_date` | `date` | |
| `salary` | `numeric` | |
| `employment_status` | `text` | active\|vacation\|inactive |
| `facial_photo_url` | `text` | Storage URL for reference photo |
| `updated_at` | `timestamptz` | |

**Note**: Companion to `attendance.employees`. Upserted together via `attendance.upsert_employee_full()`.

---

### `public.biometric_devices` — Registered Devices (Cerebro view)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | |
| `serial_number` | `text` | |
| `name` | `text` | |
| `is_active` | `boolean` | |

---

### `public.tenant_ai_settings` — Per-Tenant AI Configuration

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | `uuid` | PK |
| `is_enabled` | `boolean` | |
| `provider` | `text` | `'gemini'` (only supported) |
| `model` | `text` | e.g. `'gemini-2.5-flash'` |
| `api_key_encrypted` | `text` | AES-GCM encrypted: `ivB64.cipherB64` |
| `base_url` | `text` | Optional custom endpoint |
| `system_prompt` | `text` | Custom HR analysis system prompt |

**Managed by**: `tenant-ai-settings-save` Edge Function (encrypts key with `AI_SETTINGS_ENCRYPTION_KEY`)

---

### `public.v_tenant_ia_status` — View: AI Availability

| Column | Notes |
|---|---|
| `tenant_id` | uuid |
| `business_name` | tenant name |
| `ia_available` | boolean — true if `tenant_ai_settings.is_enabled = true` |

---

## 3. Schema: attendance (HR & Punches)

The `attendance` schema is **isolated from Cerebro** — it holds all HR, scheduling, and time-tracking data for every tenant.

---

### `attendance.memberships` — User ↔ Tenant ↔ Role

| Column | Type | Constraints | Default |
|---|---|---|---|
| `tenant_id` | `uuid` | NOT NULL, PK part | |
| `user_id` | `uuid` | NOT NULL, PK part, FK → `auth.users(id)` ON DELETE CASCADE | |
| `role` | `text` | NOT NULL | `'employee'` (`tenant_admin\|hr_admin\|admin\|employee`) |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Primary Key**: `(tenant_id, user_id)`  
**Indexes**: `user_idx` on `(user_id)`  
**Access**: Not directly accessible. Clients read via `attendance.my_memberships` view.

---

### `attendance.settings` — Per-Tenant Attendance Mode

| Column | Type | Constraints | Default |
|---|---|---|---|
| `tenant_id` | `uuid` | PK | |
| `mode` | `attendance.mode` | NOT NULL | `'biometric'` |
| `timezone` | `text` | NOT NULL | `'America/Guayaquil'` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT → by tenant; INSERT/UPDATE → `can_manage_attendance()`

---

### `attendance.turns` — Work Turns

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | `attendance.current_tenant_id()` |
| `name` | `text` | NOT NULL | |
| `type` | `attendance.turn_type` | NOT NULL | `diurno\|vespertino\|nocturno` |
| `color` | `text` | NOT NULL | |
| `days` | `int[]` | NOT NULL, CHECK valid ISO days 1–7 | |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Unique**: `(tenant_id, id)`, `(tenant_id, name)`  
**Indexes**: `tenant_idx`  
**RLS**: SELECT → by tenant; ALL → manager

---

### `attendance.schedules` — Work Schedules

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | `attendance.current_tenant_id()` |
| `turn_id` | `uuid` | NOT NULL, FK → `turns(tenant_id, id)` ON DELETE RESTRICT | |
| `name` | `text` | NOT NULL | |
| `color` | `text` | NOT NULL | |
| `entry_time` | `time` | NOT NULL | |
| `exit_time` | `time` | NOT NULL | |
| `crosses_midnight` | `boolean` | NOT NULL | `false` |
| `meal_enabled` | `boolean` | NOT NULL | `false` |
| `meal_start` | `time` | NULL | |
| `meal_end` | `time` | NULL | |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Foreign Keys**: `(tenant_id, turn_id)` → `attendance.turns(tenant_id, id)` — prevents cross-tenant FK  
**Check**: `meal_chk` — `meal_start`/`meal_end` required when `meal_enabled = true`  
**Unique**: `(tenant_id, id)`, `(tenant_id, name)`  
**Indexes**: `tenant_idx`  
**RLS**: SELECT → by tenant; ALL → manager

---

### `attendance.employees` — Employee Records

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | `attendance.current_tenant_id()` |
| `user_id` | `uuid` | NULL | |
| `employee_code` | `text` | NOT NULL | |
| `first_name` | `text` | NOT NULL | |
| `last_name` | `text` | NOT NULL | |
| `status` | `attendance.employee_status` | NOT NULL | `'active'` |
| `schedule_id` | `uuid` | NOT NULL, FK → `schedules(tenant_id, id)` | |
| `biometric_employee_code` | `text` | NULL | |
| `first_login_pending` | `boolean` | NOT NULL | `false` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Foreign Keys**: `(tenant_id, schedule_id)` → `attendance.schedules(tenant_id, id)` ON DELETE RESTRICT  
**Unique**: `(tenant_id, id)`, `(tenant_id, employee_code)`  
**Indexes**: `tenant_idx`, `user_idx` on `(user_id)`  
**RLS**: SELECT → by tenant (manager or own `user_id`); ALL → manager

---

### `attendance.employee_profile` — Extended Employee Profile + GPS/PWA

| Column | Type | Constraints | Default |
|---|---|---|---|
| `employee_id` | `uuid` | PK, FK → `attendance.employees(id)` | |
| `tenant_id` | `uuid` | NOT NULL | |
| `employee_code` | `text` | | |
| `status` | `text` | | `active\|inactive\|vacation` |
| `photo_meta` | `jsonb` | | `'{}'` |
| `work_mode` | `text` | | `presencial\|remoto\|mixto` |
| `allow_remote_pwa` | `boolean` | | |
| `geofence_lat` | `double precision` | | |
| `geofence_lng` | `double precision` | | |
| `geofence_radius_m` | `numeric` | | |
| `pwa_self_service_enabled` | `boolean` | NOT NULL | `false` |
| `pwa_self_service_locked` | `boolean` | NOT NULL | `false` |
| `pwa_self_service_requested_at` | `timestamptz` | | |
| `pwa_self_service_completed_at` | `timestamptz` | | |
| `updated_at` | `timestamptz` | | |

**Managed by**: `attendance.upsert_employee_full()` and `attendance.upsert_employee_pwa_self_service_settings()`

---

### `attendance.biometric_devices` — ZKTeco Devices

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | |
| `serial_no` | `text` | NOT NULL | |
| `name` | `text` | NOT NULL | |
| `device_timezone` | `text` | NOT NULL | `'America/Guayaquil'` |
| `is_active` | `boolean` | NOT NULL | `true` |
| `last_seen_at` | `timestamptz` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Unique**: `(tenant_id, id)`, `(tenant_id, serial_no)`  
**Indexes**: `tenant_idx`  
**RLS**: SELECT → by tenant; INSERT/UPDATE → by tenant manager  
**Note**: `last_seen_at` is updated by `adms-gateway` on every successful iClock batch.

---

### `attendance.biometric_raw` — Raw Biometric Audit Log

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | | |
| `device_id` | `uuid` | | |
| `serial_no` | `text` | | |
| `path` | `text` | NOT NULL | |
| `query` | `jsonb` | NOT NULL | `'{}'` |
| `headers` | `jsonb` | NOT NULL | `'{}'` |
| `body` | `text` | | |
| `received_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes**: `received_at_desc`  
**RLS**: SELECT → by tenant  
**Note**: Written by `adms-gateway` before punch parsing. Used for troubleshooting iClock protocol issues.

---

### `attendance.punches` — Unified Punch Log

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | |
| `employee_id` | `uuid` | NULL, FK → `employees(tenant_id, id)` ON DELETE SET NULL | |
| `biometric_employee_code` | `text` | NULL | |
| `punched_at` | `timestamptz` | NOT NULL | |
| `source` | `text` | NOT NULL | `web\|biometric\|import` |
| `type` | `text` | NULL | `in\|out\|clock_in\|clock_out\|break_start\|break_end` |
| `serial_no` | `text` | NULL | |
| `device_id` | `uuid` | NULL | |
| `raw_id` | `uuid` | NULL | |
| `meta` | `jsonb` | | `'{}'` |
| `evidence` | `jsonb` | | `'{}'` |
| `verification` | `jsonb` | | `'{}'` |
| `created_at` | `timestamptz` | | `now()` |

**Unique**: `(tenant_id, id)`  
**Indexes**: `tenant_time_idx` on `(tenant_id, punched_at DESC)`, `device_code_idx` on `(tenant_id, biometric_employee_code)`  
**RLS**: SELECT → own employee within tenant; INSERT → via `register_web_punch` RPC; UPDATE/DELETE → service_role only  
**Sources**:
- `biometric` → inserted by `adms-gateway` or `biometric-gatekeeper` Edge Function
- `web` → inserted via `attendance.register_web_punch()` RPC
- `import` → batch USB import

---

### `attendance.punch_evidence` — Facial/GPS Evidence

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `punch_id` | `uuid` | NOT NULL, FK → `punches(id)` ON DELETE CASCADE | |
| `tenant_id` | `uuid` | NOT NULL | |
| `employee_id` | `uuid` | NOT NULL | |
| `selfie_bucket` | `text` | | |
| `selfie_path` | `text` | | |
| `selfie_uploaded_at` | `timestamptz` | | |
| `latitude` | `numeric(10,7)` | | |
| `longitude` | `numeric(10,7)` | | |
| `gps_accuracy_m` | `integer` | | |
| `distance_to_fence_m` | `integer` | | |
| `geofence_ok` | `boolean` | | |
| `device_info` | `jsonb` | | |
| `verification_status` | `text` | NOT NULL | `'pending'` (`pending\|ok\|failed\|skipped`) |
| `verification_at` | `timestamptz` | | |
| `verification_detail` | `jsonb` | | |
| `created_at` | `timestamptz` | | `now()` |

**Indexes**: `punch_id_idx`, `tenant_employee_idx`, `status_idx WHERE pending`, `created_at_idx DESC`  
**RLS**: SELECT/INSERT → own employee within tenant  
**Lifecycle**: `pending` → set by PWA on punch; `ok/failed/skipped` → set by `app_face_v2.py` worker

---

### `attendance.punch_attempts` — Punch Attempt Audit

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | `uuid` | |
| `employee_id` | `uuid` | |
| `attempted_at` | `timestamptz` | |
| `action` | `text` | `clock_in\|clock_out\|break_start\|break_end` |
| `ok` | `boolean` | |
| `step` | `text` | |
| `reason` | `text` | SQLERRM on failure |
| `meta` | `jsonb` | `{punch_id}` on success, `{evidence, verification}` on failure |

**RLS**: SELECT/INSERT → own employee within tenant  
**Note**: Written best-effort inside `register_web_punch` — failure to log never blocks the punch.

---

### `attendance.permission_requests` — Employee Time-Off/Permission Requests

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | |
| `employee_id` | `uuid` | NOT NULL | |
| `request_scope` | `text` | NOT NULL, CHECK | `day\|hour` |
| `date_from` | `date` | NULL | |
| `date_to` | `date` | NULL | |
| `request_date` | `date` | NULL | |
| `time_from` | `time` | NULL | |
| `time_to` | `time` | NULL | |
| `reason` | `text` | NOT NULL | |
| `observations` | `text` | | |
| `status` | `text` | NOT NULL, CHECK | `pending\|approved\|rejected`, default `'pending'` |
| `decision_note` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**Check**: `permission_day_shape_chk` — day scope requires `date_from/date_to`; hour scope requires `request_date/time_from/time_to`  
**Trigger**: `trg_permission_requests_updated_at` → `public.touch_updated_at()`  
**Indexes**: `(tenant_id, employee_id, created_at DESC)`  
**RLS**: SELECT/INSERT → own employee; UPDATE → own employee while `status = 'pending'`

---

### `attendance.justifications` — Absence/Tardiness Justifications

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | |
| `employee_id` | `uuid` | NOT NULL | |
| `justification_type` | `text` | NOT NULL, CHECK | `late\|absence` |
| `affected_date` | `date` | NOT NULL | |
| `reason` | `text` | NOT NULL | |
| `observations` | `text` | | |
| `evidence_path` | `text` | | Storage path for uploaded document |
| `status` | `text` | NOT NULL, CHECK | `pending\|approved\|rejected`, default `'pending'` |
| `decision_note` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**Trigger**: `trg_justifications_updated_at` → `public.touch_updated_at()`  
**Indexes**: `(tenant_id, employee_id, created_at DESC)`  
**RLS**: SELECT/INSERT → own employee; UPDATE → own employee while `status = 'pending'`

---

### `attendance.holidays` — National/Company Holidays

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL | |
| `holiday_date` | `date` | NOT NULL | |
| `name` | `text` | NOT NULL | |
| `is_mandatory` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Unique**: `(tenant_id, holiday_date)`  
**RLS**: SELECT/ALL → user whose `public.profiles.tenant_id` matches

---

### `attendance.kpi_settings` — Per-Tenant KPI Dashboard Config

| Column | Type | Constraints | Default |
|---|---|---|---|
| `tenant_id` | `uuid` | PK | |
| `ranking_limit` | `int` | NOT NULL | `10` |
| `chart_type` | `text` | NOT NULL | `'bar'` |
| `dashboard_widgets` | `jsonb` | NOT NULL | `['turn','department','ranking']` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**RLS**: SELECT/ALL → by tenant profile

---

## 4. Views

### `attendance.my_memberships` (security_barrier)

```sql
SELECT tenant_id, role
FROM attendance.memberships
WHERE user_id = auth.uid();
```
Used by `attendance.current_tenant_id()` and `attendance.current_user_role()` as a secure indirection layer. Memberships table itself is revoked from direct access.

---

### `public.attendance_v_punch_report`

Joins `attendance_punches` (legacy public schema) + `employees` + `attendance_schedules` + `attendance_turns` + `attendance_biometric_devices`. Adds:
- `punched_at_local` — punch time converted to tenant's timezone
- `outside_schedule` — boolean: punch falls outside the employee's assigned schedule window (handles `crosses_midnight`)

---

## 5. Enums

| Enum | Schema | Values |
|---|---|---|
| `attendance.turn_type` | `attendance` | `diurno`, `vespertino`, `nocturno` |
| `attendance.employee_status` | `attendance` | `active`, `inactive` |
| `attendance.mode` | `attendance` | `biometric`, `web` |
| `attendance_punch_source` | `public` | `web`, `biometric`, `import` |

---

## 6. PostgreSQL Functions & Triggers

### `public` Schema Functions

| Function | Returns | Description |
|---|---|---|
| `current_tenant_id()` | `uuid` | JWT `tenant_id` claim → `public.profiles` → `attendance.memberships` |
| `current_email()` | `text` | JWT `email` claim |
| `has_role(text)` | `boolean` | Email exists in `user_roles` with given role |
| `is_internal()` | `boolean` | Any row in `user_roles` for current email |
| `is_admin()` | `boolean` | Role = `admin` |
| `is_assistant()` | `boolean` | Role = `assistant` |
| `is_maintenance()` | `boolean` | Role = `maintenance` |
| `get_first_login_pending(uuid)` | `boolean` | Checks `profiles.first_login_pending` OR `employees.first_login_pending` |
| `clear_first_login_flags(uuid)` | `void` | Clears both flags for a user |
| `seed_attendance_defaults(uuid)` | `void` | Inserts default turns + schedules for a new tenant |
| `touch_updated_at()` | `trigger` | Sets `updated_at = now()` on UPDATE |

### `attendance` Schema Functions

| Function | Returns | Description |
|---|---|---|
| `current_tenant_id()` | `uuid` | JWT `tenant_id` → `my_memberships` |
| `current_user_role()` | `text` | JWT `app_role` → `my_memberships` |
| `current_employee_id()` | `uuid` | `employees.id` where `user_id = auth.uid()` |
| `can_manage_attendance()` | `boolean` | Role in `tenant_admin\|hr_admin\|admin` |
| `assert_tenant_access(uuid)` | `void` | Raises if caller's `profiles.tenant_id` ≠ `p_tenant_id` |
| `seed_defaults(uuid)` | `void` | Inserts turns + schedules + settings for tenant |
| `register_web_punch(text, timestamptz, jsonb, jsonb, text [, text, int])` | `uuid` | Transactional web punch: validates employee + tenant active + punch sequence; inserts punch + attempt log |
| `resolve_marking_type_label(text, text, text)` | `text` | Human label from `source/verify_type/auth_method` |
| `upsert_employee_full(...)` | `uuid` | Full employee upsert across `public.employees` + `attendance.employee_profile` |
| `upsert_employee_pwa_self_service_settings(...)` | `table` | Sets GPS/PWA config for an employee |
| `get_employee_pwa_self_service_settings(uuid, uuid)` | `table` | Reads PWA/GPS settings |
| `resolve_my_employee_context()` | `table` | Returns `(tenant_id, employee_id, email)` for current user |
| `get_my_pwa_self_service_profile()` | `table` | Full employee profile for PWA self-service |
| `save_my_pwa_self_service_profile(...)` | `table` | Saves personal data + GPS coordinates; locks after save |
| `attendance_tenant_timezone()` | `text` | Timezone string for current tenant |

### Triggers

| Trigger | Table | Function | Event |
|---|---|---|---|
| `trg_permission_requests_updated_at` | `attendance.permission_requests` | `public.touch_updated_at()` | BEFORE UPDATE |
| `trg_justifications_updated_at` | `attendance.justifications` | `public.touch_updated_at()` | BEFORE UPDATE |

---

## 7. Row Level Security (RLS) Summary

### `public` Schema

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `app_settings` | internal | admin | admin | — |
| `smtp_settings` | internal | admin | admin | — |
| `billing_settings` | internal | admin | admin | — |
| `kpi_targets` | internal | admin | admin | — |
| `security_settings` | internal | admin | admin | — |
| `user_roles` | admin or own email | admin | admin | admin |
| `role_permissions` | internal | admin | admin | — |
| `plans` | internal | admin | admin | — |
| `tenants` | admin, assistant | admin, assistant | admin, assistant | — |
| `invoices` | admin, assistant | admin, assistant | admin, assistant | — |
| `messages` | internal + role match | admin, assistant | — | — |
| `message_reads` | own `user_id` | own `user_id` | own `user_id` | own `user_id` |
| `audit_logs` | admin, maintenance | internal | — | — |

> **internal** = any email in `public.user_roles`  
> Service Role key bypasses all RLS

### `attendance` Schema

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `memberships` | ❌ revoked (use view) | service_role only | service_role only | service_role only |
| `settings` | own tenant | manager | manager | — |
| `turns` | own tenant | manager | manager | manager |
| `schedules` | own tenant | manager | manager | manager |
| `employees` | manager or own user_id | manager | manager | manager |
| `employee_profile` | manager | manager | manager | — |
| `biometric_devices` | own tenant | manager | manager | — |
| `biometric_raw` | own tenant | service_role | — | — |
| `punches` | own employee + tenant | via RPC only | service_role | — |
| `punch_evidence` | own employee + tenant | own employee | service_role | — |
| `punch_attempts` | own employee + tenant | own employee | — | — |
| `permission_requests` | own employee | own employee | own (pending only) | — |
| `justifications` | own employee | own employee | own (pending only) | — |
| `holidays` | tenant profile | manager | manager | manager |
| `kpi_settings` | tenant profile | manager | manager | — |

> **manager** = `can_manage_attendance()` → role in (`tenant_admin`, `hr_admin`, `admin`)

---

## 8. Edge Functions

All functions run on **Supabase Edge Runtime (Deno)**. CORS is configured for `*` with `Authorization, x-client-info, apikey, content-type`.

### `admin-create-tenant`
**Caller**: `cerebro-front` (admin only)  
**Auth**: Bearer JWT → verified as Cerebro admin  
**Actions**:
1. Validates RUC (13 digits), name, contact_email
2. Creates row in `public.tenants`
3. Optionally creates row in `public.biometric_devices`
4. Optionally creates `auth.users` entry + `public.profiles` row for tenant admin
5. Generates magic link for tenant admin
6. Writes to `public.audit_logs` (action: `CREATE_TENANT`)

---

### `admin-create-user`
**Caller**: `cerebro-front`  
**Auth**: Bearer JWT (no role check — uses `getAdminClient`)  
**Actions**:
1. Creates `auth.users` with `email_confirm: true`
2. Upserts row in `public.user_roles` (roles: `admin|assistant|maintenance`)

---

### `admin-invite-staff`
**Caller**: `cerebro-front` (admin only)  
**Auth**: Bearer JWT → verified as `cerebro.user_roles` admin with `is_active = true`  
**Actions**:
1. Creates `auth.users` with `email_confirm: true`
2. Inserts into `cerebro.user_roles` (user_id, email, full_name, role, is_active)
3. On failure: rollback (delete created auth user)
4. Logs to `cerebro.audit_logs`

---

### `attendance-ai-analyze`
**Caller**: `base-front`, `pwa` (tenant users)  
**Auth**: Bearer JWT → user resolved → tenant resolved  
**Flow**:
1. Verifies `v_tenant_ia_status.ia_available = true`
2. Reads `tenant_ai_settings` (provider must = `gemini`)
3. Decrypts `api_key_encrypted` using AES-GCM + `AI_SETTINGS_ENCRYPTION_KEY` env var
4. Fetches `attendance.punches` for date range + optional employee/department filter
5. Derives novelties: duplicate punches (≤3 min), odd IN/OUT count, missing geo, missing device serial
6. Computes stats: punch count, sources, types, inconsistency count
7. Builds managerial HR prompt (embedded in function)
8. Calls Google Gemini API (`generateContent`)
9. Returns structured JSON: `{summary, findings, critical_employees, recommendations, totals}`

**Input**: `{tenant_id?, analysis_type, date_from, date_to, employee_id?, department_id?, include_evidence?, max_rows?}`  
**Analysis types**: `attendance_summary | novelties_summary | attendance_and_novelties | employee_risk | daily_exceptions`

---

### `biometric-gatekeeper`
**Caller**: ZKTeco devices or `adms-gateway` fallback  
**Auth**: None (device-side; verifies serial_no against `attendance.biometric_devices`)  
**Flow**:
1. Validates `serial_number` against `attendance.biometric_devices` → resolves `tenant_id`
2. Resolves employee via `pin/biometric_employee_code` → `attendance.employees`
3. Inserts into `attendance.punches` (source: `biometric`)
4. Returns `{ok: true, punch}`

---

### `broadcast-email`
**Caller**: `cerebro-front`  
**Auth**: Service role (admin client)  
**Actions**:
1. Collects recipients from `public.tenants.contact_email` and/or `public.user_roles.email`
2. Loads SMTP config from `public.smtp_settings` + Vault password
3. Sends emails in chunks of 40 via SMTP (`SmtpClient` from `deno.land/x/smtp`)

---

### `face-verify`
**Caller**: `base-front`, `pwa`  
**Purpose**: Entry point for face verification. Delegates to `app_face_v2.py` or processes inline.

---

### `smtp-settings`
**Caller**: `cerebro-front`  
**Actions**:
1. Upserts `public.smtp_settings` (metadata only, no password)
2. If `password` provided: stores in `vault.secrets` (tries `secret`/`value` column variants)
3. Sets `has_secret = true` when secret saved

---

### `smtp-test`
**Caller**: `cerebro-front`  
**Actions**: Sends a test email to `to_email` using SMTP config from `smtp_settings` + Vault.

---

### `tenant-ai-settings-save`
**Caller**: `base-front`, `pwa` (tenant admin)  
**Auth**: Bearer JWT  
**Actions**:
1. Receives plain-text API key
2. Encrypts with AES-GCM: generates random 12-byte IV, encrypts with `AI_SETTINGS_ENCRYPTION_KEY` (32-byte base64 env var)
3. Stores `ivB64.cipherB64` in `tenant_ai_settings.api_key_encrypted`
4. Saves provider, model, base_url, system_prompt

---

### `base-create-employee-user` (in `supabase/supabase/functions/`)
**Caller**: `base-front` (tenant admin or global admin)  
**Auth**: Bearer JWT → verified as global admin (`profiles.role = 'admin'`) or tenant admin (`attendance.memberships.role = 'tenant_admin'`)  
**Actions**:
1. Creates or updates `auth.users` entry
2. Upserts `public.profiles` (tenant_id, role, first_login_pending=true)
3. Upserts `attendance.memberships` (tenant_id, user_id, role)
4. Calls `attendance.link_employee_auth_user` RPC to link `employees.user_id`
5. Returns `{user_id, email, temporary_password}`

---

## 9. Storage Buckets

| Bucket | Public | Path Convention | RLS Policy |
|---|---|---|---|
| `employee_photos` | varies | `{tenant_id}/{employee_id}/photo.jpg` | Read by face service (service_role) |
| `punch-selfies` | `false` | `{tenant_id}/{timestamp}_{employee_id}.jpg` | SELECT/INSERT → authenticated, path starts with own `tenant_id` |
| `request-evidence` | `false` | `{tenant_id}/{...}` | SELECT/INSERT → authenticated, path starts with own `tenant_id` |

**Policy pattern**: `(storage.foldername(name))[1] = public.current_tenant_id()::text`

---

## 10. Mermaid ERD Diagram

```mermaid
erDiagram

  %% ─────────────────────────────────────────────
  %% CEREBRO (public schema)
  %% ─────────────────────────────────────────────

  plans {
    text code PK
    text name
    text billing_model
    text price_model
    numeric price
    numeric unit_price
    timestamptz created_at
  }

  tenants {
    uuid id PK
    text name
    text ruc
    text contact_email
    text plan FK
    text status
    text billing_period
    int grace_days
    boolean is_suspended
    timestamptz created_at
  }

  invoices {
    uuid id PK
    uuid tenant_id FK
    text number
    date period_start
    date period_end
    numeric total
    text status
    timestamptz paid_at
    timestamptz created_at
  }

  profiles {
    uuid id PK
    uuid tenant_id FK
    text role
    uuid employee_id
    boolean is_active
    boolean first_login_pending
    timestamptz created_at
  }

  user_roles {
    uuid id PK
    text email
    text role
    timestamptz created_at
  }

  role_permissions {
    text role PK
    jsonb permissions
    timestamptz created_at
  }

  messages {
    uuid id PK
    text title
    text body
    text priority
    text[] target_roles
    timestamptz created_at
  }

  message_reads {
    uuid user_id PK
    uuid message_id PK_FK
    timestamptz read_at
  }

  audit_logs {
    uuid id PK
    text user_email
    text action
    text details
    timestamptz created_at
  }

  app_settings {
    int id PK
    text company_name
    text company_ruc
    text primary_color
    text login_message_title
    text paused_message_title
    timestamptz created_at
  }

  smtp_settings {
    int id PK
    text host
    int port
    text from_email
    boolean secure
    text secret_name
    boolean has_secret
  }

  billing_settings {
    int id PK
    text currency
    numeric tax_percent
  }

  kpi_targets {
    int id PK
    numeric expected_revenue_monthly
    int expected_new_clients_monthly
  }

  security_settings {
    int id PK
    text password_level
    int min_length
    boolean rotation_enabled
  }

  tenant_ai_settings {
    uuid tenant_id PK_FK
    boolean is_enabled
    text provider
    text model
    text api_key_encrypted
    text system_prompt
  }

  public_employees {
    uuid id PK
    uuid tenant_id FK
    text first_name
    text last_name
    text email
    text phone
    text address
    text employment_status
    text facial_photo_url
    timestamptz updated_at
  }

  biometric_devices_pub {
    uuid id PK
    uuid tenant_id FK
    text serial_number
    text name
    boolean is_active
  }

  %% ─────────────────────────────────────────────
  %% ATTENDANCE schema
  %% ─────────────────────────────────────────────

  memberships {
    uuid tenant_id PK
    uuid user_id PK
    text role
    timestamptz created_at
  }

  att_settings {
    uuid tenant_id PK_FK
    text mode
    text timezone
    timestamptz created_at
  }

  turns {
    uuid id PK
    uuid tenant_id FK
    text name
    text type
    text color
    int[] days
    boolean is_active
    timestamptz created_at
  }

  schedules {
    uuid id PK
    uuid tenant_id FK
    uuid turn_id FK
    text name
    time entry_time
    time exit_time
    boolean crosses_midnight
    boolean meal_enabled
    time meal_start
    time meal_end
    boolean is_active
    timestamptz created_at
  }

  att_employees {
    uuid id PK
    uuid tenant_id FK
    uuid user_id
    text employee_code
    text first_name
    text last_name
    text status
    uuid schedule_id FK
    text biometric_employee_code
    boolean first_login_pending
    timestamptz created_at
  }

  employee_profile {
    uuid employee_id PK_FK
    uuid tenant_id FK
    text employee_code
    text status
    text work_mode
    boolean allow_remote_pwa
    float geofence_lat
    float geofence_lng
    numeric geofence_radius_m
    boolean pwa_self_service_enabled
    boolean pwa_self_service_locked
    timestamptz updated_at
  }

  biometric_devices {
    uuid id PK
    uuid tenant_id FK
    text serial_no
    text name
    text device_timezone
    boolean is_active
    timestamptz last_seen_at
    timestamptz created_at
  }

  biometric_raw {
    uuid id PK
    uuid tenant_id
    uuid device_id
    text serial_no
    text path
    jsonb query
    jsonb headers
    text body
    timestamptz received_at
  }

  punches {
    uuid id PK
    uuid tenant_id FK
    uuid employee_id FK
    text biometric_employee_code
    timestamptz punched_at
    text source
    text type
    text serial_no
    uuid device_id
    uuid raw_id
    jsonb meta
    jsonb evidence
    jsonb verification
    timestamptz created_at
  }

  punch_evidence {
    uuid id PK
    uuid punch_id FK
    uuid tenant_id FK
    uuid employee_id FK
    text selfie_bucket
    text selfie_path
    numeric latitude
    numeric longitude
    int gps_accuracy_m
    boolean geofence_ok
    text verification_status
    timestamptz verification_at
    jsonb verification_detail
    timestamptz created_at
  }

  punch_attempts {
    uuid tenant_id FK
    uuid employee_id FK
    timestamptz attempted_at
    text action
    boolean ok
    text reason
    jsonb meta
  }

  permission_requests {
    uuid id PK
    uuid tenant_id FK
    uuid employee_id FK
    text request_scope
    date date_from
    date date_to
    text reason
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  justifications {
    uuid id PK
    uuid tenant_id FK
    uuid employee_id FK
    text justification_type
    date affected_date
    text reason
    text evidence_path
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  holidays {
    uuid id PK
    uuid tenant_id FK
    date holiday_date
    text name
    boolean is_mandatory
    timestamptz created_at
  }

  kpi_settings {
    uuid tenant_id PK_FK
    int ranking_limit
    text chart_type
    jsonb dashboard_widgets
    timestamptz updated_at
  }

  %% ─────────────────────────────────────────────
  %% RELATIONSHIPS
  %% ─────────────────────────────────────────────

  %% Cerebro
  plans           ||--o{ tenants              : "plan code"
  tenants         ||--o{ invoices             : "tenant_id"
  tenants         ||--o{ profiles             : "tenant_id"
  tenants         ||--o{ tenant_ai_settings   : "tenant_id"
  tenants         ||--o{ public_employees     : "tenant_id"
  tenants         ||--o{ biometric_devices_pub: "tenant_id"
  messages        ||--o{ message_reads        : "message_id"
  user_roles      ||--|| role_permissions     : "role"

  %% Attendance core hierarchy
  tenants         ||--o{ memberships          : "tenant_id"
  tenants         ||--|| att_settings         : "tenant_id"
  tenants         ||--o{ turns                : "tenant_id"
  tenants         ||--o{ holidays             : "tenant_id"
  tenants         ||--|| kpi_settings         : "tenant_id"
  turns           ||--o{ schedules            : "turn_id (tenant-scoped)"
  schedules       ||--o{ att_employees        : "schedule_id (tenant-scoped)"
  att_employees   ||--|| employee_profile     : "employee_id"

  %% Biometric
  tenants         ||--o{ biometric_devices    : "tenant_id"
  biometric_devices ||--o{ biometric_raw      : "device_id"
  biometric_raw   ||--o{ punches              : "raw_id"

  %% Punches & Evidence
  att_employees   ||--o{ punches              : "employee_id (tenant-scoped)"
  att_employees   ||--o{ punch_evidence       : "employee_id"
  att_employees   ||--o{ punch_attempts       : "employee_id"
  att_employees   ||--o{ permission_requests  : "employee_id"
  att_employees   ||--o{ justifications       : "employee_id"
  punches         ||--o{ punch_evidence       : "punch_id (CASCADE)"

  %% Cross-schema links
  profiles        ||--o{ att_employees        : "employee_id (soft)"
  public_employees ||--|| att_employees       : "id (same UUID)"
```

---

## Appendix: Migration Execution Order

```
supabase/sql/00_extensions.sql
supabase/sql/01_tables.sql                    ← Cerebro: all public tables
supabase/sql/02_rls.sql                       ← Cerebro: RLS + helper functions
supabase/sql/03_grants.sql                    ← Cerebro: GRANT statements
supabase/sql/04_repair_existing.sql           ← Patch: add missing columns, fix constraints

supabase/sql/001_attendance_core.sql          ← Attendance: public schema legacy tables
supabase/sql/002_attendance_rls.sql           ← Attendance: legacy RLS
supabase/sql/003_seed_attendance_defaults.sql ← Attendance: seed function
supabase/sql/004_biometric_core.sql           ← Biometric: devices + raw + punches (public)
supabase/sql/005_biometric_rls.sql            ← Biometric: RLS

supabase/sql_attendance_isolated/001_attendance_schema.sql ← attendance schema + enums
supabase/sql_attendance_isolated/002_attendance_core.sql   ← Core tables (isolated)
supabase/sql_attendance_isolated/003_attendance_rls.sql    ← RLS (isolated)
supabase/sql_attendance_isolated/004_attendance_seed_defaults.sql
supabase/sql_attendance_isolated/005_dev_membership_and_seed.sql ← DEV ONLY

pwa/sql/001_current_tenant_and_first_login.sql ← current_tenant_id() + first_login helpers
pwa/sql/002_requests_tables_and_rls.sql        ← permission_requests + justifications
pwa/sql/003_register_web_punch_rpc.sql         ← register_web_punch() v1
pwa/sql/004_storage_buckets_and_policies.sql   ← punch-selfies + request-evidence buckets
pwa/sql/sql_migration_punch_evidence.sql       ← punch_evidence table + RLS
pwa/sql/2026-04-07_pwa_self_service_gps.sql   ← employee_profile + GPS self-service functions
pwa/sql/2026-04-08_punches_rls_y_rpc_v2.sql  ← punches RLS + register_web_punch() v2

base-front/sql/2026-03-05_base_mejoras.sql     ← holidays, kpi_settings, assert_tenant_access
base-front/sql/2026-03-20_reporte_asistencia_operativo.sql ← resolve_marking_type_label
```
