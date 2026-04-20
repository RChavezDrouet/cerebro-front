import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/config/supabase'
import { env } from '@/config/env'
import { baseDebug } from '@/lib/debug'

export type TenantContext = { tenantId: string; tenantStatus?: string }

async function loadTenantContext(userId: string): Promise<TenantContext | null> {
  baseDebug('tenant-context.request', {
    mode: import.meta.env.MODE,
    prod: import.meta.env.PROD,
    userId,
    supabaseOrigin: new URL(env.VITE_SUPABASE_URL).origin,
    profilesTable: env.VITE_PROFILES_TABLE,
    tenantsTable: env.VITE_TENANTS_TABLE,
  })

  const { data: profile, error: e1 } = await supabase
    .from(env.VITE_PROFILES_TABLE)
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  baseDebug('tenant-context.profile', {
    userId,
    hasError: Boolean(e1),
    error: e1 instanceof Error ? e1.message : e1 ? String(e1) : null,
    profileTenantId: profile?.tenant_id ?? null,
  })

  if (e1) throw e1
  if (!profile?.tenant_id) return null

  const { data: tenant, error: e2 } = await supabase
    .from(env.VITE_TENANTS_TABLE)
    .select('id,status')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  baseDebug('tenant-context.tenant', {
    userId,
    tenantId: profile.tenant_id,
    hasError: Boolean(e2),
    error: e2 instanceof Error ? e2.message : e2 ? String(e2) : null,
    tenantStatus: tenant?.status ?? null,
  })

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
