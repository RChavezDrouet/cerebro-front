# HRCloud PWA — Marcación Remota (Rediseño NOVA)

Esta PWA permite que empleados en **teletrabajo** registren **Entrada / Salida / Descanso** con evidencia:
- **Selfie (cámara frontal)** → se guarda en Supabase Storage (bucket `punch-selfies`)
- **GPS (geolocalización + precisión + validación geocerca opcional)**

La app está construida con:
- React + Vite + TypeScript
- Tailwind CSS (con tema NOVA “glass / neon / vanguardia”)
- Supabase (Auth + PostgREST + Storage)
- PWA: `vite-plugin-pwa` (Android/iOS/Windows)

---

## 1) Navegación rápida (lee en este orden)
1. **01_SETUP_LOCAL.md** → correr en local (ultra paso a paso)
2. **02_SUPABASE_PREREQS.md** → tablas/buckets/policies mínimas
3. **03_PWA_INSTALL.md** → instalación como PWA (Android / iOS / Windows)
4. **04_DEPLOY.md** → build y despliegue
5. **05_TROUBLESHOOTING.md** → errores comunes y cómo diagnosticarlos
6. **06_CHECKLIST_QA.md** → checklist para dar “OK” a producción
7. **07_SQL_SCRIPTS.md** → SQL listo (attempts + solicitudes)

---

## 2) Flujo funcional (MVP)

### 2.1 Auth → Perfil → Tenant Gate
1. Usuario inicia sesión con **Supabase Auth** (email/password).
2. La app resuelve:
   - `tenant_id`
   - `employee_id`
   desde `public.profiles` (recomendado) o fallback en `public.employees`.
3. La app lee `public.tenants` para conocer:
   - `name`
   - `status` (ej: `active|paused`)
   - `paused_message`
4. Si `status == paused` → **bloquea** el acceso y muestra el mensaje del tenant.

> Esto implementa el “Tenant Gate” descrito en el proyecto: si el tenant está `paused` desde Cerebro, Base/PWA deben bloquear.

### 2.2 Marcación (Punch) — Flujo requerido (Selfie → BACK Face → GPS → Insert)
1. El usuario presiona **ENTRADA / SALIDA / DESCANSO**.
2. La PWA **captura selfie** (cámara frontal).
3. La PWA sube selfie a Storage (`punch-selfies`).
4. La PWA llama al **backend** (Supabase Edge Function) para **reconocimiento facial**.
   - Si **NO coincide**, la marcación se rechaza y se registra un intento fallido.
5. Si coincide, la PWA recién toma **GPS** (lat/lng/accuracy) y valida geocerca.
6. Se inserta un registro en `attendance.punches` con:
   - `tenant_id`, `employee_id`, `punched_at`, `source='web'`
   - `evidence` (jsonb/text) con evidencia

> Por diseño, el **GPS se captura SOLO si el backend valida el rostro**.

**Ejemplo de evidence recomendado:**
```json
{
  "action": "clock_in",
  "notes": "texto opcional",
  "geo": {
    "lat": -2.12,
    "lng": -79.90,
    "accuracy_m": 12,
    "distance_m": 8,
    "in_range": true
  },
  "selfie": { "bucket": "punch-selfies", "path": "tenant/employee/yyyy-mm-dd/uuid.jpg" },
  "face": { "provider": "face-verify", "match": true, "score": 0.91, "threshold": 0.6 },
  "device": { "device_id": "...", "ua": "...", "tz": "America/Guayaquil" }
}
```

### 2.3 Intentos fallidos (Punch Attempts)
Si existe la tabla `attendance.punch_attempts`, la PWA registra fallos como:
- rostro no coincide (`step='face'`)
- GPS inválido / baja precisión / fuera de geocerca (`step='gps'`)
- error de insert (`step='insert'`)

Esto permite mostrar en la UI: **Marcaciones OK** y **Fallidas**.

### 2.4 Solicitudes (MVP)
Se agrega pestaña **SOLICITUD**:
- Crear solicitud (tipo, asunto, detalle)
- Ver estado (seguimiento) desde tabla `attendance.employee_requests`

---

## 3) Estructura del código (dónde tocar qué)
- `src/hooks/useAuth.ts`:
  - login
  - resuelve `tenant_id` y `employee_id`
  - carga `tenant_status` y `tenant_paused_message`
- `src/hooks/useAttendance.ts`:
  - usa settings locales (env/defaults) para NO depender de tablas inexistentes
  - obtiene GPS
  - inserta punches (tabla `attendance.punches`)
- `src/pages/ClockInPage.tsx`:
  - UI principal de marcación
  - modal selfie + upload
  - llama `attendance.clockIn/clockOut/breakStart/breakEnd`
- `src/components/FaceCaptureModal.tsx`:
  - cámara + guía visual + captura
- `vite.config.ts`:
  - PWA manifest + caching
- `index.html`:
  - meta tags PWA + iOS

---

## 4) Regla de oro para ZIP / Git
✅ **NO** subir `node_modules/`, `dist/`, `.vite/`, `.env.local`

✅ Solo:
- `src/`, `public/`, `index.html`, `package.json`, configs, `docs/`

