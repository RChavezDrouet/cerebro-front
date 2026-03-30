import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export const ATT_SCHEMA = env.VITE_ATTENDANCE_SCHEMA

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'base_auth'
  },
  global: {
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY
    }
  }
})
