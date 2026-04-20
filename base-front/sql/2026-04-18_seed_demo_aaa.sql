-- ============================================================
-- HRCloud Base demo seed for tenant resolved from aaa@prueba.com
-- Corrected core seed focused on employee persistence and biometric binding.
-- ============================================================

begin;

create extension if not exists pgcrypto;
create schema if not exists attendance;

do $$
declare
  v_email constant text := lower('aaa@prueba.com');
  v_tenant uuid;
  v_biometric_device_id uuid;
  v_candidate_count int;
  v_profile_cols text[];
  v_profile_user_col text;
  v_profile_email_cols text[];
  v_tenant_email_cols text[];
  v_dept_dg uuid;
  v_dept_fin uuid;
  v_dept_con uuid;
  v_dept_prod uuid;
  v_dept_fab uuid;
  v_dept_tal uuid;
  v_dept_ti uuid;
  v_dept_hd uuid;
  v_sched_diurno uuid;
  v_sched_vesp uuid;
  v_sched_noct uuid;
  r record;
begin
  create temporary table seed_roster (
    seq int primary key,
    employee_id uuid not null,
    employee_code text not null,
    employee_number text not null,
    first_name text not null,
    last_name text not null,
    email text not null,
    identification text not null,
    address text,
    salary numeric not null,
    employment_status text not null,
    department_name text not null,
    schedule_name text not null,
    work_mode text not null,
    position text not null,
    birth_date date not null,
    marital_status text not null,
    nationality text not null,
    emergency_contact_name text not null,
    emergency_contact_relationship text not null,
    emergency_contact_phone text not null,
    is_unit_leader boolean not null default false,
    pwa_enabled boolean not null default false,
    geo_radius_m numeric,
    geo_lat numeric,
    geo_lng numeric,
    has_disability boolean not null default false,
    disability_percentage numeric,
    facial_photo_url text
  ) on commit drop;

  create temporary table seed_summary (
    metric text primary key,
    amount bigint not null
  ) on commit drop;

  create temporary table tmp_tenant_candidates (
    tenant_id uuid not null,
    source text not null,
    ref_id uuid
  ) on commit drop;

  insert into seed_roster (
    seq,
    employee_id,
    employee_code,
    employee_number,
    first_name,
    last_name,
    email,
    identification,
    address,
    salary,
    employment_status,
    department_name,
    schedule_name,
    work_mode,
    position,
    birth_date,
    marital_status,
    nationality,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
    is_unit_leader,
    pwa_enabled,
    geo_radius_m,
    geo_lat,
    geo_lng,
    has_disability,
    disability_percentage,
    facial_photo_url
  ) values
    (1, gen_random_uuid(), ''AAA001'', ''HR-001'', ''Sofía'', ''Montalvo'', ''sofia.montalvo@aaa.prueba.com'', ''1712345678'', ''Av. 6 de Diciembre y Naciones Unidas, Quito'', 2200, ''active'', ''Dirección General'', ''Diurno 08:00-17:00'', ''PRESENCIAL'', ''Directora General'', ''1990-03-14'', ''CASADO'', ''Ecuatoriana'', ''Carlos Montalvo'', ''Hermano'', ''0991234567'', true, false, 150, -0.1807, -78.4678, false, null, ''https://placehold.co/256x256/png?text=SM''),
    (2, gen_random_uuid(), ''AAA002'', ''HR-002'', ''Javier'', ''Paredes'', ''javier.paredes@aaa.prueba.com'', ''1712345679'', ''Av. Amazonas y Colón, Quito'', 1450, ''active'', ''Finanzas'', ''Vespertino 14:00-22:00'', ''MIXTO'', ''Analista Contable'', ''1992-08-21'', ''SOLTERO'', ''Ecuatoriana'', ''Ana Paredes'', ''Madre'', ''0991234568'', true, true, 120, -0.1810, -78.4682, false, null, ''https://placehold.co/256x256/png?text=JP''),
    (3, gen_random_uuid(), ''AAA003'', ''HR-003'', ''Daniela'', ''Cedeño'', ''daniela.cedeno@aaa.prueba.com'', ''1712345680'', ''Av. República y Atahualpa, Quito'', 1100, ''active'', ''TI'', ''Diurno 08:00-17:00'', ''REMOTO'', ''HelpDesk'', ''1996-02-03'', ''SOLTERO'', ''Ecuatoriana'', ''Pedro Cedeño'', ''Padre'', ''0991234569'', false, true, 80, null, null, false, null, ''https://placehold.co/256x256/png?text=DC'');

  select array_agg(column_name order by ordinal_position)
    into v_profile_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles';

  if v_profile_cols is null then
    raise exception 'No se encontrÃ³ public.profiles; no se puede resolver aaa@prueba.com';
  end if;

  if 'user_id' = any(v_profile_cols) then
    v_profile_user_col := 'user_id';
  elsif 'id' = any(v_profile_cols) then
    v_profile_user_col := 'id';
  else
    raise exception 'public.profiles no tiene columna id ni user_id; no se puede resolver aaa@prueba.com';
  end if;

  select array_remove(array_agg(column_name order by ordinal_position), null)
    into v_profile_email_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name in ('email', 'user_email', 'contact_email', 'profile_email');

  select array_remove(array_agg(column_name order by ordinal_position), null)
    into v_tenant_email_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'tenants'
    and column_name in ('email', 'contact_email', 'owner_email', 'admin_email', 'company_email');

  begin
    execute format(
      'insert into tmp_tenant_candidates (tenant_id, source, ref_id)
       select distinct p.tenant_id, ''profiles/auth.users'', u.id
       from auth.users u
       join public.profiles p on p.%I = u.id
       where lower(u.email) = $1',
      v_profile_user_col
    ) using v_email;
  exception
    when undefined_table then
      null;
    when insufficient_privilege then
      null;
  end;

  if v_profile_email_cols is not null and array_length(v_profile_email_cols, 1) > 0 then
    execute format(
      'insert into tmp_tenant_candidates (tenant_id, source, ref_id)
       select distinct p.tenant_id, ''profiles/email'', null::uuid
       from public.profiles p
       where lower(coalesce(%s)) = $1',
      array_to_string(
        array(
          select format('p.%I', c)
          from unnest(v_profile_email_cols) as c
        ),
        ', '
      )
    ) using v_email;
  end if;

  if v_tenant_email_cols is not null and array_length(v_tenant_email_cols, 1) > 0 then
    execute format(
      'insert into tmp_tenant_candidates (tenant_id, source, ref_id)
       select distinct t.id, ''tenants/email'', null::uuid
       from public.tenants t
       where lower(coalesce(%s)) = $1',
      array_to_string(
        array(
          select format('t.%I', c)
          from unnest(v_tenant_email_cols) as c
        ),
        ', '
      )
    ) using v_email;
  end if;

  select count(distinct tenant_id)
    into v_candidate_count
  from tmp_tenant_candidates;

  if v_candidate_count = 0 then
    raise exception 'No se pudo resolver un tenant para %', v_email;
  elsif v_candidate_count > 1 then
    raise exception 'El correo % resuelve mÃºltiples tenants. Revisa public.profiles/public.tenants/auth.users antes de continuar.', v_email;
  end if;

  select tenant_id
    into v_tenant
  from tmp_tenant_candidates
  group by tenant_id;

  if v_tenant is null then
    raise exception 'No se pudo resolver un tenant unÃ­voco para %', v_email;
  end if;

  raise notice 'Tenant resuelto para % => %', v_email, v_tenant;

  select id into v_dept_dg   from public.departments where tenant_id = v_tenant and name = 'DirecciÃ³n General' limit 1;
  select id into v_dept_fin  from public.departments where tenant_id = v_tenant and name = 'Finanzas' limit 1;
  select id into v_dept_con  from public.departments where tenant_id = v_tenant and name = 'Contabilidad' limit 1;
  select id into v_dept_prod from public.departments where tenant_id = v_tenant and name = 'ProducciÃ³n' limit 1;
  select id into v_dept_fab  from public.departments where tenant_id = v_tenant and name = 'FÃ¡brica' limit 1;
  select id into v_dept_tal  from public.departments where tenant_id = v_tenant and name = 'Talleres' limit 1;
  select id into v_dept_ti   from public.departments where tenant_id = v_tenant and name = 'TI' limit 1;
  select id into v_dept_hd   from public.departments where tenant_id = v_tenant and name = 'HelpDesk' limit 1;

  select id into v_sched_diurno from attendance.schedules where tenant_id = v_tenant and name = 'Diurno 08:00-17:00' limit 1;
  select id into v_sched_vesp   from attendance.schedules where tenant_id = v_tenant and name = 'Vespertino 14:00-22:00' limit 1;
  select id into v_sched_noct   from attendance.schedules where tenant_id = v_tenant and name = 'Nocturno 22:00-06:00' limit 1;

  if v_sched_diurno is null or v_sched_vesp is null or v_sched_noct is null then
    raise exception 'No se pudieron resolver horarios base en attendance.schedules';
  end if;

  select id
    into v_biometric_device_id
  from attendance.biometric_devices
  where tenant_id = v_tenant
    and serial_no = '8029252100142'
  limit 1;

  if v_biometric_device_id is null then
    raise exception 'No se encontrÃ³ el biomÃ©trico serial_no=8029252100142 para el tenant resuelto %', v_tenant;
  end if;

  delete from public.departments
   where tenant_id = v_tenant
     and name in ('DirecciÃ³n General', 'Finanzas', 'Contabilidad', 'ProducciÃ³n', 'FÃ¡brica', 'Talleres', 'TI', 'HelpDesk');

  insert into public.departments (id, tenant_id, name, description, is_active, created_at, updated_at)
  values
    (gen_random_uuid(), v_tenant, 'DirecciÃ³n General', 'DirecciÃ³n y gerencia', true, now(), now()),
    (gen_random_uuid(), v_tenant, 'Finanzas', 'GestiÃ³n financiera', true, now(), now()),
    (gen_random_uuid(), v_tenant, 'Contabilidad', 'Contabilidad y cuentas por pagar', true, now(), now()),
    (gen_random_uuid(), v_tenant, 'ProducciÃ³n', 'CoordinaciÃ³n de planta', true, now(), now()),
    (gen_random_uuid(), v_tenant, 'FÃ¡brica', 'OperaciÃ³n de fÃ¡brica', true, now(), now()),
    (gen_random_uuid(), v_tenant, 'Talleres', 'Mantenimiento y taller', true, now(), now()),
    (gen_random_uuid(), v_tenant, 'TI', 'TecnologÃ­a de la informaciÃ³n', true, now(), now()),
    (gen_random_uuid(), v_tenant, 'HelpDesk', 'Mesa de ayuda', true, now(), now());

  delete from public.employees
   where tenant_id = v_tenant
     and employee_number in (select employee_number from seed_roster);

  insert into public.employees (
    id,
    tenant_id,
    user_id,
    employee_code,
    employee_number,
    first_name,
    last_name,
    full_name,
    email,
    identification,
    cedula,
    department_id,
    hire_date,
    employment_status,
    salary,
    base_salary,
    position,
    address,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relation,
    facial_photo_url,
    vacation_start,
    vacation_end,
    lunch_tracking,
    work_modality,
    presential_days,
    entry_biometric_id,
    exit_biometric_id,
    is_department_head,
    has_disability,
    disability_percentage,
    identification_type,
    civil_status,
    nationality,
    birth_date,
    created_at,
    updated_at
  )
  select
    r.employee_id,
    v_tenant,
    null,
    r.employee_code,
    r.employee_number,
    r.first_name,
    r.last_name,
    trim(concat_ws(' ', r.first_name, r.last_name)),
    r.email,
    r.identification,
    r.identification,
    case
      when r.department_name = 'DirecciÃ³n General' then v_dept_dg
      when r.department_name = 'Finanzas' then v_dept_fin
      when r.department_name = 'Contabilidad' then v_dept_con
      when r.department_name = 'ProducciÃ³n' then v_dept_prod
      when r.department_name = 'FÃ¡brica' then v_dept_fab
      when r.department_name = 'Talleres' then v_dept_tal
      when r.department_name = 'TI' then v_dept_ti
      when r.department_name = 'HelpDesk' then v_dept_hd
      else null
    end,
    date '2025-01-01' + (r.seq * 13),
    r.employment_status,
    r.salary,
    r.salary,
    r.position,
    r.address,
    r.emergency_contact_name,
    r.emergency_contact_phone,
    r.emergency_contact_relationship,
    r.facial_photo_url,
    null,
    null,
    case when upper(r.work_mode) <> 'REMOTO' then true else false end,
    case
      when upper(r.work_mode) = 'REMOTO' then 'remoto'
      when upper(r.work_mode) = 'MIXTO' then 'mixto'
      else 'presencial'
    end,
    array[1,2,3,4,5],
    case when upper(r.work_mode) in ('PRESENCIAL', 'MIXTO') then v_biometric_device_id else null end,
    case when upper(r.work_mode) in ('PRESENCIAL', 'MIXTO') then v_biometric_device_id else null end,
    r.is_unit_leader,
    r.has_disability,
    r.disability_percentage,
    'CEDULA',
    r.marital_status,
    r.nationality,
    r.birth_date,
    now(),
    now()
  from seed_roster r;

  delete from attendance.employees
   where tenant_id = v_tenant
     and employee_code in (select employee_code from seed_roster);

  insert into attendance.employees (
    id,
    tenant_id,
    user_id,
    employee_code,
    first_name,
    last_name,
    status,
    schedule_id,
    biometric_employee_code,
    created_at
  )
  select
    r.employee_id,
    v_tenant,
    null,
    r.employee_code,
    r.first_name,
    r.last_name,
    case when upper(r.employment_status) in ('TERMINATED', 'INACTIVE') then 'inactive' else 'active' end,
    case
      when r.schedule_name = 'Vespertino 14:00-22:00' then v_sched_vesp
      when r.schedule_name = 'Nocturno 22:00-06:00' then v_sched_noct
      else v_sched_diurno
    end,
    r.employee_code,
    now()
  from seed_roster r;

  delete from attendance.employee_profile
   where tenant_id = v_tenant
     and employee_id in (select employee_id from seed_roster);

  insert into attendance.employee_profile (
    employee_id,
    tenant_id,
    employee_code,
    status,
    biometric_employee_code,
    entry_biometric_id,
    exit_biometric_id,
    work_mode,
    allow_remote_pwa,
    geofence_lat,
    geofence_lng,
    geofence_radius_m,
    pwa_self_service_enabled,
    pwa_self_service_locked,
    pwa_self_service_requested_at,
    pwa_self_service_completed_at,
    photo_meta,
    updated_at
  )
  select
    r.employee_id,
    v_tenant,
    r.employee_code,
    case
      when upper(r.employment_status) in ('TERMINATED', 'INACTIVE') then 'inactive'
      when upper(r.employment_status) in ('VACATION', 'ON_LEAVE') then 'vacation'
      else 'active'
    end,
    r.employee_code,
    case when upper(r.work_mode) in ('PRESENCIAL', 'MIXTO') then v_biometric_device_id else null end,
    case when upper(r.work_mode) in ('PRESENCIAL', 'MIXTO') then v_biometric_device_id else null end,
    lower(r.work_mode),
    case when upper(r.work_mode) in ('REMOTO', 'MIXTO') then true else false end,
    r.geo_lat,
    r.geo_lng,
    r.geo_radius_m,
    coalesce(r.pwa_enabled, false),
    false,
    case when coalesce(r.pwa_enabled, false) then now() else null end,
    null,
    jsonb_build_object(
      'seed', 'aaa',
      'tenant', v_tenant::text,
      'employee_number', r.employee_number,
      'identification', r.identification,
      'salary', r.salary,
      'position', r.position,
      'work_mode', r.work_mode,
      'pwa_enabled', r.pwa_enabled
    ),
    now()
  from seed_roster r;

  raise notice 'Seed preparado para tenant % con biomÃ©trico %', v_tenant, v_biometric_device_id;
end $$;

commit;
