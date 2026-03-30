import { supabase } from '@/config/supabase'
import { env } from '@/config/env'

export type TenantGateResult = { paused: boolean; title: string; body: string }

export async function checkTenantStatus(userId: string): Promise<TenantGateResult> {
  const ok: TenantGateResult = { paused: false, title: '', body: '' }

  const { data: profile } = await supabase
    .from(env.VITE_PROFILES_TABLE)
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.tenant_id) return ok

  const { data: tenant } = await supabase
    .from(env.VITE_TENANTS_TABLE)
    .select('status')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  if (!tenant || tenant.status !== 'paused') return ok

  return {
    paused: true,
    title: 'Empresa suspendida',
    body: 'Tu empresa está temporalmente suspendida. Contacta al soporte para más información.'
  }
}
