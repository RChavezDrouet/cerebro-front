-- =======================================================
-- 039_requests_legacy_compat.sql
-- Normaliza tablas legacy de solicitudes antes de aplicar
-- 040_approval_flows.sql en tenants que ya tienen tablas
-- parciales como permission_requests o vacation_requests.
-- =======================================================

begin;

create schema if not exists attendance;

do $$
begin
  if to_regclass('attendance.permission_requests') is not null then
    alter table attendance.permission_requests add column if not exists tenant_id uuid;
    alter table attendance.permission_requests add column if not exists employee_id uuid;
    alter table attendance.permission_requests add column if not exists request_type text;
    alter table attendance.permission_requests add column if not exists start_date date;
    alter table attendance.permission_requests add column if not exists end_date date;
    alter table attendance.permission_requests add column if not exists start_time time;
    alter table attendance.permission_requests add column if not exists end_time time;
    alter table attendance.permission_requests add column if not exists hours_requested numeric;
    alter table attendance.permission_requests add column if not exists reason text;
    alter table attendance.permission_requests add column if not exists attachment_url text;
    alter table attendance.permission_requests add column if not exists request_status text;
    alter table attendance.permission_requests add column if not exists approval_request_id uuid;
    alter table attendance.permission_requests add column if not exists submitted_at timestamptz;
    alter table attendance.permission_requests add column if not exists resolved_at timestamptz;
    alter table attendance.permission_requests add column if not exists resolved_by uuid;
    alter table attendance.permission_requests add column if not exists created_at timestamptz;
    alter table attendance.permission_requests add column if not exists updated_at timestamptz;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'collaborator_id'
    ) then
      execute $sql$
        update attendance.permission_requests
        set employee_id = coalesce(employee_id, collaborator_id)
        where employee_id is null and collaborator_id is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'requester_employee_id'
    ) then
      execute $sql$
        update attendance.permission_requests
        set employee_id = coalesce(employee_id, requester_employee_id)
        where employee_id is null and requester_employee_id is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'request_date'
    ) then
      execute $sql$
        update attendance.permission_requests
        set start_date = coalesce(start_date, request_date::date),
            end_date = coalesce(end_date, request_date::date)
        where request_date is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'date'
    ) then
      execute $sql$
        update attendance.permission_requests
        set start_date = coalesce(start_date, "date"::date),
            end_date = coalesce(end_date, "date"::date)
        where "date" is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'from_date'
    ) then
      execute $sql$
        update attendance.permission_requests
        set start_date = coalesce(start_date, from_date::date)
        where from_date is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'to_date'
    ) then
      execute $sql$
        update attendance.permission_requests
        set end_date = coalesce(end_date, to_date::date)
        where to_date is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'date_from'
    ) then
      execute $sql$
        update attendance.permission_requests
        set start_date = coalesce(start_date, date_from::date)
        where date_from is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'date_to'
    ) then
      execute $sql$
        update attendance.permission_requests
        set end_date = coalesce(end_date, date_to::date)
        where date_to is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'from_time'
    ) then
      execute $sql$
        update attendance.permission_requests
        set start_time = coalesce(start_time, from_time::time)
        where from_time is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'to_time'
    ) then
      execute $sql$
        update attendance.permission_requests
        set end_time = coalesce(end_time, to_time::time)
        where to_time is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'hours'
    ) then
      execute $sql$
        update attendance.permission_requests
        set hours_requested = coalesce(hours_requested, hours::numeric)
        where hours is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'description'
    ) then
      execute $sql$
        update attendance.permission_requests
        set reason = coalesce(reason, description::text)
        where reason is null and description is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'comment'
    ) then
      execute $sql$
        update attendance.permission_requests
        set reason = coalesce(reason, comment::text)
        where reason is null and comment is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'notes'
    ) then
      execute $sql$
        update attendance.permission_requests
        set reason = coalesce(reason, notes::text)
        where reason is null and notes is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'permission_requests' and column_name = 'status'
    ) then
      execute $sql$
        update attendance.permission_requests
        set request_status = coalesce(
          request_status,
          case
            when lower(status::text) like '%approv%' or lower(status::text) like '%autoriz%' then 'aprobado'
            when lower(status::text) like '%reject%' or lower(status::text) like '%deneg%' then 'rechazado'
            when lower(status::text) like '%cancel%' then 'cancelado'
            when lower(status::text) like '%draft%' then 'borrador'
            when lower(status::text) like '%progress%' then 'en_aprobacion'
            else 'pendiente'
          end
        )
        where status is not null
      $sql$;
    end if;

    update attendance.permission_requests pr
    set tenant_id = e.tenant_id
    from public.employees e
    where pr.tenant_id is null
      and pr.employee_id = e.id;

    update attendance.permission_requests
    set request_type = coalesce(nullif(trim(request_type), ''), 'general'),
        start_date = coalesce(start_date, end_date, created_at::date, (now() at time zone 'America/Guayaquil')::date),
        end_date = coalesce(end_date, start_date, created_at::date, (now() at time zone 'America/Guayaquil')::date),
        reason = coalesce(nullif(trim(reason), ''), 'Solicitud migrada a flujo transaccional'),
        request_status = coalesce(nullif(trim(request_status), ''), 'borrador'),
        created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, created_at, now());
  end if;

  if to_regclass('attendance.vacation_requests') is not null then
    alter table attendance.vacation_requests add column if not exists tenant_id uuid;
    alter table attendance.vacation_requests add column if not exists employee_id uuid;
    alter table attendance.vacation_requests add column if not exists start_date date;
    alter table attendance.vacation_requests add column if not exists end_date date;
    alter table attendance.vacation_requests add column if not exists days_requested numeric;
    alter table attendance.vacation_requests add column if not exists available_balance_days numeric;
    alter table attendance.vacation_requests add column if not exists reason text;
    alter table attendance.vacation_requests add column if not exists request_status text;
    alter table attendance.vacation_requests add column if not exists approval_request_id uuid;
    alter table attendance.vacation_requests add column if not exists submitted_at timestamptz;
    alter table attendance.vacation_requests add column if not exists resolved_at timestamptz;
    alter table attendance.vacation_requests add column if not exists resolved_by uuid;
    alter table attendance.vacation_requests add column if not exists created_at timestamptz;
    alter table attendance.vacation_requests add column if not exists updated_at timestamptz;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'collaborator_id'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set employee_id = coalesce(employee_id, collaborator_id)
        where employee_id is null and collaborator_id is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'requester_employee_id'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set employee_id = coalesce(employee_id, requester_employee_id)
        where employee_id is null and requester_employee_id is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'from_date'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set start_date = coalesce(start_date, from_date::date)
        where from_date is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'to_date'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set end_date = coalesce(end_date, to_date::date)
        where to_date is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'date_from'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set start_date = coalesce(start_date, date_from::date)
        where date_from is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'date_to'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set end_date = coalesce(end_date, date_to::date)
        where date_to is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'request_date'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set start_date = coalesce(start_date, request_date::date),
            end_date = coalesce(end_date, request_date::date)
        where request_date is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'days'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set days_requested = coalesce(days_requested, days::numeric)
        where days is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'requested_days'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set days_requested = coalesce(days_requested, requested_days::numeric)
        where requested_days is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'available_days'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set available_balance_days = coalesce(available_balance_days, available_days::numeric)
        where available_days is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'description'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set reason = coalesce(reason, description::text)
        where reason is null and description is not null
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'attendance' and table_name = 'vacation_requests' and column_name = 'status'
    ) then
      execute $sql$
        update attendance.vacation_requests
        set request_status = coalesce(
          request_status,
          case
            when lower(status::text) like '%approv%' or lower(status::text) like '%autoriz%' then 'aprobado'
            when lower(status::text) like '%reject%' or lower(status::text) like '%deneg%' then 'rechazado'
            when lower(status::text) like '%cancel%' then 'cancelado'
            when lower(status::text) like '%draft%' then 'borrador'
            when lower(status::text) like '%progress%' then 'en_aprobacion'
            else 'pendiente'
          end
        )
        where status is not null
      $sql$;
    end if;

    update attendance.vacation_requests vr
    set tenant_id = e.tenant_id
    from public.employees e
    where vr.tenant_id is null
      and vr.employee_id = e.id;

    update attendance.vacation_requests
    set start_date = coalesce(start_date, end_date, created_at::date, (now() at time zone 'America/Guayaquil')::date),
        end_date = coalesce(end_date, start_date, created_at::date, (now() at time zone 'America/Guayaquil')::date),
        days_requested = coalesce(days_requested, greatest((coalesce(end_date, start_date) - coalesce(start_date, end_date)) + 1, 1)),
        reason = coalesce(nullif(trim(reason), ''), 'Solicitud de vacaciones migrada a flujo transaccional'),
        request_status = coalesce(nullif(trim(request_status), ''), 'borrador'),
        created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, created_at, now());
  end if;

  if to_regclass('attendance.loan_requests') is not null then
    alter table attendance.loan_requests add column if not exists tenant_id uuid;
    alter table attendance.loan_requests add column if not exists employee_id uuid;
    alter table attendance.loan_requests add column if not exists amount_requested numeric;
    alter table attendance.loan_requests add column if not exists currency_code text;
    alter table attendance.loan_requests add column if not exists installments integer;
    alter table attendance.loan_requests add column if not exists reason text;
    alter table attendance.loan_requests add column if not exists request_status text;
    alter table attendance.loan_requests add column if not exists approval_request_id uuid;
    alter table attendance.loan_requests add column if not exists submitted_at timestamptz;
    alter table attendance.loan_requests add column if not exists resolved_at timestamptz;
    alter table attendance.loan_requests add column if not exists resolved_by uuid;
    alter table attendance.loan_requests add column if not exists created_at timestamptz;
    alter table attendance.loan_requests add column if not exists updated_at timestamptz;
  end if;

  if to_regclass('attendance.salary_advance_requests') is not null then
    alter table attendance.salary_advance_requests add column if not exists tenant_id uuid;
    alter table attendance.salary_advance_requests add column if not exists employee_id uuid;
    alter table attendance.salary_advance_requests add column if not exists amount_requested numeric;
    alter table attendance.salary_advance_requests add column if not exists currency_code text;
    alter table attendance.salary_advance_requests add column if not exists requested_pay_date date;
    alter table attendance.salary_advance_requests add column if not exists reason text;
    alter table attendance.salary_advance_requests add column if not exists request_status text;
    alter table attendance.salary_advance_requests add column if not exists approval_request_id uuid;
    alter table attendance.salary_advance_requests add column if not exists submitted_at timestamptz;
    alter table attendance.salary_advance_requests add column if not exists resolved_at timestamptz;
    alter table attendance.salary_advance_requests add column if not exists resolved_by uuid;
    alter table attendance.salary_advance_requests add column if not exists created_at timestamptz;
    alter table attendance.salary_advance_requests add column if not exists updated_at timestamptz;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
