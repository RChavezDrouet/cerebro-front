# Guía paso a paso para desarrollador junior

## Objetivo

Levantar la nueva API administrativa biométrica sin romper el gateway actual de marcaciones.

---

## Parte 1 - Qué vas a tener al final

Al finalizar tendrás:

1. El `adms-gateway` actual funcionando para marcaciones.
2. Nuevas tablas en Supabase para jobs y auditoría biométrica.
3. La nueva `biometric-admin-api` corriendo en local.
4. Endpoints listos para pruebas.
5. Un proveedor ZKTeco mock listo para cambiar por uno real.

---

## Parte 2 - Prerrequisitos

Instala primero:

- Python 3.11 o superior
- VS Code
- Git
- acceso al proyecto Supabase
- clave `SUPABASE_SERVICE_ROLE_KEY`

Verifica Python:

```bash
python --version
```

---

## Parte 3 - Estructura del paquete

```text
hrcloud_biometric_bundle/
├── adms-gateway/
├── biometric-admin-api/
├── sql/
├── docs/
└── scripts/
```

---

## Parte 4 - Mantener el gateway actual

No reescribas todavía `adms-gateway/app.py`.

Ese archivo ya cumple el rol correcto:

- recibe `GET /iclock/getrequest`
- recibe `POST /iclock/cdata`
- registra `biometric_raw`
- registra `punches`

Este servicio debe seguir separado de la nueva API administrativa.

---

## Parte 5 - Crear tablas en Supabase

### Paso 5.1
Abre Supabase SQL Editor.

### Paso 5.2
Ejecuta en este orden:

1. `sql/001_biometric_admin_tables.sql`
2. `sql/002_seed_example_devices.sql` (opcional y editando UUIDs)
3. `sql/003_rls_notes.sql`

### Paso 5.3
Verifica que existan las tablas:

- `attendance.biometric_sync_jobs`
- `attendance.biometric_sync_job_items`
- `attendance.biometric_device_users`
- `attendance.biometric_audit_log`

---

## Parte 6 - Configurar la nueva API

### Paso 6.1
Entra a la carpeta:

```bash
cd biometric-admin-api
```

### Paso 6.2
Crea entorno virtual:

```bash
python -m venv .venv
```

### Paso 6.3
Activa entorno virtual.

#### En Windows PowerShell

```powershell
.\.venv\Scripts\Activate.ps1
```

#### En CMD

```cmd
.venv\Scripts\activate.bat
```

### Paso 6.4
Instala dependencias:

```bash
pip install -r requirements.txt
```

### Paso 6.5
Copia `.env.example` a `.env`

#### Windows PowerShell

```powershell
copy .env.example .env
```

### Paso 6.6
Edita `.env` y llena:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_PORT`

Por ahora deja:

```env
ENABLE_MOCK_PROVIDER=true
```

Eso permite probar todo sin SDK real.

---

## Parte 7 - Levantar la API localmente

Ejecuta:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8090
```

Si todo salió bien, abre:

- `http://localhost:8090/`
- `http://localhost:8090/docs`

---

## Parte 8 - Probar endpoints

## 8.1 Listar dispositivos del tenant

```http
GET /api/v1/biometric/devices?tenant_id=TU_TENANT_ID
```

## 8.2 Health check de un dispositivo

```http
GET /api/v1/biometric/devices/{device_id}/health
```

## 8.3 Leer usuarios del dispositivo

```http
GET /api/v1/biometric/devices/{device_id}/users
```

Con el mock activo debe devolverte un usuario demo.

## 8.4 Crear job pull users

```json
POST /api/v1/biometric/jobs/pull-users
{
  "tenant_id": "TU_TENANT_ID",
  "device_id": "TU_DEVICE_ID",
  "created_by": "raul@empresa.com"
}
```

## 8.5 Crear job de traslado réplica

```json
POST /api/v1/biometric/jobs/transfer
{
  "tenant_id": "TU_TENANT_ID",
  "source_device_id": "DEVICE_A",
  "target_device_id": "DEVICE_B",
  "employee_ids": ["EMPLOYEE_UUID_1", "EMPLOYEE_UUID_2"],
  "mode": "replica",
  "created_by": "raul@empresa.com"
}
```

## 8.6 Crear job de traslado excluyente

```json
POST /api/v1/biometric/jobs/transfer
{
  "tenant_id": "TU_TENANT_ID",
  "source_device_id": "DEVICE_A",
  "target_device_id": "DEVICE_B",
  "employee_ids": ["EMPLOYEE_UUID_1"],
  "mode": "exclusive",
  "created_by": "raul@empresa.com"
}
```

## 8.7 Ver resultado del job

```http
GET /api/v1/biometric/jobs/{job_id}
GET /api/v1/biometric/jobs/{job_id}/items
```

---

## Parte 9 - Qué hace el mock y qué no hace

### Sí hace
- permite probar la API
- genera jobs
- guarda items
- escribe auditoría
- simula lectura y traslado

### No hace todavía
- conectarse físicamente al biométrico
- leer huellas reales
- escribir foto real
- borrar usuarios reales

---

## Parte 10 - Cómo pasar de mock a integración real ZKTeco

Abre este archivo:

```text
biometric-admin-api/app/providers/zkteco_provider.py
```

Métodos a reemplazar:

- `list_users()`
- `create_or_update_user()`
- `delete_user()`

### Estrategia recomendada

1. Identifica el canal real del modelo ZKTeco:
   - ADMS push
   - API REST
   - SDK local
   - import/export masivo
2. Si el equipo no soporta escritura remota real, usa flujo mixto:
   - Base genera plantilla
   - operador importa en software/herramienta oficial
   - la API registra job y auditoría
3. Si existe SDK/API estable, encapsúlalo dentro del provider.

No metas lógica del proveedor directamente en rutas ni en servicios.

---

## Parte 11 - Integración con Base Frontend

Base no debe hablar directo con el biométrico.

Base solo debe consumir esta API:

- listado de biométricos
- health
- usuarios del equipo
- crear jobs
- revisar jobs
- conciliación

---

## Parte 12 - Despliegue sugerido

## API administrativa

Puedes desplegarla en DigitalOcean como servicio separado.

Variables mínimas:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_PORT=8090`
- `ENABLE_MOCK_PROVIDER=false` cuando ya tengas integración real

Comando sugerido:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

## Gateway ADMS

Mantenerlo como servicio separado en 8080.

---

## Parte 13 - Checklist de validación

Antes de pasar a frontend, revisa:

- [ ] El gateway sigue recibiendo marcaciones
- [ ] Las tablas nuevas existen
- [ ] `GET /biometric/devices` responde
- [ ] `GET /devices/{id}/health` responde
- [ ] `GET /devices/{id}/users` responde
- [ ] `POST /jobs/pull-users` crea job
- [ ] `POST /jobs/transfer` crea job
- [ ] `GET /jobs/{id}` muestra resumen
- [ ] `GET /jobs/{id}/items` muestra detalle
- [ ] `attendance.biometric_audit_log` guarda trazabilidad

---

## Parte 14 - Qué mejorar después

Siguiente iteración recomendada:

1. autenticación JWT para la nueva API
2. validación de permisos por rol
3. cola asíncrona real para jobs largos
4. conciliación real Base vs dispositivo
5. importación XLSX/CSV desde endpoint
6. proveedor ZKTeco real por modelo/firmware
7. endpoint de enrolamiento individual completo
8. dashboard de errores y transferencias parciales
