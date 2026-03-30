-- 003_register_web_punch_rpc.sql
-- Ejecutar tercero. Crea la RPC transaccional para marcación web.

create or replace function attendance.register_web_punch(
  p_action text,
  p_punched_at timestamptz default now(),
  p_evidence jsonb default '{}'::jsonb,
  p_verification jsonb default '{}'::jsonb,
  p_serial_no text default null
)
returns uuid
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid;
  v_employee_id uuid;
  v_employee_status text;
  v_tenant_status text;
  v_is_suspended boolean;
  v_last_action text;
  v_punch_id uuid := gen_random_uuid();
  v_meta jsonb;
begin
  v_tenant_id := public.current_tenant_id();

  select e.id, lower(coalesce(e.status, ''))
    into v_employee_id, v_employee_status
  from attendance.employees e
  where e.user_id = auth.uid()
    and e.tenant_id = v_tenant_id
  limit 1;

  if v_employee_id is null then
    raise exception 'EMPLOYEE_NOT_LINKED';
  end if;

  if v_employee_status not in ('active','probation','permanent','contract','activo') then
    raise exception 'EMPLOYEE_INACTIVE';
  end if;

  select lower(coalesce(t.status, '')), coalesce(t.is_suspended, false)
    into v_tenant_status, v_is_suspended
  from public.tenants t
  where t.id = v_tenant_id
  limit 1;

  if v_tenant_status <> 'active' or v_is_suspended = true then
    raise exception 'TENANT_BLOCKED';
  end if;

  select coalesce((p.evidence ->> 'action'), '')
    into v_last_action
  from attendance.punches p
  where p.tenant_id = v_tenant_id
    and p.employee_id = v_employee_id
    and p.punched_at::date = p_punched_at::date
  order by p.punched_at desc
  limit 1;

  if p_action = 'clock_in' and v_last_action = 'clock_in' then
    raise exception 'SEQUENCE_CLOCK_IN';
  elsif p_action = 'clock_out' and v_last_action <> 'clock_in' then
    raise exception 'SEQUENCE_CLOCK_OUT';
  elsif p_action = 'break_start' and v_last_action <> 'clock_in' then
    raise exception 'SEQUENCE_BREAK_START';
  elsif p_action = 'break_end' and v_last_action <> 'break_start' then
    raise exception 'SEQUENCE_BREAK_END';
  end if;

  v_meta := jsonb_build_object('status', 'OK', 'verify_type', '15');

  insert into attendance.punches (
    id,
    tenant_id,
    employee_id,
    punched_at,
    source,
    serial_no,
    verification,
    evidence,
    meta
  )
  values (
    v_punch_id,
    v_tenant_id,
    v_employee_id,
    p_punched_at,
    'web',
    p_serial_no,
    p_verification,
    p_evidence,
    v_meta
  );

  begin
    insert into attendance.punch_attempts (
      tenant_id,
      employee_id,
      attempted_at,
      action,
      ok,
      step,
      reason,
      meta
    )
    values (
      v_tenant_id,
      v_employee_id,
      now(),
      p_action,
      true,
      'insert',
      null,
      jsonb_build_object('punch_id', v_punch_id)
    );
  exception when others then
    null;
  end;

  return v_punch_id;
exception when others then
  begin
    insert into attendance.punch_attempts (
      tenant_id,
      employee_id,
      attempted_at,
      action,
      ok,
      step,
      reason,
      meta
    )
    values (
      coalesce(v_tenant_id, public.current_tenant_id()),
      v_employee_id,
      now(),
      p_action,
      false,
      'insert',
      sqlerrm,
      jsonb_build_object('evidence', p_evidence, 'verification', p_verification)
    );
  exception when others then
    null;
  end;
  raise;
end;
$$;

grant execute on function attendance.register_web_punch(text, timestamptz, jsonb, jsonb, text) to authenticated;
