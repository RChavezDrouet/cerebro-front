// =============================================
// HRCloud Attendance PWA - Auth Hook
// v5.0 — Abril 2026
//
// FUENTE DE IDENTIDAD: public.profiles (.single() — siempre tiene registro)
// FUENTE OPERATIVA: attendance.employees (best-effort, maybeSingle)
//
// BOOTSTRAP:
//   getSession() al montar → token garantizado listo.
//   onAuthStateChange solo gestiona SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}


// ─────────────────────────────────────────────────────────────────────────────
// Fuente principal: public.profiles
//   Siempre tiene registro → nunca falla. Da: tenant_id, employee_id, role,
//   is_active, first_login_pending.
//
// Fuente secundaria (best-effort): attendance.employees
//   Da nombre, work_mode, foto, geofence, etc. Si falla, se usan defaults.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveProfile(user: User): Promise<UserProfile> {
  // ── 1. Identidad garantizada ──────────────────────────────────────────────
  console.log('[AUTH] consultando profiles...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id, employee_id, role, is_active, first_login_pending')
    .eq('id', user.id)
    .single()

  console.log('[AUTH] profiles resultado:', profile, profileError)

  if (profileError) {
    throw new Error(`profiles: ${profileError.message}`)
  }
  if (!profile?.tenant_id || !profile?.employee_id) {
    throw new Error('No se pudo resolver tenant/employee. Verifica public.profiles.')
  }
  if (profile.is_active === false) {
    throw new Error('Usuario inactivo. Contacta a tu administrador.')
  }

  // ── 2. Datos operativos del empleado (best-effort) ────────────────────────
  console.log('[AUTH] consultando attendance.employees...')
  const { data: emp } = await supabase
    .schema('attendance')
    .from('employees')
    .select(
      'first_name, last_name, employee_code, biometric_employee_code, ' +
      'work_mode, photo_path, geofence_lat, geofence_lng, allow_remote_pwa'
    )
    .eq('id', profile.employee_id)
    .maybeSingle()

  console.log('[AUTH] employees resultado:', emp)

  const fullName = emp
    ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
    : ''

  const result: UserProfile = {
    id:        user.id,
    email:     user.email ?? '',
    full_name: fullName || user.email || 'Empleado',
    role:      profile.role ?? 'employee',

    tenant_id:   profile.tenant_id,
    employee_id: profile.employee_id,

    employee_code:           emp?.employee_code           ?? undefined,
    biometric_employee_code: emp?.biometric_employee_code ?? null,
    work_mode:               emp?.work_mode               ?? undefined,
    photo_path:              emp?.photo_path               ?? null,
    geofence_lat:            emp?.geofence_lat             ?? null,
    geofence_lng:            emp?.geofence_lng             ?? null,
    geofence_radius_m:       null,

    allow_remote_pwa:    emp?.allow_remote_pwa    ?? true,
    first_login_pending: profile.first_login_pending ?? false,

    pwa_self_service_enabled:      false,
    pwa_self_service_locked:       false,
    pwa_self_service_completed_at: null,
  }
  console.log('[AUTH] perfil cargado:', result.employee_id)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  })

  const mountedRef       = useRef(true)
  const requestSeqRef    = useRef(0)
  const profileLoadedRef = useRef(false)

  // ── loadProfile ──────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (user: User, session: Session | null) => {
    const requestId = ++requestSeqRef.current
    console.log('[AUTH] loadProfile iniciado, requestId:', requestId)

    if (!session?.access_token) {
      console.log('[AUTH] sin token válido, abortando loadProfile')
      setState((prev) => ({ ...prev, loading: false, error: null }))
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    console.log('[AUTH] token presente, exp:', session?.expires_at, 'ahora:', Math.floor(Date.now() / 1000))

    try {
      const profile = await resolveProfile(user)
      if (!mountedRef.current || requestId !== requestSeqRef.current) return
      profileLoadedRef.current = true
      setState((prev) => ({ ...prev, user, profile, loading: false, error: null }))
    } catch (err: any) {
      console.log('[AUTH] error en catch:', err)
      if (!mountedRef.current || requestId !== requestSeqRef.current) return
      profileLoadedRef.current = false
      setState((prev) => ({
        ...prev,
        profile: null,
        loading: false,
        error: err?.message || 'Error cargando perfil del empleado.',
      }))
    }
  }, [])

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  // REGLA: loadProfile SOLO se llama desde SIGNED_IN y TOKEN_REFRESHED.
  // INITIAL_SESSION puede dispararse durante _recoverAndRefresh con un token
  // aún no válido → solo actualiza UI, nunca carga perfil.
  useEffect(() => {
    mountedRef.current = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!mountedRef.current) return
        const user = session?.user ?? null

        switch (event) {
          case 'INITIAL_SESSION': {
            if (!user) {
              // Sin sesión → mostrar login
              setState({ user: null, session: null, profile: null, loading: false, error: null })
            } else {
              // Sesión presente pero token puede no estar listo → spinner, esperar TOKEN_REFRESHED o SIGNED_IN
              setState((prev) => ({ ...prev, user, session, loading: true, error: null }))
            }
            break
          }

          case 'SIGNED_IN': {
            if (user && !profileLoadedRef.current) {
              setState((prev) => ({ ...prev, user, session, loading: true, error: null }))
              // setTimeout(0) escapa el mutex interno de Supabase auth.
              // Sin esto, cualquier query dentro del callback se bloquea
              // esperando que el mismo mutex se libere (deadlock).
              const capturedUser = user
              const capturedSession = session
              setTimeout(() => { void loadProfile(capturedUser, capturedSession) }, 0)
            } else {
              setState((prev) => ({ ...prev, user, session, loading: false }))
            }
            break
          }

          case 'TOKEN_REFRESHED': {
            setState((prev) => ({ ...prev, user, session }))
            if (user && !profileLoadedRef.current) {
              const capturedUser = user
              const capturedSession = session
              setTimeout(() => { void loadProfile(capturedUser, capturedSession) }, 0)
            }
            break
          }

          case 'USER_UPDATED': {
            setState((prev) => ({
              ...prev,
              user,
              session: session ?? prev.session,
              loading: false,
              error: null,
            }))
            break
          }

          case 'SIGNED_OUT': {
            profileLoadedRef.current = false
            setState({ user: null, session: null, profile: null, loading: false, error: null })
            break
          }

          default:
            break
        }
      }
    )

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  // ── Acciones públicas ────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error.message === 'Invalid login credentials'
            ? 'Credenciales inválidas. Verifica tu correo y contraseña.'
            : error.message,
      }))
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    profileLoadedRef.current = false
    setState({ user: null, session: null, profile: null, loading: false, error: null })
  }

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    profileLoadedRef.current = false
    await loadProfile(state.user, state.session)
  }, [loadProfile, state.user, state.session])

  return { ...state, signIn, signOut, refreshProfile }
}
// cache-bust: 2026-04-08
