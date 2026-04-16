import { useState, useEffect } from 'react'
import { supabase } from '@/config/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TenantGateResult = {
  loading:  boolean
  blocked:  boolean
  title:    string
  body:     string
}

type AppSettingsRow = {
  paused_message_title: string | null
  paused_message_body:  string | null
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TITLE = 'Cuenta suspendida'
const DEFAULT_BODY  =
  'El acceso a esta cuenta está temporalmente bloqueado. ' +
  'Contacta con soporte para más información.'

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useTenantGate
 *
 * Resuelve el tenant del usuario autenticado directamente desde la sesión
 * (auth.uid → public.profiles.tenant_id → public.tenants.status).
 * NO depende de useTenantStore porque el store puede estar vacío cuando
 * AppShell monta por primera vez.
 *
 * Devuelve blocked=true si status === 'paused' o is_suspended === true.
 * Fail-open: si la query falla por red, permite el acceso (no bloquea).
 */
export function useTenantGate(): TenantGateResult {
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [title,   setTitle]   = useState(DEFAULT_TITLE)
  const [body,    setBody]     = useState(DEFAULT_BODY)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        // ── 1. Usuario autenticado ──────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) { setLoading(false); return }

        // ── 2. tenant_id desde public.profiles ─────────────────────────────
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) throw profileError
        if (!profile?.tenant_id || cancelled) { setLoading(false); return }

        // ── 3. Estado del tenant ────────────────────────────────────────────
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('status, is_suspended')
          .eq('id', profile.tenant_id)
          .maybeSingle()

        if (tenantError) throw tenantError
        if (cancelled) return

        const isBlocked =
          tenant?.status === 'paused' ||
          tenant?.is_suspended === true

        if (!isBlocked) {
          setBlocked(false)
          setLoading(false)
          return
        }

        // ── 4. Mensaje personalizado en app_settings ────────────────────────
        const { data: settings } = await supabase
          .from('app_settings')
          .select('paused_message_title, paused_message_body')
          .eq('id', 1)
          .maybeSingle()

        if (cancelled) return

        setTitle((settings as AppSettingsRow | null)?.paused_message_title ?? DEFAULT_TITLE)
        setBody ((settings as AppSettingsRow | null)?.paused_message_body  ?? DEFAULT_BODY)
        setBlocked(true)

      } catch (err) {
        // Fail-open: error de red no bloquea la app
        console.warn('[useTenantGate] check failed, allowing access:', err)
        if (!cancelled) setBlocked(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  return { loading, blocked, title, body }
}
