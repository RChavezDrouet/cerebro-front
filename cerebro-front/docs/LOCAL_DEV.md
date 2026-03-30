# Local Dev (Cerebro Front)

## 1) Variables de entorno

Crea `.env.local` en la raíz del proyecto:

```bash
VITE_SUPABASE_URL="https://TU-PROYECTO.supabase.co"
VITE_SUPABASE_ANON_KEY="TU_ANON_KEY"
VITE_APP_NAME="CEREBRO"
VITE_APP_VERSION="3.0.0"
```

## 2) Instalar y ejecutar

```bash
npm install
npm run dev
```

## 3) Pruebas automatizadas

```bash
npm test
npm run test:coverage
```

## 4) Build de producción

```bash
npm run build
npm run preview
```
