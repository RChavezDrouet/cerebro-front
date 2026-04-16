# TIMEFACE.md — app_face_v2.py

Servicio de verificación facial para marcaciones de asistencia. Funciona como un microservicio Python independiente que recibe selfies, las compara contra la foto de referencia del empleado almacenada en Supabase Storage, y actualiza el resultado en la tabla `attendance.punch_evidence`.

---

## Propósito

Cuando un empleado marca asistencia desde la PWA o un dispositivo ZKTeco, el sistema genera un registro de evidencia en `attendance.punch_evidence` con estado `pending`. Este servicio toma esa evidencia, descarga la selfie, descarga la foto de referencia del empleado, ejecuta comparación facial de 2 capas, y actualiza el estado a `verified`, `rejected`, `failed`, o `error`.

**Casos de uso:**
1. **Marcación web/PWA** — empleado toma selfie desde el navegador → `/verify-pwa`
2. **Verificación asíncrona** — un cron o evento externo dispara `/process-pending` para procesar cola de evidencias pendientes
3. **Llamada directa** — la Edge Function `face-verify` llama a `/verify` pasando un `evidence_id` específico

---

## Dependencias

### Python packages (`requirements.txt` implícito)

| Paquete | Uso |
|---|---|
| `flask` | Servidor HTTP (endpoints REST) |
| `flask-cors` | Cabeceras CORS |
| `opencv-python` (cv2) | Haar Cascade + LBPH face recognition |
| `numpy` | Conversión de bytes a array de imagen |
| `requests` | Llamadas HTTP a Supabase REST API y Storage |

### Modelos y archivos de OpenCV

| Archivo | Origen | Propósito |
|---|---|---|
| `haarcascade_frontalface_default.xml` | Incluido en `cv2.data.haarcascades` | Detección de rostros frontales (Capa 1) |
| `cv2.face.LBPHFaceRecognizer` | Módulo `opencv-contrib-python` | Comparación de patrones faciales (Capa 2) |

> **Importante:** Se requiere `opencv-contrib-python`, no solo `opencv-python`, porque `cv2.face.LBPHFaceRecognizer_create()` pertenece al módulo extra `opencv-contrib`.

---

## Algoritmo de Reconocimiento Facial

El servicio implementa un pipeline de **2 capas** secuenciales. Si cualquier capa falla, el proceso se detiene y actualiza la evidencia con el motivo del rechazo.

### Flujo completo paso a paso

```
Entrada: evidence_id, tenant_id, employee_id, selfie_bucket, selfie_path

PASO 1 — Descarga de selfie
  download_image(selfie_bucket, selfie_path)
  → GET /storage/v1/object/{bucket}/{path}  (Supabase Storage, service role)
  → np.frombuffer(bytes) → cv2.imdecode → imagen BGR
  ✗ Falla → update_evidence('error', 'No se pudo descargar la selfie') → return

PASO 2 — Control de calidad de imagen
  check_quality(selfie_img):
    gray = cv2.cvtColor(BGR → GRAY)
    brightness = gray.mean()
    checks:
      brightness < 40  → 'Imagen muy oscura'
      brightness > 230 → 'Imagen sobreexpuesta'
      width  < 80      → 'Resolución muy baja'
      height < 80      → 'Resolución muy baja'
  ✗ Tiene issues → update_evidence('failed', 'Calidad insuficiente: ...') → return

PASO 3 — CAPA 1: Detección de rostro (Haar Cascade)
  detect_face(selfie_img):
    gray = cv2.cvtColor(BGR → GRAY)
    gray = cv2.equalizeHist(gray)       ← ecualización de histograma (mejora contraste)
    faces = face_cascade.detectMultiScale(
      scaleFactor=1.1,
      minNeighbors=5,
      minSize=(60, 60)
    )
    Si múltiples rostros → tomar el de mayor área (max by w*h)
    Recortar región del rostro → redimensionar a 150×150 px (escala gris)
  ✗ Sin rostro → update_evidence('rejected', 'No se detectó rostro en la selfie') → return
  ✓ Rostro detectado → selfie_face (array 150×150 gris)

PASO 4 — Obtención de foto de referencia
  get_employee_photo(tenant_id, employee_id):
    GET /rest/v1/employees?select=photo_path&id=eq.{employee_id}&tenant_id=eq.{tenant_id}
    (attendance schema via Accept-Profile: attendance)
    → photo_path (ruta en bucket 'employee_photos')
  ✗ Sin foto → update_evidence('failed', 'Empleado sin foto de referencia') → return

PASO 5 — Descarga de foto de referencia
  download_image('employee_photos', photo_path)
  ✗ Falla → update_evidence('failed', 'No se pudo descargar foto de referencia') → return

PASO 6 — Detección de rostro en referencia
  detect_face(ref_img)  ← mismo algoritmo Haar Cascade
  ✗ Sin rostro detectable → usar imagen completa redimensionada a 150×150 (fallback)
    (se registra warning pero NO falla el proceso)

PASO 7 — CAPA 2: Comparación LBPH
  compare_lbph(ref_face, selfie_face):
    recognizer = cv2.face.LBPHFaceRecognizer_create(
      radius=1, neighbors=8, grid_x=8, grid_y=8
    )
    recognizer.train([ref_face], labels=[0])
    label, confidence = recognizer.predict(selfie_face)
    score = max(0.0, 1.0 - (confidence / 150.0))
    → (score: float 0.0–1.0, lbph_conf: float raw LBPH distance)

PASO 8 — Decisión
  match = score >= THRESHOLD    (default THRESHOLD = 0.75)
  status = 'verified' si match, 'rejected' si no
  notes  = "score=X.XXX threshold=0.75 lbph_conf=XX.X layer=2"
  update_evidence(evidence_id, status, notes)

SALIDA: {match, score, lbph_confidence, threshold, elapsed_s, layer}
```

### Interpretación del score LBPH

LBPH retorna una **distancia** (0 = idéntico, mayor = más diferente). La conversión a score es:

```
score = 1.0 - (lbph_confidence / 150.0)
```

| lbph_confidence | score | Interpretación |
|---|---|---|
| 0 | 1.00 | Imagen idéntica |
| 37.5 | 0.75 | Umbral por defecto (match) |
| 75 | 0.50 | Coincidencia débil |
| 150+ | ≤ 0.00 | Sin coincidencia |

El umbral predeterminado (`FACE_THRESHOLD=0.75`) corresponde a una distancia LBPH de ≤ 37.5. Puede ajustarse por entorno con la variable `FACE_THRESHOLD`.

### Parámetros LBPH

| Parámetro | Valor | Efecto |
|---|---|---|
| `radius=1` | Vecindario local de 1 px | Captura patrones de textura finos |
| `neighbors=8` | 8 puntos en el círculo | Resolución del descriptor LBP |
| `grid_x=8, grid_y=8` | 8×8 = 64 regiones | Divide el rostro en 64 celdas; cada celda genera un histograma |

---

## Conexión con Supabase

### Autenticación

Todas las peticiones usan el **Service Role Key** (`SUPABASE_SERVICE_KEY`). Este key bypasea RLS, necesario porque el servicio actúa en nombre del sistema, no de un usuario autenticado.

### Targeting del schema `attendance`

Las peticiones REST al schema `attendance` incluyen cabeceras:
```
Accept-Profile: attendance
Content-Profile: attendance
```

Las peticiones a Storage no requieren estas cabeceras (Storage es independiente de esquemas).

### Tablas y operaciones

| Tabla | Schema | Operación | Cuándo | Campos |
|---|---|---|---|---|
| `employees` | `attendance` | SELECT | Paso 4: obtener `photo_path` | `photo_path` WHERE `id=employee_id AND tenant_id=tenant_id` |
| `punch_evidence` | `attendance` | SELECT | `/verify-pwa`: buscar evidencia pendiente del empleado | `id` WHERE `employee_id, tenant_id, verification_status=pending` ORDER BY `created_at` DESC LIMIT 1 |
| `punch_evidence` | `attendance` | SELECT | `/process-pending`: listar hasta 50 pendientes | `id, tenant_id, employee_id, selfie_bucket, selfie_path` WHERE `verification_status=pending` |
| `punch_evidence` | `attendance` | PATCH | Todos los flujos: escribir resultado | `verification_status, verification_notes, verified_at` WHERE `id=evidence_id` |

### Storage buckets

| Bucket | Acceso | Uso |
|---|---|---|
| `employee_photos` | Privado (service role) | Foto de referencia del empleado (subida desde base-front) |
| `punch-selfies` | Privado (service role) | Selfie de la marcación (subida desde PWA) |

URL de descarga: `{SUPABASE_URL}/storage/v1/object/{bucket}/{path}`

### Estados de `verification_status` en `punch_evidence`

| Estado | Significado | Cuándo se asigna |
|---|---|---|
| `pending` | Sin procesar | Estado inicial (asignado por PWA o Edge Function) |
| `verified` | Rostro verificado, score ≥ threshold | LBPH match positivo |
| `rejected` | Rostro no coincide o no detectado | Sin rostro en selfie / score < threshold |
| `failed` | Error de calidad o falta de referencia | Imagen muy oscura/pequeña, empleado sin foto |
| `error` | Error técnico | No se pudo descargar la selfie |

---

## Integración con Dispositivos ZKTeco

Los dispositivos ZKTeco con reconocimiento facial (`verify_type=15`) generan marcaciones con método `RECONOCIMIENTO_FACIAL`. El flujo de verificación facial para estos dispositivos es:

```
ZKTeco device
  → POST /iclock/cdata (adms-gateway)
  → adms-gateway INSERT attendance.biometric_raw (raw log)
  → adms-gateway INSERT attendance.punches (punch con auth_method='RECONOCIMIENTO_FACIAL')

[La evidencia facial para marcaciones ZKTeco es gestionada por la Edge Function face-verify]

Edge Function 'face-verify' (Supabase):
  → SELECT punch_evidence WHERE punch_id=... AND verification_status='pending'
  → POST {FACE_VERIFY_SERVICE_URL}/verify
       { secret, evidence_id, tenant_id, employee_id, selfie_path, selfie_bucket }
  ← { match, score, threshold, layer }
  → UPDATE punches.verified_at si match=true
```

Para **marcaciones desde PWA** (selfie en vivo), el flujo difiere levemente:

```
Employee en PWA
  → Captura selfie → sube a Storage 'punch-selfies'
  → INSERT attendance.punches (source='WEB')
  → INSERT attendance.punch_evidence (verification_status='pending', selfie_path=...)
  → POST face-verify Edge Function O directo a /verify-pwa
  ← {match, score}
  → Si match=false → alerta al empleado pero el punch ya fue registrado
    (política: no bloquear marcación, verificar post-hoc)
```

---

## Endpoints de la API

### `GET /health`

Sin autenticación. Probe de salud.

**Respuesta `200`:**
```json
{
  "status": "ok",
  "service": "hrcloud-face-verify",
  "version": "2.0",
  "algorithm": "HaarCascade+LBPH",
  "threshold": 0.75
}
```

---

### `POST /verify`

Verificación directa por `evidence_id`. Llamado por la Edge Function `face-verify`.

**Autenticación:** campo `secret` en el body (shared secret, variable `API_SECRET`).

**Request body:**
```json
{
  "secret": "hrcloud-face-2026",
  "evidence_id": "uuid",
  "tenant_id": "uuid",
  "employee_id": "uuid",
  "selfie_path": "tenant_id/employee_id/timestamp.jpg",
  "selfie_bucket": "punch-selfies"
}
```

**Respuesta exitosa `200`:**
```json
{
  "match": true,
  "score": 0.812,
  "lbph_confidence": 27.9,
  "threshold": 0.75,
  "elapsed_s": 0.843,
  "layer": 2
}
```

**Respuesta con rechazo `200`:**
```json
{
  "match": false,
  "reason": "No se detectó rostro en la selfie",
  "layer": 1
}
```

**Errores:**
- `401` — secret inválido
- `400` — campos requeridos faltantes

---

### `POST /verify-pwa`

Verificación desde PWA. Busca automáticamente la evidencia pendiente más reciente del empleado.

**Autenticación:** campo `secret`.

**Request body:**
```json
{
  "secret": "hrcloud-face-2026",
  "tenant_id": "uuid",
  "employee_id": "uuid",
  "selfie": {
    "path": "tenant_id/employee_id/timestamp.jpg",
    "bucket": "punch-selfies"
  }
}
```

**Respuesta `200`:**
```json
{
  "match": true,
  "score": 0.831,
  "threshold": 0.75,
  "provider": "hrcloud-face-v2",
  "reason": null,
  "layer": 2
}
```

**Fallback si no hay evidencia pendiente:**
```json
{
  "match": true,
  "score": null,
  "provider": "fallback_allow",
  "reason": "No pending evidence"
}
```
> El fallback permite la marcación si no hay evidencia pendiente (política permisiva). Esto evita bloquear al empleado por un error de sincronización.

---

### `POST /process-pending`

Procesa por lotes hasta 50 evidencias pendientes. Diseñado para ser llamado por un cron o tarea programada.

**Autenticación:** campo `secret`.

**Request body:**
```json
{ "secret": "hrcloud-face-2026" }
```

**Respuesta `200`:**
```json
{
  "processed": 3,
  "results": [
    { "id": "uuid-1", "result": { "match": true, "score": 0.81, "layer": 2 } },
    { "id": "uuid-2", "result": { "match": false, "reason": "No se detectó rostro", "layer": 1 } },
    { "id": "uuid-3", "error": "Timeout connecting to Supabase" }
  ]
}
```

---

## Variables de Entorno

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `SUPABASE_URL` | Sí | — | URL del proyecto Supabase (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Sí | — | Service Role Key (bypasea RLS). No exponer en frontend. |
| `API_SECRET` | No | `hrcloud-face-2026` | Shared secret para autenticar llamadas al servicio |
| `FACE_THRESHOLD` | No | `0.75` | Score mínimo para considerar match (0.0–1.0) |
| `PORT` | No | `5001` | Puerto HTTP del servidor Flask |

---

## Requisitos de Despliegue

### Requisitos del sistema

| Requisito | Mínimo | Recomendado |
|---|---|---|
| Python | 3.9+ | 3.11+ |
| RAM | 256 MB | 512 MB (por carga de imágenes en memoria) |
| CPU | 1 vCPU | 2 vCPU (LBPH es CPU-bound) |
| Almacenamiento | 200 MB (OpenCV models) | 500 MB |

### Instalación

```bash
# Instalar dependencias del sistema (Ubuntu/Debian)
apt-get install -y libglib2.0-0 libsm6 libxrender1 libxext6

# Instalar dependencias Python
pip install flask flask-cors requests numpy opencv-contrib-python-headless

# Verificar que LBPH esté disponible
python -c "import cv2; r = cv2.face.LBPHFaceRecognizer_create(); print('LBPH OK')"
```

> **Nota crítica:** En entornos sin pantalla (servidores, Docker) usar `opencv-contrib-python-headless` en lugar de `opencv-contrib-python` para evitar dependencias de GUI (GTK, Qt).

### Ejecución local

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_KEY=<service_role_key>
export API_SECRET=mi-secreto-seguro
export FACE_THRESHOLD=0.75
export PORT=5001

python app_face_v2.py
```

### Ejecución con Gunicorn (producción)

```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:${PORT:-5001} --timeout 60 app_face_v2:app
```

> Usar 2 workers máximo. LBPH carga el clasificador por worker — más workers = más RAM. El timeout debe ser ≥ 30s para cubrir descarga de imágenes + inferencia.

### Dockerfile (referencia)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY app_face_v2.py .
RUN pip install --no-cache-dir \
    flask flask-cors requests numpy \
    opencv-contrib-python-headless gunicorn

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5001", "--timeout", "60", "app_face_v2:app"]
```

### Despliegue en DigitalOcean App Platform

El servicio se despliega como un componente separado (Worker o Web Service) en la misma App del monorepo:

```yaml
# En la configuración del App Platform
- name: face-verify
  source_dir: /
  run_command: gunicorn -w 2 -b 0.0.0.0:$PORT --timeout 60 app_face_v2:app
  environment_slug: python
  envs:
    - key: SUPABASE_URL
      value: <secret>
    - key: SUPABASE_SERVICE_KEY
      value: <secret>
    - key: API_SECRET
      value: <secret>
    - key: FACE_THRESHOLD
      value: "0.75"
```

---

## Limitaciones y Consideraciones

| Tema | Detalle |
|---|---|
| **Seguridad del secret** | `API_SECRET` se pasa en el body (no en header). Considerar mover a `Authorization: Bearer` en producción. |
| **Sin anti-spoofing** | El algoritmo no detecta fotos de fotos (ataques de presentación). Para mayor seguridad, reemplazar con DeepFace+AntiSpoofing (ver `base-front/face-service/.env.example`). |
| **Concurrencia** | LBPH es stateless por llamada pero carga el modelo en cada `compare_lbph()`. Con alto volumen, considerar cachear el recognizer. |
| **Calidad de referencia** | Si la foto de referencia del empleado no tiene rostro detectable, el servicio usa la imagen completa como referencia (fallback con warning). La precisión baja considerablemente. |
| **Threshold por tenant** | El umbral es global (variable de entorno). Una mejora futura sería per-tenant via `attendance.settings`. |
| **Versión alternativa** | `base-front/face-service/` contiene una versión más avanzada con DeepFace + ArcFace + RetinaFace. `app_face_v2.py` es la versión ligera de producción sin dependencias pesadas. |
