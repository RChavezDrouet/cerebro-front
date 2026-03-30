/**
 * ==============================================
 * CEREBRO SaaS - Hook useSettings
 * ==============================================
 *
 * Ajustado para el esquema real visto en Supabase:
 * - app_settings: tabla tipo “singleton” (id, company_name, company_logo, primary_color, ...)
 * - role_permissions: (role, permissions jsonb)
 *
 * Si en el futuro creas un esquema tipo key/value (setting_type, setting_key, setting_value),
 * puedes extender aquí. Por ahora, evita romper por columnas inexistentes.
 */

import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../config/supabase'
import { useToast } from './useToast'

const isSchemaCacheError = (err) => {
  const msg = err?.message || err?.details || ''
  return (
    typeof msg === 'string' &&
    (msg.includes('schema cache') ||
      msg.includes('Could not find the table') ||
      msg.includes('does not exist') ||
      msg.includes('Not Found'))
  )
}

const isMissingColumnError = (err) => {
  const msg = err?.message || err?.details || ''
  return typeof msg === 'string' && msg.includes('column') && msg.includes('does not exist')
}

/**
 * Intenta upsert en app_settings eliminando columnas inexistentes (robusto).
 */
const safeUpsertAppSettings = async (patch) => {
  let payload = { id: 1, ...patch }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .maybeSingle()

    if (!error) return { data: data ?? null, removedColumns: [] }

    const msg = error?.message || ''
    const match = msg.match(/column \"(.+?)\" does not exist/i)
    if (match?.[1]) {
      const missingCol = match[1]
      delete payload[missingCol]
      continue
    }

    if (isSchemaCacheError(error)) return { data: null, removedColumns: [] }
    throw error
  }

  return { data: null, removedColumns: [] }
}

export function useSettings() {
  const toast = useToast()

  const [settings, setSettings] = useState({
    // Branding (desde app_settings)
    branding: {
      company_name: '',
      company_logo: null,
      primary_color: '#0056e6',
      // opcionales (si existen en DB)
      company_ruc: '',
      secondary_color: '#0ea5e9',
      accent_color: '#22c55e',
      login_message_title: '',
      login_message_body: '',
    },

    // Role permissions cache
    rolePermissions: {
      admin: {},
      assistant: {},
      maintenance: {},
    },
  })

  const [loading, setLoading] = useState(false)

  /**
   * Cargar Branding desde app_settings (singleton).
   */
  const loadBranding = useCallback(async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) {
        if (isSchemaCacheError(error)) {
          // tabla no existe => no rompemos
          return
        }
        toast.error('No se pudo cargar Branding')
        console.warn('loadBranding error:', error)
        return
      }

      if (!data) return

      setSettings((prev) => ({
        ...prev,
        branding: {
          ...prev.branding,
          ...data,
          primary_color: data.primary_color || prev.branding.primary_color,
        },
      }))
    } finally {
      setLoading(false)
    }
  }, [toast])

  /**
   * Guardar Branding en app_settings.
   * Nota: si mandas campos que no existen como columna, se eliminan y se reintenta.
   */
  const saveBranding = useCallback(
    async (brandingPatch) => {
      try {
        setLoading(true)

        const patch = {
          company_name: brandingPatch.company_name,
          company_logo: brandingPatch.company_logo ?? null,
          primary_color: brandingPatch.primary_color,
          // opcionales
          company_ruc: brandingPatch.company_ruc,
          secondary_color: brandingPatch.secondary_color,
          accent_color: brandingPatch.accent_color,
          login_message_title: brandingPatch.login_message_title,
          login_message_body: brandingPatch.login_message_body,
        }

        const { data } = await safeUpsertAppSettings(patch)

        if (!data) {
          toast.warning('Branding guardado parcialmente (revisa columnas en DB)')
          return { success: false }
        }

        setSettings((prev) => ({
          ...prev,
          branding: { ...prev.branding, ...data },
        }))

        toast.success('Branding guardado')
        return { success: true }
      } catch (e) {
        toast.error('Error guardando Branding')
        console.error(e)
        return { success: false, error: e }
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  /**
   * Cargar role_permissions (jsonb) por rol.
   */
  const loadRolePermissions = useCallback(
    async (roles = ['admin', 'assistant', 'maintenance']) => {
      try {
        setLoading(true)

        const next = {}
        for (const role of roles) {
          const { data, error } = await supabase
            .from('role_permissions')
            .select('permissions')
            .eq('role', role)
            .maybeSingle()

          if (error) {
            if (isSchemaCacheError(error) || isMissingColumnError(error)) {
              next[role] = {}
              continue
            }
            console.warn('loadRolePermissions error:', error)
            next[role] = {}
            continue
          }

          const perms = data?.permissions
          next[role] = typeof perms === 'object' && perms ? perms : {}
        }

        setSettings((prev) => ({
          ...prev,
          rolePermissions: {
            ...prev.rolePermissions,
            ...next,
          },
        }))
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Guardar role_permissions para un rol (upsert por role).
   */
  const saveRolePermissions = useCallback(
    async (role, permissions) => {
      try {
        const { error } = await supabase
          .from('role_permissions')
          .upsert({ role, permissions }, { onConflict: 'role' })

        if (error) {
          if (isSchemaCacheError(error)) {
            toast.error("No existe la tabla 'role_permissions' en Supabase")
            return { success: false }
          }
          toast.error('No se pudo guardar permisos')
          console.warn(error)
          return { success: false, error }
        }

        setSettings((prev) => ({
          ...prev,
          rolePermissions: {
            ...prev.rolePermissions,
            [role]: permissions,
          },
        }))

        toast.success('Permiso actualizado')
        return { success: true }
      } catch (e) {
        toast.error('Error guardando permisos')
        return { success: false, error: e }
      }
    },
    [toast]
  )

  /**
   * API pública (mantiene compatibilidad mínima con llamadas existentes).
   */
  const api = useMemo(
    () => ({
      settings,
      loading,

      // Branding
      loadBranding,
      saveBranding,

      // Roles/Permisos
      loadRolePermissions,
      saveRolePermissions,

      /**
       * Compat (por si alguna parte del front la llama):
       * Antes esto intentaba cargar “todos” los settings desde app_settings (kv).
       * Ahora solo carga Branding + role_permissions.
       */
      loadAllSettings: async () => {
        await loadBranding()
        await loadRolePermissions()
        return settings
      },
    }),
    [settings, loading, loadBranding, saveBranding, loadRolePermissions, saveRolePermissions]
  )

  return api
}

