PATCH CEREBRO – 2026-03-24

Archivos incluidos para reemplazo:

1) src/pages/SettingsPage.tsx
   - Corrige la gestión de planes para usar cerebro.subscription_plans.
   - Elimina billing_model y unit_price del payload.
   - Cambia la creación de usuarios internos para usar fetch nativo con Authorization + apikey,
     leyendo el token explícitamente desde localStorage.

2) src/pages/TenantCreatePage.tsx
   - Mantiene el catálogo de planes desde cerebro.subscription_plans.
   - Cambia la invocación de admin-create-tenant para usar fetch nativo con Authorization + apikey.
   - Lee el token desde localStorage (cerebro_auth o claves auth-token equivalentes).
   - Hace prevalidación de RUC duplicado en public.tenants.

3) supabase/functions/admin-create-tenant/index.ts
   - Reescritura completa del flujo.
   - Valida caller admin activo.
   - Crea public.tenants + auth.users + public.profiles + attendance.memberships.
   - Inserta seriales biométricos.
   - Genera invite link si está disponible.
   - Registra auditoría.
   - Incluye rollback compensatorio para evitar tenants parciales.

4) supabase/functions/admin-create-user/index.ts
   - Requiere Authorization Bearer y valida caller admin activo.
   - Crea auth.users y upserta user_roles.
   - Registra auditoría.

IMPORTANTE:
- Después de reemplazar los Edge Functions, volver a desplegarlas con:

  supabase functions deploy admin-create-tenant --project-ref qymoohwtxceggtvgjfsv --no-verify-jwt
  supabase functions deploy admin-create-user --project-ref qymoohwtxceggtvgjfsv --no-verify-jwt

- El frontend por sí solo corrige la propagación del token, pero si la función desplegada sigue siendo la versión antigua,
  el alta del tenant seguirá quedando incompleta.
