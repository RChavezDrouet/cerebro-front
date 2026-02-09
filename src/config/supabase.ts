/**
 * ==============================================
 * CEREBRO SaaS - Configuración de Supabase
 * ==============================================
 *
 * Este archivo configura el cliente Supabase y provee helpers robustos.
 * Objetivo: evitar bloqueos por:
 * - 0 filas (maybeSingle)
 * - Tablas/columnas inexistentes ("schema cache")
 */

import { createClient } from '@supabase/supabase-js'

// Variables (Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables. Check .env.local')
}

// Cliente Supabase (Anon)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Helpers de autenticación
 */
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

/**
 * Helper genérico para obtener rol desde una tabla, tolerante a errores.
 * Si la tabla/columna no existe o hay error, retorna null sin romper la app.
 */
type TryGetRoleArgs = {
  table: string
  by: 'id' | 'email'
  value: string
}

const tryGetRoleFromTable = async ({ table, by, value }: TryGetRoleArgs): Promise<string | null> => {
  try {
    const query = supabase.from(table).select('role')

    const { data, error } =
      by === 'id'
        ? await query.eq('id', value).maybeSingle()
        : await query.eq('email', value).maybeSingle()

    if (error) {
      // Errores típicos si la tabla/columna no existe o no está en cache
      const msg = (error as any)?.message || String(error)
      if (
        msg.includes('schema cache') ||
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        msg.includes('column') ||
        msg.includes('permission denied')
      ) {
        return null
      }
      console.warn(`⚠️ tryGetRoleFromTable(${table}) error:`, msg)
      return null
    }

    return (data as any)?.role ?? null
  } catch (e) {
    return null
  }
}

/**
 * ✅ REGLA (Opción B): rol SOLO por public.user_roles.email
 * Se ignora user_metadata.role para evitar inconsistencias (como la tuya).
 */
export const getUserRole = async (identity?: { email?: string | null }): Promise<string | null> => {
  try {
    // Evitar dependencia extra a auth.getUser() cuando ya tenemos el email del session.user
    const emailRaw = (identity?.email ?? (await getCurrentUser())?.email ?? '').toString()
    if (!emailRaw) return null

    const email = emailRaw.trim().toLowerCase()
    if (!email) return null

    // NO usar maybeSingle(): si existen duplicados por casing (p.ej. Admin@x vs admin@x)
    // preferimos resolver por prioridad en el cliente y loguear el incidente.
    const { data, error } = await supabase
      .from('user_roles')
      .select('email,role')
      .ilike('email', email)
      .limit(10)

    if (error) {
      console.warn('⚠️ getUserRole: error leyendo user_roles por email:', (error as any)?.message || error)
      return null
    }

    const rows = (data || []) as any[]
    if (!rows.length) return null

    const normalizeRole = (r: any) => String(r || '').trim().toLowerCase()
    const priority: Record<string, number> = { assistant: 1, maintenance: 2, admin: 3 }

    const candidates = rows
      .map((r) => ({ email: String(r.email || ''), role: normalizeRole(r.role) }))
      .filter((r) => ['admin', 'assistant', 'maintenance'].includes(r.role))

    if (!candidates.length) return null

    if (candidates.length > 1) {
      console.warn('⚠️ getUserRole: múltiples filas para el mismo email (posible duplicado por casing).', {
        email,
        candidates,
      })
    }

    // Elegir el rol con mayor privilegio
    const best = candidates.reduce((acc, cur) => (priority[cur.role] > priority[acc.role] ? cur : acc))
    return best.role
  } catch (error) {
    console.error('❌ Error en getUserRole:', error)
    return null
  }
}

/**
 * App settings / Branding (singleton)
 * - Si la tabla no existe o está vacía, retorna null sin romper.
 */
/**
 * Obtiene la matriz de permisos del rol desde public.role_permissions (jsonb).
 * - Fail-safe: si no existe o hay error, retorna {}.
 */
export const getRolePermissions = async (role: string | null): Promise<Record<string, boolean>> => {
  try {
    const r = String(role || '').trim().toLowerCase()
    if (!r) return {}
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permissions')
      .eq('role', r)
      .maybeSingle()
    if (error || !data) return {}
    const perms = (data as any)?.permissions
    if (!perms || typeof perms !== 'object') return {}
    return perms as Record<string, boolean>
  } catch {
    return {}
  }
}

export const getAppSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null

    // Compat + normalización de logo (algunas versiones guardaron URLs no-public)
    const anyD: any = data as any
    const logoRaw = anyD.company_logo || anyD.logo_url || null
    const normalizeLogo = (url: any) => {
      if (!url) return null
      const s = String(url)
      if (s.includes('/storage/v1/object/') && !s.includes('/storage/v1/object/public/') && !s.includes('/storage/v1/object/sign/')) {
        return s.replace('/storage/v1/object/', '/storage/v1/object/public/')
      }
      return s
    }

    return {
      ...anyD,
      company_ruc: anyD.company_ruc || anyD.ruc || null,
      company_logo: normalizeLogo(logoRaw),
    }
  } catch {
    return null
  }
}

/**
 * SMTP settings (singleton: id=1)
 */
export const getSmtpSettings = async () => {
  try {
    const { data, error } = await supabase.from('smtp_settings').select('*').eq('id', 1).maybeSingle()
    if (error) return null
    return data
  } catch {
    return null
  }
}

/**
 * KPI targets (singleton: id=1)
 */
export const getKpiTargets = async () => {
  try {
    const { data, error } = await supabase.from('kpi_targets').select('*').eq('id', 1).maybeSingle()
    if (error) return null
    return data
  } catch {
    return null
  }
}

/**
 * Edge Functions wrappers
 */
export const invokeFn = async <T = any>(name: string, body?: any): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw error
  return data as T
}

export const smtpTest = async (to: string) => invokeFn('smtp-test', { to })
export const smtpSave = async (payload: any) => invokeFn('smtp-settings', payload)
export const broadcastEmail = async (payload: any) => invokeFn('broadcast-email', payload)
export const adminCreateUser = async (payload: any) => invokeFn('admin-create-user', payload)
export const adminCreateTenant = async (payload: any) => invokeFn('admin-create-tenant', payload)

// =====================
// Auditoría (ms-auditoria / audit_logs)
// =====================

const isSchemaCacheError = (err: any) => {
  const msg = String(err?.message || err?.details || err || '')
  return (
    msg.includes('schema cache') ||
    msg.includes('Could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('Not Found')
  )
}

/**
 * Registra un evento de auditoría en public.audit_logs.
 * - Fail-safe: si no existe la tabla o RLS lo bloquea, NO rompe el flujo.
 * - NO debe usarse para registrar secretos (passwords, tokens, service keys).
 */
export const logAuditEvent = async (action: string, details?: Record<string, any>) => {
  try {
    const a = String(action || '').trim().slice(0, 120)
    if (!a) return

    // Mejor esfuerzo: email actual (si existe sesión)
    let email: string | null = null
    try {
      const { data } = await supabase.auth.getUser()
      email = (data?.user?.email || null) as any
    } catch {
      email = null
    }

    const safeDetails = (() => {
      try {
        // Evitar errores por estructuras circulares
        return details ? JSON.parse(JSON.stringify(details)) : null
      } catch {
        return null
      }
    })()

    const { error } = await supabase.from('audit_logs').insert({
      action: a,
      user_email: email,
      details: safeDetails,
    })

    if (error) {
      if (isSchemaCacheError(error)) return
      // No toasts aquí: auditoría no debe bloquear UX.
      console.warn('audit_logs insert error:', (error as any)?.message || error)
    }
  } catch (e) {
    if (isSchemaCacheError(e)) return
    console.warn('logAuditEvent failed:', e)
  }
}


