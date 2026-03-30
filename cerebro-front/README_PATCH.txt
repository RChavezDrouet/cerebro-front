# Patch v3 — Fix "getSession timeout" en App.tsx

## Síntoma
En consola:
  [App:init] Auth bootstrap failed: Error: getSession timeout

## Causa (documentada)
Con storageKey custom (cerebro_auth) + ciertos estados del browser, supabase.auth.getSession()
puede quedarse esperando (locks/race) y no resolver a tiempo.

## Solución aplicada
- App.tsx ya NO llama supabase.auth.getSession() en el bootstrap.
- Lee la sesión desde localStorage (cerebro_auth) con getSessionFromStorage().
- verifyCerebroAccess() ya NO usa getSession() y valida token + user_roles vía fetch directo:
  - GET /auth/v1/user (valida token)
  - GET /rest/v1/user_roles (schema cerebro) para role/is_active

## Archivos a reemplazar
- src/config/supabase.ts
- src/App.tsx

## Notas
- Si el proyecto Supabase no expone schema "cerebro", el GET a /rest/v1/user_roles fallará.
  En ese caso, debes exponer "cerebro" en Supabase Settings > API > Exposed Schemas.
