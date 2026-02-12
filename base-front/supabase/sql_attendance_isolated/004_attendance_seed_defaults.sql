-- =======================================================
-- HRCloud Base — Asistencia (AISLADO)
-- 004_attendance_seed_defaults.sql
-- Defaults por tenant (turnos + horarios + settings)
-- =======================================================

create or replace function attendance.seed_defaults(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  t_diurno uuid;
  t_vesp uuid;
  t_noct uuid;
begin
  -- Si se llama desde el frontend, forzamos coherencia
  if auth.uid() is not null then
    if attendance.current_tenant_id() is distinct from p_tenant then
      raise exception 'Tenant mismatch';
    end if;
    if not attendance.can_manage_attendance() then
      raise exception 'Not allowed';
    end if;
  end if;

  insert into attendance.settings (tenant_id, mode, timezone)
  values (p_tenant, 'biometric', 'America/Guayaquil')
  on conflict (tenant_id) do nothing;

  -- Turnos
  insert into attendance.turns (tenant_id, name, type, color, days, is_active)
  values (p_tenant, 'Diurno', 'diurno', '#6366F1', array[1,2,3,4,5], true)
  on conflict (tenant_id, name) do nothing;

  insert into attendance.turns (tenant_id, name, type, color, days, is_active)
  values (p_tenant, 'Vespertino', 'vespertino', '#F59E0B', array[1,2,3,4,5], true)
  on conflict (tenant_id, name) do nothing;

  insert into attendance.turns (tenant_id, name, type, color, days, is_active)
  values (p_tenant, 'Nocturno', 'nocturno', '#22C55E', array[1,2,3,4,5], true)
  on conflict (tenant_id, name) do nothing;

  select id into t_diurno from attendance.turns where tenant_id = p_tenant and name='Diurno' limit 1;
  select id into t_vesp   from attendance.turns where tenant_id = p_tenant and name='Vespertino' limit 1;
  select id into t_noct   from attendance.turns where tenant_id = p_tenant and name='Nocturno' limit 1;

  -- Horarios
  insert into attendance.schedules
    (tenant_id, turn_id, name, color, entry_time, exit_time, crosses_midnight,
     meal_enabled, meal_start, meal_end, is_active)
  values
    (p_tenant, t_diurno, 'Diurno 08:00-17:00', '#22C55E', '08:00', '17:00', false, true, '13:00', '14:00', true)
  on conflict (tenant_id, name) do nothing;

  insert into attendance.schedules
    (tenant_id, turn_id, name, color, entry_time, exit_time, crosses_midnight,
     meal_enabled, meal_start, meal_end, is_active)
  values
    (p_tenant, t_vesp, 'Vespertino 14:00-22:00', '#F59E0B', '14:00', '22:00', false, true, '18:00', '19:00', true)
  on conflict (tenant_id, name) do nothing;

  insert into attendance.schedules
    (tenant_id, turn_id, name, color, entry_time, exit_time, crosses_midnight,
     meal_enabled, meal_start, meal_end, is_active)
  values
    (p_tenant, t_noct, 'Nocturno 22:00-06:00', '#6366F1', '22:00', '06:00', true, false, null, null, true)
  on conflict (tenant_id, name) do nothing;
end;
$$;

grant execute on function attendance.seed_defaults(uuid) to authenticated;
