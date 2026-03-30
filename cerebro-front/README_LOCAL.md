# Cerebro Front (Local)

## Requisitos
- Node.js 20+ (recomendado)
- npm 9+

## 1) Configurar variables de entorno
1. Copia `.env.example` a `.env.local`
2. Edita los valores:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 2) Instalar dependencias
```bash
npm install
```

## 3) Levantar en modo desarrollo
```bash
npm run dev
```

## 4) Base de datos (Supabase)
En el proyecto Supabase, ejecuta los scripts (en orden):

- `supabase/sql/01_tables.sql`
- `supabase/sql/02_rls.sql`
- `supabase/sql/03_grants.sql`
- `supabase/sql/04_repair_existing.sql` (si aplica)

Luego verifica que existan:
- `user_roles(email, role)`
- `role_permissions(role, permissions jsonb)`

## Notas de cambios aplicados
- RBAC por permisos: `role_permissions.permissions` (jsonb) + helper `can(permission)`
- Primera pantalla tras login: `/dashboard`
- Pausa manual: clic en el badge Activo/Pausado (solo si `pause_after_grace=false`)
- Mensaje global de pausa (Base): `app_settings.paused_message_title/body` editable en Settings → Mensajes
