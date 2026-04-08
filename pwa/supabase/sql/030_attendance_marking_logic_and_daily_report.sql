-- =======================================================
-- HRCloud Base — v4.6.0
-- Marcación: interpretación Entrada / Comida / Salida + Reporte diario
-- Fecha: 2026-03-01
--
-- Objetivo
-- 1) Extender parámetros de marcación (ventanas “hasta X minutos antes”).
-- 2) Extender employee_status para soportar vacaciones.
-- 3) Publicar RPC attendance.get_daily_attendance_report(date_from, date_to)
--    que devuelve un reporte diario por empleado con:
--      - Entrada, Inicio comida, Fin comida, Salida
--      - Estado: ANTICIPADA / A_TIEMPO / ATRASADO / NOVEDAD
--      - Novedad detallada
--      - Departamento y estado del empleado (activo/vacaciones/inactivo)
--
-- NOTA
-- - Este script asume que existen:
--   attendance.employees, attendance.departments, attendance.schedules,
--   attendance.turns, attendance.punches, attendance.settings,
--   attendance.marking_parameters (v4.4.0)
-- - No toca RLS de punches (pendiente crítico en doc v4.4.0).
-- =======================================================

begin;

-- 1) Extender enum de estado de empleado (vacaciones)
do $$
begin
  -- En algunos ambientes el enum puede existir en attendance o en public (legado)
  if exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='employee_status' and n.nspname='attendance') then
    alter type attendance.employee_status add value if not exists 'vacation';
  end if;
  if exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='employee_status' and n.nspname='public') then
    alter type public.employee_status add value if not exists 'vacation';
  end if;
exception
  when duplicate_object then null;
end $$;

-- 2) Extender parámetros de marcación
-- Ventanas “hasta X minutos antes” para considerar una marcación como válida
alter table if exists attendance.marking_parameters
  add column if not exists entry_early_window_min integer not null default 60,
  add column if not exists exit_early_window_min integer not null default 180,
  add column if not exists lunch_start_early_window_min integer not null default 30,
  add column if not exists lunch_end_early_window_min integer not null default 30;

-- Asegurar que haya un registro por tenant (si no existe)
-- (evita nulls al ejecutar el reporte en tenants nuevos)
insert into attendance.marking_parameters (
  tenant_id,
  tolerance_entry_min,
  tolerance_exit_min,
  tolerance_lunch_entry_min,
  tolerance_lunch_exit_min,
  duplicate_window_min,
  entry_early_window_min,
  exit_early_window_min,
  lunch_start_early_window_min,
  lunch_end_early_window_min
)
select
  t.id,
  5,5,5,5,3,
  60,180,30,30
from public.tenants t
where not exists (
  select 1 from attendance.marking_parameters mp where mp.tenant_id = t.id
);

-- 3) Helpers
create or replace function attendance.get_tenant_timezone(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = attendance, public
as $$
  select coalesce(
    (select s.timezone from attendance.settings s where s.tenant_id = p_tenant_id limit 1),
    'America/Guayaquil'
  );
$$;

-- 4) RPC: reporte diario agregado
-- Firma sin tenant_id explícito (se resuelve desde contexto del usuario)
-- Supabase JS: supabase.rpc('get_daily_attendance_report', { p_date_from: '2026-03-01', p_date_to: '2026-03-01' })
create or replace function attendance.get_daily_attendance_report(
  p_date_from date,
  p_date_to date
)
returns table (
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
set search_path = attendance, public
as $$
declare
  v_tenant uuid;
  v_tz text;
begin
  -- Resolver tenant desde contexto (mismo patrón de Base PWA)
  v_tenant := attendance.current_tenant_id();
  if v_tenant is null then
    raise exception 'tenant_id not resolved for current user';
  end if;

  v_tz := attendance.get_tenant_timezone(v_tenant);

  return query
  with
  mp as (
    select
      v_tenant as tenant_id,
      coalesce(tolerance_entry_min, 5) as tolerance_entry_min,
      coalesce(tolerance_exit_min, 5) as tolerance_exit_min,
      coalesce(tolerance_lunch_entry_min, 5) as tolerance_lunch_entry_min,
      coalesce(tolerance_lunch_exit_min, 5) as tolerance_lunch_exit_min,
      coalesce(duplicate_window_min, 3) as duplicate_window_min,
      coalesce(entry_early_window_min, 60) as entry_early_window_min,
      coalesce(exit_early_window_min, 180) as exit_early_window_min,
      coalesce(lunch_start_early_window_min, 30) as lunch_start_early_window_min,
      coalesce(lunch_end_early_window_min, 30) as lunch_end_early_window_min
    from attendance.marking_parameters
    where tenant_id = v_tenant
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
    where e.tenant_id = v_tenant
  ),
  computed as (
    select
      b.*,
      -- Programación en tz del tenant, convertida a timestamptz (UTC)
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
      ) as lunch_end_dt
    from base b
  ),
  picks as (
    select
      c.*,
      e.entry_at,
      lo.lunch_out_at,
      li.lunch_in_at,
      x.exit_at
    from computed c
    cross join mp
    cross join lateral (
      select p.punched_at as entry_at
      from attendance.punches p
      where p.tenant_id = c.tenant_id
        and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
        and p.punched_at >= c.entry_dt - make_interval(mins => (select entry_early_window_min from mp))
        and p.punched_at <= c.entry_dt + make_interval(mins => (select tolerance_entry_min from mp))
      order by p.punched_at asc
      limit 1
    ) e
    cross join lateral (
      select p.punched_at as exit_at
      from attendance.punches p
      where p.tenant_id = c.tenant_id
        and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
        and p.punched_at >= c.exit_dt - make_interval(mins => (select exit_early_window_min from mp))
        and p.punched_at <= c.exit_dt + make_interval(mins => (select tolerance_exit_min from mp))
      order by p.punched_at desc
      limit 1
    ) x
    left join lateral (
      select p.punched_at as lunch_out_at
      from attendance.punches p
      where c.meal_enabled = true
        and c.lunch_start_dt is not null
        and p.tenant_id = c.tenant_id
        and (p.employee_id = c.employee_id or (p.employee_id is null and p.biometric_employee_code = (select e2.biometric_employee_code from attendance.employees e2 where e2.id = c.employee_id)))
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
        and p.punched_at >= c.lunch_end_dt - make_interval(mins => (select lunch_end_early_window_min from mp))
        and p.punched_at <= c.lunch_end_dt + make_interval(mins => (select tolerance_lunch_entry_min from mp))
        and (lo.lunch_out_at is null or p.punched_at > lo.lunch_out_at)
      order by p.punched_at asc
      limit 1
    ) li on true
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
      -- Entrada status
      case
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.entry_at is null then 'NOVEDAD'
        when p.entry_at < p.entry_dt then 'ANTICIPADA'
        when p.entry_at <= (p.entry_dt + make_interval(mins => (select tolerance_entry_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as entry_status,
      -- Comida salida status
      case
        when p.meal_enabled is not true then null
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.lunch_out_at is null then 'NOVEDAD'
        when p.lunch_out_at < p.lunch_start_dt then 'ANTICIPADA'
        when p.lunch_out_at <= (p.lunch_start_dt + make_interval(mins => (select tolerance_lunch_exit_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as lunch_out_status,
      -- Comida regreso status
      case
        when p.meal_enabled is not true then null
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.lunch_in_at is null then 'NOVEDAD'
        when p.lunch_in_at < p.lunch_end_dt then 'ANTICIPADA'
        when p.lunch_in_at <= (p.lunch_end_dt + make_interval(mins => (select tolerance_lunch_entry_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as lunch_in_status,
      -- Salida status
      case
        when p.employee_status <> 'active' then 'NOVEDAD'
        when p.exit_at is null then 'NOVEDAD'
        when p.exit_at < p.exit_dt then 'ANTICIPADA'
        when p.exit_at <= (p.exit_dt + make_interval(mins => (select tolerance_exit_min from mp))) then 'A_TIEMPO'
        else 'ATRASADO'
      end as exit_status,
      -- Novedad detalle
      trim(both ';' from
        concat(
          case when p.employee_status = 'inactive' then 'Empleado inactivo; ' else '' end,
          case when p.employee_status = 'vacation' then 'Empleado en vacaciones; ' else '' end,
          case when p.entry_at is null then 'Sin marcación de entrada; ' else '' end,
          case when p.meal_enabled and p.lunch_out_at is null then 'Sin salida a comida; ' else '' end,
          case when p.meal_enabled and p.lunch_in_at is null then 'Sin regreso de comida; ' else '' end,
          case when p.exit_at is null then 'Sin marcación de salida; ' else '' end
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
    -- Estado global del día (prioridad: NOVEDAD > ATRASADO > ANTICIPADA > A_TIEMPO)
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

-- Permisos básicos (si RLS/privilegios son estrictos en tu proyecto)
-- En muchos proyectos Supabase, authenticated ya tiene EXECUTE por defecto.
grant execute on function attendance.get_daily_attendance_report(date, date) to authenticated;

commit;
