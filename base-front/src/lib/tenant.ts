import { supabase, type TenantGate } from '@/config/supabase'
import { ENV } from '@/lib/env'

/**
 * Resuelve el tenant_id del usuario logueado.
 *
 * Orden de resolución:
 * 1) user_metadata.tenant_id (si existe)
 * 2) attendance.my_memberships (si existe)
 * 3) public.profiles (tabla configurable) usando profiles.id = auth.users.id  ✅ (tu caso real)
 * 4) fallback: profiles.user_id (compatibilidad con otros esquemas)
 */
export async function resolveTenantId(userId: string): Promise<string | null> {
  // 1) Metadata del usuario (si existe)
  const { data: userRes } = await supabase.auth.getUser()
  const metaTenant = (userRes.user?.user_metadata as any)?.tenant_id
  if (typeof metaTenant === 'string' && metaTenant.length > 0) return metaTenant

  // 2) Schema attendance: my_memberships
  try {
    const { data: m, error: mErr } = await supabase
      .schema('attendance')
      .from('my_memberships')
      .select('tenant_id')
      .limit(1)
      .maybeSingle()

    if (!mErr && (m as any)?.tenant_id) return (m as any).tenant_id as string
  } catch {
    // ignore
  }

  // 3) Fallback: public.profiles (o tabla configurada)
  const profilesTable = ENV.PROFILES_TABLE

  // ✅ TU CASO REAL: public.profiles.id = auth.users.id
  {
    const { data, error } = await supabase
      .from(profilesTable)
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle()

    if (!error && (data as any)?.tenant_id) return (data as any).tenant_id as string
  }

  // Compatibilidad: algunos esquemas usan profiles.user_id
  {
    const { data, error } = await supabase
      .from(profilesTable)
      .select('tenant_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!error && (data as any)?.tenant_id) return (data as any).tenant_id as string
  }

  return null
}

export async function fetchTenantGate(tenantId: string): Promise<TenantGate | null> {
  const tenantsTable = ENV.TENANTS_TABLE

  const { data, error } = await supabase
    .from(tenantsTable)
    .select('id,status,paused_message')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) return null
  return data as unknown as TenantGate
}
