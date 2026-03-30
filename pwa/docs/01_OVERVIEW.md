# HRCloud Base – Marcaciones Web (PWA) – Handoff técnico

Este PWA registra marcaciones de empleados remotos en **Supabase** y queda visible en el **reporte de Base** (que ya consume `attendance.v_punch_report`).

## Qué hace este PWA (estado actual)

1) Login con Supabase Auth.
2) Resuelve `tenant_id` y `employee_id` para el usuario autenticado (preferente desde `public.profiles`).
3) En cada marcación:
   - Captura **geolocalización** (lat/lng/accuracy/timestamp).
   - Valida **geocerca** contra el punto remoto del empleado (lat/lng) y el radio máximo configurado por tenant (`attendance.web_settings.geo_max_m`).
   - Captura **selfie** (cámara frontal), la sube a Storage (`punch-selfies`) y guarda el path.
   - Inserta el evento en **`attendance.punches`**, con `source='web'` y evidencia completa dentro de `evidence` (jsonb).
4) El historial del PWA lee desde `attendance.punches` y muestra el `action` desde `evidence.action`.

> Nota: La **comparación facial** (score real contra foto del empleado) quedó como **MVP “selfie obligatoria”**. La estructura ya deja `evidence.face` para que puedas conectar un proveedor (AWS Rekognition / Face API / face-api.js) sin cambiar el contrato hacia Base.

---

## Requisitos de Base para que el PWA funcione sin hacks

### 1) Resolver tenant/employee del usuario

El PWA asume la tabla:

- `public.profiles` con:
  - `id` (uuid) = `auth.users.id`
  - `tenant_id` (uuid)
  - `employee_id` (uuid)  ← **clave para RLS y punches**
  - `full_name` (text, opcional)

Si `employee_id` no existe, el PWA intenta un fallback a `public.employees.user_id`.

### 2) Geocerca: punto remoto del empleado

El PWA usa en el perfil (fallback) los campos:

- `employees.geofence_lat`
- `employees.geofence_lng`

> En tu requerimiento lo llamas “georeferenciación de donde el empleado hace el trabajo remoto”. Puedes mantener estos nombres o crear `remote_lat/remote_lng` y mapear en el resolver.

### 3) Storage bucket

Crear bucket:

- `punch-selfies`

y permitir upload autenticado (policy en Storage).

---

## Tablas / SQL necesarias (MVP)

Ejecuta el archivo:

- `supabase/001_web_settings.sql`

Esto crea `attendance.web_settings` para configurar:

- geo_enabled
- geo_max_m (ej. 400)
- face_enabled
- face_threshold

---

## Contrato de datos: qué se inserta en attendance.punches

Campos principales:

- tenant_id
- employee_id
- punched_at (timestamptz)
- source = 'web'
- status = 0 (MVP)
- verification = 15 si hubo selfie requerida (MVP)
- evidence (jsonb):

```json
{
  "action": "clock_in",
  "device_id": "...",
  "ua": "...",
  "online": true,
  "geo": {
    "lat": -2.18,
    "lng": -79.9,
    "accuracy_m": 12,
    "timestamp": 1700000000,
    "base_lat": -2.18,
    "base_lng": -79.9,
    "max_m": 400,
    "distance_m": 53,
    "in_range": true
  },
  "selfie": { "bucket": "punch-selfies", "path": "<tenant>/<employee>/<yyyy-mm-dd>/<uuid>.jpg" },
  "face": { "match": true, "score": null, "threshold": 0.6, "provider": "selfie_only_mvp" },
  "notes": "..."
}
```

Base puede mostrar:

- Coordenadas
- Distancia
- `in_range`
- Link a la selfie (si haces `getPublicUrl` o sirves vía signed URL)

---

## Cómo correr el PWA

1) En la carpeta `pwa/`:

```bash
npm install
npm run dev
```

2) Configurar `.env` (ver `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Opcionales:

- `VITE_GEO_MAX_METERS`
- `VITE_MIN_GPS_ACCURACY`
- `VITE_FACE_THRESHOLD`

---

## Próximo paso recomendado (Face Match REAL)

Tienes dos caminos “enterprise”:

### Opción A (recomendada): Edge Function `attendance-punch`

- Recibe selfie (signed URL / path)
- Descarga selfie + foto del empleado
- Llama a AWS Rekognition `CompareFaces`
- Calcula score y decide `match=true/false`
- Inserta punch con `service_role` y auditoría + rate-limit

### Opción B: face-api.js local

- Almacenas el embedding del empleado al enrolar su foto (en Base)
- En PWA calculas embedding de selfie y comparas con umbral

---

## Cambios solicitados en Base (pendientes)

En el **CRUD de Empleados**:

- Subir Foto (Storage + `photo_path`)
- Guardar georeferencia del trabajo remoto (lat/lng)
- Selección de modalidad: `presencial | remoto | mixto`
- Si `mixto`: calendario emergente con fechas presenciales y turno asociado

En **Configuración de asistencia** (por tenant):

- Umbral / tolerancia face match
- Radio máximo permitido (metros)

