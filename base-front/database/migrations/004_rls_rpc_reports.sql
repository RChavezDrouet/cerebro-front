create schema if not exists attendance;

alter table if exists attendance.attendance_rules_v2 enable row level security;
alter table if exists attendance.attendance_novelties enable row level security;
alter table if exists attendance.audit_logs enable row level security;
alter table if exists attendance.punch_attempts enable row level security;
alter table if exists attendance.employee_enterprise_profile enable row level security;
alter table if exists attendance.employee_biometric_links enable row level security;

create or replace function attendance.current_tenant_id_v2()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.tenant_id', true), '')::uuid,
    (select p.tenant_id from public.profiles p where p.id = auth.uid() limit 1)
  );
$$;

create or replace function attendance.is_tenant_admin_v2()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from attendance.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = attendance.current_tenant_id_v2()
      and m.role in ('tenant_admin','hr_admin','supervisor')
      and coalesce(m.is_active, true) = true
  );
$$;

drop policy if exists p_attendance_rules_v2_select on attendance.attendance_rules_v2;
create policy p_attendance_rules_v2_select on attendance.attendance_rules_v2
for select using (tenant_id = attendance.current_tenant_id_v2());

drop policy if exists p_attendance_rules_v2_manage on attendance.attendance_rules_v2;
create policy p_attendance_rules_v2_manage on attendance.attendance_rules_v2
for all using (tenant_id = attendance.current_tenant_id_v2() and attendance.is_tenant_admin_v2())
with check (tenant_id = attendance.current_tenant_id_v2() and attendance.is_tenant_admin_v2());

-- Reusable policies for the remaining tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance_novelties','audit_logs','punch_attempts','employee_enterprise_profile','employee_biometric_links']
  LOOP
    EXECUTE format('drop policy if exists %I_select on attendance.%I', 'p_'||t, t);
    EXECUTE format('create policy %I_select on attendance.%I for select using (tenant_id = attendance.current_tenant_id_v2())', 'p_'||t, t);
    EXECUTE format('drop policy if exists %I_manage on attendance.%I', 'p_'||t, t);
    EXECUTE format('create policy %I_manage on attendance.%I for all using (tenant_id = attendance.current_tenant_id_v2() and attendance.is_tenant_admin_v2()) with check (tenant_id = attendance.current_tenant_id_v2() and attendance.is_tenant_admin_v2())', 'p_'||t, t);
  END LOOP;
END $$;

create or replace function attendance.rpc_upsert_attendance_rules_v2(
  p_timezone text,
  p_grace_entry_minutes integer,
  p_grace_exit_minutes integer,
  p_rounding_policy text,
  p_max_punches_per_day integer,
  p_allow_duplicates boolean,
  p_geo_enabled boolean,
  p_geo_radius_m numeric,
  p_geo_point_lat numeric,
  p_geo_point_lng numeric,
  p_face_required boolean,
  p_device_required boolean,
  p_allow_remote boolean,
  p_ai_enabled boolean,
  p_ai_provider text,
  p_ai_model text,
  p_ai_sensitivity_level text
)
returns attendance.attendance_rules_v2
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_tenant uuid;
  v_row attendance.attendance_rules_v2;
begin
  v_tenant := attendance.current_tenant_id_v2();
  if v_tenant is null then
    raise exception 'No se pudo resolver el tenant activo';
  end if;
  if not attendance.is_tenant_admin_v2() then
    raise exception 'No autorizado';
  end if;

  insert into attendance.attendance_rules_v2 (
    tenant_id, timezone, grace_entry_minutes, grace_exit_minutes, rounding_policy,
    max_punches_per_day, allow_duplicates, geo_enabled, geo_radius_m, geo_point_lat,
    geo_point_lng, face_required, device_required, allow_remote, ai_enabled,
    ai_provider, ai_model, ai_sensitivity_level, updated_by
  ) values (
    v_tenant, p_timezone, p_grace_entry_minutes, p_grace_exit_minutes, p_rounding_policy,
    p_max_punches_per_day, p_allow_duplicates, p_geo_enabled, p_geo_radius_m, p_geo_point_lat,
    p_geo_point_lng, p_face_required, p_device_required, p_allow_remote, p_ai_enabled,
    p_ai_provider, p_ai_model, p_ai_sensitivity_level, auth.uid()
  )
  on conflict (tenant_id) do update set
    timezone = excluded.timezone,
    grace_entry_minutes = excluded.grace_entry_minutes,
    grace_exit_minutes = excluded.grace_exit_minutes,
    rounding_policy = excluded.rounding_policy,
    max_punches_per_day = excluded.max_punches_per_day,
    allow_duplicates = excluded.allow_duplicates,
    geo_enabled = excluded.geo_enabled,
    geo_radius_m = excluded.geo_radius_m,
    geo_point_lat = excluded.geo_point_lat,
    geo_point_lng = excluded.geo_point_lng,
    face_required = excluded.face_required,
    device_required = excluded.device_required,
    allow_remote = excluded.allow_remote,
    ai_enabled = excluded.ai_enabled,
    ai_provider = excluded.ai_provider,
    ai_model = excluded.ai_model,
    ai_sensitivity_level = excluded.ai_sensitivity_level,
    updated_by = auth.uid()
  returning * into v_row;

  return v_row;
end; $$;

create or replace view attendance.v_attendance_heatmap as
select
  ar.tenant_id,
  ar.work_date,
  extract(isodow from ar.work_date)::int as iso_dow,
  ar.department_name,
  count(*) as total_collaborators,
  count(*) filter (where ar.day_status = 'PRESENTE') as present_count,
  count(*) filter (where ar.day_status = 'ATRASADO') as late_count,
  count(*) filter (where ar.day_status = 'AUSENTE') as absent_count,
  round((count(*) filter (where ar.day_status in ('PRESENTE','ATRASADO'))::numeric / nullif(count(*),0)) * 100, 2) as compliance_pct
from attendance.attendance_records ar
group by ar.tenant_id, ar.work_date, iso_dow, ar.department_name;
