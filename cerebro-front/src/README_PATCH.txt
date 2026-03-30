# Patch v2 – exports faltantes (verifyCerebroAccess / getFirstActiveTenantId)

Este ZIP corrige el build error:
- No matching export verifyCerebroAccess
- No matching export getFirstActiveTenantId

## Reemplazos
1) index.html -> raíz del proyecto Vite
2) src/config/supabase.ts -> reemplazar completo
3) (solo si aplica) supabase/functions/admin-create-tenant/index.ts

## Frontend dependency
  npm i @supabase/supabase-js

## Nota importante
- verifyCerebroAccess implementa el flujo descrito en el documento de login:
  sesión válida + cerebro.user_roles (role permitido + is_active=true).
