// src/config/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * =========================================================
 * Supabase Client (Base)
 * =========================================================
 * - Cliente principal: supabase (schema por defecto: public)
 * - Cliente schema attendance: attendanceDb (evita 400 por schema equivocado)
 * - Debug DEV: window.supabase (para consola)
 * =========================================================
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabase] Faltan variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Revisa .env/.env.local y reinicia Vite.'
  )
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

/**
 * Cliente “fijado” al schema attendance.
 * Úsalo así:
 *   await attendanceDb.from('turns').insert(...)
 *   await attendanceDb.from('employees').select(...)
 */
export const attendanceDb = supabase.schema('attendance')

/**
 * Tipo usado por Tenant Gate (si aplica)
 */
export type TenantGate = {
  id: string
  status: 'active' | 'paused'
  paused_message?: string | null
}

/**
 * =========================================================
 * DEV ONLY: acceso a supabase desde consola del navegador
 * =========================================================
 * En consola:
 *   window.supabase.auth.getSession().then(console.log)
 *   window.supabase.schema('attendance').from('turns').select('*').then(console.log)
 */
declare global {
  interface Window {
    supabase?: SupabaseClient
  }
}

if (import.meta.env.DEV) {
  window.supabase = supabase
}
