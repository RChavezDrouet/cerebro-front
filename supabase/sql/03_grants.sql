-- ============================================================
-- CEREBRO (HRCloud) - Grants
-- ============================================================
-- Objetivo:
-- - Evitar errores "permission denied" al consumir tablas vía PostgREST.
-- - Mantener el control de acceso en RLS (02_rls.sql).
--
-- Nota: en Supabase, GRANT + RLS trabajan juntos:
--   - Si NO hay GRANT, la app falla aunque exista una policy.
--   - Si hay GRANT, RLS sigue aplicando (policies).

grant usage on schema public to anon, authenticated;

-- Privilegios base (control real en policies)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Helpers de RLS (si el motor requiere explícito)
grant execute on function public.current_email() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_internal() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_assistant() to authenticated;
grant execute on function public.is_maintenance() to authenticated;

-- Opcional: permitir lectura pública de branding en Login (NO recomendado en entornos regulados)
-- grant select on table public.app_settings to anon;
