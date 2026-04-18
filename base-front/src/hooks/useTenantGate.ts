import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  INITIAL_TENANT_GATE_STATE,
  resolveTenantGate,
  type TenantGateState,
} from '../lib/tenantGate'

export function useTenantGate(supabaseClient?: SupabaseClient) {
  const [state, setState] = useState<TenantGateState>(() => INITIAL_TENANT_GATE_STATE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    setLoading(true)

    void resolveTenantGate({ supabaseClient }).then((result) => {
      if (!cancelled) {
        setState(result)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [supabaseClient])

  return { ...state, loading }
}
