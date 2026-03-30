/**
 * lib/tenant.ts — Base PWA v4.2.1-patch
 *
 * FUNCIONES:
 *  - resolveTenantId()        → tenant_id desde public.profiles
 *  - resolveUserRole()        → rol desde attendance.memberships ✅ (corregido de user_accounts)
 *  - fetchTenantGate()        → estado active/paused desde public.tenants (requerido por TenantGate.tsx)
 *  - checkFirstLoginPending() → first_login_pending desde attendance.employees
 *  - clearFirstLoginPending() → marca first_login_pending = false
 */
import { supabase } from '@/config/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UserRole = 'tenant_admin' | 'assistant' | 'auditor' | 'employee' | null

export type TenantGateResult = {
  id: string
  status: 'active' | 'paused'
}

// ─── resolveTenantId ─────────────────────────────────────────────────────────
// Obtiene el tenant_id del usuario desde public.profiles.
export async function resolveTenantId(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle()
    return data?.tenant_id ?? null
  } catch {
    return null
  }
}

// ─── resolveUserRole ─────────────────────────────────────────────────────────
// Obtiene el rol del usuario desde attendance.memberships.
// ✅ CORREGIDO: era attendance.user_accounts (tabla inexistente en este proyecto)
export async function resolveUserRole(userId: string): Promise<UserRole> {
  try {
    const { data } = await supabase
      .schema('attendance')
      .from('memberships')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    return (data?.role as UserRole) ?? 'employee'
  } catch {
    return 'employee'
  }
}

// ─── fetchTenantGate ─────────────────────────────────────────────────────────
// Requerida por TenantGate.tsx.
// Consulta public.tenants para obtener el estado active/paused del tenant.
export async function fetchTenantGate(tenantId: string): Promise<TenantGateResult | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('id', tenantId)
      .maybeSingle()

    if (error || !data) return null
    return data as TenantGateResult
  } catch {
    return null
  }
}

// ─── checkFirstLoginPending ──────────────────────────────────────────────────
// Consulta attendance.employees.first_login_pending.
// Retorna true  → debe cambiar contraseña antes de continuar.
// Retorna false → ya tiene contraseña definitiva.
export async function checkFirstLoginPending(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .schema('attendance')
      .from('employees')
      .select('first_login_pending')
      .eq('user_id', userId)
      .maybeSingle()
    return data?.first_login_pending === true
  } catch {
    return false
  }
}

// ─── clearFirstLoginPending ──────────────────────────────────────────────────
// Llamada desde SetPasswordPage tras completar el cambio de contraseña.
// Pone first_login_pending = false en attendance.employees.
export async function clearFirstLoginPending(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('attendance')
      .from('employees')
      .update({ first_login_pending: false })
      .eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}
