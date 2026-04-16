# HRCloud — Monorepo

Sistema SaaS multi-tenant de gestión de Recursos Humanos y control de asistencia. Integra dispositivos biométricos ZKTeco, reconocimiento facial, marcación web/móvil con GPS y selfie, y un panel administrativo por capas.

---

## Visión General

HRCloud opera en dos capas:

1. **Capa SaaS (Cerebro)** — administrada por el proveedor del software. Gestiona clientes (tenants), facturación, planes y configuración global.
2. **Capa Tenant (Base + PWA)** — usada por cada empresa cliente. Gestiona empleados, turnos, asistencia, reportes y configuración organizacional.

```
Proveedor HRCloud
  └── cerebro-front     Panel SaaS: clientes, facturación, ajustes globales

Empresa cliente (tenant)
  └── base-front        Panel HR: empleados, asistencia, configuración
  └── pwa               App móvil empleado: marcar entrada/salida con GPS + selfie

Infraestructura
  └── supabase/         Base de datos, autenticación, edge functions, storage
  └── adms-gateway      Receptor HTTP para dispositivos biométricos ZKTeco
  └── app_face_v2.py    Servicio de verificación facial (Haar Cascade + LBPH)
```

---

## Subproyectos

| Subproyecto | Tipo | Tecnología | Propósito |
|---|---|---|---|
| [`cerebro-front/`](#cerebro-front) | Frontend SaaS | React + Vite 4 | Panel del proveedor: clientes, facturación, ajustes |
| [`base-front/`](#base-front) | Frontend Tenant | React + Vite 5 + TanStack Query | Panel HR del cliente: empleados, asistencia, reportes |
| [`pwa/`](#pwa) | PWA Móvil | React + Vite 5 + PWA | App del empleado: marcar asistencia con GPS y selfie |
| [`adms-gateway/`](#adms-gateway) | Backend Gateway | Python/Flask + Node.js/Express | Receptor iClock para dispositivos ZKTeco |
| [`app_face_v2.py`](#face-verify) | Microservicio IA | Python + OpenCV | Verificación facial Haar Cascade + LBPH |
| [`supabase/`](#supabase) | Base de datos | PostgreSQL + Deno | Migraciones, edge functions, RLS, Storage |

---

## Stack Tecnológico

| Categoría | Tecnología | Versión |
|---|---|---|
| Frontend framework | React | 18.3 |
| Build tool | Vite | 4.x (cerebro) / 5.x (base, pwa) |
| Lenguaje frontend | TypeScript | 5.6 |
| CSS | Tailwind CSS | 3.4 |
| State management | TanStack Query v5 (base/pwa) · useState (cerebro) | — |
| State client | Zustand v5 (base/pwa) | — |
| Formularios | React Hook Form + Zod | — |
| Gráficas | Recharts (cerebro) | 2.10 |
| Backend DB | PostgreSQL (Supabase) | 17 |
| Auth | Supabase Auth (JWT) | — |
| Edge functions | Deno (TypeScript) | 2.x |
| Storage | Supabase Storage | — |
| Gateway biométrico | Python/Flask ó Node.js/Express | — |
| IA facial | OpenCV (Haar + LBPH) | 4.x |
| Despliegue | DigitalOcean App Platform | — |

---

## Prerrequisitos

### Generales

| Herramienta | Versión mínima | Uso |
|---|---|---|
| Node.js | 20.x | cerebro-front, base-front, pwa, adms-gateway (JS) |
| npm | 9.x | Gestión de dependencias JS |
| Python | 3.9+ | adms-gateway (Flask), app_face_v2.py |
| pip | — | Dependencias Python |
| Supabase CLI | 2.x | Migraciones, edge functions locales |
| Git | — | Control de versiones |

### Servicios externos

| Servicio | Obligatorio | Uso |
|---|---|---|
| Proyecto Supabase | Sí | Base de datos, auth, storage, edge functions |
| DigitalOcean App Platform | Para producción | Despliegue de todos los subproyectos |
| Google Gemini API | Opcional | Edge function `attendance-ai-analyze` |

---

## Estructura del Repositorio

```
ProyectoRLeon/
├── cerebro-front/          Panel SaaS del proveedor
├── base-front/             Panel HR del cliente
├── pwa/                    App móvil del empleado
├── adms-gateway/           Gateway biométrico ZKTeco
├── app_face_v2.py          Servicio de verificación facial
├── supabase/               Infraestructura backend
│   ├── migrations/         Migraciones SQL ordenadas
│   ├── functions/          11 edge functions Deno/TypeScript
│   ├── seed.sql            Datos iniciales
│   └── config.toml         Configuración local Supabase
├── docs/                   Documentación técnica
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── BACKEND.md
│   ├── FRONTEND.md
│   └── TIMEFACE.md
├── ARCHITECTURE.md         Diagrama de arquitectura general
└── README.md               Este archivo
```

---

## Configuración Inicial

### 1. Clonar el repositorio

```bash
git clone <repo-url> ProyectoRLeon
cd ProyectoRLeon
```

### 2. Configurar Supabase local

```bash
# Instalar CLI de Supabase (si no está instalado)
npm install -g supabase

# Iniciar servicios locales (Docker requerido)
cd supabase
supabase start

# Aplicar migraciones
supabase db push

# La CLI mostrará:
# API URL:     http://127.0.0.1:54321
# DB URL:      postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Studio URL:  http://127.0.0.1:54323
# Anon Key:    eyJ...
# Service Key: eyJ...
```

---

## Ejecución Local por Subproyecto

### cerebro-front

Panel SaaS del proveedor HRCloud.

```bash
cd cerebro-front
npm install

# Crear archivo de variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores de Supabase

npm run dev
# Disponible en http://localhost:5173
```

**Variables de entorno** (`.env.local`):

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sí | Anon key de Supabase |
| `VITE_APP_NAME` | No | Nombre mostrado en la UI (default: `CEREBRO SaaS`) |
| `VITE_ENABLE_AUDIT_LOGS` | No | Habilitar ruta `/audit` (default: `true`) |
| `VITE_ENABLE_BIOMETRIC` | No | Habilitar test biométrico (default: `true`) |

```bash
# Ejecutar tests
npm run test

# Build de producción
npm run build
```

---

### base-front

Panel HR del cliente (tenant). Gestión de empleados, asistencia y configuración.

```bash
cd base-front
npm install

cp .env.example .env.local
# Editar .env.local

npm run dev
# Disponible en http://localhost:5174
```

**Variables de entorno** (`.env.local`):

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Sí | — | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sí | — | Anon key de Supabase |
| `VITE_ATTENDANCE_SCHEMA` | No | `attendance` | Nombre del schema de asistencia |
| `VITE_PROFILES_TABLE` | No | `profiles` | Tabla de perfiles de usuario |
| `VITE_TENANTS_TABLE` | No | `tenants` | Tabla de tenants |
| `VITE_TENANT_GATE_ENABLED` | No | `false` | Activar bloqueo si tenant está pausado |

```bash
# Build de producción (genera dist/404.html para SPA en DigitalOcean)
npm run build
```

---

### pwa

Aplicación móvil/PWA del empleado para marcar asistencia con GPS y selfie.

```bash
cd pwa
npm install

cp .env.example .env.local
# Editar .env.local

npm run dev
# Disponible en https://localhost:5173 (HTTPS requerido para cámara/GPS)
```

> La PWA requiere HTTPS en desarrollo para acceder a la cámara y GPS. El dev server de Vite incluye `@vitejs/plugin-basic-ssl` para generar un certificado auto-firmado.

**Variables de entorno** (`.env.local`):

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Sí | — | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sí | — | Anon key de Supabase |
| `VITE_GEO_MAX_METERS` | No | `400` | Radio máximo para geocerca (metros) |
| `VITE_MIN_GPS_ACCURACY` | No | `50` | Precisión GPS mínima aceptable (metros) |
| `VITE_FACE_THRESHOLD` | No | `0.6` | Umbral de similitud facial |
| `VITE_FACE_VERIFY_MODE` | No | `strict` | `strict` = bloquea si falla; `mvp` = permite sin verificación |
| `VITE_FACE_VERIFY_FUNCTION` | No | `face-verify` | Nombre de la edge function de verificación |
| `VITE_SELFIE_BUCKET` | No | `punch-selfies` | Bucket de Storage para selfies |
| `VITE_WEB_PUNCH_STATUS` | No | `0` | Valor `status` al insertar punch web |
| `VITE_WEB_PUNCH_VERIFICATION` | No | `15` | Código de verificación (15=facial) |
| `VITE_TENANT_PAUSED_MESSAGE` | No | (mensaje default) | Mensaje cuando el tenant está suspendido |

```bash
# Build de producción
npm run build
```

---

### adms-gateway

Receptor HTTP para el protocolo iClock de dispositivos biométricos ZKTeco. Dos implementaciones disponibles:

#### Implementación Node.js (desplegada por Procfile)

```bash
cd adms-gateway
npm install

cp .env.example .env
# Editar .env

npm start
# Disponible en http://localhost:3005
```

**Variables de entorno** (`.env`):

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `SUPABASE_URL` | Sí | — | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | — | Service Role Key (bypasea RLS) |
| `PORT` | No | `3005` | Puerto HTTP |
| `REJECT_UNKNOWN_SN` | No | `1` | Rechazar dispositivos no registrados (`1`=sí) |
| `DEFAULT_TENANT_ID` | No | — | Tenant por defecto si el dispositivo no tiene uno |
| `DEVICE_TIMEZONE` | No | `America/Guayaquil` | Zona horaria de los dispositivos |
| `MAX_BODY_KB` | No | `256` | Tamaño máximo del body POST (KB) |
| `TRUST_PROXY` | No | `1` | Confiar en cabeceras de proxy inverso |

#### Implementación Python (app.py)

```bash
cd adms-gateway

# Instalar dependencias
pip install flask flask-cors requests

# Configurar variables de entorno (mismas que la versión Node.js)
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
export PORT=8080

python app.py
# Disponible en http://localhost:8080
```

> Ver [docs/BACKEND.md](docs/BACKEND.md) para documentación completa de endpoints.

---

### app_face_v2.py — Servicio de Verificación Facial

Microservicio de reconocimiento facial basado en OpenCV. Procesa selfies de marcación y las compara con la foto de referencia del empleado.

```bash
# Instalar dependencias del sistema (Linux)
apt-get install -y libglib2.0-0 libsm6 libxrender1 libxext6

# Instalar dependencias Python
pip install flask flask-cors requests numpy opencv-contrib-python-headless

# Configurar variables de entorno
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_KEY=<service_role_key>
export API_SECRET=mi-secreto-seguro
export FACE_THRESHOLD=0.75
export PORT=5001

# Ejecutar
python app_face_v2.py
# Disponible en http://localhost:5001
```

**Variables de entorno**:

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `SUPABASE_URL` | Sí | — | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | Sí | — | Service Role Key |
| `API_SECRET` | No | `hrcloud-face-2026` | Shared secret para autenticar llamadas |
| `FACE_THRESHOLD` | No | `0.75` | Score mínimo para match (0.0–1.0) |
| `PORT` | No | `5001` | Puerto HTTP |

> Ver [docs/TIMEFACE.md](docs/TIMEFACE.md) para documentación completa del algoritmo y despliegue.

---

### supabase

Infraestructura backend: base de datos, autenticación, edge functions y storage.

```bash
cd supabase

# Iniciar servicios locales (requiere Docker)
supabase start

# Aplicar migraciones al entorno local
supabase db push

# Ejecutar edge functions localmente
supabase functions serve

# Desplegar edge functions a producción
supabase functions deploy <nombre-funcion>

# Vincular con el proyecto remoto
supabase link --project-ref <ref>
```

**Variables de entorno para edge functions** (`supabase/.env`):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key para operaciones admin |
| `GEMINI_API_KEY` | Google Gemini API key (función `attendance-ai-analyze`) |
| `FACE_VERIFY_SERVICE_URL` | URL del servicio `app_face_v2.py` (función `face-verify`) |
| `FACE_VERIFY_SECRET` | Shared secret para autenticar al servicio facial |
| `SMTP_*` | Configuración SMTP para funciones de email |

---

## Flujo de Datos Principal

```
Dispositivo ZKTeco (punch biométrico)
  → POST /iclock/cdata  (adms-gateway)
  → attendance.biometric_raw  +  attendance.punches

Empleado en PWA (punch web)
  → GPS check  →  selfie  →  storage upload
  → RPC register_web_punch()  →  attendance.punches
  → attendance.punch_evidence (verification_status='pending')
  → face-verify (Edge Function)  →  app_face_v2.py
  → attendance.punch_evidence (verification_status='verified'|'rejected')

Administrador en base-front
  → attendance.punches  →  get_daily_attendance_report_v2()
  → Dashboard KPIs  +  Exportar PDF/Excel/Word

Proveedor en cerebro-front
  → public.tenants  +  public.invoices
  → Dashboard facturación  +  Gestión clientes
```

---

## Despliegue en Producción (DigitalOcean App Platform)

Cada subproyecto se configura como un componente separado en la App, con `Source Directory` apuntando a su carpeta correspondiente:

| Componente | Source Dir | Build Command | Run Command |
|---|---|---|---|
| `cerebro-front` | `/cerebro-front` | `npm run build` | — (static site) |
| `base-front` | `/base-front` | `npm run build` | — (static site) |
| `pwa` | `/pwa` | `npm run build` | — (static site) |
| `adms-gateway` | `/adms-gateway` | `npm install` | `npm start` |
| `face-verify` | `/` | — | `gunicorn -w 2 -b 0.0.0.0:$PORT --timeout 60 app_face_v2:app` |

> Los sites estáticos (React) incluyen `dist/404.html` (copia de `index.html`) para que el enrutamiento SPA funcione correctamente en DigitalOcean.

---

## Seguridad

- **Nunca subir archivos `.env` reales** al repositorio. Solo se admiten `.env.example`.
- **Service Role Key** — solo usada en adms-gateway y app_face_v2.py (backends), nunca en frontends.
- **Anon Key** — usada en los frontends React. Segura en el navegador porque RLS restringe el acceso.
- **API_SECRET** — protege los endpoints del servicio facial. Cambiar el valor por defecto en producción.
- **RLS habilitada** en todas las tablas de ambos schemas (`public` y `attendance`). Cada tenant solo accede a sus propios datos.

---

## Documentación Técnica

| Documento | Descripción |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Diagrama de arquitectura general del monorepo |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Esquema completo de la base de datos: tablas, columnas, FKs, índices, RLS, ERD |
| [docs/BACKEND.md](docs/BACKEND.md) | Documentación del adms-gateway: endpoints, middleware, variables de entorno |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Documentación de cerebro-front y base-front: rutas, componentes, autenticación, flujos |
| [docs/TIMEFACE.md](docs/TIMEFACE.md) | Documentación del servicio de verificación facial: algoritmo, Supabase, despliegue |

---

## Notas de Desarrollo

- El monorepo no usa Turborepo ni herramientas de workspace. Cada subproyecto tiene su propio `package.json` y se gestiona de forma independiente.
- Los archivos SQL de migraciones están en `supabase/migrations/` y se aplican en orden cronológico.
- Existen copias de SQL en `adms-gateway/supabase/sql/`, `base-front/sql/` y `pwa/sql/` para referencia, pero el canon es `supabase/migrations/`.
- El schema `attendance` está completamente aislado del schema `public`. Los frontends de tenant usan exclusivamente `attendance`; el panel Cerebro usa exclusivamente `public`.
