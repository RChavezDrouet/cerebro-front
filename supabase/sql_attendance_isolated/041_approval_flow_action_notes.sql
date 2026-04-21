-- =======================================================
-- HRCloud Base - Approval Flows
-- 041_approval_flow_action_notes.sql
-- Nota obligatoria para aprobacion y rechazo
-- =======================================================

begin;

create or replace function attendance.rpc_approve_request(
  p_approval_request_id uuid,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = attendance, public
as $$
declare
  v_tenant_id uuid := attendance.approval_current_tenant_id();
  v_step attendance.approval_request_steps%rowtype;
begin
  if trim(coalesce(p_comment, '')) = '' then
    raise exception 'El comentario de aprobacion es obligatorio';
  end if;

  if v_tenant_id is null then
    raise exception 'No se pudo resolver el tenant activo';
  end if;

  select s.*
  into v_step
  from attendance.approval_request_steps s
  join attendance.approval_requests r on r.id = s.approval_request_id
  where s.approval_request_id = p_approval_request_id
    and s.tenant_id = v_tenant_id
    and r.overall_status = 'en_aprobacion'
    and s.status = 'pendiente'
    and s.activated_at is not null
    and (
      s.assigned_user_id = auth.uid()
      or auth.uid() = any(s.candidate_user_ids)
    )
  order by s.step_order
  limit 1;

  if not found then
    raise exception 'No existe un paso pendiente para el usuario actual';
  end if;

  update attendance.approval_request_steps
     set status = 'aprobado',
         acted_at = now(),
         acted_by_user_id = auth.uid(),
         comments = trim(p_comment),
         assigned_user_id = coalesce(assigned_user_id, auth.uid()),
         updated_at = now()
   where id = v_step.id;

  insert into attendance.approval_action_audit (
    tenant_id,
    approval_request_id,
    approval_request_step_id,
    action,
    acted_by_user_id,
    comments
  )
  values (
    v_tenant_id,
    p_approval_request_id,
    v_step.id,
    'approve',
    auth.uid(),
    trim(p_comment)
  );

  perform attendance.approval_finalize_request_state(p_approval_request_id, auth.uid());

  return p_approval_request_id;
end;
$$;

grant execute on function attendance.rpc_approve_request(uuid,text) to authenticated;

notify pgrst, 'reload schema';

commit;
