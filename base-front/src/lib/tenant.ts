import { supabase, type TenantGate } from '@/config/supabase'
import { ENV } from '@/lib/env'

export async function resolveTenantId(userId: string): Promise<string | null> {
  // 1) Intentar metadata del usuario (si existe claim/metadata)
  const { data: userRes } = await supabase.auth.getUser()
  const metaTenant = (userRes.user?.user_metadata as any)?.tenant_id
  if (typeof metaTenant === 'string' && metaTenant.length > 0) return metaTenant

  // 2) Resolver desde schema aislado (attendance.my_memberships)
  // Esto evita depender de public.profiles y mantiene Base desacoplado de Cerebro.
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

  // 3) Fallback: Resolver desde profiles (si existe en el proyecto)
  const profilesTable = ENV.PROFILES_TABLE
  const { data, error } = await supabase
    .from(profilesTable)
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return null
  return (data as any)?.tenant_id ?? null
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
