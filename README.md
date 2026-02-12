<<<<<<< HEAD
# 🧠 CEREBRO SaaS - Frontend

Sistema de Gestión Multi-Tenant para HRCloud (ProyectoRLeon)

## 📋 Descripción

CEREBRO SaaS es una plataforma de gestión empresarial multi-tenant diseñada para administrar clientes, facturación, y monitoreo del sistema. El frontend está construido con React 18, Vite, y Tailwind CSS, conectándose a un backend en Supabase.

## 🚀 Características

- **Dashboard Interactivo**: KPIs en tiempo real con semáforos de estado
- **Gestión de Clientes**: CRUD completo con validación de RUC ecuatoriano
- **Sistema de Facturación**: Generación de prefacturas y seguimiento de pagos
- **Control de Acceso**: Roles (Admin, Asistente, Mantenimiento) con matriz de permisos
- **Auditoría**: Registro detallado de todas las acciones del sistema
- **Diseño Responsivo**: Optimizado para desktop y móvil

## 🛠️ Tecnologías

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18.3.1 | Framework UI |
| Vite | 4.5.14 | Build tool |
| Tailwind CSS | 3.4.19 | Estilos |
| Supabase | 2.94.1 | Backend/Auth/DB |
| React Router | 6.20.0 | Enrutamiento |
| Recharts | 2.10.0 | Gráficos |
| React Hook Form | 7.47.0 | Formularios |
| Zod | 3.22.4 | Validaciones |
| Lucide React | 0.309.0 | Iconos |

## 📁 Estructura del Proyecto (resumen)

```
cerebro-front/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/           # Imágenes y recursos estáticos
│   ├── components/       # Componentes reutilizables
│   │   ├── auth/         # Componentes de autenticación
│   │   ├── dashboard/    # Widgets del dashboard
│   │   ├── layout/       # Layout principal
│   │   ├── shared/       # Componentes compartidos
│   │   └── tenants/      # Componentes de clientes
│   ├── config/           # Configuraciones
│   │   ├── supabase.ts   # Cliente de Supabase
│   │   └── theme.ts      # Configuración del tema (paleta/brand)
│   ├── hooks/            # Custom hooks
│   ├── pages/            # Páginas/vistas
│   ├── services/         # Servicios de API
│   ├── styles/           # Estilos globales
│   ├── utils/            # Utilidades
│   │   ├── constants.ts  # Constantes del sistema
│   │   ├── formatters.ts # Funciones de formateo
│   │   └── validators.ts # Funciones de validación
│   ├── App.tsx           # Componente principal
│   ├── index.css         # Estilos globales
│   └── main.tsx          # Punto de entrada
├── supabase/
│   ├── sql/               # Scripts SQL (tablas, triggers, RLS)
│   └── functions/         # Edge Functions (SMTP Vault, broadcast, create-user, tenant-welcome)
├── docs/                  # Instructivos (setup Supabase, seguridad)
├── .env.local            # Variables de entorno
├── index.html            # HTML base
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

## ⚡ Instalación

### Prerrequisitos

- Node.js >= 18.0.0
- npm >= 9.0.0

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/cerebro-front.git
   cd cerebro-front
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   ```
   
   Editar `.env.local` con tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

4. **Crear BD y desplegar Edge Functions (obligatorio)**
   - Ejecuta los scripts en `supabase/sql/` en el SQL Editor de Supabase.
   - Despliega las Edge Functions de `supabase/functions/`.
   - Detalle paso-a-paso: **docs/SUPABASE_SETUP.md**.

5. **Iniciar servidor de desarrollo**
   ```bash
   npm run dev
   ```

6. **Abrir en el navegador**
   ```
   http://localhost:5173
   ```

## 🔧 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Genera build de producción |
| `npm run preview` | Preview del build |
| `npm run lint` | Ejecuta ESLint |
| `npm run test` | Ejecuta tests con Vitest |
| `npm run test:ui` | Tests con interfaz visual |
| `npm run test:coverage` | Tests con reporte de cobertura |

## 👥 Roles del Sistema

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso total, configuración, gestión de usuarios |
| **Asistente** | Gestión de clientes y facturación |
| **Mantenimiento** | Monitoreo técnico y auditoría |

## 🎨 Sistema de Diseño

### Colores

- **Primary**: `#0056e6` (Azul corporativo)
- **Secondary**: `#00e673` (Verde éxito)
- **Warning**: `#f59e0b` (Amarillo alerta)
- **Danger**: `#ef4444` (Rojo error)

### Tipografía

- **Display/Body**: Plus Jakarta Sans
- **Monospace**: JetBrains Mono

### Componentes CSS

```css
/* Botones */
.btn-primary    /* Acción principal */
.btn-secondary  /* Acción secundaria */
.btn-danger     /* Acción destructiva */

/* Inputs */
.input-field    /* Campo de entrada */
.input-label    /* Etiqueta */
.input-error    /* Mensaje de error */

/* Cards */
.card           /* Contenedor base */
.card-header    /* Encabezado */
.card-body      /* Contenido */

/* KPIs */
.kpi-card       /* Tarjeta de KPI */
.kpi-success    /* Estado verde */
.kpi-warning    /* Estado amarillo */
.kpi-danger     /* Estado rojo */
```

## 🔐 Validaciones

### RUC Ecuatoriano

El sistema incluye validación completa del RUC:
- Verifica 13 dígitos
- Valida código de provincia (01-24, 30)
- Calcula dígito verificador según tipo (natural, público, privado)

```javascript
import { validateRUC } from './utils/validators'

const result = validateRUC('1790000000001')
// { valid: true, type: 'private', formattedRuc: '1790000000001' }
```

### Contraseñas

Niveles de seguridad configurables:
- **Bajo**: Mínimo 6 caracteres
- **Medio**: Mínimo 8 caracteres + 1 número
- **Alto**: Mínimo 12 caracteres + mayúscula + número + especial

## 📊 KPIs y Semáforos

Los indicadores clave usan un sistema de semáforos:

| KPI | Verde | Amarillo | Rojo |
|-----|-------|----------|------|
| Tasa de Morosidad | < 10% | 10-25% | > 25% |
| Recuperación | > 80% | 50-80% | < 50% |
| Uso CPU | < 70% | 70-85% | > 85% |
| Uso Disco | < 80% | 80-90% | > 90% |

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm run test

# Con interfaz visual
npm run test:ui

# Con cobertura
npm run test:coverage
```

## 🚀 Deployment

### Build de Producción

```bash
npm run build
```

Los archivos se generan en `dist/`.

### Variables de Entorno en Producción

```env
VITE_SUPABASE_URL=https://produccion.supabase.co
VITE_SUPABASE_ANON_KEY=key-de-produccion
VITE_APP_VERSION=3.0.0
```

## 📚 Documentación Adicional

- [Diseño Arquitectónico](./docs/Diseno_Arquitectonico.pdf)
- [Guía de Implementación](./docs/Guia_Implementacion.pdf)
- [Manual de Usuario](./docs/Manual_Usuario.pdf)

## 🤝 Contribución

1. Fork el proyecto
2. Crea tu rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y pertenece a HRCloud.

## 👨‍💻 Equipo

- **ProyectoRLeon** - Desarrollo y mantenimiento

---

**CEREBRO SaaS** v3.0.0 | HRCloud © 2024
=======
# HRCloud — ADMS (Biométrico) Gateway → Supabase

Este servicio recibe las marcaciones del biométrico (modo **ADMS / Push**) y las guarda en Supabase en tablas multi-tenant.

## Qué hace (MVP)
- Escucha en `PORT` (default **3005**) y atiende endpoints comunes de ZKTeco Push:
  - `GET /iclock/cdata` (handshake)
  - `POST /iclock/cdata?SN=...&table=ATTLOG` (marcaciones)
  - `GET /iclock/getrequest` (poll de comandos)
- Inserta marcaciones en `public.attendance_punches` con `source='biometric'`.
- Genera reporte vía vista `public.attendance_v_punch_report`.

> Importante: **el protocolo exacto puede variar por modelo/firmware**. Por eso también se guarda el payload crudo en `public.attendance_biometric_raw` para diagnosticar.

---

## 1) Scripts Supabase (en orden)
En Supabase SQL Editor ejecuta:
1. (ya lo tienes) `001_attendance_core.sql`
2. (ya lo tienes) `002_attendance_rls.sql`
3. (ya lo tienes) `003_seed_attendance_defaults.sql`
4. **NUEVO** `004_biometric_core.sql`
5. **NUEVO** `005_biometric_rls.sql`

### Registrar tu dispositivo (1 vez)
Necesitas el **serial del biométrico (SN)** y el `tenant_id`.

Ejemplo:
```sql
insert into public.attendance_biometric_devices (tenant_id, serial_no, name, device_timezone, is_active)
values (
  'c678b4b9-2946-455f-a2e7-5ec3e348eea8'::uuid,
  '<SN_DEL_DISPOSITIVO>',
  'Oficina Matriz',
  'America/Guayaquil',
  true
);
```

---

## 2) Configurar y ejecutar el Gateway

```bash
npm install
copy .env.example .env   # en Windows
# o
cp .env.example .env

# editar .env y pegar SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm start
```

### Configuración del biométrico
En el biométrico (ADMS):
- **Dirección del servidor:** IP/DNS donde corre este Gateway
- **Puerto:** 3005 (o el que uses)
- **HTTPS:**
  - Para pruebas: apágalo (HTTP)
  - Producción: usar un reverse-proxy (Nginx) con certificado válido y HTTPS.

---

## 3) Reporte (SQL)

```sql
select employee_name, punched_at_local, outside_schedule, device_serial
from public.attendance_v_punch_report
where tenant_id = 'c678b4b9-2946-455f-a2e7-5ec3e348eea8'::uuid
order by punched_at desc
limit 50;
```

---

## Seguridad mínima (OWASP)
- **No expongas** el `SERVICE_ROLE_KEY` en frontend.
- Protege el servidor: firewall, allowlist IP, o al menos `REJECT_UNKNOWN_SN=1`.
- Limita tamaño de request: `MAX_BODY_KB`.
- Log crudo solo para troubleshooting (datos personales). En producción definir retención.
>>>>>>> 27d02b9 (Initial commit)
