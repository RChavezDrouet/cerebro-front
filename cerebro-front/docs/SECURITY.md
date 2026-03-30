# Seguridad (OWASP Top 10 + ISO/IEC 25000)

Este front aplica un enfoque **secure-by-default**:

## Controles principales

- **Secrets fuera del Front**: el password SMTP no se guarda ni viaja al storage del navegador.
  - Se envía únicamente a Edge Function `smtp-settings`.
  - Se persiste en **Vault** (`vault.secrets` / `vault.decrypted_secrets`), accesible solo con Service Role.
- **RLS**: todas las tablas del dominio `public.*` tienen Row Level Security.
  - Acceso determinado por `public.user_roles.email` (Opción B).
- **Least privilege**:
  - `admin`: acceso total.
  - `assistant`: opera tenants/invoices y puede enviar mensajes.
  - `maintenance`: dashboard + auditoría.
- **Auditoría**: eventos UI → `audit_logs`.

## Recomendaciones

- Activa MFA en cuentas admin.
- Configura políticas de password y rotación desde `security_settings`.
- Restringe IPs/Red para Service Role y activa alertas.
- Revisa headers (CSP) en el reverse proxy/hosting.