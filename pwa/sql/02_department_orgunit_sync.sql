begin;

create schema if not exists attendance;

create or replace function attendance.ensure_visible_department(
  p_tenant_id uuid,
  p_name text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_name text;
begin
  v_name := nullif(trim(p_name), '');
  if v_name is null then
    return null;
  end if;

  select d.id
    into v_id
  from public.departments d
  where d.tenant_id = p_tenant_id
    and lower(trim(d.name)) = lower(v_name)
  order by d.id
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.departments (
    id,
    tenant_id,
    name,
    is_active
  ) values (
    gen_random_uuid(),
    p_tenant_id,
    v_name,
    true
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    select d.id
      into v_id
    from public.departments d
    where d.tenant_id = p_tenant_id
      and lower(trim(d.name)) = lower(v_name)
    order by d.id
    limit 1;

    return v_id;
end;
$$;

create or replace function attendance.sync_employee_department_from_org_assignment()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_name text;
  v_department_id uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.org_unit_id is null then
    return new;
  end if;

  if new.effective_to is not null then
    return new;
  end if;

  select nullif(trim(ou.name), '')
    into v_org_name
  from attendance.org_units ou
  where ou.tenant_id = new.tenant_id
    and ou.id = new.org_unit_id
  limit 1;

  if v_org_name is null then
    return new;
  end if;

  v_department_id := attendance.ensure_visible_department(new.tenant_id, v_org_name);

  if v_department_id is null then
    return new;
  end if;

  update public.employees e
     set department_id = v_department_id
   where e.tenant_id = new.tenant_id
     and e.id = new.employee_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_employee_department_from_org_assignment on attendance.employee_org_assignments;
create trigger trg_sync_employee_department_from_org_assignment
  after insert or update of org_unit_id, effective_to
  on attendance.employee_org_assignments
  for each row
  execute function attendance.sync_employee_department_from_org_assignment();

do $$
declare
  r record;
  v_department_id uuid;
begin
  for r in
    select distinct on (a.employee_id)
           a.tenant_id,
           a.employee_id,
           ou.name as org_unit_name
      from attendance.employee_org_assignments a
      join attendance.org_units ou
        on ou.tenant_id = a.tenant_id
       and ou.id = a.org_unit_id
     where a.org_unit_id is not null
       and a.effective_to is null
     order by a.employee_id, a.effective_from desc nulls last
  loop
    v_department_id := attendance.ensure_visible_department(r.tenant_id, r.org_unit_name);

    update public.employees e
       set department_id = v_department_id
     where e.tenant_id = r.tenant_id
       and e.id = r.employee_id
       and (e.department_id is null or e.department_id <> v_department_id);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
