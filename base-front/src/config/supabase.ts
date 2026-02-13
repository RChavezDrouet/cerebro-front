// src/config/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '@/lib/env'

/**
 * =========================================================
 * Supabase Client (Base)
 * =========================================================
 * - Cliente principal: supabase (schema por defecto: public)
 * - Cliente de schema attendance: attendanceDb (para evitar 400 por schema equivocado)
 * =========================================================
 */

const SUPABASE_URL = ENV.SUPABASE_URL()
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY()

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Esto te ayuda a detectar problemas de .env en DO/local
  // (en runtime en Vite: import.meta.env)
  // No uses process.env aquí.
  throw new Error(
    '[supabase] Faltan variables de entorno: SUPABASE_URL / SUPABASE_ANON_KEY'
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
 *   await attendanceDb.rpc('debug_auth_context')
 *
 * Esto evita que el app pegue a /rest/v1/turns (public) por error.
 */
export const attendanceDb = supabase.schema('attendance')

/**
 * Tipos usados en tenant gate (si aplica)
 */
export type TenantGate = {
  id: string
  status: 'active' | 'paused'
  paused_message?: string | null
}

/**
 * SOLO para depuración local (no afecta producción)
 * Permite ejecutar en consola:
 *   await window.supabase.schema('attendance').rpc('debug_auth_context')
 */
declare global {
  interface Window {
    supabase?: SupabaseClient
  }
}

if (import.meta.env.DEV) {
  window.supabase = supabase
}
