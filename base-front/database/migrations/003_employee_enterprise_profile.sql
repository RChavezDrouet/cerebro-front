create schema if not exists attendance;
create extension if not exists pgcrypto;

create table if not exists attendance.employee_enterprise_profile (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  personal_email text,
  mobile_phone text,
  home_phone text,
  birth_date date,
  gender text,
  marital_status text,
  nationality text,
  national_id text,
  blood_type text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  emergency_contact_address text,
  medical_notes text,
  allergies text,
  chronic_conditions text,
  disability_info text,
  work_modality text not null default 'presencial' check (work_modality in ('remoto','presencial','mixto')),
  geofence_lat numeric(10,7),
  geofence_lng numeric(10,7),
  geofence_radius_m numeric(10,2),
  biometric_code text,
  biometric_device_id uuid,
  official_photo_path text,
  hire_date date,
  termination_date date,
  department_name text,
  position_name text,
  supervisor_employee_id uuid,
  labor_history jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employee_enterprise_profile_tenant on attendance.employee_enterprise_profile(tenant_id);

create table if not exists attendance.employee_biometric_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  device_id uuid,
  device_serial_no text,
  biometric_code text not null,
  is_primary boolean not null default true,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tenant_id, biometric_code)
);
create index if not exists idx_employee_biometric_links_employee on attendance.employee_biometric_links(employee_id);

create or replace view attendance.v_employee_enterprise_full as
select
  e.id as employee_id,
  e.tenant_id,
  e.employee_code,
  coalesce(e.full_name, trim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,''))) as employee_name,
  e.status as employee_status,
  ep.work_modality,
  ep.mobile_phone,
  ep.personal_email,
  ep.department_name,
  ep.position_name,
  ep.emergency_contact_name,
  ep.emergency_contact_phone,
  ep.biometric_code,
  ep.geofence_lat,
  ep.geofence_lng,
  ep.geofence_radius_m,
  ep.official_photo_path,
  ep.hire_date,
  ep.termination_date,
  ep.labor_history,
  ep.custom_fields
from public.employees e
left join attendance.employee_enterprise_profile ep on ep.employee_id = e.id;
