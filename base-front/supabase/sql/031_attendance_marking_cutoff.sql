-- =======================================================
-- HRCloud Base — v4.6.3 (PATCH)
-- Marcación: cortes por turno (fuera de corte => NOVEDAD)
-- Fecha: 2026-03-02
--
-- Cambios:
-- 1) attendance.marking_parameters: agrega horas de corte por tipo de turno
-- 2) attendance.get_daily_attendance_report: excluye marcaciones > corte
--    y registra novedad "Marcación fuera de corte"
-- =======================================================

begin;

alter table attendance.marking_parameters
  add column if not exists cutoff_diurno_time time not null default '23:50',
  add column if not exists cutoff_vespertino_time time not null default '08:00',
  add column if not exists cutoff_nocturno_time time not null default '15:00';

-- Asegurar no-nulos en data existente
update attendance.marking_parameters
set
  cutoff_diurno_time     = coalesce(cutoff_diurno_time, '23:50'::time),
  cutoff_vespertino_time = coalesce(cutoff_vespertino_time, '08:00'::time),
  cutoff_nocturno_time   = coalesce(cutoff_nocturno_time, '15:00'::time)
where cutoff_diurno_time is null
   or cutoff_vespertino_time is null
   or cutoff_nocturno_time is null;

-- =======================================================
-- RPC Wrapper (resuelve tenant del usuario)
-- =======================================================
create or replace function attendance.get_daily_attendance_report(p_date_from date, p_date_to date)
returns table(
  tenant_id uuid,
  work_date date,
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  schedule_name text,
  turn_name text,
  employee_status text,
  employee_active boolean,
  entry_at timestamptz,
  lunch_out_at timestamptz,
  lunch_in_at timestamptz,
  exit_at timestamptz,
  entry_status text,
  lunch_out_status text,
  lunch_in_status text,
  exit_status text,
  day_status text,
  novelty text
)
language plpgsql
stable
security definer
set search_path to 'attendance', 'public'
as $$
declare
  v_tenant uuid;
begin
  v_tenant := attendance.current_tenant_id();
  if v_tenant is null then
    raise exception 'tenant_id not resolved for current user';
  end if;

  return query
  select *
  from attendance.get_daily_attendance_report(v_tenant, p_date_from, p_date_to);
end;
$$;

-- =======================================================
-- RPC Principal (admin/service_role puede pasar tenant)
-- =======================================================
create or replace function attendance.get_daily_attendance_report(p_tenant_id uuid, p_date_from date, p_date_to date)
returns table(
  tenant_id uuid,
  work_date date,
  employee_id uuid,
  employee_code text,
  employee_name text,
  department_name text,
  schedule_name text,
  turn_name text,
  employee_status text,
  employee_active boolean,
  entry_at timestamptz,
  lunch_out_at timestamptz,
  lunch_in_at timestamptz,
  exit_at timestamptz,
  entry_status text,
  lunch_out_status text,
  lunch_in_status text,
  exit_status text,
  day_status text,
  novelty text
)
language plpgsql
stable
security definer
set search_path to 'attendance', 'public'
as $$
declare
  v_tz text;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  v_tz := attendance.get_tenant_timezone(p_tenant_id);

  return query
  with
  mp as (
    select
      p_tenant_id as tenant_id,
      coalesce(tolerance_entry_min, 5) as tolerance_entry_min,
      coalesce(tolerance_exit_min, 5) as tolerance_exit_min,
      coalesce(tolerance_lunch_entry_min, 5) as tolerance_lunch_entry_min,
      coalesce(tolerance_lunch_exit_min, 5) as tolerance_lunch_exit_min,
      coalesce(duplicate_window_min, 3) as duplicate_window_min,
      coalesce(entry_early_window_min, 60) as entry_early_window_min,
      coalesce(exit_early_window_min, 180) as exit_early_window_min,
      coalesce(lunch_start_early_window_min, 30) as lunch_start_early_window_min,
      coalesce(lunch_end_early_window_min, 30) as lunch_end_early_window_min,
      coalesce(cutoff_diurno_time, '23:50'::time) as cutoff_diurno_time,
      coalesce(cutoff_vespertino_time, '08:00'::time) as cutoff_vespertino_time,
      coalesce(cutoff_nocturno_time, '15:00'::time) as cutoff_nocturno_time
    from attendance.marking_parameters mp0
    where mp0.tenant_id = p_tenant_id
    limit 1
  ),
  days as (
    select d::date as work_date
    from generate_series(p_date_from::timestamp, p_date_to::timestamp, interval '1 day') d
  ),
  base as (
    select
      e.tenant_id,
      d.work_date,
      e.id as employee_id,
      e.employee_code,
      trim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,'')) as employee_name,
      coalesce(dep.name, '') as department_name,
      coalesce(sch.name, '') as schedule_name,
      coalesce(trn.name, '') as turn_name,
      trn.type::text as turn_type,
      e.status::text as employee_status,
      (e.status::text = 'active') as employee_active,
      sch.entry_time,
      sch.exit_time,
      sch.crosses_midnight,
      sch.meal_enabled,
      sch.meal_start,
      sch.meal_end
    from attendance.employees e
    cross join days d
    left join attendance.departments dep
      on dep.tenant_id = e.tenant_id and dep.id = e.department_id
    left join attendance.schedules sch
      on sch.tenant_id = e.tenant_id and sch.id = e.schedule_id
    left join attendance.turns trn
      on trn.tenant_id = sch.tenant_id and trn.id = sch.turn_id
    where e.tenant_id = p_tenant_id
  ),
  computed as (
    select
      b.*,
      ((b.work_date::text || ' ' || coalesce(b.entry_time, '00:00:00')::text)::timestamp at time zone v_tz) as entry_dt,
      (
        (
          (case when coalesce(b.crosses_midnight,false) then (b.work_date + 1) else b.work_date end)::text
          || ' ' || coalesce(b.exit_time, '00:00:00')::text
        )::timestamp at time zone v_tz
      ) as exit_dt,
      (case when b.meal_enabled and b.meal_start is not null
        then ((b.work_date::text || ' ' || b.meal_start::text)::timestamp at time zone v_tz)
        else null end
      ) as lunch_start_dt,
      (case when b.meal_enabled and b.meal_end is not null
        then ((b.work_date::text || ' ' || b.meal_end::text)::timestamp at time zone v_tz)
        else null end
      ) as lunch_end_dt,
      -- Corte por turno:
      -- - Diurno: mismo día a cutoff_diurno_time
      -- - Vespertino: día siguiente a cutoff_vespertino_time
      -- - Nocturno: día siguiente a cutoff_nocturno_time
      (case
        when coalesce(b.turn_type,'diurno') = 'vespertino'
          then (((b.work_date + 1)::text || ' ' || (select cutoff_vespertino_time from mp)::text)::timestamp at time zone v_tz)
        when coalesce(b.turn_type,'diurno') = 'nocturno'
          then (((b.work_date + 1)::text || ' ' || (select cutoff_nocturno_time from mp)::text)::timestamp at time zone v_tz)
        else (((b.work_date)::text || ' ' || (select cutoff_diurno_time from mp)::text)::timestamp at time zone v_tz)
      end) as cutoff_dt
    from base b
    cross join mp
  ),
  picks as (
    select
      c.*,
      e.entry_at,
      lo.lunch_out_at,
      li.lunch_in_at,
      x.exit_at,
      ac.has_after_cutoff
    from computed c
    cross join mp
    left join lateral (
      select p.punched_at as entry_at
      from attendance.punches p
      where p.tenant_id = c.tenant_id
        and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
        and p.punched_at <= c.cutoff_dt
        and p.punched_at >= c.entry_dt - make_interval(mins => (select entry_early_window_min from mp))
        and p.punched_at <= c.entry_dt + make_interval(mins => (select tolerance_entry_min from mp))
      order by p.punched_at asc
      limit 1
    ) e on true
    left join lateral (
      select p.punched_at as exit_at
      from attendance.punches p
      where p.tenant_id = c.tenant_id
        and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
        and p.punched_at <= c.cutoff_dt
        and p.punched_at >= c.exit_dt - make_interval(mins => (select exit_early_window_min from mp))
        and p.punched_at <= c.exit_dt + make_interval(mins => (select tolerance_exit_min from mp))
      order by p.punched_at desc
      limit 1
    ) x on true
    left join lateral (
      select p.punched_at as lunch_out_at
      from attendance.punches p
      where c.meal_enabled = true
        and c.lunch_start_dt is not null
        and p.tenant_id = c.tenant_id
        and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
        and p.punched_at <= c.cutoff_dt
        and p.punched_at >= c.lunch_start_dt - make_interval(mins => (select lunch_start_early_window_min from mp))
        and p.punched_at <= c.lunch_start_dt + make_interval(mins => (select tolerance_lunch_exit_min from mp))
      order by p.punched_at asc
      limit 1
    ) lo on true
    left join lateral (
      select p.punched_at as lunch_in_at
      from attendance.punches p
      where c.meal_enabled = true
        and c.lunch_end_dt is not null
        and p.tenant_id = c.tenant_id
        and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
        and p.punched_at <= c.cutoff_dt
        and p.punched_at >= c.lunch_end_dt - make_interval(mins => (select lunch_end_early_window_min from mp))
        and p.punched_at <= c.lunch_end_dt + make_interval(mins => (select tolerance_lunch_entry_min from mp))
        and (lo.lunch_out_at is null or p.punched_at > lo.lunch_out_at)
      order by p.punched_at asc
      limit 1
    ) li on true
    left join lateral (
      select exists(
        select 1
        from attendance.punches p
        where p.tenant_id = c.tenant_id
          and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
          and p.punched_at > c.cutoff_dt
      ) as has_after_cutoff
    ) ac on true
  ),
  statuses as (
    select
      p.tenant_id,
      p.work_date,
      p.employee_id,
      p.employee_code,
      p.employee_name,
      p.department_name,
      p.schedule_name,
      p.turn_name,
      p.employee_status,
      p.employee_active,
      p.entry_at,
      p.lunch_out_at,
      p.lunch_in_at,
      p.exit_at,
      case
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.entry_at is null then 'NOVEDAD'
        when p.entry_at < p.entry_dt then 'ANTICIPADA'
        when p.entry_at <= (p.entry_dt + make_interval(mins => (select tolerance_entry_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as entry_status,
      case
        when p.meal_enabled is not true then null
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.lunch_out_at is null then 'NOVEDAD'
        when p.lunch_out_at < p.lunch_start_dt then 'ANTICIPADA'
        when p.lunch_out_at <= (p.lunch_start_dt + make_interval(mins => (select tolerance_lunch_exit_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as lunch_out_status,
      case
        when p.meal_enabled is not true then null
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.lunch_in_at is null then 'NOVEDAD'
        when p.lunch_in_at < p.lunch_end_dt then 'ANTICIPADA'
        when p.lunch_in_at <= (p.lunch_end_dt + make_interval(mins => (select tolerance_lunch_entry_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as lunch_in_status,
      case
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.exit_at is null then 'NOVEDAD'
        when p.exit_at < p.exit_dt then 'ANTICIPADA'
        when p.exit_at <= (p.exit_dt + make_interval(mins => (select tolerance_exit_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as exit_status,
      trim(both ';' from
        concat(
          case when (p.employee_active is false) and (p.employee_status <> 'vacation') then 'Empleado no activo; ' else '' end,
          case when p.employee_status = 'vacation' then 'Empleado en vacaciones; ' else '' end,
          case when p.entry_at is null then 'Sin marcación de entrada; ' else '' end,
          case when p.meal_enabled and p.lunch_out_at is null then 'Sin salida a comida; ' else '' end,
          case when p.meal_enabled and p.lunch_in_at is null then 'Sin regreso de comida; ' else '' end,
          case when p.exit_at is null then 'Sin marcación de salida; ' else '' end,
          case when coalesce(p.has_after_cutoff,false) then 'Marcación fuera de corte; ' else '' end
        )
      ) as novelty
    from picks p
    cross join mp
  )
  select
    s.tenant_id,
    s.work_date,
    s.employee_id,
    s.employee_code,
    s.employee_name,
    s.department_name,
    s.schedule_name,
    s.turn_name,
    s.employee_status,
    s.employee_active,
    s.entry_at,
    s.lunch_out_at,
    s.lunch_in_at,
    s.exit_at,
    s.entry_status,
    s.lunch_out_status,
    s.lunch_in_status,
    s.exit_status,
    case
      when s.novelty is not null and length(s.novelty) > 0 then 'NOVEDAD'
      when s.entry_status = 'ATRASADO' or s.lunch_out_status = 'ATRASADO' or s.lunch_in_status = 'ATRASADO' or s.exit_status = 'ATRASADO' then 'ATRASADO'
      when s.entry_status = 'ANTICIPADA' or s.lunch_out_status = 'ANTICIPADA' or s.lunch_in_status = 'ANTICIPADA' or s.exit_status = 'ANTICIPADA' then 'ANTICIPADA'
      else 'A_TIEMPO'
    end as day_status,
    nullif(s.novelty,'') as novelty
  from statuses s
  order by s.work_date desc, s.employee_code asc;

end;
$$;

commit;

-- Nota: si tu API de Supabase no “ve” el RPC, asegúrate de:
-- 1) Settings → API → Exposed schemas: incluir attendance
-- 2) (Opcional) reiniciar PostgREST / esperar cache refresh
