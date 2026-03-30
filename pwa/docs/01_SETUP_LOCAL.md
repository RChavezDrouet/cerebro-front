# 01 — Ejecutar en local (paso a paso para Junior, sin omitir nada)

> Objetivo: levantar la PWA en tu PC y poder abrirla desde tu celular (misma red Wi‑Fi).

---

## 1) Requisitos (instalación)

### 1.1 Instalar Node.js
1. Descarga **Node.js LTS** (recomendado 18 o 20).
2. Instálalo con “Next → Next → Finish”.

✅ Verifica:
```bash
node -v
npm -v
```

### 1.2 Instalar Git
1. Descarga Git.
2. Instala con opciones por defecto.

✅ Verifica:
```bash
git --version
```

### 1.3 Editor recomendado
- **VS Code**
- Extensiones útiles:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense

---

## 2) Abrir el proyecto

1. Descomprime el ZIP.
2. Debes ver esta estructura:
```
pwa/
  src/
  public/
  docs/
  index.html
  package.json
  vite.config.ts
```
3. Abre una terminal **dentro de la carpeta `pwa/`**.

### Windows (opción fácil)
- Click derecho en carpeta `pwa/` → “Open in Terminal”

### macOS / Linux
- `cd` a la carpeta `pwa/`

---

## 3) Configurar variables de entorno (obligatorio)

### 3.1 Crear `.env.local`
1. Copia `.env.example` a `.env.local`.

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env.local
```

**macOS/Linux:**
```bash
cp .env.example .env.local
```

### 3.2 Llenar `.env.local`
1. Abre `.env.local` con VS Code.
2. Coloca:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

📌 ¿Dónde saco esto?
- Supabase Dashboard → **Project Settings → API**
- Copia:
  - `Project URL`
  - `anon public` key

> ⚠️ No uses service_role en frontend. Solo ANON + JWT.

---

## 4) Instalar dependencias

En la terminal dentro de `pwa/`:
```bash
npm install
```

Si aparece error de permisos en Windows:
1. Cierra terminal.
2. Abre PowerShell como Administrador.
3. Repite `npm install`.

---

## 5) Ejecutar en modo desarrollo

```bash
npm run dev
```

Vite mostrará algo como:
- `Local:   http://localhost:5173/`

Abre esa URL en tu navegador.

---

## 6) Abrir desde el teléfono (misma red Wi‑Fi)

### 6.1 Obtener IP de tu PC
**Windows:**
```powershell
ipconfig
```
Busca “IPv4 Address”, por ejemplo `192.168.1.50`

**macOS/Linux:**
```bash
ip a
```
o
```bash
ifconfig
```

### 6.2 Abrir en el móvil
En el navegador del móvil, abre:
- `http://TU_IP:5173`

Ejemplo:
- `http://192.168.1.50:5173`

> Nota: cámara/GPS funcionan mejor con HTTPS, pero para pruebas LAN suele funcionar en Chrome Android.
> iOS Safari puede ser más estricto con permisos en HTTP. Para iOS, prueba con deploy temporal en HTTPS (ver `04_DEPLOY.md`).

---

## 7) Build y preview (simular producción)

1. Generar build:
```bash
npm run build
```

2. Probar build local:
```bash
npm run preview
```

Vite mostrará:
- `http://localhost:4173`

---

## 8) Si no carga nada (pantalla blanca)
1. Abre DevTools (F12 en Chrome)
2. Mira Console y Network
3. Ve `05_TROUBLESHOOTING.md`

