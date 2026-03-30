-- =======================================================
-- Seed defaults per tenant
-- =======================================================

create or replace function public.seed_attendance_defaults(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t_diurno uuid;
  t_vespertino uuid;
  t_nocturno uuid;
begin
  -- Turnos
  insert into public.attendance_turns (tenant_id, name, type, color, days, is_active)
  values (p_tenant, 'Diurno', 'diurno', '#6366F1', ARRAY[1,2,3,4,5], true)
  on conflict (tenant_id, name) do update set is_active = excluded.is_active
  returning id into t_diurno;

  select id into t_diurno from public.attendance_turns where tenant_id = p_tenant and name = 'Diurno' limit 1;

  insert into public.attendance_turns (tenant_id, name, type, color, days, is_active)
  values (p_tenant, 'Vespertino', 'vespertino', '#F59E0B', ARRAY[1,2,3,4,5], true)
  on conflict (tenant_id, name) do update set is_active = excluded.is_active
  returning id into t_vespertino;

  select id into t_vespertino from public.attendance_turns where tenant_id = p_tenant and name = 'Vespertino' limit 1;

  insert into public.attendance_turns (tenant_id, name, type, color, days, is_active)
  values (p_tenant, 'Nocturno', 'nocturno', '#22C55E', ARRAY[1,2,3,4,5], true)
  on conflict (tenant_id, name) do update set is_active = excluded.is_active
  returning id into t_nocturno;

  select id into t_nocturno from public.attendance_turns where tenant_id = p_tenant and name = 'Nocturno' limit 1;

  -- Horarios
  insert into public.attendance_schedules (
    tenant_id, turn_id, name, color, entry_time, exit_time, crosses_midnight,
    meal_enabled, meal_start, meal_end, is_active
  )
  values
    (p_tenant, t_diurno, 'Diurno 08:00-17:00', '#22C55E', '08:00', '17:00', false, true, '13:00', '14:00', true)
  on conflict (tenant_id, name) do update set is_active = excluded.is_active;

  insert into public.attendance_schedules (
    tenant_id, turn_id, name, color, entry_time, exit_time, crosses_midnight,
    meal_enabled, meal_start, meal_end, is_active
  )
  values
    (p_tenant, t_vespertino, 'Vespertino 14:00-22:00', '#F59E0B', '14:00', '22:00', false, true, '18:00', '19:00', true)
  on conflict (tenant_id, name) do update set is_active = excluded.is_active;

  insert into public.attendance_schedules (
    tenant_id, turn_id, name, color, entry_time, exit_time, crosses_midnight,
    meal_enabled, meal_start, meal_end, is_active
  )
  values
    (p_tenant, t_nocturno, 'Nocturno 22:00-06:00', '#6366F1', '22:00', '06:00', true, false, null, null, true)
  on conflict (tenant_id, name) do update set is_active = excluded.is_active;

end;
$$;
