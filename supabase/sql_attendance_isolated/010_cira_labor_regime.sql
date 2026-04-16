-- =======================================================
-- HRCloud Base — CIRA V2.0 (Sesión C-1)
-- 010_cira_labor_regime.sql
-- Régimen laboral por tenant + reglas de recargo parametrizables
-- Regímenes soportados: CODIGO_TRABAJO | LOSEP
-- =======================================================

-- -------------------------------------------------------
-- 1) attendance.labor_regime_config
--    Una fila por tenant. Define el régimen laboral activo
--    y los parámetros de franja nocturna, límites y multas.
-- -------------------------------------------------------

create table if not exists attendance.labor_regime_config (
  tenant_id             uuid        primary key,
  regime                text        not null default 'CODIGO_TRABAJO'
                                    constraint labor_regime_config_regime_chk
                                    check (regime in ('CODIGO_TRABAJO', 'LOSEP')),
  night_start           time        not null default '19:00',
  night_end             time        not null default '06:00',  -- puede cruzar medianoche
  max_suplem_daily_h    numeric     not null default 4,
  max_suplem_monthly_h  numeric     not null default 48,
  fine_cap_pct          numeric     not null default 10        -- % del salario mensual
                                    constraint labor_regime_config_fine_cap_chk
                                    check (fine_cap_pct >= 0 and fine_cap_pct <= 100),
  reincidence_threshold int         not null default 3,        -- atrasos antes de escalar multa
  reincidence_multiplier numeric    not null default 1.5,
  updated_at            timestamptz not null default now()
);

comment on table attendance.labor_regime_config is
  'Configuración del régimen laboral por tenant (CODIGO_TRABAJO o LOSEP). Una fila por tenant.';

comment on column attendance.labor_regime_config.night_start is
  'Inicio de franja nocturna (defecto 19:00). Puede cruzar medianoche con night_end.';
comment on column attendance.labor_regime_config.night_end is
  'Fin de franja nocturna (defecto 06:00). Si < night_start, se asume que cruza la medianoche.';
comment on column attendance.labor_regime_config.fine_cap_pct is
  'Tope mensual de multas como % del salario mensual del empleado.';

-- -------------------------------------------------------
-- 2) attendance.surcharge_rules
--    Recargos parametrizables por régimen y tipo de hora.
--    NO hardcodear porcentajes: cambios legales = UPDATE,
--    no un nuevo deploy.
-- -------------------------------------------------------

create table if not exists attendance.surcharge_rules (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null,
  regime      text        not null
              constraint surcharge_rules_regime_chk
              check (regime in ('CODIGO_TRABAJO', 'LOSEP')),
  hour_type   text        not null
              constraint surcharge_rules_hour_type_chk
              check (hour_type in (
                'NORMAL_DIURNA',
                'NORMAL_NOCTURNA',
                'SUPLEMENTARIA',
                'SUPLEMENTARIA_NOCTURNA',
                'EXTRAORDINARIA',
                'EXTRAORDINARIA_NOCTURNA'
              )),
  multiplier  numeric     not null
              constraint surcharge_rules_multiplier_chk
              check (multiplier > 0),
  is_active   boolean     not null default true,
  valid_from  date        null,    -- null = sin restricción de vigencia
  created_at  timestamptz not null default now(),

  constraint surcharge_rules_tenant_regime_type_uk
    unique (tenant_id, regime, hour_type)
);

comment on table attendance.surcharge_rules is
  'Multiplicadores de recargo por tipo de hora y régimen laboral. Parametrizable para absorber cambios legales sin redeploy.';

comment on column attendance.surcharge_rules.multiplier is
  'Factor sobre HB (Hora Base = sueldo/240). Ej: 1.50 para horas suplementarias en Código de Trabajo.';
comment on column attendance.surcharge_rules.valid_from is
  'Fecha desde la que aplica esta versión del multiplicador. NULL = siempre válido.';

create index if not exists surcharge_rules_tenant_idx
  on attendance.surcharge_rules (tenant_id);

create index if not exists surcharge_rules_tenant_regime_idx
  on attendance.surcharge_rules (tenant_id, regime);

-- -------------------------------------------------------
-- 3) Grants
-- -------------------------------------------------------

grant select, insert, update, delete
  on attendance.labor_regime_config to authenticated;

grant select, insert, update, delete
  on attendance.surcharge_rules to authenticated;

-- -------------------------------------------------------
-- 4) Row Level Security
-- -------------------------------------------------------

alter table attendance.labor_regime_config enable row level security;
alter table attendance.surcharge_rules      enable row level security;

-- labor_regime_config: cualquier usuario autenticado del tenant puede leer;
-- solo gestores pueden escribir.

drop policy if exists labor_regime_config_select on attendance.labor_regime_config;
create policy labor_regime_config_select
  on attendance.labor_regime_config
  for select to authenticated
  using (tenant_id = attendance.current_tenant_id());

drop policy if exists labor_regime_config_insert on attendance.labor_regime_config;
create policy labor_regime_config_insert
  on attendance.labor_regime_config
  for insert to authenticated
  with check (
    tenant_id = attendance.current_tenant_id()
    and attendance.can_manage_attendance()
  );

drop policy if exists labor_regime_config_update on attendance.labor_regime_config;
create policy labor_regime_config_update
  on attendance.labor_regime_config
  for update to authenticated
  using  (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance())
  with check (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance());

-- surcharge_rules: mismo modelo. Lectura para todos en el tenant;
-- escritura solo para gestores.

drop policy if exists surcharge_rules_select on attendance.surcharge_rules;
create policy surcharge_rules_select
  on attendance.surcharge_rules
  for select to authenticated
  using (tenant_id = attendance.current_tenant_id());

drop policy if exists surcharge_rules_write on attendance.surcharge_rules;
create policy surcharge_rules_write
  on attendance.surcharge_rules
  for all to authenticated
  using  (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance())
  with check (tenant_id = attendance.current_tenant_id() and attendance.can_manage_attendance());

-- -------------------------------------------------------
-- 5) attendance.seed_cira_defaults(p_tenant uuid)
--    Siembra la configuración CIRA base para un tenant.
--    Reglas para AMBOS regímenes (CODIGO_TRABAJO y LOSEP)
--    con on conflict do nothing: idempotente.
--    El régimen activo del tenant se establece en
--    labor_regime_config.regime (defecto: CODIGO_TRABAJO).
-- -------------------------------------------------------

create or replace function attendance.seed_cira_defaults(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = attendance, public
as $$
begin
  -- Verificación de contexto si se llama desde el frontend
  if auth.uid() is not null then
    if attendance.current_tenant_id() is distinct from p_tenant then
      raise exception 'Tenant mismatch';
    end if;
    if not attendance.can_manage_attendance() then
      raise exception 'Not allowed';
    end if;
  end if;

  -- ── Configuración de régimen laboral (defecto: Código de Trabajo) ──────────
  insert into attendance.labor_regime_config (
    tenant_id, regime,
    night_start, night_end,
    max_suplem_daily_h, max_suplem_monthly_h,
    fine_cap_pct,
    reincidence_threshold, reincidence_multiplier
  ) values (
    p_tenant, 'CODIGO_TRABAJO',
    '19:00', '06:00',
    4, 48,
    10,
    3, 1.5
  )
  on conflict (tenant_id) do nothing;

  -- ── Reglas de recargo: CODIGO_TRABAJO ─────────────────────────────────────
  -- HB = sueldo / 240
  -- Suplementaria:          HB × 1.50
  -- Suplementaria nocturna: HB × 1.875  (1.25 × 1.50)
  -- Extraordinaria:         HB × 2.00
  -- Extraordinaria nocturna:HB × 2.50   (2.00 × 1.25)
  -- Nocturna en jornada:    HB × 1.25
  -- Fuente: Código del Trabajo Ecuador, Arts. 49, 55

  insert into attendance.surcharge_rules
    (tenant_id, regime, hour_type, multiplier, is_active, valid_from)
  values
    (p_tenant, 'CODIGO_TRABAJO', 'NORMAL_DIURNA',           1.00, true, '2024-01-01'),
    (p_tenant, 'CODIGO_TRABAJO', 'NORMAL_NOCTURNA',         1.25, true, '2024-01-01'),
    (p_tenant, 'CODIGO_TRABAJO', 'SUPLEMENTARIA',           1.50, true, '2024-01-01'),
    (p_tenant, 'CODIGO_TRABAJO', 'SUPLEMENTARIA_NOCTURNA',  1.875,true, '2024-01-01'),
    (p_tenant, 'CODIGO_TRABAJO', 'EXTRAORDINARIA',          2.00, true, '2024-01-01'),
    (p_tenant, 'CODIGO_TRABAJO', 'EXTRAORDINARIA_NOCTURNA', 2.50, true, '2024-01-01')
  on conflict (tenant_id, regime, hour_type) do nothing;

  -- ── Reglas de recargo: LOSEP ───────────────────────────────────────────────
  -- Suplementaria:          HB × 1.25
  -- Suplementaria nocturna: HB × 1.5625  (1.25²)
  -- Extraordinaria:         HB × 2.00
  -- Extraordinaria nocturna:HB × 2.50   (2.00 × 1.25)
  -- Nocturna en jornada:    HB × 1.25
  -- Fuente: LOSEP Ecuador, Art. 113

  insert into attendance.surcharge_rules
    (tenant_id, regime, hour_type, multiplier, is_active, valid_from)
  values
    (p_tenant, 'LOSEP', 'NORMAL_DIURNA',           1.00,   true, '2024-01-01'),
    (p_tenant, 'LOSEP', 'NORMAL_NOCTURNA',         1.25,   true, '2024-01-01'),
    (p_tenant, 'LOSEP', 'SUPLEMENTARIA',           1.25,   true, '2024-01-01'),
    (p_tenant, 'LOSEP', 'SUPLEMENTARIA_NOCTURNA',  1.5625, true, '2024-01-01'),
    (p_tenant, 'LOSEP', 'EXTRAORDINARIA',          2.00,   true, '2024-01-01'),
    (p_tenant, 'LOSEP', 'EXTRAORDINARIA_NOCTURNA', 2.50,   true, '2024-01-01')
  on conflict (tenant_id, regime, hour_type) do nothing;

end;
$$;

grant execute on function attendance.seed_cira_defaults(uuid) to authenticated;

-- -------------------------------------------------------
-- 6) Reload PostgREST schema cache
-- -------------------------------------------------------

notify pgrst, 'reload schema';
