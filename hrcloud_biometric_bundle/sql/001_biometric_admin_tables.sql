-- HRCloud - SQL base para API administrativa biométrica
-- Ejecutar en Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists attendance.biometric_sync_jobs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    job_type text not null check (job_type in ('import_users','export_users','transfer_users','reconciliation','pull_users')),
    status text not null default 'pending' check (status in ('pending','running','completed','failed','partial')),
    source_device_id uuid null,
    target_device_id uuid null,
    created_by text not null,
    summary jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    completed_at timestamptz null
);

create table if not exists attendance.biometric_sync_job_items (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references attendance.biometric_sync_jobs(id) on delete cascade,
    employee_id uuid null,
    biometric_user_code text null,
    requested_action text not null,
    result_status text not null default 'pending',
    result_message text null,
    source_deleted boolean not null default false,
    payload_request jsonb not null default '{}'::jsonb,
    payload_response jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists attendance.biometric_device_users (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    device_id uuid not null,
    employee_id uuid null,
    biometric_user_code text not null,
    display_name text null,
    has_face boolean not null default false,
    has_fingerprint boolean not null default false,
    has_pin boolean not null default false,
    source_status text not null default 'active',
    payload_raw jsonb not null default '{}'::jsonb,
    synced_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (device_id, biometric_user_code)
);

create table if not exists attendance.biometric_audit_log (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    action text not null,
    device_id uuid null,
    employee_id uuid null,
    severity text not null default 'info',
    details jsonb not null default '{}'::jsonb,
    created_by text not null,
    created_at timestamptz not null default now()
);

alter table attendance.biometric_devices
    add column if not exists alias text,
    add column if not exists vendor text,
    add column if not exists model text,
    add column if not exists firmware_version text,
    add column if not exists connection_mode text,
    add column if not exists supports_fingerprint boolean not null default false,
    add column if not exists supports_face boolean not null default false,
    add column if not exists supports_pin boolean not null default false,
    add column if not exists supports_user_pull boolean not null default false,
    add column if not exists supports_user_push boolean not null default false,
    add column if not exists supports_delete boolean not null default false,
    add column if not exists supports_mass_import boolean not null default false;

create index if not exists idx_bio_sync_jobs_tenant on attendance.biometric_sync_jobs(tenant_id, created_at desc);
create index if not exists idx_bio_sync_job_items_job on attendance.biometric_sync_job_items(job_id, created_at asc);
create index if not exists idx_bio_device_users_device on attendance.biometric_device_users(device_id, biometric_user_code);
create index if not exists idx_bio_audit_tenant on attendance.biometric_audit_log(tenant_id, created_at desc);
