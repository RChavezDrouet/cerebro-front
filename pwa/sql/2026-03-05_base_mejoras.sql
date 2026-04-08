-- HRCloud Base — Mejoras 05-Mar-2026
-- Ejecutar en Supabase SQL Editor (como owner/service role)

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
  biometric_methods text[]
)
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  tz text;
begin
  perform attendance.assert_tenant_access(p_tenant_id);

  select coalesce(to_jsonb(mp)->>'tenant_timezone', to_jsonb(mp)->>'timezone', 'UTC')
    into tz
  from attendance.marking_parameters mp
  where mp.tenant_id = p_tenant_id
  limit 1;

  tz := coalesce(tz, 'UTC');

  return query
  select
    (p.punched_at at time zone tz)::date as work_date,
    p.employee_id,
    array_agg(distinct coalesce(p.source, 'unknown')) as sources,
    array_remove(array_agg(distinct case
      when coalesce(p.source,'') = 'biometric' then coalesce(p.meta->>'biometric_method', p.meta->>'method', 'biometric')
      else null
    end), null) as biometric_methods
  from attendance.punches p
  where p.tenant_id = p_tenant_id
    and (p.punched_at at time zone tz)::date between p_date_from and p_date_to
  group by 1,2;
end;
$$;

grant execute on function attendance.get_punch_sources_summary(uuid,date,date) to authenticated;

-- 4) Importación USB (XLSX/CSV -> JSON)
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
  ptype text;
  psource text;
  bmethod text;
  emp_id uuid;
  inserted_count int := 0;
  unmatched_count int := 0;
  has_unmatched_col boolean := false;
  has_meta_col boolean := false;
  punched timestamptz;
  is_timestamptz boolean;
begin
  perform attendance.assert_tenant_access(p_tenant_id);

  select coalesce(to_jsonb(mp)->>'tenant_timezone', to_jsonb(mp)->>'timezone', 'UTC')
    into tz
  from attendance.marking_parameters mp
  where mp.tenant_id = p_tenant_id
  limit 1;

  tz := coalesce(tz, 'UTC');

  select exists(select 1 from information_schema.columns where table_schema='attendance' and table_name='punches' and column_name='unmatched_employee_code')
    into has_unmatched_col;

  select exists(select 1 from information_schema.columns where table_schema='attendance' and table_name='punches' and column_name='meta')
    into has_meta_col;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    code := nullif(trim(coalesce(r->>'employee_code','')), '');
    ts_text := nullif(trim(coalesce(r->>'punched_at','')), '');
    ptype := lower(nullif(trim(coalesce(r->>'type','in')), ''));
    psource := lower(nullif(trim(coalesce(r->>'source','usb')), ''));
    bmethod := nullif(trim(coalesce(r->>'biometric_method','')), '');

    if code is null or ts_text is null then
      continue;
    end if;

    select e.id into emp_id
    from attendance.employees e
    where e.tenant_id = p_tenant_id and e.employee_code = code
    limit 1;

    is_timestamptz := ts_text ~* '(z$|[+-][0-9]{2}(:?[0-9]{2})?$)';
    if is_timestamptz then
      punched := ts_text::timestamptz;
    else
      punched := (ts_text::timestamp at time zone tz);
    end if;

    if emp_id is not null then
      if has_meta_col then
        insert into attendance.punches(tenant_id, employee_id, punched_at, type, source, meta)
        values (p_tenant_id, emp_id, punched, ptype, psource, jsonb_build_object('import','usb','biometric_method',bmethod));
      else
        insert into attendance.punches(tenant_id, employee_id, punched_at, type, source)
        values (p_tenant_id, emp_id, punched, ptype, psource);
      end if;
      inserted_count := inserted_count + 1;
    else
      unmatched_count := unmatched_count + 1;
      if has_unmatched_col then
        if has_meta_col then
          insert into attendance.punches(tenant_id, employee_id, punched_at, type, source, unmatched_employee_code, meta)
          values (p_tenant_id, null, punched, ptype, psource, code, jsonb_build_object('import','usb','unmatched_employee_code',code,'biometric_method',bmethod));
        else
          insert into attendance.punches(tenant_id, employee_id, punched_at, type, source, unmatched_employee_code)
          values (p_tenant_id, null, punched, ptype, psource, code);
        end if;
      else
        if has_meta_col then
          insert into attendance.punches(tenant_id, employee_id, punched_at, type, source, meta)
          values (p_tenant_id, null, punched, ptype, psource, jsonb_build_object('import','usb','unmatched_employee_code',code,'biometric_method',bmethod));
        else
          raise exception 'punches table does not support unmatched rows (missing meta + unmatched_employee_code)';
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object('inserted', inserted_count, 'unmatched', unmatched_count, 'timezone_used', tz);
end;
$$;

grant execute on function attendance.import_usb_punches(uuid,jsonb) to authenticated;

-- 5) KPIs por periodo (SQL-first sobre el motor del reporte diario)
-- Requiere: attendance.get_daily_attendance_report(p_tenant_id, p_date_from, p_date_to)
create or replace function attendance.get_kpi_attendance_by_department(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table(
  department_name text,
  a_tiempo int,
  atrasado int,
  anticipada int,
  novedad int,
  total int
)
language sql
security definer
set search_path = public, attendance
as $$
  select
    coalesce(department_name,'(Sin departamento)') as department_name,
    count(*) filter (where upper(coalesce(day_status,'')) like '%A_TIEM%') as a_tiempo,
    count(*) filter (where upper(coalesce(day_status,'')) like '%ATRAS%') as atrasado,
    count(*) filter (where upper(coalesce(day_status,'')) like '%ANTIC%') as anticipada,
    count(*) filter (where upper(coalesce(day_status,'')) like '%NOVE%') as novedad,
    count(*) as total
  from attendance.get_daily_attendance_report(p_tenant_id, p_date_from, p_date_to)
  group by 1
  order by 1;
$$;

grant execute on function attendance.get_kpi_attendance_by_department(uuid,date,date) to authenticated;

create or replace function attendance.get_kpi_attendance_by_turn(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table(
  turn_name text,
  a_tiempo int,
  atrasado int,
  anticipada int,
  novedad int,
  total int
)
language sql
security definer
set search_path = public, attendance
as $$
  select
    coalesce(turn_name, schedule_name, '(Sin turno)') as turn_name,
    count(*) filter (where upper(coalesce(day_status,'')) like '%A_TIEM%') as a_tiempo,
    count(*) filter (where upper(coalesce(day_status,'')) like '%ATRAS%') as atrasado,
    count(*) filter (where upper(coalesce(day_status,'')) like '%ANTIC%') as anticipada,
    count(*) filter (where upper(coalesce(day_status,'')) like '%NOVE%') as novedad,
    count(*) as total
  from attendance.get_daily_attendance_report(p_tenant_id, p_date_from, p_date_to)
  group by 1
  order by 1;
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
  department_name text,
  atrasos int,
  anticipadas int,
  novedades int,
  score int
)
language sql
security definer
set search_path = public, attendance
as $$
  with base as (
    select *
    from attendance.get_daily_attendance_report(p_tenant_id, p_date_from, p_date_to)
  )
  select
    employee_id,
    employee_code,
    employee_name,
    department_name,
    count(*) filter (where upper(coalesce(day_status,'')) like '%ATRAS%') as atrasos,
    count(*) filter (where upper(coalesce(day_status,'')) like '%ANTIC%') as anticipadas,
    count(*) filter (where upper(coalesce(day_status,'')) like '%NOVE%') as novedades,
    (
      count(*) filter (where upper(coalesce(day_status,'')) like '%ATRAS%') +
      count(*) filter (where upper(coalesce(day_status,'')) like '%ANTIC%') +
      count(*) filter (where upper(coalesce(day_status,'')) like '%NOVE%')
    ) as score
  from base
  group by 1,2,3,4
  order by score desc, employee_name asc
  limit greatest(p_limit, 1);
$$;

grant execute on function attendance.get_kpi_ranking(uuid,date,date,int) to authenticated;

commit;
