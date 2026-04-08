import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/config/supabase'
import { env } from '@/config/env'

export type TenantContext = { tenantId: string; tenantStatus?: string }

async function loadTenantContext(userId: string): Promise<TenantContext | null> {
  const { data: profile, error: e1 } = await supabase
    .from(env.VITE_PROFILES_TABLE)
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (e1) throw e1
  if (!profile?.tenant_id) return null

  const { data: tenant, error: e2 } = await supabase
    .from(env.VITE_TENANTS_TABLE)
    .select('id,status')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  if (e2) throw e2
  if (!tenant?.id) return null

  return { tenantId: tenant.id, tenantStatus: tenant.status }
}

export function useTenantContext(userId?: string) {
  return useQuery({
    queryKey: ['tenant-context', userId],
    enabled: !!userId,
    queryFn: () => loadTenantContext(userId!),
    staleTime: 60_000
  })
}
