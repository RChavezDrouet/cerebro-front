-- =======================================================
-- 005_dev_membership_and_seed.sql
-- SOLO DEV: crea membership admin y siembra defaults
-- Reemplaza los UUIDs antes de ejecutar.
-- =======================================================

-- 1) Insertar membership del usuario en el tenant
insert into attendance.memberships (tenant_id, user_id, role)
values ('<TENANT_ID>'::uuid, '<AUTH_USER_ID>'::uuid, 'tenant_admin')
on conflict (tenant_id, user_id) do update
set role = excluded.role;

-- 2) Sembrar defaults
select attendance.seed_defaults('<TENANT_ID>'::uuid);
