-- HRCloud Base — Mejoras 05-Mar-2026 (v4.7.1)
-- Ejecutar en Supabase SQL Editor (como owner/service role)
-- NOTA: Este script está alineado al modelo real observado en tu Supabase:
-- - Empleado maestro: public.employees
-- - Perfil asistencia: attendance.employee_profile
-- - Marcaciones: attendance.punches (SIN columna type; verify_type/status son GENERATED desde meta)

begin;

-- 0) Helper: seguridad multi-tenant
create or replace function attendance.assert_tenant_access(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, attendance
as $$
begin
  if auth.uid() is null then
    raise exception 'access denied (no auth)';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.tenant_id = p_tenant_id
  ) then
    raise exception 'access denied (wrong tenant)';
  end if;
end;
$$;

grant execute on function attendance.assert_tenant_access(uuid) to authenticated;

-- 0.1) Vista recomendada para el frontend (lectura): public.v_employees_full
-- Combina HR + Attendance + Departamento (public.departments)
create or replace view public.v_employees_full as
select
  e.id,
  e.tenant_id,
  e.user_id,
  ep.employee_code,
  e.employee_number,
  e.first_name,
  e.last_name,
  e.email,
  e.identification,
  e.department_id,
  d.name as department_name,
  e.hire_date,
  e.salary,
  e.employment_status,
  e.position,
  e.work_shift_id,
  e.facial_photo_url,
  ep.status as attendance_status,
  ep.schedule_id,
  ep.biometric_employee_code,
  ep.work_mode,
  ep.employee_type,
  ep.allow_remote_pwa,
  ep.onsite_days,
  ep.geofence_lat,
  ep.geofence_lng,
  ep.geofence_radius_m,
  ep.photo_url,
  ep.photo_path,
  ep.photo_meta,
  (ep.photo_meta->'hrcloud'->>'vacation_start')::date as vacation_start,
  (ep.photo_meta->'hrcloud'->>'vacation_end')::date as vacation_end,
  coalesce((ep.photo_meta->'hrcloud'->>'lunch_tracking')::boolean, true) as lunch_tracking,
  ep.first_login_pending,
  e.created_at,
  e.updated_at
from public.employees e
join attendance.employee_profile ep
  on ep.employee_id = e.id
left join public.departments d
  on d.tenant_id = e.tenant_id
 and d.id = e.department_id;

-- 0.2) RPC transaccional para altas/ediciones de empleado
-- Escribe: public.employees + attendance.employee_profile
create or replace function attendance.upsert_employee_full(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_employee_code text,
  p_first_name text,
  p_last_name text,
  p_email text,
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
  v_hr jsonb;
  v_att_status text;
  v_photo_meta jsonb;
begin
  perform attendance.assert_tenant_access(p_tenant_id);

  if v_id is null then
    v_id := gen_random_uuid();
  end if;

  -- Status operativo (reporte diario usa attendance_status)
  v_att_status := case upper(coalesce(p_employment_status,'ACTIVE'))
    when 'ACTIVE' then 'active'
    when 'VACATION' then 'vacation'
    when 'SUSPENDED' then 'inactive'
    when 'TERMINATED' then 'inactive'
    else lower(p_employment_status)
  end;

  -- Guardar metadatos no-core sin romper el esquema (namespacing)
  v_photo_meta := jsonb_build_object(
    'hrcloud',
    jsonb_build_object(
      'vacation_start', p_vacation_start,
      'vacation_end', p_vacation_end,
      'lunch_tracking', coalesce(p_lunch_tracking, true)
    )
  );

  insert into public.employees(
    id, tenant_id, first_name, last_name, email, identification, department_id,
    hire_date, salary, employment_status, facial_photo_url, updated_at
  )
  values(
    v_id, p_tenant_id, p_first_name, p_last_name, nullif(p_email,''), p_identification, p_department_id,
    coalesce(p_hire_date, current_date), p_salary, lower(coalesce(p_employment_status,'active')), p_facial_photo_url, now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
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

grant execute on function attendance.upsert_employee_full(uuid,uuid,text,text,text,text,text,uuid,date,numeric,text,text,date,date,boolean) to authenticated;

-- 1) Feriados
create table if not exists attendance.holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  holiday_date date not null,
  name text not null,
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_att_holidays_tenant_date on attendance.holidays(tenant_id, holiday_date);

alter table attendance.holidays enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='attendance' and tablename='holidays' and policyname='holidays_select'
  ) then
    execute $$
      create policy holidays_select on attendance.holidays
      for select to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.tenant_id = holidays.tenant_id));
    $$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='attendance' and tablename='holidays' and policyname='holidays_write'
  ) then
    execute $$
      create policy holidays_write on attendance.holidays
      for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.tenant_id = holidays.tenant_id))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.tenant_id = holidays.tenant_id));
    $$;
  end if;
end $$;

-- 2) Config KPI (Top X, widgets, tipo de gráfica)
create table if not exists attendance.kpi_settings (
  tenant_id uuid primary key,
  ranking_limit int not null default 10,
  chart_type text not null default 'bar',
  dashboard_widgets jsonb not null default jsonb_build_array('turn','department','ranking'),
  updated_at timestamptz not null default now()
);

alter table attendance.kpi_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='attendance' and tablename='kpi_settings' and policyname='kpi_settings_select'
  ) then
    execute $$
      create policy kpi_settings_select on attendance.kpi_settings
      for select to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.tenant_id = kpi_settings.tenant_id));
    $$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='attendance' and tablename='kpi_settings' and policyname='kpi_settings_write'
  ) then
    execute $$
      create policy kpi_settings_write on attendance.kpi_settings
      for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.tenant_id = kpi_settings.tenant_id))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.tenant_id = kpi_settings.tenant_id));
    $$;
  end if;
end $$;

-- 3) Fuente de marcación (PWA / Biometrico / USB)
create or replace function attendance.get_punch_sources_summary(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table(
  work_date date,
  employee_id uuid,
  sources text[],
  biometric_verify_types text[],
  serial_nos text[]
)
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  tz text;
begin
  perform attendance.assert_tenant_access(p_tenant_id);

  tz := attendance.get_tenant_timezone(p_tenant_id);

  return query
  select
    (p.punched_at at time zone tz)::date as work_date,
    p.employee_id,
    array_agg(distinct upper(coalesce(p.source, 'UNKNOWN'))) as sources,
    array_remove(array_agg(distinct case when lower(coalesce(p.source,'')) = 'biometric' then p.verify_type else null end), null) as biometric_verify_types,
    array_remove(array_agg(distinct p.serial_no), null) as serial_nos
  from attendance.punches p
  where p.tenant_id = p_tenant_id
    and (p.punched_at at time zone tz)::date between p_date_from and p_date_to
  group by 1,2;
end;
$$;

grant execute on function attendance.get_punch_sources_summary(uuid,date,date) to authenticated;

-- 4) Importación USB (XLSX/CSV -> JSON) — alineado a attendance.punches real
-- Columnas esperadas en p_rows (JSON array):
-- - employee_code (obligatorio)
-- - punched_at (obligatorio)  ej: '2026-03-05 08:03' (se interpreta en TZ del tenant) o ISO con TZ
-- - source (opcional) default 'USB'
-- - status (opcional) => se guarda en meta.status (status es GENERATED)
-- - verify_type (opcional) => se guarda en meta.verify_type (verify_type es GENERATED)
-- - serial_no / sn (opcional)
-- - biometric_employee_code / pin (opcional)
create or replace function attendance.import_usb_punches(
  p_tenant_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  tz text;
  r jsonb;
  code text;
  ts_text text;
  psource text;
  v_status text;
  v_verify_type text;
  v_serial text;
  v_pin text;
  emp_id uuid;
  inserted_count int := 0;
  unmatched_count int := 0;
  punched timestamptz;
begin
  perform attendance.assert_tenant_access(p_tenant_id);
  tz := attendance.get_tenant_timezone(p_tenant_id);

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    code := nullif(trim(coalesce(r->>'employee_code','')), '');
    ts_text := nullif(trim(coalesce(r->>'punched_at','')), '');
    psource := coalesce(nullif(trim(coalesce(r->>'source','')), ''), 'USB');
    v_status := nullif(trim(coalesce(r->>'status','')), '');
    v_verify_type := nullif(trim(coalesce(r->>'verify_type','')), '');
    v_serial := coalesce(nullif(trim(coalesce(r->>'serial_no','')), ''), nullif(trim(coalesce(r->>'sn','')), ''));
    v_pin := coalesce(nullif(trim(coalesce(r->>'biometric_employee_code','')), ''), nullif(trim(coalesce(r->>'pin','')), ''));

    if code is null or ts_text is null then
      continue;
    end if;

    -- Parse timestamp: si viene con TZ explícita => timestamptz directo. Si no => interpretarlo en TZ tenant.
    begin
      if ts_text ~* '(z$|[+-][0-9]{2}:[0-9]{2}$)' then
        punched := ts_text::timestamptz;
      else
        punched := (ts_text::timestamp at time zone tz);
      end if;
    exception when others then
      continue;
    end;

    -- Resolver employee_id por employee_code (attendance.employees VIEW)
    select e.id into emp_id
    from attendance.employees e
    where e.tenant_id = p_tenant_id
      and e.employee_code = code
    limit 1;

    if emp_id is null then
      unmatched_count := unmatched_count + 1;
      insert into attendance.punches(tenant_id, employee_id, biometric_employee_code, punched_at, source, serial_no, meta)
      values(
        p_tenant_id,
        null,
        v_pin,
        punched,
        psource,
        v_serial,
        jsonb_strip_nulls(jsonb_build_object(
          'unmatched', true,
          'unmatched_reason', 'employee_code sin match: ' || code,
          'employee_code', code,
          'status', v_status,
          'verify_type', v_verify_type,
          'sn', v_serial
        ))
      );
    else
      inserted_count := inserted_count + 1;
      insert into attendance.punches(tenant_id, employee_id, biometric_employee_code, punched_at, source, serial_no, meta)
      values(
        p_tenant_id,
        emp_id,
        v_pin,
        punched,
        psource,
        v_serial,
        jsonb_strip_nulls(jsonb_build_object(
          'status', v_status,
          'verify_type', v_verify_type,
          'sn', v_serial
        ))
      );
    end if;
  end loop;

  return jsonb_build_object('inserted', inserted_count, 'unmatched', unmatched_count);
end;
$$;

grant execute on function attendance.import_usb_punches(uuid,jsonb) to authenticated;

-- 5) KPIs (sin cambios; consumen get_daily_attendance_report)
create or replace function attendance.get_kpi_attendance_by_department(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table(
  department_name text,
  total int,
  a_tiempo int,
  atrasado int,
  anticipada int,
  novedad int
)
language sql
security definer
set search_path = public, attendance
as $$
  select
    coalesce(r.department_name, 'Sin departamento') as department_name,
    count(*)::int as total,
    sum((r.day_status = 'A_TIEMPO')::int)::int as a_tiempo,
    sum((r.day_status = 'ATRASADO')::int)::int as atrasado,
    sum((r.day_status = 'ANTICIPADA')::int)::int as anticipada,
    sum((r.day_status = 'NOVEDAD')::int)::int as novedad
  from attendance.get_daily_attendance_report(p_tenant_id, p_date_from, p_date_to) r
  group by 1
  order by total desc;
$$;

grant execute on function attendance.get_kpi_attendance_by_department(uuid,date,date) to authenticated;

create or replace function attendance.get_kpi_attendance_by_turn(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table(
  turn_name text,
  total int,
  a_tiempo int,
  atrasado int,
  anticipada int,
  novedad int
)
language sql
security definer
set search_path = public, attendance
as $$
  select
    coalesce(r.turn_name, 'Sin turno') as turn_name,
    count(*)::int as total,
    sum((r.day_status = 'A_TIEMPO')::int)::int as a_tiempo,
    sum((r.day_status = 'ATRASADO')::int)::int as atrasado,
    sum((r.day_status = 'ANTICIPADA')::int)::int as anticipada,
    sum((r.day_status = 'NOVEDAD')::int)::int as novedad
  from attendance.get_daily_attendance_report(p_tenant_id, p_date_from, p_date_to) r
  group by 1
  order by total desc;
$$;

grant execute on function attendance.get_kpi_attendance_by_turn(uuid,date,date) to authenticated;

create or replace function attendance.get_kpi_ranking(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to date,
  p_limit int default 10
)
returns table(
  employee_id uuid,
  employee_code text,
  employee_name text,
  total int,
  atrasos int,
  novedades int
)
language sql
security definer
set search_path = public, attendance
as $$
  select
    r.employee_id,
    r.employee_code,
    r.employee_name,
    count(*)::int as total,
    sum((r.day_status = 'ATRASADO')::int)::int as atrasos,
    sum((r.day_status = 'NOVEDAD')::int)::int as novedades
  from attendance.get_daily_attendance_report(p_tenant_id, p_date_from, p_date_to) r
  group by 1,2,3
  order by atrasos desc, novedades desc, total desc
  limit greatest(coalesce(p_limit,10), 1);
$$;

grant execute on function attendance.get_kpi_ranking(uuid,date,date,int) to authenticated;

commit;
