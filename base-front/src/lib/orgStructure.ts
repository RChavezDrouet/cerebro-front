import { supabase, ATT_SCHEMA } from '@/config/supabase'

export type OrgLevelDefinition = {
  id?: string
  tenant_id: string
  level_no: number
  level_key: string
  display_name: string
  is_enabled: boolean
}

export type OrgUnit = {
  id: string
  tenant_id: string
  level_no: number
  parent_id: string | null
  code: string
  name: string
  description: string | null
  responsible_employee_id: string | null
  is_active: boolean
}

export type EmployeeLookup = {
  id: string
  full_name: string
  employee_code: string | null
}

export type EmployeeOrgAssignment = {
  employee_id: string
  org_unit_id: string | null
  supervisor_employee_id: string | null
  is_unit_leader: boolean
  lead_org_unit_id: string | null
}

export type EmployeeShiftAssignment = {
  employee_id: string
  shift_id: string | null
}

export const ORG_MIGRATION_HINT =
  'Faltan las tablas de jerarquía organizacional. Ejecuta la migración supabase/sql/040_org_structure_turns_hierarchy.sql.'

export function defaultOrgLevels(tenantId: string): OrgLevelDefinition[] {
  return [
    'Dirección / Gerencia',
    'Departamento',
    'rea',
    'Subárea',
    'Unidad',
    'Sección',
    'Equipo / Frente / Célula',
  ].map((display_name, i) => ({
    tenant_id: tenantId,
    level_no: i + 1,
    level_key: `LEVEL_${i + 1}`,
    display_name,
    is_enabled: i < 3,
  }))
}

export function isMissingOrgSchemaError(error: any) {
  const msg = String(error?.message ?? error ?? '')
  return (
    msg.includes('org_level_definitions') ||
    msg.includes('org_units') ||
    msg.includes('employee_org_assignments') ||
    msg.includes('employee_shift_assignments') ||
    msg.includes('Could not find the table') ||
    msg.includes('relation') ||
    msg.includes('does not exist')
  )
}

export async function fetchOrgLevelDefinitions(tenantId: string): Promise<OrgLevelDefinition[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('org_level_definitions')
    .select('id,tenant_id,level_no,level_key,display_name,is_enabled')
    .eq('tenant_id', tenantId)
    .order('level_no')

  if (error) {
    if (isMissingOrgSchemaError(error)) return defaultOrgLevels(tenantId)
    throw error
  }

  return ((data ?? []) as OrgLevelDefinition[]).length > 0
    ? ((data ?? []) as OrgLevelDefinition[])
    : defaultOrgLevels(tenantId)
}

export async function saveOrgLevelDefinitions(tenantId: string, rows: OrgLevelDefinition[]) {
  const payload = rows.map((row) => ({
    tenant_id: tenantId,
    level_no: row.level_no,
    level_key: row.level_key,
    display_name: row.display_name,
    is_enabled: row.is_enabled,
  }))

  const { error } = await supabase
    .schema(ATT_SCHEMA)
    .from('org_level_definitions')
    .upsert(payload, { onConflict: 'tenant_id,level_no' })

  if (error) throw error
}

export async function fetchOrgUnits(tenantId: string): Promise<OrgUnit[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('org_units')
    .select('id,tenant_id,level_no,parent_id,code,name,description,responsible_employee_id,is_active')
    .eq('tenant_id', tenantId)
    .order('level_no')
    .order('name')

  if (error) {
    if (isMissingOrgSchemaError(error)) return []
    throw error
  }

  return (data ?? []) as OrgUnit[]
}

export async function fetchEmployeeLookup(tenantId: string): Promise<EmployeeLookup[]> {
  const v = await supabase
    .schema('public')
    .from('v_employees_full')
    .select('id, employee_code, first_name, last_name')
    .eq('tenant_id', tenantId)
    .order('first_name')

  if (!v.error && v.data) {
    return (v.data as any[]).map((row) => ({
      id: row.id,
      employee_code: row.employee_code ?? null,
      full_name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
    }))
  }

  const { data, error } = await supabase
    .schema('public')
    .from('employees')
    .select('id, employee_number, first_name, last_name')
    .eq('tenant_id', tenantId)
    .order('first_name')

  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    employee_code: row.employee_number ?? null,
    full_name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
  }))
}

export async function upsertOrgUnit(tenantId: string, payload: Partial<OrgUnit> & { id?: string }) {
  const record = {
    tenant_id: tenantId,
    level_no: payload.level_no,
    parent_id: payload.parent_id ?? null,
    code: String(payload.code ?? '').trim(),
    name: String(payload.name ?? '').trim(),
    description: payload.description ?? null,
    responsible_employee_id: payload.responsible_employee_id ?? null,
    is_active: payload.is_active ?? true,
  }

  if (payload.id) {
    const { error } = await supabase
      .schema(ATT_SCHEMA)
      .from('org_units')
      .update(record)
      .eq('id', payload.id)
      .eq('tenant_id', tenantId)
    if (error) throw error
    return
  }

  const { error } = await supabase.schema(ATT_SCHEMA).from('org_units').insert(record)
  if (error) throw error
}

export async function softDeleteOrgUnit(tenantId: string, id: string) {
  const { error } = await supabase
    .schema(ATT_SCHEMA)
    .from('org_units')
    .update({ is_active: false })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function fetchEmployeeOrgAssignment(tenantId: string, employeeId: string): Promise<EmployeeOrgAssignment | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_org_assignments')
    .select('employee_id,org_unit_id,supervisor_employee_id,is_unit_leader,lead_org_unit_id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .is('effective_to', null)
    .maybeSingle()

  if (error) {
    if (isMissingOrgSchemaError(error)) return null
    throw error
  }
  return (data as EmployeeOrgAssignment | null) ?? null
}

export async function fetchEmployeeShiftAssignment(tenantId: string, employeeId: string): Promise<EmployeeShiftAssignment | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_shift_assignments')
    .select('employee_id,shift_id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .is('effective_to', null)
    .maybeSingle()

  if (error) {
    if (isMissingOrgSchemaError(error)) return null
    throw error
  }
  return (data as EmployeeShiftAssignment | null) ?? null
}

export async function saveEmployeeOrgAssignment(
  tenantId: string,
  payload: EmployeeOrgAssignment,
) {
  const closeCurrent = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_org_assignments')
    .update({ effective_to: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('employee_id', payload.employee_id)
    .is('effective_to', null)

  if (closeCurrent.error && !isMissingOrgSchemaError(closeCurrent.error)) {
    throw closeCurrent.error
  }

  if (!payload.org_unit_id && !payload.supervisor_employee_id && !payload.lead_org_unit_id && !payload.is_unit_leader) {
    return
  }

  const { error } = await supabase.schema(ATT_SCHEMA).from('employee_org_assignments').insert({
    tenant_id: tenantId,
    employee_id: payload.employee_id,
    org_unit_id: payload.org_unit_id,
    supervisor_employee_id: payload.supervisor_employee_id,
    is_unit_leader: payload.is_unit_leader,
    lead_org_unit_id: payload.is_unit_leader ? payload.lead_org_unit_id ?? payload.org_unit_id : null,
    effective_from: new Date().toISOString(),
    effective_to: null,
  })

  if (error) throw error
}

export async function saveEmployeeShiftAssignment(tenantId: string, payload: EmployeeShiftAssignment) {
  const closeCurrent = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_shift_assignments')
    .update({ effective_to: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('employee_id', payload.employee_id)
    .is('effective_to', null)

  if (closeCurrent.error && !isMissingOrgSchemaError(closeCurrent.error)) {
    throw closeCurrent.error
  }

  if (!payload.shift_id) return

  const { error } = await supabase.schema(ATT_SCHEMA).from('employee_shift_assignments').insert({
    tenant_id: tenantId,
    employee_id: payload.employee_id,
    shift_id: payload.shift_id,
    effective_from: new Date().toISOString(),
    effective_to: null,
  })

  if (error) throw error
}

export function buildOrgPath(units: OrgUnit[], unitId?: string | null): string {
  if (!unitId) return ''
  const byId = new Map(units.map((u) => [u.id, u]))
  const parts: string[] = []
  const visited = new Set<string>()
  let currentId: string | null = unitId

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const current = byId.get(currentId)
    if (!current) break
    parts.unshift(current.name)
    currentId = current.parent_id
  }

  return parts.length ? parts.join(' > ') : ''
}

export function resolveSupervisorLabel(
  assignment: EmployeeOrgAssignment | null,
  employees: EmployeeLookup[],
  units: OrgUnit[],
): string {
  if (!assignment) return ''

  const employeeById = new Map(employees.map((row) => [row.id, row]))
  if (assignment.supervisor_employee_id) {
    return employeeById.get(assignment.supervisor_employee_id)?.full_name ?? 'Supervisor manual'
  }

  const byId = new Map(units.map((u) => [u.id, u]))
  let current = assignment.org_unit_id ? byId.get(assignment.org_unit_id) : null
  while (current) {
    if (current.responsible_employee_id && current.responsible_employee_id !== assignment.employee_id) {
      return employeeById.get(current.responsible_employee_id)?.full_name ?? 'Responsable jerárquico'
    }
    current = current.parent_id ? byId.get(current.parent_id) ?? null : null
  }

  return 'No configurado'
}

export function resolveImmediateSupervisorEmployeeId(
  units: OrgUnit[],
  unitId?: string | null,
  employeeId?: string | null,
): string | null {
  if (!unitId) return null

  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const visited = new Set<string>()
  let current: OrgUnit | undefined | null = byId.get(unitId)

  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)

    if (current.responsible_employee_id && current.responsible_employee_id !== employeeId) {
      return current.responsible_employee_id
    }

    current = current.parent_id ? byId.get(current.parent_id) ?? null : null
  }

  return null
}

export function resolveImmediateSupervisorLabel(
  units: OrgUnit[],
  employees: EmployeeLookup[],
  unitId?: string | null,
  employeeId?: string | null,
): string {
  const supervisorId = resolveImmediateSupervisorEmployeeId(units, unitId, employeeId)
  if (!supervisorId) return 'Derivado del organigrama'

  const employeeById = new Map(employees.map((row) => [row.id, row]))
  return employeeById.get(supervisorId)?.full_name ?? 'Derivado del organigrama'
}
