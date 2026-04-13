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
    // CRÍTICO: NO usar storageKey personalizado.
    // Un storageKey diferente al default causa que el cliente mantenga
    // una sesión en localStorage separada que no coincide con el token
    // JWT real, haciendo que RLS bloquee todas las queries (devuelven
    // null silenciosamente). Documentado en HRCloud aprendizajes v4.8.7.
    // storageKey: 'hrcloud_pwa_session',  ← REMOVIDO
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
 * Obtiene el usuario autenticado actual (validado contra el servidor).
 */
export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  return user
}
