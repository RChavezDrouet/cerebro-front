-- HRCloud / Base
-- 06_views_reports_seed.sql

-- Seeds mínimos de conceptos
insert into attendance.payroll_concepts (
  tenant_id, code, name, category, calculation_mode, taxable_iess, taxable_income_tax,
  affects_net_pay, sort_order, is_system, is_active
)
select t.id, x.code, x.name, x.category, 'SYSTEM', x.tax_iess, x.tax_renta, x.net, x.sort_order, true, true
from public.tenants t
cross join (
  values
    ('BASE_SALARY','Sueldo Base','EARNING', true, true, true, 10),
    ('OVERTIME_50','Horas Extra 50%','EARNING', true, true, true, 20),
    ('OVERTIME_100','Horas Extra 100%','EARNING', true, true, true, 21),
    ('IESS_EMPLOYEE','Aporte IESS Empleado','DEDUCTION', false, false, true, 100),
    ('INCOME_TAX','Impuesto a la Renta','DEDUCTION', false, false, true, 101),
    ('ADVANCE_DISCOUNT','Descuento por Anticipo','DEDUCTION', false, false, true, 102),
    ('LOAN_DISCOUNT','Descuento por Préstamo','DEDUCTION', false, false, true, 103),
    ('IESS_EMPLOYER','Aporte IESS Patronal','EMPLOYER_CONTRIBUTION', false, false, false, 200),
    ('PROV_13TH','Provisión Décimo Tercero','PROVISION', false, false, false, 300),
    ('PROV_14TH','Provisión Décimo Cuarto','PROVISION', false, false, false, 301),
    ('PROV_VACATION','Provisión Vacaciones','PROVISION', false, false, false, 302)
) as x(code, name, category, tax_iess, tax_renta, net, sort_order)
on conflict (tenant_id, code) do nothing;

-- Seed mínimo de settings por tenant
insert into attendance.payroll_settings(tenant_id, setting_code, setting_value, valid_from, is_active)
select t.id, 'EC_LEGAL_DEFAULTS',
       jsonb_build_object(
         'iess_employee_pct', 9.45,
         'iess_employer_pct', 11.15,
         'reserve_fund_pct', 8.33,
         'thirteenth_salary_mode', 'MONTHLY_PROVISION',
         'fourteenth_salary_mode', 'MONTHLY_PROVISION'
       ),
       current_date,
       true
from public.tenants t
on conflict do nothing;

create or replace view attendance.v_payroll_receipt_summary as
select
  prc.tenant_id,
  pr.id as payroll_run_id,
  p.code as payroll_period_code,
  prc.employee_id,
  prc.employee_code,
  prc.collaborator_name,
  prc.total_earnings,
  prc.total_deductions,
  prc.total_employer_contributions,
  prc.total_provisions,
  prc.net_pay,
  pr.status as payroll_run_status,
  pp.published_at
from attendance.payroll_run_collaborators prc
join attendance.payroll_runs pr on pr.id = prc.payroll_run_id
join attendance.payroll_periods p on p.id = pr.payroll_period_id
left join attendance.payroll_receipts pp on pp.payroll_run_collaborator_id = prc.id;

create or replace view attendance.v_performance_review_summary as
select
  pr.tenant_id,
  pr.id as performance_review_id,
  pc.code as cycle_code,
  pc.name as cycle_name,
  pr.employee_id,
  e.employee_code,
  coalesce(e.full_name, concat_ws(' ', e.first_name, e.last_name)) as collaborator_name,
  pr.status,
  pr.self_score,
  pr.reviewer_score,
  pr.final_score,
  pr.final_result_label,
  pr.published_at
from attendance.performance_reviews pr
join attendance.performance_cycles pc on pc.id = pr.performance_cycle_id
join public.employees e on e.id = pr.employee_id;

create or replace view attendance.v_training_gap_summary as
select
  g.tenant_id,
  g.id as performance_gap_id,
  g.employee_id,
  e.employee_code,
  coalesce(e.full_name, concat_ws(' ', e.first_name, e.last_name)) as collaborator_name,
  g.gap_name,
  g.severity,
  g.current_score,
  g.target_score,
  g.status,
  tp.id as training_plan_id,
  tp.title as training_plan_title,
  tp.status as training_status
from attendance.performance_gaps g
join public.employees e on e.id = g.employee_id
left join attendance.training_plans tp on tp.performance_gap_id = g.id;