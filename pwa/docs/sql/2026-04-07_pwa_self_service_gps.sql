-- HRCloud Base + PWA
-- Autogestión de datos personales + registro único de GPS del puesto de trabajo
-- Fecha: 2026-04-07

begin;

alter table if exists public.employees
  add column if not exists phone text,
  add column if not exists address text;

alter table if exists attendance.employee_profile
  add column if not exists pwa_self_service_enabled boolean not null default false,
  add column if not exists pwa_self_service_locked boolean not null default false,
  add column if not exists pwa_self_service_requested_at timestamptz,
  add column if not exists pwa_self_service_completed_at timestamptz;

create or replace function attendance.upsert_employee_full(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_employee_code text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_identification text,
  p_department_id uuid,
  p_hire_date date,
  p_salary numeric,
  p_employment_status text,
  p_facial_photo_url text,
  p_vacation_start date,
  p_vacation_end date,
  p_lunch_tracking boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_id uuid := p_employee_id;
  v_att_status text;
  v_photo_meta jsonb;
begin
  perform attendance.assert_tenant_access(p_tenant_id);

  if v_id is null then
    v_id := gen_random_uuid();
  end if;

  v_att_status := case upper(coalesce(p_employment_status,'ACTIVE'))
    when 'ACTIVE' then 'active'
    when 'VACATION' then 'vacation'
    when 'SUSPENDED' then 'inactive'
    when 'TERMINATED' then 'inactive'
    else lower(p_employment_status)
  end;

  v_photo_meta := jsonb_build_object(
    'hrcloud',
    jsonb_build_object(
      'vacation_start', p_vacation_start,
      'vacation_end', p_vacation_end,
      'lunch_tracking', coalesce(p_lunch_tracking, true)
    )
  );

  insert into public.employees(
    id, tenant_id, first_name, last_name, email, phone, address, identification, department_id,
    hire_date, salary, employment_status, facial_photo_url, updated_at
  )
  values(
    v_id, p_tenant_id, p_first_name, p_last_name, nullif(p_email,''), nullif(p_phone,''), nullif(p_address,''), p_identification, p_department_id,
    coalesce(p_hire_date, current_date), p_salary, lower(coalesce(p_employment_status,'active')), p_facial_photo_url, now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = excluded.phone,
    address = excluded.address,
    identification = excluded.identification,
    department_id = excluded.department_id,
    hire_date = excluded.hire_date,
    salary = excluded.salary,
    employment_status = excluded.employment_status,
    facial_photo_url = excluded.facial_photo_url,
    updated_at = now();

  insert into attendance.employee_profile(
    employee_id, tenant_id, employee_code, status, photo_meta, updated_at
  )
  values(
    v_id, p_tenant_id, p_employee_code, v_att_status, v_photo_meta, now()
  )
  on conflict (employee_id) do update set
    employee_code = excluded.employee_code,
    status = excluded.status,
    photo_meta = coalesce(attendance.employee_profile.photo_meta, '{}'::jsonb) || excluded.photo_meta,
    updated_at = now();

  return v_id;
end;
$$;

grant execute on function attendance.upsert_employee_full(uuid,uuid,text,text,text,text,text,text,text,uuid,date,numeric,text,text,date,date,boolean) to authenticated;

create or replace function attendance.upsert_employee_pwa_self_service_settings(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_work_mode text default null,
  p_geofence_radius_m numeric default null,
  p_pwa_self_service_enabled boolean default false,
  p_reset_pwa_self_service_lock boolean default false
)
returns table (
  employee_id uuid,
  pwa_self_service_enabled boolean,
  pwa_self_service_locked boolean
)
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_mode text;
  v_allow_remote boolean;
begin
  perform attendance.assert_tenant_access(p_tenant_id);

  v_mode := case upper(coalesce(p_work_mode,''))
    when 'PRESENCIAL' then 'presencial'
    when 'REMOTO' then 'remoto'
    when 'MIXTO' then 'mixto'
    else null
  end;
  v_allow_remote := v_mode in ('remoto', 'mixto');

  insert into attendance.employee_profile(
    employee_id,
    tenant_id,
    work_mode,
    allow_remote_pwa,
    geofence_radius_m,
    pwa_self_service_enabled,
    pwa_self_service_locked,
    pwa_self_service_requested_at,
    updated_at
  )
  values (
    p_employee_id,
    p_tenant_id,
    v_mode,
    v_allow_remote,
    p_geofence_radius_m,
    coalesce(p_pwa_self_service_enabled, false),
    false,
    case when coalesce(p_pwa_self_service_enabled, false) then now() else null end,
    now()
  )
  on conflict (employee_id) do update set
    work_mode = coalesce(excluded.work_mode, attendance.employee_profile.work_mode),
    allow_remote_pwa = excluded.allow_remote_pwa,
    geofence_radius_m = excluded.geofence_radius_m,
    pwa_self_service_enabled = excluded.pwa_self_service_enabled,
    pwa_self_service_locked = case
      when coalesce(p_reset_pwa_self_service_lock, false) then false
      when excluded.pwa_self_service_enabled = false then false
      else attendance.employee_profile.pwa_self_service_locked
    end,
    pwa_self_service_requested_at = case
      when excluded.pwa_self_service_enabled = false then null
      when coalesce(p_reset_pwa_self_service_lock, false) then now()
      when attendance.employee_profile.pwa_self_service_requested_at is null then now()
      else attendance.employee_profile.pwa_self_service_requested_at
    end,
    pwa_self_service_completed_at = case
      when excluded.pwa_self_service_enabled = false then null
      when coalesce(p_reset_pwa_self_service_lock, false) then null
      else attendance.employee_profile.pwa_self_service_completed_at
    end,
    updated_at = now();

  return query
  select ep.employee_id, ep.pwa_self_service_enabled, ep.pwa_self_service_locked
  from attendance.employee_profile ep
  where ep.employee_id = p_employee_id;
end;
$$;

grant execute on function attendance.upsert_employee_pwa_self_service_settings(uuid,uuid,text,numeric,boolean,boolean) to authenticated;

create or replace function attendance.get_employee_pwa_self_service_settings(
  p_tenant_id uuid,
  p_employee_id uuid
)
returns table (
  employee_id uuid,
  work_mode text,
  allow_remote_pwa boolean,
  geofence_lat double precision,
  geofence_lng double precision,
  geofence_radius_m numeric,
  pwa_self_service_enabled boolean,
  pwa_self_service_locked boolean,
  pwa_self_service_completed_at timestamptz
)
language sql
security definer
set search_path = public, attendance
as $$
  select
    ep.employee_id,
    ep.work_mode,
    ep.allow_remote_pwa,
    ep.geofence_lat,
    ep.geofence_lng,
    ep.geofence_radius_m,
    ep.pwa_self_service_enabled,
    ep.pwa_self_service_locked,
    ep.pwa_self_service_completed_at
  from attendance.employee_profile ep
  where ep.tenant_id = p_tenant_id
    and ep.employee_id = p_employee_id
$$;

grant execute on function attendance.get_employee_pwa_self_service_settings(uuid,uuid) to authenticated;

create or replace function attendance.resolve_my_employee_context()
returns table (
  tenant_id uuid,
  employee_id uuid,
  email text
)
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'No existe sesión autenticada';
  end if;

  return query
  with src as (
    select ua.tenant_id, ua.employee_id, au.email
    from attendance.user_accounts ua
    join auth.users au on au.id = ua.user_id
    where ua.user_id = v_user_id
    union all
    select p.tenant_id, p.employee_id, au.email
    from public.profiles p
    join auth.users au on au.id = p.id
    where p.id = v_user_id
  )
  select s.tenant_id, s.employee_id, s.email
  from src s
  where s.tenant_id is not null and s.employee_id is not null
  limit 1;

  if not found then
    raise exception 'No se pudo resolver tenant/employee para el usuario autenticado';
  end if;
end;
$$;

grant execute on function attendance.resolve_my_employee_context() to authenticated;

create or replace function attendance.get_my_pwa_self_service_profile()
returns table (
  tenant_id uuid,
  employee_id uuid,
  employee_code text,
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  work_mode text,
  allow_remote_pwa boolean,
  geofence_lat double precision,
  geofence_lng double precision,
  geofence_radius_m numeric,
  pwa_self_service_enabled boolean,
  pwa_self_service_locked boolean,
  pwa_self_service_completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_ctx record;
begin
  select * into v_ctx from attendance.resolve_my_employee_context();

  return query
  select
    e.tenant_id,
    e.id as employee_id,
    ep.employee_code,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.address,
    ep.work_mode,
    ep.allow_remote_pwa,
    ep.geofence_lat,
    ep.geofence_lng,
    ep.geofence_radius_m,
    ep.pwa_self_service_enabled,
    ep.pwa_self_service_locked,
    ep.pwa_self_service_completed_at
  from public.employees e
  join attendance.employee_profile ep on ep.employee_id = e.id
  where e.tenant_id = v_ctx.tenant_id
    and e.id = v_ctx.employee_id;
end;
$$;

grant execute on function attendance.get_my_pwa_self_service_profile() to authenticated;

create or replace function attendance.save_my_pwa_self_service_profile(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text default null,
  p_address text default null,
  p_geofence_lat double precision default null,
  p_geofence_lng double precision default null,
  p_geofence_accuracy_m numeric default null
)
returns table (
  employee_id uuid,
  saved_at timestamptz,
  locked boolean
)
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_ctx record;
  v_profile attendance.employee_profile%rowtype;
  v_meta jsonb;
begin
  select * into v_ctx from attendance.resolve_my_employee_context();

  select * into v_profile
  from attendance.employee_profile ep
  where ep.tenant_id = v_ctx.tenant_id
    and ep.employee_id = v_ctx.employee_id
  for update;

  if not found then
    raise exception 'No se encontró el perfil de asistencia del empleado';
  end if;

  if coalesce(v_profile.pwa_self_service_enabled, false) = false then
    raise exception 'La revisión de datos personales no está habilitada para este empleado';
  end if;

  if coalesce(v_profile.pwa_self_service_locked, false) then
    raise exception 'La edición ya fue bloqueada. Solicita en Base que vuelvan a habilitarla';
  end if;

  if coalesce(v_profile.geofence_radius_m, 0) <= 0 then
    raise exception 'No existe un rango GPS válido configurado desde Base';
  end if;

  if p_geofence_lat is null or p_geofence_lng is null then
    raise exception 'Debes registrar la georreferenciación del puesto de trabajo';
  end if;

  update public.employees
  set first_name = nullif(trim(p_first_name), ''),
      last_name = nullif(trim(p_last_name), ''),
      email = nullif(trim(p_email), ''),
      phone = nullif(trim(p_phone), ''),
      address = nullif(trim(p_address), ''),
      updated_at = now()
  where tenant_id = v_ctx.tenant_id
    and id = v_ctx.employee_id;

  v_meta := jsonb_build_object(
    'hrcloud',
    jsonb_build_object(
      'self_service_gps',
      jsonb_build_object(
        'lat', p_geofence_lat,
        'lng', p_geofence_lng,
        'accuracy_m', p_geofence_accuracy_m,
        'saved_at', now()
      )
    )
  );

  update attendance.employee_profile
  set geofence_lat = p_geofence_lat,
      geofence_lng = p_geofence_lng,
      pwa_self_service_locked = true,
      pwa_self_service_completed_at = now(),
      photo_meta = coalesce(photo_meta, '{}'::jsonb) || v_meta,
      updated_at = now()
  where tenant_id = v_ctx.tenant_id
    and employee_id = v_ctx.employee_id;

  return query
  select v_ctx.employee_id, now(), true;
end;
$$;

grant execute on function attendance.save_my_pwa_self_service_profile(text,text,text,text,text,double precision,double precision,numeric) to authenticated;

notify pgrst, 'reload schema';
commit;
