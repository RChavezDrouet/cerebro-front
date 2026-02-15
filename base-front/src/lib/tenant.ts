import { supabase, type TenantGate } from '@/config/supabase'

/**
 * Resuelve el tenant_id del usuario logueado.
 *
 * Orden de resolución:
 * 1) user_metadata.tenant_id (si existe)
 * 2) attendance.my_memberships (si existe)
 * 3) public.profiles por id = auth.users.id   ✅ (tu caso real)
 * 4) fallback: public.profiles.user_id (compatibilidad)
 */
export async function resolveTenantId(userId: string): Promise<string | null> {
  // 1) Metadata del usuario (si existe)
  const { data: userRes } = await supabase.auth.getUser()
  const metaTenant = (userRes.user?.user_metadata as any)?.tenant_id
  if (typeof metaTenant === 'string' && metaTenant.trim().length > 0) return metaTenant.trim()

  // 2) Schema attendance: my_memberships (si existe)
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

  // 3) public.profiles (tu esquema real: profiles.id = auth.users.id)
  {
    const { data, error } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle()

    if (!error && (data as any)?.tenant_id) return (data as any).tenant_id as string
  }

  // 4) Compatibilidad: profiles.user_id (si algún día cambias la estructura)
  {
    const { data, error } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!error && (data as any)?.tenant_id) return (data as any).tenant_id as string
  }

  return null
}

/**
 * Tenant gate (estado active/paused).
 *
 * Nota: en tu tabla public.tenants NO existe paused_message, por eso solo consultamos id,status.
 */
export async function fetchTenantGate(tenantId: string): Promise<TenantGate | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id,status')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) {
    // útil para debug en consola
    console.error('fetchTenantGate error:', error)
    return null
  }

  return data as unknown as TenantGate
}
