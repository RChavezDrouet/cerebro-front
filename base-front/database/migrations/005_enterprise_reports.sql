create schema if not exists attendance;

create or replace view attendance.v_novelties_report as
select
  n.id,
  n.tenant_id,
  n.work_date,
  n.type,
  n.severity,
  n.detected_by,
  n.status,
  n.title,
  n.description,
  n.confidence_score,
  e.employee_code,
  coalesce(e.full_name, trim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,''))) as employee_name,
  ep.department_name,
  n.evidence,
  n.created_at,
  n.updated_at
from attendance.attendance_novelties n
left join public.employees e on e.id = n.employee_id
left join attendance.employee_enterprise_profile ep on ep.employee_id = e.id;

create or replace view attendance.v_punctuality_ranking as
select
  ar.tenant_id,
  ar.employee_id,
  ar.employee_code,
  ar.employee_name,
  ar.department_name,
  count(*) filter (where ar.day_status in ('PRESENTE','ATRASADO')) as attended_days,
  count(*) filter (where ar.entry_status = 'A_TIEMPO') as on_time_days,
  count(*) filter (where ar.entry_status = 'ATRASADO') as late_days,
  round((count(*) filter (where ar.entry_status = 'A_TIEMPO')::numeric / nullif(count(*) filter (where ar.day_status in ('PRESENTE','ATRASADO')),0)) * 100, 2) as punctuality_pct
from attendance.attendance_records ar
group by ar.tenant_id, ar.employee_id, ar.employee_code, ar.employee_name, ar.department_name;
