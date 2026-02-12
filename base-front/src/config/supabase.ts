import { createClient } from '@supabase/supabase-js'
import { ENV } from '@/lib/env'

export const supabase = createClient(ENV.SUPABASE_URL(), ENV.SUPABASE_ANON_KEY(), {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export type TenantGate = {
  id: string
  status: 'active' | 'paused'
  paused_message?: string | null
}
// SOLO para depuración local (no afecta producción)
if (import.meta.env.DEV) {
  ;(window as any).supabase = supabase
}
