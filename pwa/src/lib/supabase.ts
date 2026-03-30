import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'hrcloud_base_pwa_auth',
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
      'X-Application': 'HRCLOUD-BASE-PWA',
    },
  },
})

export const attendanceDb = supabase.schema('attendance')
export const publicDb = supabase.schema('public')

export async function safeSelect<T>(
  fn: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> {
  try {
    const { data, error } = await fn()
    if (error) throw error
    return data ?? null
  } catch {
    return null
  }
}