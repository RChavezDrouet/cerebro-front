import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTenantGate, type TenantGateState } from '../lib/tenantGate'

export function useTenantGate(supabase: SupabaseClient) {
  const [state, setState] = useState<TenantGateState>({ allowed: false, status: 'unknown', message: null, tenantId: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    resolveTenantGate(supabase).then((result) => {
      if (!cancelled) {
        setState(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  return { ...state, loading }
}
