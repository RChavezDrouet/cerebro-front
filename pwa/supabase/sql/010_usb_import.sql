-- HRCloud Base (attendance) — USB Import (staging → dedupe → insert)
-- v4.2.1
--
-- Objetivo:
--  - Carga masiva desde USB (CSV/XLSX) mediante Edge Function (service_role)
--  - Staging con dedupe por hash
--  - Aplicación set-based a attendance.punches
--
-- NOTA:
--  - Este script asume que existe el schema attendance y tablas attendance.employees, attendance.punches
--  - Ajusta nombres de columnas si tu modelo difiere.

begin;

create extension if not exists pgcrypto;

create schema if not exists attendance;

-- 1) Batch tracking
create table if not exists attendance.usb_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  created_by uuid not null,
  filename text not null,
  mime text,
  status text not null default 'received', -- received|staged|dry_run|done|failed
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists usb_import_batches_tenant_created_at
on attendance.usb_import_batches (tenant_id, created_at desc);

-- 2) Staging table
create table if not exists attendance.usb_import_staging (
  id bigserial primary key,
  batch_id uuid not null references attendance.usb_import_batches(id) on delete cascade,
  tenant_id uuid not null,
  employee_code text not null,
  punched_at timestamptz not null,
  punch_type text not null check (punch_type in ('in','out','break_start','break_end')),
  source text not null default 'usb',
  device_location text,
  meta jsonb not null default '{}'::jsonb,
  hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists usb_import_staging_batch
on attendance.usb_import_staging (batch_id);

-- Dedupe key (hash determinístico)
create unique index if not exists usb_import_staging_hash_uq
on attendance.usb_import_staging (tenant_id, hash);

-- 3) Dedupe a nivel final (evita insertar duplicados en punches)
-- Si ya tienes un índice/constraint equivalente, NO lo dupliques.
-- Usamos source para no interferir con biométrico/web.
create unique index if not exists punches_usb_dedupe_uq
on attendance.punches (tenant_id, employee_id, punched_at, type, source)
where (source = 'usb');

-- 4) RPC: aplica staging → punches
-- Retorna métricas para UI/logs
create or replace function attendance.attendance_usb_import_apply(
  p_batch_id uuid,
  p_tenant_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_inserted int := 0;
  v_duplicates int := 0;
  v_missing_employee int := 0;
begin
  -- A) Marca filas staging con employee_id resuelto (si tu employees tiene employee_code)
  -- Si tu modelo usa otro identificador, cambia el join.
  with emp as (
    select id, employee_code
    from attendance.employees
    where tenant_id = p_tenant_id
  )
  update attendance.usb_import_staging s
     set meta = jsonb_set(s.meta, '{employee_id}', to_jsonb(e.id::text), true)
    from emp e
   where s.batch_id = p_batch_id
     and s.tenant_id = p_tenant_id
     and s.employee_code = e.employee_code
     and (s.meta->>'employee_id') is null;

  -- B) Cuenta missing employees
  select count(*) into v_missing_employee
  from attendance.usb_import_staging s
  where s.batch_id = p_batch_id
    and s.tenant_id = p_tenant_id
    and (s.meta->>'employee_id') is null;

  -- C) Inserta a punches (solo con employee_id resuelto)
  -- Usa ON CONFLICT DO NOTHING por el índice punches_usb_dedupe_uq.
  with to_insert as (
    select
      p_tenant_id as tenant_id,
      (s.meta->>'employee_id')::uuid as employee_id,
      s.punched_at,
      s.punch_type as type,
      'usb'::text as source,
      jsonb_build_object(
        'import_batch_id', p_batch_id,
        'imported_by', p_user_id,
        'device_location', s.device_location,
        'raw', s.meta->'raw',
        'method', s.meta->>'method'
      ) as meta
    from attendance.usb_import_staging s
    where s.batch_id = p_batch_id
      and s.tenant_id = p_tenant_id
      and (s.meta->>'employee_id') is not null
  ), ins as (
    insert into attendance.punches (tenant_id, employee_id, punched_at, type, source, meta)
    select * from to_insert
    on conflict do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  -- D) Duplicados = válidos - insertados - missing_employee
  select greatest((select count(*) from attendance.usb_import_staging where batch_id=p_batch_id and tenant_id=p_tenant_id) - v_inserted - v_missing_employee, 0)
    into v_duplicates;

  return jsonb_build_object(
    'inserted', v_inserted,
    'duplicates_skipped', v_duplicates,
    'missing_employee', v_missing_employee
  );
end;
$$;

-- 5) Seguridad mínima (production-ready)
-- La Edge Function usa service_role, por lo tanto:
--  - Estas tablas NO deben ser accesibles desde anon/authenticated.
--  - Mantener RLS habilitado y sin policies para roles normales.

alter table attendance.usb_import_batches enable row level security;
alter table attendance.usb_import_staging enable row level security;

-- Revocar todo por defecto a roles públicos
revoke all on attendance.usb_import_batches from anon, authenticated;
revoke all on attendance.usb_import_staging from anon, authenticated;

-- Permitir al service_role (interno de Supabase)
grant all on attendance.usb_import_batches to service_role;
grant all on attendance.usb_import_staging to service_role;

-- Permisos de función: solo service_role
revoke all on function attendance.attendance_usb_import_apply(uuid, uuid, uuid) from public;
grant execute on function attendance.attendance_usb_import_apply(uuid, uuid, uuid) to service_role;

commit;
