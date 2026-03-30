# Seguridad — OWASP Top 10 (mínimos desde el día 1)

## A01: Broken Access Control
- **RLS** habilitado en tablas de asistencia.
- Policies restringen por `tenant_id` resuelto desde JWT/Profiles.
- FK compuestas `(tenant_id, id)` para impedir referencias cruzadas entre tenants.

## A02: Cryptographic Failures
- Supabase gestiona JWT y transporte TLS.
- No almacenar secretos en el frontend.

## A03: Injection
- No hay SQL en frontend.
- Validación fuerte de entrada con **Zod**.
- Constraints DB (unique, not null, FK).

## A04: Insecure Design
- Multi-tenant pensado a nivel de datos (tenant_id + RLS + FK compuestas).
- No confiar en tenant_id enviado por el usuario.

## A05: Security Misconfiguration
- Documentación para RLS y roles.
- Evitar exponer información sensible en logs del navegador.

## A06: Vulnerable/Outdated Components
- Dependencias mínimas.

## A07: Identification & Authentication Failures
- Mensajes de error genéricos en login (evita enumeración).

## A08: Software & Data Integrity Failures
- Semilla de defaults por tenant via función controlada.

## A09: Security Logging & Monitoring Failures
- Recomendación: tabla de auditoría y eventos (pendiente en siguiente sprint).

## A10: SSRF
- No aplica en frontend; relevante en Edge Functions si se usan.
