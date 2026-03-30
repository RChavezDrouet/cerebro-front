-- 001_current_tenant_and_first_login.sql
-- Ejecutar primero. Define tenant actual y normaliza first_login_pending.

create or replace function public.current_tenant_id()
returns uuid
language plpgsql
stable
as $$
declare
  v text;
  t uuid;
begin
  v := auth.jwt() ->> 'tenant_id';

  if v is not null and v <> '' then
    begin
      t := v::uuid;
      return t;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'select tenant_id from public.profiles where id = auth.uid()' into t;
    if t is not null then
      return t;
    end if;
  end if;

  if to_regclass('attendance.memberships') is not null then
    execute 'select tenant_id from attendance.memberships where user_id = auth.uid() limit 1' into t;
    if t is not null then
      return t;
    end if;
  end if;

  raise exception 'No se pudo resolver tenant_id.';
end;
$$;

create or replace function attendance.current_employee_id()
returns uuid
language sql
stable
as $$
  select e.id
  from attendance.employees e
  where e.user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function attendance.current_employee_id() to authenticated;

alter table public.profiles
  add column if not exists first_login_pending boolean not null default false,
  add column if not exists is_active boolean not null default true;

alter table attendance.employees
  add column if not exists first_login_pending boolean not null default false,
  add column if not exists user_id uuid null;

create or replace function public.get_first_login_pending(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public, attendance
as $$
declare
  v_profile boolean;
  v_employee boolean;
begin
  select first_login_pending
    into v_profile
  from public.profiles
  where id = p_user_id;

  select first_login_pending
    into v_employee
  from attendance.employees
  where user_id = p_user_id
  limit 1;

  return coalesce(v_profile, v_employee, false);
end;
$$;

create or replace function public.clear_first_login_flags(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public, attendance
as $$
begin
  update public.profiles
     set first_login_pending = false
   where id = p_user_id;

  update attendance.employees
     set first_login_pending = false
   where user_id = p_user_id;
end;
$$;

grant execute on function public.get_first_login_pending(uuid) to authenticated;
grant execute on function public.clear_first_login_flags(uuid) to authenticated;
