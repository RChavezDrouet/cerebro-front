# HRCloud — PWA Marcación Remota (NOVA Redesign)

PWA en **React + Vite + TypeScript + Tailwind + Supabase** para registrar marcaciones (entrada/salida/descanso) con:
- **Geolocalización** (GPS + precisión + geocerca opcional)
- **Selfie** como evidencia (bucket `punch-selfies`)
- Diseño NOVA: moderno, cinético, con sensación 3D y micro‑animaciones.

## Quickstart
```bash
cd pwa
cp .env.example .env.local   # (Windows: Copy-Item .env.example .env.local)
npm install
npm run dev
```

## Documentación
Revisa `docs/`:
- `00_README.md` (overview)
- `01_SETUP_LOCAL.md` (paso a paso junior)
- `02_SUPABASE_PREREQS.md` (tablas/bucket/policies)
- `03_PWA_INSTALL.md` (Android/iOS/Windows)
- `04_DEPLOY.md` (producción)
- `05_TROUBLESHOOTING.md` (errores comunes)
- `06_CHECKLIST_QA.md` (checklist QA)

## Importante
- No subas `node_modules` al repositorio.
- En producción usa **HTTPS** (recomendado para cámara/GPS).
