-- =======================================================
-- 005_dev_bootstrap.sql
-- Bootstrap DEV: crea membership + seed
-- Reemplaza TENANT_ID y AUTH_USER_ID
-- =======================================================

-- insert into attendance.memberships (tenant_id, user_id, role)
-- values ('TENANT_ID'::uuid, 'AUTH_USER_ID'::uuid, 'tenant_admin')
-- on conflict (tenant_id, user_id) do update
-- set role = excluded.role;

-- select attendance.seed_defaults('TENANT_ID'::uuid);
