import { supabase, ATT_SCHEMA } from '@/config/supabase'

export type AccessRole = 'employee' | 'assistant' | 'auditor' | 'tenant_admin'

export const ACCESS_ROLE_OPTIONS: Array<{ value: AccessRole; label: string; help: string }> = [
  { value: 'employee', label: 'Empleado', help: 'Sin privilegios administrativos. La jefatura organizacional se define aparte.' },
  { value: 'assistant', label: 'Asistente', help: 'Puede operar empleados, asistencia y tareas administrativas según permisos.' },
  { value: 'auditor', label: 'Auditor', help: 'Acceso de consulta y auditoría, sin operación administrativa.' },
  { value: 'tenant_admin', label: 'Administrador HRCloud', help: 'Acceso total del tenant. Debe existir uno solo activo por empresa.' },
]

export type EmployeeAccessInfo = {
  role: AccessRole
  user_id: string | null
  has_access: boolean
  source: 'user_accounts' | 'memberships' | 'none'
}

function normalizeRole(raw?: string | null): AccessRole {
  const role = String(raw || '').trim()
  if (role === 'assistant' || role === 'auditor' || role === 'tenant_admin') return role
  return 'employee'
}

export async function fetchEmployeeAccessRole(tenantId: string, employeeId: string, fallbackUserId?: string | null): Promise<EmployeeAccessInfo> {
  try {
    const { data, error } = await supabase
      .schema(ATT_SCHEMA)
      .from('user_accounts')
      .select('user_id,role,is_active')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .maybeSingle()

    if (!error && data) {
      return {
        role: normalizeRole((data as any).role),
        user_id: (data as any).user_id ?? null,
        has_access: !!(data as any).user_id && (data as any).is_active !== false,
        source: 'user_accounts',
      }
    }
  } catch {}

  if (fallbackUserId) {
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('memberships')
        .select('role,user_id')
        .eq('tenant_id', tenantId)
        .eq('user_id', fallbackUserId)
        .maybeSingle()

      if (!error && data) {
        return {
          role: normalizeRole((data as any).role),
          user_id: (data as any).user_id ?? fallbackUserId,
          has_access: true,
          source: 'memberships',
        }
      }
    } catch {}
  }

  return { role: 'employee', user_id: fallbackUserId ?? null, has_access: false, source: 'none' }
}

export async function ensureUniqueTenantAdmin(tenantId: string, employeeId?: string | null, userId?: string | null): Promise<void> {
  try {
    const { data, error } = await supabase
      .schema(ATT_SCHEMA)
      .from('user_accounts')
      .select('employee_id,user_id,role,is_active')
      .eq('tenant_id', tenantId)
      .eq('role', 'tenant_admin')
      .limit(5)

    if (!error && (data ?? []).some((row: any) => row.is_active !== false && row.employee_id !== employeeId && row.user_id !== userId)) {
      throw new Error('TENANT_ADMIN_ALREADY_EXISTS')
    }
  } catch (e: any) {
    if (String(e?.message || '') === 'TENANT_ADMIN_ALREADY_EXISTS') throw e
  }

  try {
    const { data, error } = await supabase
      .schema(ATT_SCHEMA)
      .from('memberships')
      .select('user_id,role')
      .eq('tenant_id', tenantId)
      .eq('role', 'tenant_admin')
      .limit(5)

    if (!error && (data ?? []).some((row: any) => row.user_id && row.user_id !== userId)) {
      throw new Error('TENANT_ADMIN_ALREADY_EXISTS')
    }
  } catch (e: any) {
    if (String(e?.message || '') === 'TENANT_ADMIN_ALREADY_EXISTS') throw e
  }
}

export function accessRoleLabel(role?: string | null): string {
  const normalized = normalizeRole(role)
  return ACCESS_ROLE_OPTIONS.find((opt) => opt.value === normalized)?.label ?? 'Empleado'
}
