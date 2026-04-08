-- =======================================================
-- HRCloud Base — USB Import (Edge Function base-usb-import)
-- 010_usb_import.sql
-- Staging → Dedupe → Insert
--
-- NOTE: This script assumes you already have:
--   - schema attendance
--   - table attendance.employees (employee_code unique per tenant)
--   - table attendance.punches (or you can adapt INSERT target)
--
-- If your punches table has different columns, adjust in ONE place:
--   section "INSERT INTO attendance.punches (...)"
-- =======================================================

create extension if not exists pgcrypto;
create schema if not exists attendance;

-- 1) Batches: one per uploaded file/request
create table if not exists attendance.usb_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  requested_by uuid not null,
  device_serial text null,
  source_filename text null,
  source_sha256 text null,
  status text not null default 'received', -- received|validated|processing|completed|failed
  total_rows int not null default 0,
  valid_rows int not null default 0,
  invalid_rows int not null default 0,
  inserted_rows int null,
  duplicate_rows int null,
  unknown_employee_rows int null,
  error_summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists usb_import_batches_tenant_idx
on attendance.usb_import_batches(tenant_id, created_at desc);

-- 2) Staging rows: raw punches from USB file
create table if not exists attendance.usb_import_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  batch_id uuid not null references attendance.usb_import_batches(id) on delete cascade,
  employee_code text not null,
  punched_at timestamptz not null,
  method text not null default 'USB',
  device_serial text null,
  raw jsonb null,
  -- deterministic hash for dedupe across imports
  row_hash text generated always as (
    encode(
      digest(
        concat_ws('|', tenant_id::text, employee_code, punched_at::text, coalesce(method,''), coalesce(device_serial,'')),
        'sha256'
      ),
      'hex'
    )
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists usb_import_staging_batch_idx
on attendance.usb_import_staging(batch_id);

create unique index if not exists usb_import_staging_dedupe_uk
on attendance.usb_import_staging(batch_id, row_hash);

-- 3) Helper: update timestamps
create or replace function attendance._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_usb_import_batches_updated_at') then
    create trigger trg_usb_import_batches_updated_at
    before update on attendance.usb_import_batches
    for each row execute function attendance._touch_updated_at();
  end if;
end $$;

-- 4) Processor: staging -> punches
--
-- IMPORTANT:
-- This expects attendance.punches with at least these columns:
--   tenant_id uuid, employee_id uuid, punched_at timestamptz, source text, method text, meta jsonb
-- If your punches table differs, adapt this INSERT.

create or replace function attendance.process_usb_import(
  p_batch_id uuid,
  p_allow_unknown_employee boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = 'attendance', 'public'
as $$
declare
  v_tenant uuid;
  v_total int;
  v_unknown int := 0;
  v_dupe int := 0;
  v_inserted int := 0;
  r record;
begin
  select tenant_id, total_rows into v_tenant, v_total
  from attendance.usb_import_batches
  where id = p_batch_id;

  if v_tenant is null then
    raise exception 'batch not found: %', p_batch_id;
  end if;

  update attendance.usb_import_batches
  set status = 'processing'
  where id = p_batch_id;

  -- Temp table with resolved employee_id
  create temporary table tmp_usb_rows on commit drop as
  select
    s.tenant_id,
    s.batch_id,
    s.employee_code,
    e.id as employee_id,
    s.punched_at,
    s.method,
    s.device_serial,
    s.raw,
    s.row_hash
  from attendance.usb_import_staging s
  left join attendance.employees e
    on e.tenant_id = s.tenant_id
   and e.employee_code = s.employee_code
  where s.batch_id = p_batch_id;

  select count(*) into v_unknown from tmp_usb_rows where employee_id is null;

  if v_unknown > 0 and not p_allow_unknown_employee then
    update attendance.usb_import_batches
    set status = 'failed', error_summary = 'Unknown employee_code rows present'
    where id = p_batch_id;

    return jsonb_build_object(
      'ok', false,
      'reason', 'unknown_employee',
      'unknown_employee_rows', v_unknown
    );
  end if;

  -- Dedupe vs existing punches (best-effort):
  -- assumes punches.meta->>'row_hash' stores the hash.
  -- If you have a dedicated unique constraint, you can switch to ON CONFLICT DO NOTHING.

  -- Mark duplicates
  update tmp_usb_rows t
  set row_hash = row_hash
  where exists (
    select 1
    from attendance.punches p
    where p.tenant_id = t.tenant_id
      and p.employee_id = t.employee_id
      and p.punched_at = t.punched_at
      and coalesce(p.method,'') = coalesce(t.method,'')
  );

  -- Count duplicates
  select count(*) into v_dupe
  from tmp_usb_rows t
  where exists (
    select 1
    from attendance.punches p
    where p.tenant_id = t.tenant_id
      and p.employee_id = t.employee_id
      and p.punched_at = t.punched_at
      and coalesce(p.method,'') = coalesce(t.method,'')
  );

  -- Insert non-duplicates
  insert into attendance.punches (
    tenant_id,
    employee_id,
    punched_at,
    source,
    method,
    meta
  )
  select
    t.tenant_id,
    t.employee_id,
    t.punched_at,
    'usb',
    t.method,
    jsonb_build_object(
      'batch_id', p_batch_id,
      'device_serial', t.device_serial,
      'employee_code', t.employee_code,
      'row_hash', t.row_hash,
      'raw', t.raw
    )
  from tmp_usb_rows t
  where t.employee_id is not null
    and not exists (
      select 1
      from attendance.punches p
      where p.tenant_id = t.tenant_id
        and p.employee_id = t.employee_id
        and p.punched_at = t.punched_at
        and coalesce(p.method,'') = coalesce(t.method,'')
    );

  get diagnostics v_inserted = row_count;

  update attendance.usb_import_batches
  set
    status = 'completed',
    inserted_rows = v_inserted,
    duplicate_rows = v_dupe,
    unknown_employee_rows = v_unknown
  where id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'inserted_rows', v_inserted,
    'duplicate_rows', v_dupe,
    'unknown_employee_rows', v_unknown
  );
end;
$$;

-- 5) Minimal RLS (production-ready):
-- - End users should NOT have direct access to staging/batches.
-- - Edge Function uses SERVICE_ROLE to insert/select.
-- - Only allow admins to read batches for their tenant (optional).

alter table attendance.usb_import_batches enable row level security;
alter table attendance.usb_import_staging enable row level security;

-- Optional: allow tenant admins to read their batches
drop policy if exists usb_batches_read_admin on attendance.usb_import_batches;
create policy usb_batches_read_admin
on attendance.usb_import_batches
for select
to authenticated
using (
  tenant_id = attendance.current_tenant_id()
  and attendance.current_user_role() in ('tenant_admin','hr_admin','admin','assistant')
);

-- Block all access to staging for authenticated users
drop policy if exists usb_staging_no_access on attendance.usb_import_staging;
create policy usb_staging_no_access
on attendance.usb_import_staging
for all
to authenticated
using (false)
with check (false);

