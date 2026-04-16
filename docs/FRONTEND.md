# FRONTEND.md

> **Nota:** Ver [TECH_DEBT.md](TECH_DEBT.md) DOC-1 para advertencia importante sobre la PWA.

Three frontends serve different audiences in this platform:

| | `cerebro-front` | `base-front` | `pwa` |
|---|---|---|---|
| **Audience** | HRCloud SaaS operators (internal staff) | Tenant HR/attendance managers | Employee (mobile) |
| **Purpose** | Multi-tenant lifecycle, billing, settings | Employee management, attendance, reports | Clock in/out with GPS and selfie |
| **Design** | Dark neon / glassmorphism | Dark glassmorphism | Dark glassmorphism (mobile-first) |
| **Schema** | `public` | `attendance` (isolated) | `attendance` (isolated) |
| **Navigation** | react-router-dom | react-router-dom | Tab state (useState) — no router |

> **PWA importante:** `pwa/src/App.tsx` usa navegación por `useState<Tab>` con 4 tabs (clock/history/requests/profile), NO react-router. La carpeta `pwa/src/pages/` contiene páginas con estructura de router copiadas de base-front pero **no están montadas** en el App.tsx activo. Ver sección 3 de este documento.

---

## 1. cerebro-front

### 1.1 Tech Stack

| Package | Version | Purpose |
|---|---|---|
| React | ^18.3.1 | UI framework |
| Vite | ^4.5.14 | Build tool and dev server |
| react-router-dom | ^6.20.0 | Client-side routing |
| @supabase/supabase-js | ^2.94.1 | Supabase client (anon key) |
| react-hook-form | ^7.47.0 | Form state management |
| @hookform/resolvers | ^3.10.0 | Zod integration for RHF |
| zod | ^3.25.76 | Schema validation |
| recharts | ^2.10.0 | Charts (donut, progress bars) |
| react-hot-toast | ^2.6.0 | Toast notifications |
| date-fns | ^2.30.0 | Date formatting |
| lucide-react | ^0.309.0 | Icon library |
| clsx | ^2.0.0 | Conditional className util |
| zxcvbn | ^4.4.2 | Password strength estimation |
| TypeScript | ^5.6.3 | Type system |
| Tailwind CSS | ^3.4.19 | Utility-first CSS |
| Vitest | ^1.6.1 | Unit testing |
| @testing-library/react | ^16.1.0 | Component testing |

**No state management library** — local React state (`useState`, `useReducer`) plus custom hooks.

---

### 1.2 Authentication

**Method:** Supabase Auth (`signInWithPassword`) with anon key.

**Flow:**
1. `AuthProvider` (in `App.tsx`) calls `supabase.auth.getSession()` on mount.
2. Subscribes to `supabase.auth.onAuthStateChange` for live session events.
3. On each session, calls `getUserRole()` → queries `public.user_roles` by email (case-insensitive `ilike`).
4. If no role found → force sign-out (secure policy: unknown users cannot proceed).
5. Calls `getRolePermissions(role)` → queries `public.role_permissions.permissions` (JSONB).
6. Stores `{ session, user, userRole, permissions }` in `AuthContext`.

**Role system:**
- Three roles: `admin`, `assistant`, `maintenance`
- `admin` → all permissions bypassed (`can()` returns `true` unconditionally)
- Other roles → fine-grained `permissions: Record<string, boolean>` from `role_permissions` table
- `can(permission: string)` evaluated on every route guard and nav item

**Session persistence:** `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`.

**`ProtectedRoute`** wraps every authenticated route. Takes optional `requiredPermission` prop — if user lacks it, redirects to `/dashboard`.

**Branding load on login:** `getAppSettings()` → `public.app_settings` is called before auth resolves, so the login page renders the tenant's logo and colors even before the user logs in.

---

### 1.3 Routes

| Path | Component | Required Permission | Purpose |
|---|---|---|---|
| `/login` | `LoginPage` | Public | Email + password login with branding |
| `/` | Redirect | Any auth | → `/dashboard` |
| `/dashboard` | `DashboardPage` | Any auth | Revenue KPIs, new tenants, plan distribution donut |
| `/tenants` | `TenantsPage` | `clients.view` | Paginated tenant list with search/filter |
| `/tenants/create` | `TenantCreatePage` | `clients.view` | Multi-step tenant onboarding form |
| `/tenants/:id` | `TenantDetailPage` | `clients.view` | Full tenant profile, contacts, invoices |
| `/tenant-lifecycle` | `TenantLifecyclePage` | `clients.view` | Tenant lifecycle state machine |
| `/invoices` | `InvoicesPage` | `clients.view` | Invoice list with status tracking |
| `/settings` | `SettingsPage` | `settings.view` | All platform settings (11 sections, see below) |
| `/audit` | `AuditPage` | `audit.view` | Audit log viewer (toggled by `VITE_ENABLE_AUDIT_LOGS`) |
| `/biometric-tests` | `BiometricTestsPage` | `settings.view` | Biometric face verification testing tool |
| `/storage-monitor` | `StorageMonitorPage` | `settings.view` | Supabase Storage usage by bucket |
| `/profile` | `ProfilePage` | Any auth | Operator profile and password change |
| `*` | `NotFoundPage` | Any auth | 404 handler |

**Settings page sections** (tab-based, navigated via `?tab=` query param):

| Tab Key | Label | Tables / Edge Functions used |
|---|---|---|
| `brand` | Brand | `public.app_settings` + Storage |
| `appearance` | Apariencia | `AppearanceSettingsPanel` |
| `catalog` | Productos / Tarifas | `ProductCatalogSettingsPanel` |
| `users` | Usuarios | Edge Function `admin-create-user` + `public.user_roles` |
| `roles` | Roles / Permisos | `public.role_permissions` |
| `smtp` | Correo SMTP | Edge Function `smtp-settings` + `public.smtp_settings` |
| `billing` | Facturación | `public.billing_settings` |
| `kpi` | KPI Targets | `public.kpi_targets` |
| `security` | Seguridad | `public.security_settings` |
| `plans` | Planes | `public.plans` |
| `messages` | Mensajes | `public.messages` |

---

### 1.4 Components Inventory

#### Layout

| Component | Path | Purpose |
|---|---|---|
| `Layout` | `components/layout/Layout.tsx` | App shell with fixed sidebar (desktop), drawer (mobile), messages popover, compose modal |
| `AppShell` | `components/layout/AppShell.tsx` | Inner page wrapper with padding/animation |

Navigation items in `Layout.tsx` (permission-gated):
- Dashboard, Clientes, Ciclo tenant, Facturación, Test biométrico, Capacidad, Auditoría, Config

Messaging system embedded in the layout:
- `MessagesPopover` — pulls `public.messages` filtered by role, tracks reads in `public.message_reads`
- `ComposeMessageModal` — admins/assistants can broadcast in-app + email via Edge Function `broadcast-email`

#### Auth

| Component | Purpose |
|---|---|
| `ProtectedRoute` | Guards routes, checks `isAuthenticated` + optional `requiredPermission` |
| `AuthProvider` (in `App.tsx`) | Session, role, and permissions state for the entire app |

#### Shared UI

| Component | Path |
|---|---|
| `Modal` | `components/shared/Modal.tsx` |
| `Table` | `components/shared/Table.tsx` |
| `Toast` | `components/shared/Toast.tsx` |
| `StatusComponents` | `components/shared/StatusComponents.tsx` |

#### Settings Components

| Component | Purpose |
|---|---|
| `SmtpSettingsCard` | SMTP config form, calls `smtp-settings` edge function |
| `AppearanceSettingsPanel` | Theme colors and layout customization |
| `ProductCatalogSettingsPanel` | Plan/product catalog management |

---

### 1.5 State Management

**Approach:** Local component state + custom hooks. No global state library.

| Hook | File | Purpose |
|---|---|---|
| `useTenants` | `hooks/useTenants.ts` | Full CRUD for `public.tenants` with pagination/filter |
| `useInvoices` | `hooks/useInvoices.ts` | Invoice list and status management |
| `useKPIs` | `hooks/useKPIs.ts` | KPI target read/write |
| `useSettings` | `hooks/useSettings.ts` | Generic settings singleton CRUD |
| `useToast` | `hooks/useToast.tsx` | Wrapper around react-hot-toast |
| `useAuth` | exported from `App.tsx` | Access to `AuthContext` value |

`singleton.ts` (`services/singleton.ts`) — generic helpers `getSingletonRow()` / `upsertSingletonRow()` used for tables with a single row (app_settings, smtp_settings, kpi_targets, billing_settings, security_settings).

---

### 1.6 Supabase Tables Queried

All queries use the anon key + JWT session. RLS enforces access.

| Table | Schema | Operations | Used by |
|---|---|---|---|
| `app_settings` | public | SELECT, UPSERT | Login branding, SettingsPage Brand tab |
| `user_roles` | public | SELECT, INSERT, DELETE | Settings Users tab, auth role resolution |
| `role_permissions` | public | SELECT, UPSERT | Settings Roles tab, AuthProvider permissions |
| `tenants` | public | SELECT, INSERT, UPDATE | TenantsPage, TenantDetailPage, useTenants |
| `invoices` | public | SELECT | InvoicesPage, DashboardPage |
| `plans` | public | SELECT | TenantsPage, TenantCreatePage, Settings |
| `kpi_targets` | public | SELECT, UPSERT | DashboardPage, Settings KPI tab |
| `smtp_settings` | public | SELECT | Settings SMTP tab (save goes through edge fn) |
| `billing_settings` | public | SELECT, UPSERT | Settings Billing tab |
| `security_settings` | public | SELECT, UPSERT | Settings Security tab |
| `audit_logs` | public | SELECT, INSERT | AuditPage, every mutation event |
| `messages` | public | SELECT, INSERT | MessagesPopover, ComposeMessageModal |
| `message_reads` | public | SELECT, UPSERT | MessagesPopover read tracking |
| `profiles` | public | SELECT | Profile lookup |

**Edge Functions called from cerebro-front:**

| Function | Called from | Purpose |
|---|---|---|
| `admin-create-user` | Settings Users tab | Create Supabase Auth user + role |
| `admin-create-tenant` | TenantCreatePage | Full tenant provisioning |
| `smtp-settings` | Settings SMTP tab | Save SMTP config to Vault |
| `smtp-test` | Settings SMTP tab | Test email send |
| `broadcast-email` | ComposeMessageModal | Email blast to tenants/users |

---

### 1.7 User Flows

#### Login (cerebro-front)

```
User opens /login
  → getAppSettings() → loads branding from public.app_settings
  → User submits email + password
  → supabase.auth.signInWithPassword()
    ✗ Error → toast "Credenciales inválidas"
    ✓ Session created
      → getUserRole(email) → SELECT from public.user_roles
        ✗ No role → force signOut → redirect to /login
        ✓ role resolved
          → getRolePermissions(role) → SELECT from public.role_permissions
          → AuthContext populated with {session, user, userRole, permissions}
          → Navigate to /dashboard
```

#### Dashboard (cerebro-front)

```
On mount:
  → SELECT from public.kpi_targets WHERE id=1          (monthly targets)
  → SELECT COUNT from public.tenants WHERE status='active'
  → SELECT COUNT from public.tenants (new this month)
  → SELECT total,status from public.invoices (this month + last month)
  → Compute: revenue KPI, progress %, change %, plan distribution donut
  → Render: 2 KPI cards + 1 donut chart + quick actions
```

#### Tenant Management (cerebro-front)

```
TenantsPage:
  → SELECT * from public.tenants JOIN plans (paginated, 10/page)
  → Filter: search (business_name/ruc/email), status, plan
  → Click tenant row → navigate to /tenants/:id

TenantDetailPage:
  → SELECT * from public.tenants with plans, invoices, tenant_contacts
  → Actions: Edit fields → UPDATE public.tenants + INSERT public.audit_logs
             Pause → status='paused'
             Reactivate → status='active'
             Delete → status='deleted' (soft)
             Reset admin password → RPC reset_tenant_admin_password

TenantCreatePage:
  → Fill form (business info, plan, billing day, contacts)
  → Submit → supabase.functions.invoke('admin-create-tenant', {...})
           → INSERT public.tenants
           → INSERT public.tenant_contacts (if provided)
           → INSERT public.audit_logs
```

---

## 2. base-front

### 2.1 Tech Stack

| Package | Version | Purpose |
|---|---|---|
| React | ^18.3.1 | UI framework |
| Vite | ^5.4.10 | Build tool and dev server |
| react-router-dom | ^6.26.2 | Client-side routing |
| @supabase/supabase-js | ^2.57.4 | Supabase client (anon key) |
| @tanstack/react-query | ^5.59.17 | Server state management (queries, mutations, caching) |
| zustand | ^5.0.3 | Client state (tenant context) |
| zod | ^3.23.8 | Schema validation |
| jsPDF + jspdf-autotable | ^2.5.2 / ^3.8.4 | PDF report export |
| xlsx | ^0.18.5 | Excel report export |
| docx | ^9.5.1 | Word document export |
| file-saver | ^2.0.5 | Browser file download |
| html2canvas | ^1.4.1 | DOM-to-image for PDF |
| lucide-react | ^0.476.0 | Icon library |
| react-hot-toast | ^2.4.1 | Toast notifications |
| zxcvbn | ^4.4.2 | Password strength |
| TypeScript | ^5.6.3 | Type system |
| Tailwind CSS | ^3.4.14 | Utility-first CSS |

**No test framework** — no devDependency for Vitest/Jest.

---

### 2.2 Authentication

**Method:** Supabase Auth (`signInWithPassword`) with anon key.

**Flow:**
1. `AuthProvider` (`contexts/AuthContext.tsx`) calls `supabase.auth.getSession()` on mount.
2. Subscribes to `supabase.auth.onAuthStateChange`.
3. Exposes `{ loading, session, user }` via `AuthContext` — no role resolution at auth level.
4. Role is resolved per-tenant in `useTenantContext` and `accessRoles.ts`.

**Tenant gate (post-login):**
- `checkTenantStatus(userId)` → SELECT `profiles.tenant_id` → SELECT `tenants.status`
- If `status === 'paused'` → show "Empresa suspendida" banner → force signOut. Users can't access a suspended tenant.
- Controlled by `VITE_TENANT_GATE_ENABLED` env var (default: false in dev).

**First-login detection:**
- After login, checks `attendance.employees.first_login_pending = true` for the user's record.
- If true → redirects to `/auth/set-password` to force password change before entering the app.

**Password reset:** `supabase.auth.resetPasswordForEmail()` with redirect to `/auth/reset-password`.

**`RequireAuth`** (in `App.tsx`) wraps all authenticated routes — redirects to `/login` if no session.

**Session storage key:** `'base_auth'` (custom `storageKey` to avoid collision with cerebro-front if both run on same origin).

**Role system (within tenant):**
Four access roles defined in `lib/accessRoles.ts`:

| Role | Label | Access |
|---|---|---|
| `employee` | Empleado | No admin privileges |
| `assistant` | Asistente | Operational access per permissions |
| `auditor` | Auditor | Read-only audit access |
| `tenant_admin` | Administrador HRCloud | Full tenant access (only 1 per tenant) |

Resolved from `attendance.user_accounts` (primary) or `attendance.memberships` (fallback).

---

### 2.3 Routes

All authenticated routes are nested under `<AppShell>` (wrapped in `<RequireAuth>`).

| Path | Component | Purpose |
|---|---|---|
| `/login` | `LoginPage` | Email + password with tenant gate and first-login check |
| `/auth/reset-password` | `ResetPasswordPage` | Handle Supabase password reset magic link |
| `/auth/set-password` | `SetPasswordPage` | Forced first-login password set |
| `/` | `DashboardPage` | Today's attendance KPIs: on-time, late, novelties |
| `/employees` | `EmployeesPage` | Employee list with search, department filter, status filter |
| `/employees/new` | `EmployeeFormPage` (create) | Full employee creation with photo, org, access, biometrics |
| `/employees/:id` | `EmployeeDetailPage` | Employee profile with tabs: info, attendance, org, access |
| `/employees/:id/edit` | `EmployeeFormPage` (edit) | Edit all employee fields |
| `/attendance` | `AttendanceHomePage` | Attendance module hub |
| `/attendance/daily` | `DailyAttendanceReportPage` | Daily report with schedule/turn status, export PDF/Excel |
| `/attendance/novelties` | `AttendanceNoveltiesPage` | Novelties (inconsistencies) review and approval workflow |
| `/attendance/usb-import` | `UsbImportPage` | Import ZKTeco USB .dat file |
| `/reports/diario` | `DailyAttendanceReportPage` | Alias for daily report |
| `/config` | `ConfigHomePage` | Configuration module hub (card grid) |
| `/config/company` | `CompanyConfigPage` | Company info, logo, branding |
| `/config/reconocimiento-facial` | `FacialRecognitionPage` | Face recognition parameters |
| `/config/marcacion` | `MarkingParamsPage` | Punch tolerance and rules |
| `/config/marcacion-avanzada` | `MarcacionConfigPage` | Advanced punch configuration |
| `/config/biometricos` | `BiometricAliasesPage` | Biometric device alias mapping |
| `/config/horarios` | `SchedulesPage` | Work schedules (entry/exit times) |
| `/config/turnos` | `TurnsPage` | Work turns (day shift, night shift, etc.) |
| `/config/turnos-horarios` | `TurnosHorariosPage` | Turn ↔ schedule assignment |
| `/config/organizacional` | `OrgStructurePage` | Org chart and unit hierarchy |
| `/config/roles-permisos` | `RolesPermissionsPage` | Tenant role and permissions management |
| `/config/feriados` | `HolidaysPage` | Public holidays calendar |
| `/config/kpis` | `KpiConfigPage` | KPI display settings (chart type, widgets, ranking limit) |
| `/config/seguridad` | `SecurityConfigPage` | Security settings (geofence, photo requirements) |
| `/config/correo` | `EmailConfigPage` | SMTP email config per tenant |
| `/config/reportes` | `ReportsConfigPage` | Report format and column preferences |
| `/config/cira/regimen-laboral` | `LaborRegimeConfigPage` | CIRA V2.0 — régimen laboral (CODIGO_TRABAJO / LOSEP) y reglas de recargo |
| `/config/cira/multas` | `FineConfigPage` | CIRA V2.0 — configuración de multas por tipo de incidencia + historial fine_ledger |
| `/config/cira/horas-extra` | `OvertimeRequestsPage` | CIRA V2.0 — solicitudes de horas extra: aprobar / rechazar / compensar |
| `/reports/cira` | `AttendanceReportCiraPage` | CIRA V2.0 — reporte FR-09: resumen del día, multas, acumulados legales (3 tabs) |

**Redirects:**
- `/attendance/detail` → `/attendance/daily`
- `/reports/detailed` → `/attendance/daily`
- `/config/organigrama` → `/config/organizacional`
- `/config/estructura-organizacional` → `/config/organizacional`
- `/config/holidays` → `/config/feriados`

---

### 2.4 Components Inventory

#### Layout

| Component | Path | Purpose |
|---|---|---|
| `AppShell` | `components/layout/AppShell.tsx` | Main layout: sidebar (desktop drawer + mobile), Outlet |
| `SideNav` | `components/layout/SideNav.tsx` | Navigation links: Dashboard, Empleados, Asistencia, Importación USB, Configuración |
| `BrandingProvider` | `components/branding/BrandingProvider.tsx` | Injects CSS variables for primary color and company branding |

#### Auth

| Component | Purpose |
|---|---|
| `TenantGate` | Shows "empresa suspendida" overlay when tenant is paused |
| `FirstLoginModal` | Forces password change on first login |
| `ProtectedRoute` | Redirects unauthenticated users to `/login` |

#### UI Primitives (`components/ui/`)

| Component | Purpose |
|---|---|
| `Badge` | Status badges with tone: `good`, `warn`, `bad`, `neutral` |
| `Button` | Primary / secondary / ghost variants |
| `Card` | Glassmorphism card with `title`, `subtitle`, `actions` slots |
| `Drawer` | Side drawer for mobile and panel overlays |
| `Input` | Labeled input with error state |
| `Modal` | Centered modal with backdrop |
| `Select` | Styled `<select>` with label and error |
| `TiltCard` | 3D perspective-tilt card (config module hub) |

#### Org Structure (`components/org/`)

| Component | Purpose |
|---|---|
| `OrgTree` | Recursive tree rendering of org units |
| `OrgChart3D` | 3D perspective org chart visualization |
| `OrgUnitForm` | Create/edit org unit with parent selection |
| `EmployeeOrgSection` | Org section within employee detail page |
| `EmployeeLeadershipBadge` | Shows if employee is a department head |
| `AssignmentHistoryTable` | Historical org assignment log |

#### Attendance Features (`features/attendance/`)

| Component / Hook | Purpose |
|---|---|
| `NoveltiesSummaryCards` | Summary cards for novelty types |
| `NoveltiesTable` | Paginated novelties list |
| `NoveltyDecisionModal` | Approve/reject novelty with justification |
| `useAttendanceNovelties` | TanStack Query hook for novelty data |

---

### 2.5 State Management

**TanStack React Query v5** — all server data (employees, attendance, config, etc.) managed with `useQuery` and `useMutation`.

**Zustand v5** — `useTenantStore` holds the active tenant context:

```typescript
interface TenantState {
  tenantId: string | null
  role: UserRole | null
  primaryColor: string
  companyName?: string
}
```

**React Context** — `AuthContext` holds `{ loading, session, user }` (session only, no business logic).

**Local state (`useState`)** — form state in pages not using react-hook-form, filter/pagination state.

**`useTenantContext(userId)`** — TanStack Query hook that resolves `tenantId` by joining `profiles.tenant_id` → `tenants.id,status`. Cached for 60 seconds. All data-fetching hooks depend on `tenantId` being truthy (`enabled: !!tenantId`).

---

### 2.6 Supabase Configuration

**Schema targeting:** All `attendance` schema queries use either:
- `supabase.schema(ATT_SCHEMA).from(...)` via the supabase-js schema chaining
- `ATT_SCHEMA` constant from `config/supabase.ts`, set from `VITE_ATTENDANCE_SCHEMA` env var (default: `'attendance'`)

**`public` schema** queries (via `supabase.from(...)` directly):
- `profiles` — for `tenant_id` lookup
- `tenants` — for status check

---

### 2.7 Supabase Tables Queried

| Table | Schema | Operations | Used by |
|---|---|---|---|
| `profiles` | public | SELECT | `useTenantContext`, `tenantGate` |
| `tenants` | public | SELECT | `useTenantContext`, `tenantGate` |
| `employees` | attendance | SELECT, INSERT, UPDATE | EmployeesPage, EmployeeFormPage, EmployeeDetailPage |
| `employee_profile` | attendance | SELECT, UPSERT | EmployeeFormPage (work mode, geolocation) |
| `employee_org_assignments` | attendance | SELECT, INSERT | EmployeesPage dept fallback, OrgStructurePage |
| `org_units` | attendance | SELECT, INSERT, UPDATE, DELETE | OrgStructurePage, EmployeeFormPage |
| `org_level_definitions` | attendance | SELECT | OrgStructurePage |
| `user_accounts` | attendance | SELECT, UPSERT | EmployeeFormPage access role |
| `memberships` | attendance | SELECT | Access role fallback |
| `biometric_devices` | attendance | SELECT | BiometricDevicesPage, EmployeeFormPage |
| `biometric_aliases` | attendance | SELECT, INSERT, UPDATE, DELETE | BiometricAliasesPage |
| `punches` | attendance | SELECT | AttendanceReportPage |
| `biometric_raw` | attendance | SELECT | AttendanceReportPage (source tracking) |
| `schedules` | attendance | SELECT, INSERT, UPDATE, DELETE | SchedulesPage, EmployeeFormPage |
| `turns` | attendance | SELECT, INSERT, UPDATE, DELETE | TurnsPage |
| `settings` | attendance | SELECT, UPSERT | CompanyConfigPage, various config pages |
| `kpi_settings` | attendance | SELECT, UPSERT | DashboardPage, KpiConfigPage |
| `holidays` | attendance | SELECT, INSERT, UPDATE, DELETE | HolidaysPage |
| `labor_regime_config` | attendance | SELECT, UPSERT | LaborRegimeConfigPage |
| `surcharge_rules` | attendance | SELECT | LaborRegimeConfigPage |
| `fine_config` | attendance | SELECT, UPSERT | FineConfigPage |
| `fine_ledger` | attendance | SELECT | FineConfigPage, AttendanceReportCiraPage (tablePending hasta C-4) |
| `overtime_requests` | attendance | SELECT, UPDATE | OvertimeRequestsPage (tablePending hasta C-5 ejecutado) |
| `overtime_ledger` | attendance | SELECT | AttendanceReportCiraPage (tablePending hasta C-7) |

**RPCs called from base-front:**

| RPC | Schema | Used by |
|---|---|---|
| `get_daily_attendance_report_v2` | attendance | DashboardPage, DailyAttendanceReportPage |
| `get_kpi_attendance_by_department` | attendance | DashboardPage |
| `get_kpi_attendance_by_turn` | attendance | DashboardPage |
| `get_kpi_ranking` | attendance | DashboardPage |
| `upsert_employee_full` | attendance | EmployeeFormPage (full employee save) |

**Storage bucket used:**
- `employee_photos` — read via `createSignedUrl()` in EmployeeFormPage/EmployeeDetailPage

---

### 2.8 User Flows

#### Login (base-front)

```
User opens /login
  → User submits email + password
  → supabase.auth.signInWithPassword()
    ✗ Error → toast "Credenciales inválidas"
    ✓ Session created (uid)
      → checkTenantStatus(uid):
          SELECT profiles.tenant_id WHERE id=uid
          SELECT tenants.status WHERE id=tenant_id
          If status='paused' → show banner → signOut → stay on /login
      → checkFirstLoginPending(uid):
          SELECT employees.first_login_pending WHERE user_id=uid (attendance schema)
          If true → navigate to /auth/set-password
      → navigate to /  (DashboardPage)
```

#### Dashboard (base-front)

```
On mount, useTenantContext(user.id):
  → SELECT profiles.tenant_id
  → SELECT tenants.id,status
  → tenantId resolved → enable all dependent queries

TanStack Query (parallel):
  → attendance.rpc('get_daily_attendance_report_v2', {p_tenant_id, p_date_from=today, p_date_to=today})
  → attendance.kpi_settings WHERE tenant_id (chart_type, ranking_limit, dashboard_widgets)
  → attendance.rpc('get_kpi_attendance_by_department', {...})
  → attendance.rpc('get_kpi_attendance_by_turn', {...})
  → attendance.rpc('get_kpi_ranking', {..., p_limit})

Render:
  → 4 stat cards: Employees total, On time, Late, Novelties
  → Configurable widgets: turn chart, department chart, ranking chart
  → Chart type (bar/pie/donut/3d) from kpi_settings
```

#### Employee Management (base-front)

```
EmployeesPage:
  → attendance.employees with JOIN org_unit (via employee_org_assignments)
  → attendance.employee_profile (work_mode)
  → Filter: search, department, status
  → "+" button → navigate to /employees/new

EmployeeFormPage (create):
  → Load: schedules, turns, biometric devices, org units, org level definitions
  → Sections (tabs):
      1. Datos básicos: nombre, código, cédula, departamento
      2. Horario: schedule_id, assigned days of week
      3. Foto facial: capture via camera → Storage upload to employee_photos/
         → computeImageMetrics() quality check (blur, brightness, face size)
      4. Localización: work_mode (presencial/remoto/híbrido), geofence
      5. Biometría: device_employee_code (alias for ZKTeco)
      6. Acceso al sistema: role (employee/assistant/auditor/tenant_admin), password
  → Submit → attendance.rpc('upsert_employee_full', {...})
           → attendance.user_accounts UPSERT (access role)
           → attendance.employee_org_assignments INSERT
           → attendance.employee_profile UPSERT

EmployeeDetailPage:
  → Load full employee record with photo (signedUrl)
  → Tabs: Perfil, Asistencia (last punches), Organización, Acceso
```

#### Attendance Report (base-front)

```
DailyAttendanceReportPage:
  → useTenantContext → tenantId
  → Filters: dateFrom, dateTo, employee search, department, dayStatus
  → attendance.rpc('get_daily_attendance_report_v2', {p_tenant_id, p_date_from, p_date_to})
  → Returns per-employee: entry_at, exit_at, lunch times, entry_status, day_status, novelty
  → attendance.biometric_raw (for source/device tracking per punch)
  → Export options: PDF (jsPDF + autotable), Excel (xlsx), Word (docx)

AttendanceNoveltiesPage:
  → attendance.punches WHERE day_status IN ('NOVEDAD', ...) 
  → NoveltyDecisionModal: approve or reject with justification
  → Updates attendance.justifications, attendance.permission_requests
```

#### Configuration (base-front)

```
ConfigHomePage:
  → Grid of TiltCard components linking to config sub-pages

CompanyConfigPage:
  → SELECT/UPSERT attendance.settings WHERE tenant_id (company name, logo, timezone)

SchedulesPage:
  → SELECT/INSERT/UPDATE/DELETE attendance.schedules WHERE tenant_id
  → Each schedule: name, entry_time, exit_time, turn_id, color, crosses_midnight

TurnsPage:
  → SELECT/INSERT/UPDATE/DELETE attendance.turns WHERE tenant_id
  → Each turn: name, type (regular/parttime/irregular/custom), description

OrgStructurePage:
  → SELECT/INSERT/UPDATE/DELETE attendance.org_units (tree structure)
  → SELECT attendance.org_level_definitions (level names for the hierarchy)
  → OrgTree + OrgChart3D visualization

BiometricAliasesPage:
  → SELECT/INSERT/UPDATE/DELETE attendance.biometric_aliases WHERE tenant_id
  → Maps device_employee_code → canonical employee
```

---

## 3. pwa — Employee Attendance App

### 3.1 Overview

The PWA is a **single-screen tab app** built for mobile employees to clock in/out. It does NOT use react-router for navigation.

**Tech Stack:** React 18 + Vite 5 + `vite-plugin-pwa` + Workbox + Zustand + TanStack Query + Supabase JS.

### 3.2 Navigation Architecture

```typescript
// pwa/src/App.tsx
const [activeTab, setActiveTab] = useState<Tab>('clock')
const visibleTabs: Tab[] = ['clock', 'history', 'requests', 'profile']
```

| Tab | Component | Purpose |
|---|---|---|
| `clock` | `ClockInPage` | Main attendance: clock in/out, break, GPS check, selfie |
| `history` | `HistoryPage` | Employee's punch history |
| `requests` | `RequestsPage` | Permission and justification requests |
| `profile` | `ProfilePage` | Profile info, sign out, refresh |

### 3.3 Authentication

`useAuth` hook (custom, in `pwa/src/hooks/useAuth.ts`) manages session + employee profile. After login it loads:
- `profiles.tenant_id` → `tenants.status` (tenant gate)
- `attendance.employees` → full profile for the logged-in employee

### 3.4 Attendance Flow (ClockInPage)

```
Employee opens app
  → useAuth loads profile (tenant_id, employee_id, geofence config)
  → useAttendance monitors GPS location
  → geofenceStatus: 'inside' | 'outside' | 'disabled'
  
Employee taps "Marcar Entrada":
  → GPS check (geofence validation if configured)
  → Selfie capture (FacialCaptureModal)
  → Upload selfie to Storage 'punch-selfies'
  → attendance.rpc('register_web_punch') or INSERT attendance.punches
  → INSERT attendance.punch_evidence (verification_status='pending')
  → Edge Function 'face-verify' called asynchronously
```

### 3.5 PWA Features

- **Install banner** (Android/Chrome): `beforeinstallprompt` event captured → custom install UI
- **iOS install guide**: Step-by-step Safari share sheet instructions
- **Service Worker**: `vite-plugin-pwa` + Workbox for offline caching
- **HTTPS required**: Camera and GPS APIs require secure context (`@vitejs/plugin-basic-ssl` for dev)

### 3.6 Note on pwa/src/pages/ folder

The folder `pwa/src/pages/` contains ~80 TypeScript files with full routing-based page implementations (EmployeesPage, DailyAttendanceReportPage, ConfigHomePage, etc.). These are near-copies of `base-front/src/pages/` and are **not mounted** in the actual `App.tsx`. They represent an incomplete migration toward a full HR panel in the PWA. See [TECH_DEBT.md](TECH_DEBT.md) HIGH-3 for remediation plan.

---

## 4. Environment Variables

### cerebro-front (`.env.local`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_APP_NAME` | No | App title shown in header and browser tab |
| `VITE_ENABLE_AUDIT_LOGS` | No | `"true"` to show `/audit` route (default: true) |

### base-front (`.env.local`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | — | Supabase anon key |
| `VITE_ATTENDANCE_SCHEMA` | No | `attendance` | Schema name for all HR tables |
| `VITE_PROFILES_TABLE` | No | `profiles` | Table for user→tenant lookup |
| `VITE_TENANTS_TABLE` | No | `tenants` | Table for tenant status check |
| `VITE_TENANT_GATE_ENABLED` | No | `false` | Enable tenant suspension check on login |

---

## 4. Shared Patterns

### Supabase Client (both frontends)

```typescript
createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})
```

Both use the **anon key**. RLS policies on every table enforce that each user only accesses data they're authorized for.

### Tenant Isolation

Every query in base-front includes `.eq('tenant_id', tenantId)` from the `useTenantContext` hook. This is enforced at both the application level and the database level via RLS `current_tenant_id()` JWT claims.

### Error Handling

- Network/Supabase errors → `react-hot-toast` error toasts
- Schema cache errors (table doesn't exist, column missing) → silently swallowed (both frontends handle `schema cache`, `does not exist`, `relation` error strings)
- Auth errors → redirect to `/login`

### Export Pattern (base-front)

Reports support three export formats from the same data:
- **PDF**: `jsPDF` + `jspdf-autotable` — tabular with company header
- **Excel**: `xlsx` — full sheet with raw data
- **Word**: `docx` — formatted document
- **Download**: `file-saver` `saveAs()` triggers browser download

### Build Output

Both generate `dist/index.html` + `dist/404.html` (the 404.html is a copy of index.html for SPA routing on DigitalOcean App Platform):
```
# base-front build script
tsc -p tsconfig.json && vite build && copy dist\index.html dist\404.html
```
