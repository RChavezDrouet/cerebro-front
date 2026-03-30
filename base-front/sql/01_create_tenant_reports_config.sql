begin;

create schema if not exists attendance;

create table if not exists attendance.tenant_reports_config (
  tenant_id uuid primary key,
  columns_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table attendance.tenant_reports_config enable row level security;

grant select, insert, update, delete on table attendance.tenant_reports_config to authenticated;

drop policy if exists tenant_reports_config_rw on attendance.tenant_reports_config;
create policy tenant_reports_config_rw
on attendance.tenant_reports_config
for all
to authenticated
using (tenant_id = attendance.current_tenant_id())
with check (tenant_id = attendance.current_tenant_id());

create or replace function attendance.set_updated_at_tenant_reports_config()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_tenant_reports_config on attendance.tenant_reports_config;
create trigger trg_set_updated_at_tenant_reports_config
before update on attendance.tenant_reports_config
for each row
execute function attendance.set_updated_at_tenant_reports_config();

notify pgrst, 'reload schema';

commit;
