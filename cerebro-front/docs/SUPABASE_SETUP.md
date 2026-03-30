# Supabase Setup (Cerebro / HRCloud)

## 0) Prerrequisitos

- Proyecto Supabase creado (Database + Auth habilitados).
- Acceso a SQL Editor.
- Edge Functions habilitadas.

> **Roles internos**: el acceso a Cerebro es **solo** para usuarios internos definidos en `public.user_roles`.

---

## 1) Extensiones

1) En Supabase Dashboard: **Database → Extensions**
2) Habilita:
   - **pgcrypto** (UUID/crypto)  
   - **Vault** (aparece como “Vault” o “supabase_vault”, según versión)

---

## 2) Ejecutar scripts SQL

En el SQL Editor ejecuta, en orden:

1) `supabase/sql/00_extensions.sql`
2) `supabase/sql/01_tables.sql`
3) `supabase/sql/03_grants.sql`
4) `supabase/sql/02_rls.sql`

5) **Si ya tenías tablas creadas (schema parcial):** ejecuta también `supabase/sql/04_repair_existing.sql` para **agregar columnas faltantes** (ej. `tenants.billing_period`, `app_settings.secondary_color`, etc.).

> Los scripts son **idempotentes** (puedes re-ejecutarlos). Si ya tienes algunas tablas, los `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no romperán.

---

## 3) Crear el primer usuario interno (admin)

### Opción recomendada (Edge Function)

Despliega la Edge Function `admin-create-user` (ver sección 4). Luego, desde UI **Settings → Users**, crea:

- Email del administrador
- Password temporal
- Rol: `admin`

### Opción manual (solo para bootstrap)

1) Crea el usuario en **Auth → Users**.
2) Inserta el rol:

```sql
insert into public.user_roles (email, role)
values ('admin@tu-dominio.com', 'admin')
on conflict (email) do update set role = excluded.role;
```

---

## 4) Edge Functions (requeridas)

Estas funciones **no** viven en el Front; se despliegan en Supabase:

- `smtp-settings`  → guarda metadata SMTP + secreto en Vault
- `smtp-test`      → envía email de prueba a un destinatario
- `broadcast-email`→ envía correos a **todos** los tenants (`tenants.contact_email`) y/o a roles internos (`user_roles.email`)
- `admin-create-user` → crea usuario Auth interno + inserta rol
- `admin-create-tenant` → crea tenant + (opcional) crea usuario Auth para contacto y envía credenciales

### Variables de entorno para Edge Functions

En Supabase **Settings → Edge Functions** define:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

> Son provistas por Supabase. No copies la service key al front.

### Despliegue

Con Supabase CLI:

```bash
supabase functions deploy smtp-settings
supabase functions deploy smtp-test
supabase functions deploy broadcast-email
supabase functions deploy admin-create-user
supabase functions deploy admin-create-tenant
```

---

## 5) SMTP global (singleton)

En la UI de Cerebro: **Settings → SMTP**

- Completa host/port/username/secure
- `from_email` es fijo “correo oficial” (sender)
- Ingresa password (solo se envía a la Edge Function; se guarda en Vault)
- Botón **Test SMTP** permite escribir `email destino` y probar.

**Envío a tenants:** siempre se toma `tenants.contact_email` y se envía a **todos** los tenants.


---

## 5.1) Storage (Logo)

El módulo **Brand** sube el logo a Supabase Storage en el bucket **`brand`**.

1) En Supabase: **Storage → Create bucket**
   - Name: `brand`
   - Public bucket: **ON** (recomendado para servir el logo sin firmas)

2) Si prefieres bucket privado, debes usar URLs firmadas; este Front asume bucket público.

3) Si ya guardaste URLs antiguas tipo `/storage/v1/object/brand/...`, el Front las normaliza a `/storage/v1/object/public/brand/...`.

---

## 6) Troubleshooting

### 42601 syntax error at or near "," for insert, update

Ese error ocurre cuando se intenta crear una policy con `FOR INSERT, UPDATE`. En Postgres debe ser:

- una policy `FOR INSERT`
- otra policy `FOR UPDATE`

En este repo ya está corregido en `supabase/sql/02_rls.sql`.

### "schema cache" / tablas no encontradas

Si ves errores como:

- `Could not find the table 'public.messages' in the schema cache`
- `schema cache` / `relation does not exist`

Significa que **no se ejecutaron migraciones** o el API todavía no recargó el esquema.

Acciones:

1) Ejecuta `01_tables.sql`, `03_grants.sql` y `02_rls.sql`.
2) En Supabase: **Settings → API → Reload schema**.
3) Espera 10-30s y recarga la app.

> Tip: algunos cambios tardan en propagarse. En dev local, volver a loguearte fuerza un token nuevo.

### "permission denied" / RLS

Si aparece `permission denied` o `violates row-level security`, verifica:

1) El usuario esté en `public.user_roles` con el email exacto (lowercase recomendado) y rol correcto.
2) Ejecutaste `02_rls.sql`.
3) Ejecutaste `03_grants.sql`.
