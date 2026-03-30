# Deploy (Supabase) — CEREBRO

## 1) SQL (orden recomendado)
1. `sql/00_extensions.sql`
2. `sql/01_cerebro_schema_views.sql`
3. `sql/02_cerebro_core.sql`
4. `sql/03_cerebro_rls.sql`

> Nota: `01_cerebro_schema_views.sql` crea vistas `cerebro.*` que apuntan a tus tablas existentes en `public.*`.

## 2) Edge Functions
Funciones incluidas:
- `admin-create-tenant`
- `admin-create-user`
- `base-create-employee-user`
- `base-reset-password`
- `base-send-email`
- `biometric-gatekeeper`
- `broadcast-email`

### Deploy con Supabase CLI
```bash
supabase functions deploy admin-create-tenant
supabase functions deploy admin-create-user
supabase functions deploy base-create-employee-user
supabase functions deploy base-reset-password
supabase functions deploy base-send-email
supabase functions deploy biometric-gatekeeper
supabase functions deploy broadcast-email
```

## 3) Secrets (Edge)
Requeridos:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcionales:
- `BIOMETRIC_GATEKEEPER_KEY` (para `biometric-gatekeeper`)
- SMTP/Email provider secrets (si implementas envío real)

## 4) Frontend
1. Copia `.env.example` → `.env`
2. `npm i`
3. `npm run dev`
