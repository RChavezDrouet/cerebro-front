import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Falta VITE_SUPABASE_URL en el entorno')
}

if (!supabaseAnonKey) {
  throw new Error('Falta VITE_SUPABASE_ANON_KEY en el entorno')
}

/**
 * Schema HR principal para BASE.
 * Si no está definido en .env, cae a 'attendance'.
 */
export const ATT_SCHEMA =
  (import.meta.env.VITE_ATTENDANCE_SCHEMA as string | undefined)?.trim() || 'attendance'

/**
 * Tablas públicas usadas por BASE para resolver tenant y estado.
 */
export const PROFILES_TABLE =
  (import.meta.env.VITE_PROFILES_TABLE as string | undefined)?.trim() || 'profiles'

export const TENANTS_TABLE =
  (import.meta.env.VITE_TENANTS_TABLE as string | undefined)?.trim() || 'tenants'

export const TENANT_GATE_ENABLED =
  String(import.meta.env.VITE_TENANT_GATE_ENABLED ?? 'true').toLowerCase() === 'true'

/**
 * Cliente base (schema public por defecto)
 * - necesario para profiles / tenants / auth
 * - storageKey aislado para no chocar con Cerebro
 * - apikey explícito en headers globales
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'base_auth',
    storage: window.localStorage,
    flowType: 'pkce',
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
      'X-Application': 'HRCloud-Base',
    },
  },
})

/**
 * Cliente apuntando al schema attendance.
 * Úsalo para employees, punches, novelties, schedules, etc.
 */
export const attendance = supabase.schema(ATT_SCHEMA)

/**
 * Alias de compatibilidad.
 * Algunos archivos antiguos pueden importar db.
 */
export const db = attendance

export default supabase