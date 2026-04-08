// =============================================
// HRCloud Attendance PWA - Supabase Client
// =============================================
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Variables de entorno de Supabase no configuradas.',
    'Copia .env.example a .env.local y completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'hrcloud_pwa_session',
  },
})

// Cliente apuntando al esquema attendance
export const attendanceDb = supabase.schema('attendance')

/**
 * SELECT best-effort:
 * Si falla por diferencias de esquema o columnas inexistentes,
 * devolvemos null en vez de romper la PWA.
 */
export async function safeSelect<T>(fn: () => any): Promise<T | null> {
  try {
    const { data, error } = await fn()
    if (error) throw error
    return (data as T) ?? null
  } catch (err) {
    console.warn('safeSelect fallback:', err)
    return null
  }
}

/**
 * Obtiene el usuario autenticado actual
 */
export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) throw error
  return user
}

/**
 * Obtiene el tenant_id del usuario autenticado
 * Fuente principal: attendance.user_accounts
 * Fallback: public.profiles
 */
export const getCurrentTenantId = async (): Promise<string | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  try {
    const { data, error } = await supabase
      .schema('attendance')
      .from('user_accounts')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!error && data?.tenant_id) {
      return data.tenant_id
    }
  } catch (err) {
    console.warn('Fallback tenant_id: attendance.user_accounts no disponible.', err)
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!error && data?.tenant_id) {
      return data.tenant_id
    }
  } catch (err) {
    console.warn('Fallback tenant_id: public.profiles no disponible.', err)
  }

  return null
}

/**
 * Helper para insertar con tenant_id
 */
export const insertWithTenant = async (
  table: string,
  record: Record<string, unknown>,
  tenantId: string
) => {
  return supabase.from(table).insert({ ...record, tenant_id: tenantId })
}
