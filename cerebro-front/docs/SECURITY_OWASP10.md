# Seguridad (OWASP Top 10) — CEREBRO / HRCloud

Este repositorio incorpora controles mínimos desde el día 1 para mitigar OWASP Top 10 (2021) en un SaaS multi-tenant.

## A01: Broken Access Control
- **RBAC server-side**: el acceso a CEREBRO se valida contra `public.user_roles` (`verifyCerebroAccess`).
- **Edge Functions**: `admin-create-tenant` y `admin-create-user` validan rol **admin** antes de ejecutar.
- **RLS**: tablas nuevas en `cerebro.*` tienen RLS habilitado (`sql/03_cerebro_rls.sql`).

## A02: Cryptographic Failures
- Secrets **nunca** en frontend. Edge Functions usan `SUPABASE_SERVICE_ROLE_KEY` desde secretos.
- Recomendado: rotación de llaves, SMTP en secretos.

## A03: Injection
- Edge Functions: validación/normalización de inputs (`_shared/security.ts`).
- En SQL, usar parámetros y evitar concatenación dinámica.

## A04: Insecure Design
- Separación de concerns: 
  - CEREBRO (staff interno)
  - BASE (usuarios tenant)
- Multi-tenant: `tenant_id` en tablas de BASE; CEREBRO opera sobre `public.tenants` y facturación.

## A05: Security Misconfiguration
- `index.html` incluye CSP y cabeceras base.
- Recomendado: aplicar headers en CDN / reverse proxy (Nginx, Cloudflare).

## A06: Vulnerable and Outdated Components
- Mantener `npm audit` como paso CI.
- Bloqueo de versiones (package-lock).

## A07: Identification and Authentication Failures
- Supabase Auth con refresh automático.
- No usar tokens en URL (`detectSessionInUrl: false`).

## A08: Software and Data Integrity Failures
- Deploy reproducible: scripts y checklist.
- Recomendado: firmar artefactos, proteger GitHub Actions.

## A09: Security Logging and Monitoring Failures
- `public.audit_logs` registra acciones sensibles.
- Edge Functions registran auditoría.

## A10: Server-Side Request Forgery
- En Edge Functions, evitar fetch a URLs arbitrarias. Mantener allowlist si se integra con APIs externas.
