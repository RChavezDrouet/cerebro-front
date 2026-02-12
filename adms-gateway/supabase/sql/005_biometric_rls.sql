-- =======================================================
-- HRCloud Base — Biometría (ADMS) (MVP)
-- RLS / Policies (multi-tenant)
-- =======================================================

alter table public.attendance_settings enable row level security;
alter table public.attendance_biometric_devices enable row level security;
alter table public.attendance_biometric_raw enable row level security;
alter table public.attendance_punches enable row level security;

-- SETTINGS

do $$ begin
  create policy "settings_read" on public.attendance_settings
  for select to authenticated
  using (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "settings_insert" on public.attendance_settings
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "settings_update" on public.attendance_settings
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

-- DEVICES

do $$ begin
  create policy "devices_read" on public.attendance_biometric_devices
  for select to authenticated
  using (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "devices_insert" on public.attendance_biometric_devices
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "devices_update" on public.attendance_biometric_devices
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

-- RAW (por ahora solo lectura; más adelante se restringe por rol)

do $$ begin
  create policy "raw_read" on public.attendance_biometric_raw
  for select to authenticated
  using (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

-- PUNCHES

do $$ begin
  create policy "punches_read" on public.attendance_punches
  for select to authenticated
  using (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

-- Insert desde la app (marcación web) — por ahora abierto a authenticated dentro del tenant.
-- (El gateway biométrico usa SERVICE_ROLE y no depende de esta policy.)
do $$ begin
  create policy "punches_insert" on public.attendance_punches
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;
