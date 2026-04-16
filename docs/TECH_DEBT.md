# TECH_DEBT.md

Inventario de deuda técnica, riesgos de seguridad e inconsistencias en la documentación del monorepo HRCloud. Generado mediante revisión estática de código fuente.

---

## Inconsistencias en la Documentación

Problemas identificados comparando los docs/ generados contra el código real.

### DOC-1 — `docs/FRONTEND.md` describe la PWA incorrectamente (CRÍTICO)

**Problema:** `FRONTEND.md` documenta la PWA como una SPA con react-router-dom y más de 30 rutas. El archivo `pwa/src/App.tsx` real es completamente distinto: es una app de **una sola pantalla con 4 tabs** sin react-router.

**Código real** (`pwa/src/App.tsx`):
```tsx
const [activeTab, setActiveTab] = useState<Tab>('clock')
const visibleTabs: Tab[] = ['clock', 'history', 'requests', 'profile']
// → ClockInPage, HistoryPage, RequestsPage, ProfilePage
```

**Lo que documenta FRONTEND.md:** `/attendance`, `/attendance/daily`, `/employees`, `/config`, etc.

**Explicación:** La carpeta `pwa/src/pages/` contiene páginas con estructura de react-router (copias de `base-front`) pero **ninguna está montada en el router**. El `App.tsx` real usa su propio `useAuth` y `useAttendance` con navegación por tab state. Las dos implementaciones coexisten en la misma carpeta sin estar integradas.

**Impacto:** Un desarrollador que lea la documentación no entenderá qué código se ejecuta realmente.

---

### DOC-2 — `docs/BACKEND.md` lista middleware incorrecto en Node.js gateway

**Problema:** BACKEND.md lista `morgan` y `cors` como middleware activo en el pipeline del gateway Node.js. No están importados ni usados en `adms-gateway/src/index.js`.

**Código real** (`adms-gateway/src/index.js` líneas 49–51):
```js
const app = express()
app.use(express.text({ type: '*/*', limit: '512kb' }))
// no cors(), no morgan()
```

**Lo que documenta BACKEND.md:** `morgan → cors → express.text → route handler`

**Nota:** `morgan` y `cors` están en `package.json` como dependencias, pero no están cargados.

---

### DOC-3 — `docs/FRONTEND.md` no menciona la PWA como app existente separada

**Problema:** La PWA real (`pwa/src/App.tsx`) tiene toda una UI propia con hooks propios (`useAuth`, `useAttendance`), componentes de instalación PWA (banners Android/iOS), y sistema de marcación completo. FRONTEND.md la omite casi por completo y en su lugar documenta las páginas de la carpeta `pwa/src/pages/` que no están montadas.

---

### DOC-4 — `docs/BACKEND.md` describe `GET /iclock/getrequest` en Node.js pero no existe

**Problema:** BACKEND.md documenta `GET /iclock/getrequest` en la implementación Node.js. El archivo `src/index.js` solo tiene `app.all('/iclock/cdata', ...)` y `app.get('/health', ...)`. El endpoint `/iclock/getrequest` solo existe en `app.py` (Python).

---

### DOC-5 — `README.md` lista `pwa` con react-router-dom como dependencia pero el App.tsx real no lo usa para navegación

**Problema:** El README describe la PWA como una app con react-router basada en rutas. El archivo `pwa/package.json` sí incluye `react-router-dom: ^6.26.0` pero el `App.tsx` real no lo usa — navega por `useState<Tab>`.

---

## Deuda Técnica por Prioridad

---

## 🔴 PRIORIDAD ALTA — Seguridad y estabilidad

### SEC-1 — Secretos de producción committed al repositorio

**Archivos:**
- `adms-gateway/.env` — Service Role Key completa de producción en texto plano
- `base-front/face-service/.env` — misma Service Role Key duplicada

**Código:**
```
# adms-gateway/.env línea 3
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DEFAULT_TENANT_ID=db1e2c4e-78f9-4a96-bbd6-58a580ac68b9

# base-front/face-service/.env línea 2
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Por qué es un problema:** El Service Role Key bypasea toda RLS. Cualquier persona con acceso al repositorio puede leer/escribir cualquier tabla sin restricciones. El key está en el historial de git permanentemente aunque se elimine el archivo.

**Acción requerida:**
1. Rotar el Service Role Key inmediatamente en el dashboard de Supabase.
2. Agregar `*.env` y `!*.env.example` al `.gitignore` y verificar que aplique a archivos ya tracked (`git rm --cached adms-gateway/.env`).
3. Usar secretos del entorno de despliegue (DigitalOcean App Platform env vars, nunca archivos).

---

### SEC-2 — Endpoint `smtp-settings` sin verificación de autenticación

**Archivo:** `supabase/functions/smtp-settings/index.ts` líneas 57–110

**Código:**
```typescript
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  // → Procede directamente a modificar smtp_settings sin verificar JWT ni rol
  const body = (await req.json()) as Payload
  // ...
  await supabase.from('smtp_settings').upsert(...)
  await upsertVaultSecret(secret_name, password)
```

**Por qué es un problema:** Cualquier usuario autenticado (o incluso sin autenticación si la función no require JWT) puede reemplazar la configuración SMTP del sistema con un servidor propio, capturando todos los correos posteriores: invitaciones, resets de contraseña, notificaciones de facturación.

**Comparación:** `admin-create-tenant/index.ts` sí verifica `callerRole.role !== 'admin'` antes de actuar. Esta función debe hacer lo mismo.

**Acción requerida:** Agregar verificación de JWT + rol `admin` al inicio del handler, similar al patrón de `admin-create-tenant`.

---

### SEC-3 — CORS wildcard en todas las edge functions

**Archivo:** `supabase/functions/_shared/cors.ts` línea 2

**Código:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ...
}
```

**Afecta a:** todas las funciones que importan este módulo: `smtp-settings`, `broadcast-email`, `attendance-ai-analyze`, `biometric-gatekeeper`, `admin-create-tenant`, etc.

**Por qué es un problema:** Permite que cualquier origen (cualquier sitio web) realice peticiones autenticadas a estas funciones. En combinación con un token JWT robado, un atacante puede invocarlas desde cualquier dominio.

**Acción requerida:** Reemplazar `'*'` con el dominio permitido del frontend (ej. `https://cerebro.hrcloud.ec`), o al menos usar una lista blanca de orígenes válida. Para desarrollo local, permitir `http://localhost:*` condicional al entorno.

---

### SEC-4 — `API_SECRET` con valor por defecto conocido en el servicio facial

**Archivo:** `app_face_v2.py` línea 20

**Código:**
```python
API_SECRET = os.environ.get('API_SECRET', 'hrcloud-face-2026')
```

**Por qué es un problema:** Si el servicio se despliega sin configurar `API_SECRET`, el valor `hrcloud-face-2026` es accesible a cualquiera que lea el código fuente. Con este secreto se puede: (1) cambiar el estado de verificación de cualquier evidencia, (2) ejecutar `/process-pending` y alterar masivamente resultados de verificación facial.

**Acción requerida:** Eliminar el valor por defecto — fallar con `raise ValueError` si la variable no está configurada. Agregar validación de arranque:
```python
API_SECRET = os.environ.get('API_SECRET')
if not API_SECRET:
    raise ValueError("API_SECRET env var is required")
```

---

### SEC-5 — Actualización de evidencia sin validación de ownership de tenant

**Archivo:** `app_face_v2.py` líneas 88–99

**Código:**
```python
def update_evidence(evidence_id, status, notes):
    url = f"{SUPABASE_URL}/rest/v1/punch_evidence?id=eq.{evidence_id}"
    payload = { 'verification_status': status, ... }
    r = http_requests.patch(url, headers=headers_attendance(), json=payload, timeout=10)
```

**Por qué es un problema:** El `evidence_id` viene directamente del request body de `/verify`. No se valida que la evidencia pertenezca al `tenant_id` declarado en el request. Un atacante con el `API_SECRET` puede pasar cualquier `evidence_id` y cambiar su `verification_status` a `'verified'`, aprobando marcaciones falsas.

**Acción requerida:** Agregar `&tenant_id=eq.{tenant_id}` al PATCH para que el update sea nulo si el tenant no coincide:
```python
url = f"{SUPABASE_URL}/rest/v1/punch_evidence?id=eq.{evidence_id}&tenant_id=eq.{tenant_id}"
```

---

### SEC-6 — Punches insertados sin `employee_id` cuando el empleado no se encuentra

**Archivo:** `adms-gateway/src/index.js` líneas 161–177

**Código:**
```javascript
const employeeId = employee?.id ?? null

// Insert Punch (se inserta aunque employeeId sea null)
await supabase.schema('attendance').from('punches').insert({
    tenant_id: tenantId,
    employee_id: employeeId,   // ← puede ser null
    biometric_employee_code: biometricCode,
    punched_at: punchedAt.toISOString(),
    source: 'biometric'
})
```

**Por qué es un problema:** Se insertan registros de punch con `employee_id = null`. Estos registros huérfanos corrompen reportes de asistencia, pueden causar errores en agregaciones y dificultan la reconciliación posterior. La versión Python no tiene este problema — omite el punch si no hay empleado.

**Acción requerida:** Omitir el INSERT de punch si `employeeId` es null (igual que la versión Python). El raw ya fue insertado y sirve de auditoría.

---

### HIGH-1 — Archivos de páginas duplicadas en cerebro-front

**Archivos:**
- `cerebro-front/src/pages/TenantDetailPage (1).tsx` (1129 líneas — versión alternativa)
- `cerebro-front/src/pages/TenantsPage (3).tsx` (370 líneas — versión alternativa)
- `cerebro-front/src/pages/TenantCreatePage (2).tsx` (776 líneas — versión alternativa)

**Por qué es un problema:** Estos archivos tienen espacios en el nombre, lo cual puede causar problemas de import en algunos sistemas. No está claro cuál versión está activa (el router usa los nombres sin número, pero los duplicados persisten). Cualquier cambio en la lógica de negocio puede hacerse en la versión incorrecta.

**Acción requerida:** Eliminar los archivos duplicados del repo. Si contienen funcionalidad que falta en la versión activa, mergearla primero.

---

### HIGH-2 — Archivos `.bak` commiteados al repositorio

**Archivos:**
- `cerebro-front/supabase/functions/admin-create-tenant/index.ts.bak`
- `pwa/src/components/FaceCaptureModal.tsx.bak`

**Por qué es un problema:** Los archivos `.bak` pueden ser importados accidentalmente por IDEs o herramientas de build. Constituyen código no revisado en el repositorio. En el caso de la edge function, puede confundir qué versión se despliega.

**Acción requerida:** Eliminar ambos archivos. Usar git history para recuperar versiones antiguas si se necesitan.

---

### HIGH-3 — Carpeta `pwa/src/pages/` con cientos de líneas de código no montado

**Problema:** La carpeta `pwa/src/pages/` contiene implementaciones completas de páginas con react-router (copias casi exactas de `base-front/src/pages/`): `EmployeesPage`, `DailyAttendanceReportPage`, `ConfigHomePage`, etc. Ninguna está registrada en el `App.tsx` real de la PWA.

**Por qué es un problema:** Código muerto que ocupa espacio, puede confundir a desarrolladores, y puede incluirse accidentalmente en el bundle si alguien agrega imports. El bundle de producción se compilará más lento por archivos que TypeScript aún analiza aunque no se usen.

**Acción requerida:** Mover las páginas no montadas a una carpeta claramente marcada como `_unused/` o eliminarlas y tomar la decisión explícita de integrar o no el routing completo en la PWA.

---

### HIGH-4 — Dos implementaciones del gateway con comportamiento divergente

**Archivos:** `adms-gateway/app.py` vs `adms-gateway/src/index.js`

**Diferencias concretas:**

| Comportamiento | Python (`app.py`) | Node.js (`src/index.js`) |
|---|---|---|
| `/iclock/getrequest` | Implementado | No existe |
| Handshake response | Multi-línea con config | Solo `"OK"` |
| Timestamp timezone | Convierte device TZ → UTC | `new Date(timestampStr)` sin TZ (interpreta como local del servidor) |
| Auth method mapping | `RECONOCIMIENTO_FACIAL`, `HUELLA_DIGITAL`, `CODIGO` | No mapea — no inserta `auth_method` |
| Punch con employee null | Omite punch | Inserta punch con `employee_id=null` |
| Deployed by | Manualmente / separado | `Procfile` → `npm start` |

**Por qué es un problema:** No está documentado cuál corre en producción. Si se despliega el Node.js (via Procfile), las marcaciones biométricas no tienen `auth_method`, los timestamps pueden estar en zona horaria incorrecta, y se insertan punches huérfanos.

**Acción requerida:** Elegir una implementación, eliminar la otra, y documentar la decisión. Si ambas deben existir (ej. Python para nuevos features, Node.js para Procfile legacy), sincronizar el comportamiento de parseo de timestamp y eliminación de punches sin empleado.

---

## 🟡 PRIORIDAD MEDIA

### MED-1 — Sin timeout en llamadas Supabase del gateway Node.js

**Archivo:** `adms-gateway/src/index.js` líneas 70–88, 139–145, 148–155

**Código:**
```javascript
const { data, error } = await supabase
  .schema('attendance')
  .from('biometric_devices')
  .select('tenant_id')
  .eq('serial_no', sn)
  .maybeSingle()
// ← sin timeout
```

**Por qué es un problema:** Si Supabase tiene alta latencia o una partición de red, el handler puede colgar indefinidamente. ZKTeco devices esperan respuesta en <5 segundos — si el gateway no responde, el dispositivo reintenta y puede acumular colas.

**Acción requerida:** Usar `AbortController` con timeout, o usar la opción `signal` del cliente de Supabase.

---

### MED-2 — RUC validado solo por formato, sin checksum

**Archivo:** `supabase/functions/admin-create-tenant/index.ts` línea 36

**Código:**
```typescript
if (!/^\d{13}$/.test(ruc)) throw new Error('RUC invalido (debe tener 13 digitos)')
```

**Por qué es un problema:** El RUC ecuatoriano tiene un dígito verificador calculable. La validación actual acepta `0000000000000` como válido. Datos de prueba o errores tipográficos pasan sin detección.

**Acción requerida:** Implementar validación de módulo 11 del RUC ecuatoriano (SRI). Existen implementaciones de referencia en npm y PyPI.

---

### MED-3 — Email de contacto sin validación de formato

**Archivo:** `supabase/functions/admin-create-tenant/index.ts` línea 37

**Código:**
```typescript
if (!contact_email?.trim()) throw new Error('Email de contacto requerido')
// No hay regex ni validación de formato
```

**Por qué es un problema:** Un email malformado se guarda en `tenants.contact_email` y luego falla silenciosamente cuando `broadcast-email` intenta enviar. No hay feedback al operador.

**Acción requerida:** Agregar validación básica: `if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) throw new Error(...)`.

---

### MED-4 — `check_quality()` no valida resolución mínima suficiente para LBPH

**Archivo:** `app_face_v2.py` líneas 68–76

**Código:**
```python
def check_quality(img_bgr):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    issues = []
    if brightness < 40: issues.append('Imagen muy oscura')
    if brightness > 230: issues.append('Imagen sobreexpuesta')
    h, w = img_bgr.shape[:2]
    if w < 80 or h < 80: issues.append('Resolucion muy baja')
```

**Por qué es un problema:** `detect_face()` usa `minSize=(60,60)`. Una imagen de 80×80 puede pasar quality check pero tener el rostro tan pequeño que LBPH compare descriptores ruidosos. Además no se verifica desenfoque (blur), que es la causa más común de falsos rechazos.

**Acción requerida:** Agregar detección de blur con Laplacian variance:
```python
lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
if lap_var < 100: issues.append('Imagen borrosa')
```
Y aumentar el umbral mínimo de resolución a 120×120 px.

---

### MED-5 — LBPH instanciado en cada llamada (costo innecesario)

**Archivo:** `app_face_v2.py` líneas 61–66

**Código:**
```python
def compare_lbph(ref_face, selfie_face):
    recognizer = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
    recognizer.train([ref_face], np.array([0]))
    label, confidence = recognizer.predict(selfie_face)
```

**Por qué es un problema:** El recognizer se crea, entrena y destruye en cada invocación. Para un batch de 50 evidencias pendientes (`/process-pending`), esto multiplica el overhead. El entrenamiento es O(n_pixels) pero es evitable con caching.

**Acción requerida:** Dado que el recognizer se reentrena con cada foto de referencia de todos modos (es per-employee), el costo real es bajo por llamada individual. Sin embargo, el objeto puede reutilizarse en el scope de `run_verify` en lugar de crearse en una función separada.

---

### MED-6 — Magic numbers en el algoritmo LBPH no configurables

**Archivo:** `app_face_v2.py` líneas 62, 65

**Código:**
```python
recognizer = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
score = max(0.0, 1.0 - (confidence / 150.0))
```

**Por qué es un problema:** El divisor `150.0` determina la escala del score. Si la distribución de confianzas cambia (diferente calidad de cámara, iluminación diferente en otro país), el threshold `0.75` puede dejar de ser válido sin que sea obvio por qué. No hay forma de ajustar sin editar código.

**Acción requerida:** Exponer como variables de entorno:
```python
LBPH_CONFIDENCE_SCALE = float(os.environ.get('LBPH_CONFIDENCE_SCALE', '150.0'))
```

---

### MED-7 — Código de backup en `base-front/.ackup_estructura_only/`

**Archivos:**
- `base-front/.ackup_estructura_only/App.tsx`
- `base-front/.ackup_estructura_only/CompanyConfigPage.tsx`
- `base-front/.ackup_estructura_only/ConfigHomePage.tsx`
- `base-front/backup_estructura/src_raiz_duplicados/` (múltiples archivos)

**Por qué es un problema:** Carpetas de backup en el repositorio de producción. Aumentan el tamaño del repo, confunden a nuevos desarrolladores y pueden ser importadas accidentalmente.

**Acción requerida:** Eliminar todas las carpetas `backup_*` y `.ackup_*`. Usar git tags o branches para marcar versiones estables.

---

### MED-8 — `FacialCaptureModal.tsx.bak` en PWA sin archivo activo equivalente

**Archivo:** `pwa/src/components/FaceCaptureModal.tsx.bak`

**Problema relacionado:** La PWA real (`App.tsx`) usa `FacialCaptureModal` implícitamente a través de `ClockInPage`, pero el `.bak` sugiere que hubo refactoring no completado. Si la versión en `.bak` tiene lógica que falta en el modal activo, se pierde silenciosamente.

---

## 🟢 PRIORIDAD BAJA

### LOW-1 — `useTenants` en cerebro-front no usa TanStack Query

**Archivo:** `cerebro-front/src/hooks/useTenants.ts` (381 líneas)

**Problema:** Implementa manualmente loading/error/data state, pagination, y cache invalidation que TanStack Query provee. El hook tiene ~200 líneas que serían ~30 con `useQuery`/`useMutation`. Base-front usa TanStack Query v5 correctamente; cerebro-front usa useState manual.

**Impacto:** Inconsistencia de patterns entre los dos frontends. Mayor superficie de bugs en el manejo de estado asíncrono.

---

### LOW-2 — Supabase client inicializado de forma diferente en cada subproyecto

**Archivos:**

| Subproyecto | storageKey | schema default | Notas |
|---|---|---|---|
| `cerebro-front/src/config/supabase.ts` | (default) | `public` | `detectSessionInUrl: true` |
| `base-front/src/config/supabase.ts` | `'base_auth'` | `attendance` | custom key, sin `detectSessionInUrl` |
| `pwa/src/config/supabase.ts` (si existe) | varía | varía | — |

**Impacto:** Si dos subproyectos se abren en el mismo origen (ej. localhost con puertos distintos), el `storageKey` diferente evita colisión. Pero si alguna vez se unifican dominios, habrá conflictos de sesión.

---

### LOW-3 — `AccessPage.tsx` y `KpisPage.tsx` en cerebro-front sin ruta registrada

**Archivos:**
- `cerebro-front/src/pages/AccessPage.tsx`
- `cerebro-front/src/pages/KpisPage.tsx`

**Problema:** Existen como archivos en `pages/` pero no están registrados en las rutas de `App.tsx`. Código sin uso que puede confundir.

---

### LOW-4 — `REJECT_UNKNOWN_SN=0` en el `.env` de producción

**Archivo:** `adms-gateway/.env` línea 5

**Código:** `REJECT_UNKNOWN_SN=0`

**Por qué es un problema:** Con esta configuración, dispositivos no registrados pueden enviar marcaciones que se asignarán al `DEFAULT_TENANT_ID`. Cualquier dispositivo ZKTeco que conozca la URL del gateway puede inyectar marcaciones en ese tenant. La documentación (BACKEND.md) indica que el default recomendado es `1` (rechazar).

**Acción requerida:** Cambiar a `REJECT_UNKNOWN_SN=1` en producción y registrar explícitamente cada dispositivo en `attendance.biometric_devices`.

---

### LOW-5 — `pwa/src/pages/DashboardPage.tsx` duplica lógica de `base-front`

**Archivos:**
- `pwa/src/pages/dashboard/DashboardPage.tsx`
- `base-front/src/pages/dashboard/DashboardPage.tsx`

**Problema:** El archivo de la PWA parece ser una copia del de base-front (mismas RPCs: `get_daily_attendance_report_v2`, `get_kpi_attendance_by_department`, etc.). Como el `App.tsx` real de la PWA no usa este componente, es código muerto duplicado.

---

### LOW-6 — Breadcrumb de carpeta `supabase/supabase/` en el repo

**Ruta:** `supabase/supabase/functions/attendance-ai-analyze/` (lista en git status)

**Problema:** Hay una carpeta `supabase/supabase/` que contiene funciones, sugiriendo que en algún momento se hizo un `supabase init` dentro de la carpeta `supabase/`. Las edge functions canónicas están en `supabase/functions/`. La duplicación puede causar que el CLI despliegue la versión incorrecta.

---

### LOW-7 — `adms-gateway/src/zkParser.js` no se usa en `src/index.js`

**Archivos:**
- `adms-gateway/src/zkParser.js` — parser ATTLOG con Luxon para conversión de timezone
- `adms-gateway/src/index.js` — parser inline sin Luxon, sin conversión de timezone

**Problema:** `zkParser.js` existe con lógica más robusta (conversión UTC, manejo de separadores) pero `index.js` no lo importa. El parser que realmente se ejecuta es el inline básico de `index.js`.

---

---

## 🔵 CIRA V2.0 — Pendientes técnicos conocidos

### CIRA-1 — Employee UUID truncado en OvertimeRequestsPage y AttendanceReportCiraPage

**Archivos:**
- `base-front/src/pages/cira/OvertimeRequestsPage.tsx` — columna "Empleado"
- `base-front/src/pages/cira/AttendanceReportCiraPage.tsx` — función `employeeName()`

**Situación actual:**
```tsx
// OvertimeRequestsPage — siempre muestra:
<span className="font-mono text-xs text-gray-400">{req.employee_id.slice(0, 8)}…</span>

// AttendanceReportCiraPage:
function employeeName(row: PunchRow): string {
  if (row.employee) return `${row.employee.first_name} ${row.employee.last_name}`
  return `${row.employee_id.slice(0, 8)}…`
}
```

**Por qué se hizo así:** `attendance.overtime_requests` no tiene FK definida hacia `attendance.employees` (tabla creada en sesión C-5 aún no migrada). PostgREST devuelve PGRST200 si se intenta el join sin FK.

**Solución pendiente:** Crear una vista SQL `attendance.v_overtime_requests_named` que haga el JOIN explícito, o agregar la FK al ejecutar la migración C-5. `AttendanceReportCiraPage` ya intenta el join en `punches` (tiene FK real) y muestra nombre completo cuando está disponible.

**Sesión CIRA que lo resuelve:** C-5 (overtime_requests migration + FK).

---

### CIRA-2 — AttendanceReportCiraPage Tab "Resumen del Día" — columna horas sin calcular

**Archivo:** `base-front/src/pages/cira/AttendanceReportCiraPage.tsx` líneas ~195-200

**Situación actual:**
```tsx
<td className="px-4 py-3 text-right text-gray-300 text-xs">
  — pendiente C-3
</td>
```

**Por qué:** La función `attendance.calculate_day_totals(tenant_id, employee_id, date)` no existe aún. Depende de `attendance.classify_work_minute()` y `attendance.labor_regime_config`.

**Solución pendiente:** Sesión C-3 del roadmap CIRA V2.0. Una vez creada la función SQL, reemplazar la celda con llamada RPC y mostrar `normal_h | suplem_h | extra_h | total_usd`.

---

### CIRA-4 — `fine_ledger` y `overtime_requests` sin FK a `employees` — PostgREST join imposible

**Tablas afectadas:**
- `attendance.fine_ledger.employee_id` — sin `REFERENCES attendance.employees(id)`
- `attendance.overtime_requests.employee_id` — sin `REFERENCES attendance.employees(id)`

**Síntoma en el frontend:**
```
PGRST200: Could not find a relationship between 'fine_ledger' and 'employees'
```
Ambas tablas son del roadmap CIRA V2.0 (C-4 y C-5) y fueron diseñadas con `employee_id uuid NOT NULL` pero sin la clave foránea explícita. PostgREST requiere FK declarada para resolver joins automáticos vía `select('employee:employees(first_name, last_name)')`.

**Incompatibilidad con RLS:**
Aunque se creara una vista SQL (`CREATE VIEW v_fine_ledger_named AS SELECT … JOIN employees …`), la vista hereda la RLS de `fine_ledger` pero no la de `employees`. Si las políticas de `employees` filtran por `tenant_id` de forma diferente, el join puede devolver filas vacías o lanzar un error de permisos dependiendo del `security_invoker` de la vista.

**Impacto actual:**
- `FineConfigPage` — historial de multas muestra `employee_id.slice(0,8)…` (UUID truncado).
- `OvertimeRequestsPage` — columna Empleado muestra UUID truncado (ver CIRA-1).
- `AttendanceReportCiraPage` tab Multas — ídem UUID truncado cuando `fine_ledger` exista.

**Solución recomendada al ejecutar migraciones C-4 y C-5:**
```sql
-- En la migración C-4 (fine_ledger):
ALTER TABLE attendance.fine_ledger
  ADD CONSTRAINT fine_ledger_employee_id_fk
  FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE RESTRICT;

-- En la migración C-5 (overtime_requests):
ALTER TABLE attendance.overtime_requests
  ADD CONSTRAINT overtime_requests_employee_id_fk
  FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE RESTRICT;
```
Con las FK declaradas, el join PostgREST funcionará sin cambios en el frontend.

---

### CIRA-3 — Migración 010_cira_labor_regime.sql pendiente de ejecutar en producción

**Archivo:** `supabase/sql_attendance_isolated/010_cira_labor_regime.sql`

**Situación actual:** El archivo SQL está completo (237 líneas) — tablas `labor_regime_config`, `surcharge_rules`, RLS, grants, función `seed_cira_defaults()`. **No ha sido ejecutado** contra la base de datos de producción.

**Acción requerida:**
1. Abrir Supabase Dashboard → SQL Editor.
2. Pegar el contenido de `010_cira_labor_regime.sql` y ejecutar.
3. Ejecutar seed: `select attendance.seed_cira_defaults('4bddfca3-04b4-47f0-bff6-3e3145ec095c');`
4. Verificar: `select * from attendance.labor_regime_config;` → debe devolver 1 fila.
5. Verificar: `select count(*) from attendance.surcharge_rules;` → debe devolver 12 filas (6 por régimen).

**Impacto de no ejecutar:** `LaborRegimeConfigPage` muestra spinner infinito o error al cargar. `FineConfigPage` carga los DEFAULT_CONFIGS del frontend pero no persiste hasta que las tablas existan.

---

## Resumen Ejecutivo

| Categoría | Alta | Media | Baja |
|---|---|---|---|
| Seguridad | SEC-1, SEC-2, SEC-3, SEC-4, SEC-5 | — | LOW-4 |
| Estabilidad | SEC-6, HIGH-4 | MED-1 | — |
| Código muerto / duplicado | HIGH-1, HIGH-2, HIGH-3 | MED-7, MED-8 | LOW-3, LOW-5, LOW-6, LOW-7 |
| Calidad del algoritmo | — | MED-4, MED-5, MED-6 | — |
| Validación de entrada | — | MED-2, MED-3 | — |
| Patrones / arquitectura | — | — | LOW-1, LOW-2 |
| Documentación incorrecta | DOC-1, DOC-2, DOC-4 | DOC-3, DOC-5 | — |

**Acciones inmediatas recomendadas (esta semana):**
1. **SEC-1** — Rotar el Service Role Key y eliminarlo del historial de git.
2. **SEC-2** — Agregar auth check a `smtp-settings` edge function.
3. **SEC-4** — Eliminar el valor por defecto de `API_SECRET`.
4. **HIGH-1/HIGH-2** — Eliminar archivos duplicados y `.bak`.
5. **DOC-1** — Actualizar `FRONTEND.md` con la descripción correcta de la PWA.
