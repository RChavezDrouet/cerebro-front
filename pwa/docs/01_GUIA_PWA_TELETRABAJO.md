# HRCloud Base (Attendance) — PWA Teletrabajo

Guía **paso a paso** para que un desarrollador junior pueda:

1) Crear/actualizar el esquema en Supabase (tablas + RLS + Storage)  
2) Desplegar la Edge Function segura (`attendance-punch`)  
3) Levantar el Frontend PWA localmente y luego en producción  
4) Probar end-to-end (incluye geolocalización + selfie opcional)  

---

## 0) Alcance y arquitectura

**Objetivo:** Marcaciones remotas (teletrabajo) desde web/móvil como **PWA**.

**Principios de seguridad (OWASP):**

- **Inserción atómica server-side** (Edge Function) → evita bypass de reglas y captura IP real.
- **RLS multi-tenant** en tablas y Storage.
- **Anti-abuso** (rate limit) por tabla `punch_attempts`.
- Evidencia mínima: `ip`, `user_agent`, `device_id`, `geo`, `accuracy`.
- Biométrico: **NO** guardar biometría cruda en BD. Guardar **referencias + scores**.

### Diagrama (alto nivel)

Empleado (PWA) → Supabase Auth → Storage (selfie opcional) → Edge Function `attendance-punch` → Tablas (`attendance_punches`, `audit`, `attempts`) → Realtime/Consultas.

---

## 1) Requisitos

- Node.js 18+ / npm 9+
- Cuenta Supabase
- VS Code
- Chrome/Edge

---

## 2) Descargar, descomprimir y abrir

### PowerShell (Windows)

```powershell
# 1) Ir a tu carpeta de trabajo
cd C:\Users\TU_USUARIO\ProyectoRLeon

# 2) Descomprimir
Expand-Archive -Path .\hrcloud-attendance-pwa.zip -DestinationPath .\hrcloud-attendance-pwa -Force

# 3) Entrar al proyecto
cd .\hrcloud-attendance-pwa
```

---

## 3) Supabase — SQL (tablas + RLS + Storage)

1) Supabase → **SQL Editor** → **New Query**
2) Copiar/pegar y ejecutar el script:

- `supabase/001_attendance_system.sql`

### Qué se crea

- `attendance_punches` (marcaciones + geo + evidencia + selfie opcional)
- `attendance_daily_summary` (resumen)
- `attendance_config` (geocerca/tolerancias)
- `attendance_security_settings` (face/liveness + thresholds)
- `punch_attempts` (anti-abuso + intentos fallidos)
- `attendance_audit_log` (auditoría)
- Buckets storage: `employee-photos`, `punch-selfies` + policies owner

> Si tu Base ya trae tabla `employees`, el script añade columnas sin romper compatibilidad.

---

## 4) Supabase — Auth y empleados

### 4.1 Crear usuario (Auth)

Supabase → Authentication → Users → **Add user**

### 4.2 Crear empleado (Table Editor o SQL)

**IMPORTANTE:** Debe existir vínculo entre usuario y empleado. La Edge Function busca por:

1) `employees.user_id = auth.users.id` (recomendado)
2) fallback: `employees.email = auth.email`

Ejemplo:

```sql
INSERT INTO public.employees (
  tenant_id,
  user_id,
  full_name,
  email,
  status,
  telework_enabled,
  geofence_lat,
  geofence_lng,
  geofence_radius
) VALUES (
  'TU-TENANT-ID',
  'AUTH_USER_UUID',
  'Juan Pérez',
  'empleado1@empresa.com',
  'active',
  true,
  -2.897095,
  -79.004530,
  500
);
```

---

## 5) Edge Function — `attendance-punch` (OBLIGATORIO)

La PWA usa `supabase.functions.invoke('attendance-punch')`.

### Opción recomendada: Supabase CLI

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy attendance-punch
```

En Supabase → Project Settings → Functions → **Secrets**, configura:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 6) Frontend — variables de entorno

1) Copiar `.env.example` a `.env.local`
2) Completar:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_MIN_GPS_ACCURACY=50
```

---

## 7) Frontend — levantar local

### PowerShell

```powershell
npm install
npm run dev
```

Abrir: `http://localhost:5173`

---

## 8) Pruebas end-to-end

1) Login
2) Permitir ubicación
3) (Si está habilitado face/liveness) capturar selfie
4) Marcar entrada/salida
5) Verificar en Supabase:

- Table Editor → `attendance_punches`
- Table Editor → `punch_attempts` (rate limit + debugging)
- Table Editor → `attendance_audit_log`

---

## 9) Troubleshooting rápido

### "Se requiere selfie"

- Verifica `attendance_security_settings.face_enabled/liveness_enabled`.
- Asegúrate que el bucket `punch-selfies` existe.

### 401/403 en Edge Function

- Usuario no está logueado o token inválido.
- `employees.user_id` no corresponde al usuario Auth.
- Empleado `status != active` o `telework_enabled = false`.

### 429 Rate limit

- Revisa `punch_attempts` (más de 10 intentos en 60s).

---

## 10) Recomendación Enterprise (siguiente fase)

- Integrar proveedor real (AWS Rekognition Face Liveness + CompareFaces).
- Habilitar CORS estricto en Edge Function.
- SIEM: exportar `attendance_audit_log` y `punch_attempts`.
- WAF/Rate limit adicional a nivel CDN.
