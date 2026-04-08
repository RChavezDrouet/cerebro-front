// =============================================
// HRCloud Attendance PWA - Auth Hook
// v3 — columnas alineadas al esquema real documentado en v4.8.7
//
// attendance.employees columnas reales:
//   id, tenant_id, user_id, first_name, last_name,
//   status, employee_code, biometric_employee_code,
//   work_mode, photo_path, geofence_lat, geofence_lng,
//   allow_remote_pwa, first_login_pending
//
// attendance.employee_profile columnas nuevas (autogestión PWA):
//   employee_id, phone, address, geofence_radius_m,
//   pwa_self_service_enabled, pwa_self_service_locked,
//   pwa_self_service_completed_at
//
// public.profiles columnas:
//   id (= auth user id), tenant_id, employee_id, role,
//   is_active, first_login_pending
//
// Ruta: src/hooks/useAuth.ts
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, safeSelect } from '../lib/supabase'
import type { UserProfile } from '../types'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

const PROFILE_TIMEOUT_MS = 12000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Timeout cargando ${label}`))
    }, ms)
    promise
      .then((value) => { window.clearTimeout(timer); resolve(value) })
      .catch((err)  => { window.clearTimeout(timer); reject(err) })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// attendance.employees — columnas confirmadas en doc v4.8.7
// Estrategia: intentar con columnas completas, degradar si hay error 42703
// ─────────────────────────────────────────────────────────────────────────────
async function selectAttendanceEmployeeByUser(userId: string) {
  const candidates = [
    // Completo según doc v4.8.7
    'id,tenant_id,user_id,first_name,last_name,status,employee_code,biometric_employee_code,work_mode,photo_path,geofence_lat,geofence_lng,allow_remote_pwa,first_login_pending',
    // Sin columnas opcionales que pueden no existir aún en ambientes parciales
    'id,tenant_id,user_id,first_name,last_name,status,employee_code,biometric_employee_code,work_mode,photo_path,geofence_lat,geofence_lng',
    // Sin photo_path ni geofence
    'id,tenant_id,user_id,first_name,last_name,status,employee_code,biometric_employee_code,work_mode',
    // Mínimo absoluto para resolver identidad
    'id,tenant_id,user_id,first_name,last_name,status',
    'id,tenant_id,user_id,first_name,last_name',
  ]

  for (const cols of candidates) {
    const data = await safeSelect<any>(() =>
      supabase
        .schema('attendance')
        .from('employees')
        .select(cols)
        .eq('user_id', userId)
        .maybeSingle()
    )
    if (data) return data
  }
  return null
}

async function selectAttendanceEmployeeById(employeeId: string) {
  const candidates = [
    'id,tenant_id,user_id,first_name,last_name,status,employee_code,biometric_employee_code,work_mode,photo_path,geofence_lat,geofence_lng,allow_remote_pwa,first_login_pending',
    'id,tenant_id,user_id,first_name,last_name,status,employee_code,biometric_employee_code,work_mode,photo_path,geofence_lat,geofence_lng',
    'id,tenant_id,user_id,first_name,last_name,status,employee_code,biometric_employee_code,work_mode',
    'id,tenant_id,user_id,first_name,last_name,status',
    'id,tenant_id,user_id,first_name,last_name',
  ]

  for (const cols of candidates) {
    const data = await safeSelect<any>(() =>
      supabase
        .schema('attendance')
        .from('employees')
        .select(cols)
        .eq('id', employeeId)
        .maybeSingle()
    )
    if (data) return data
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// public.employees — fallback cuando el user_id está vinculado en public
// (empleados creados desde Base antes de migración a attendance)
// ─────────────────────────────────────────────────────────────────────────────
async function selectPublicEmployeeByUser(userId: string) {
  const candidates = [
    'id,tenant_id,user_id,first_name,last_name,employment_status,employee_code',
    'id,tenant_id,user_id,first_name,last_name,employment_status',
    'id,tenant_id,user_id,first_name,last_name',
  ]

  for (const cols of candidates) {
    const data = await safeSelect<any>(() =>
      supabase
        .schema('public')
        .from('employees')
        .select(cols)
        .eq('user_id', userId)
        .maybeSingle()
    )
    if (data) return data
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// attendance.employee_profile — columnas NUEVAS del paquete de autogestión PWA
// Esta tabla puede no existir en ambientes no migrados → siempre best-effort
// ─────────────────────────────────────────────────────────────────────────────
async function selectEmployeeProfile(employeeId: string) {
  const candidates = [
    'employee_id,phone,address,geofence_radius_m,pwa_self_service_enabled,pwa_self_service_locked,pwa_self_service_completed_at',
    'employee_id,phone,address,geofence_radius_m',
    'employee_id,phone,address',
    'employee_id',
  ]

  for (const cols of candidates) {
    const data = await safeSelect<any>(() =>
      supabase
        .schema('attendance')
        .from('employee_profile')
        .select(cols)
        .eq('employee_id', employeeId)
        .maybeSingle()
    )
    if (data !== null && data !== undefined) return data
  }
  return null
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
  const bootstrappedRef  = useRef(false)

  const resolveProfile = useCallback(async (user: User): Promise<UserProfile> => {

    // ── Paso 1: resolver tenant_id + employee_id desde múltiples fuentes ──────
    const [ua, publicProfile, attEmpByUser, pubEmpByUser] = await Promise.all([
      withTimeout(
        safeSelect<{
          tenant_id: string
          employee_id: string | null
          role: string
          is_active: boolean
        }>(() =>
          supabase
            .schema('attendance')
            .from('user_accounts')
            .select('tenant_id, employee_id, role, is_active')
            .eq('user_id', user.id)
            .maybeSingle()
        ),
        PROFILE_TIMEOUT_MS,
        'attendance.user_accounts'
      ),
      withTimeout(
        safeSelect<{
          tenant_id: string
          employee_id: string | null
          role: string | null
          is_active: boolean | null
          first_login_pending: boolean | null
        }>(() =>
          supabase
            .from('profiles')
            .select('tenant_id, employee_id, role, is_active, first_login_pending')
            .eq('id', user.id)
            .maybeSingle()
        ),
        PROFILE_TIMEOUT_MS,
        'public.profiles'
      ),
      withTimeout(
        selectAttendanceEmployeeByUser(user.id),
        PROFILE_TIMEOUT_MS,
        'attendance.employees by user_id'
      ),
      withTimeout(
        selectPublicEmployeeByUser(user.id),
        PROFILE_TIMEOUT_MS,
        'public.employees by user_id'
      ).catch(() => null),
    ])

    const tenantId   = ua?.tenant_id  ?? publicProfile?.tenant_id  ?? attEmpByUser?.tenant_id ?? pubEmpByUser?.tenant_id
    const employeeId = ua?.employee_id ?? publicProfile?.employee_id ?? attEmpByUser?.id       ?? pubEmpByUser?.id
    const isActive   = ua?.is_active   ?? publicProfile?.is_active   ?? true

    if (!tenantId || !employeeId || isActive === false) {
      throw new Error(
        'No se pudo resolver tenant/employee para este usuario. ' +
        'Verifica attendance.user_accounts, public.profiles y attendance.employees.'
      )
    }

    // ── Paso 2: datos completos en paralelo ───────────────────────────────────
    const [attEmp, empProfile, tenant, selfServiceRaw] = await Promise.all([

      // Datos principales — attendance.employees (geofence, photo_path, work_mode)
      withTimeout(
        selectAttendanceEmployeeById(employeeId),
        PROFILE_TIMEOUT_MS,
        'attendance.employees by id'
      ),

      // Datos de autogestión — attendance.employee_profile (tabla nueva, opcional)
      withTimeout(
        selectEmployeeProfile(employeeId),
        PROFILE_TIMEOUT_MS,
        'attendance.employee_profile'
      ).catch(() => null),

      // Tenant
      withTimeout(
        safeSelect<any>(() =>
          supabase
            .from('tenants')
            .select('id,business_name,status,is_suspended,suspension_reason')
            .eq('id', tenantId)
            .maybeSingle()
        ),
        PROFILE_TIMEOUT_MS,
        'public.tenants'
      ),

      // RPC consolidado — opcional, no bloquea el login si falla
      withTimeout(
        safeSelect<any>(() =>
          supabase.schema('attendance').rpc('get_my_pwa_self_service_profile')
        ),
        PROFILE_TIMEOUT_MS,
        'attendance.get_my_pwa_self_service_profile'
      ).catch(() => null),
    ])

    const ss = Array.isArray(selfServiceRaw) ? selfServiceRaw[0] : selfServiceRaw

    const fullName =
      (ss        ? `${ss.first_name        ?? ''} ${ss.last_name        ?? ''}`.trim() : '') ||
      (attEmp    ? `${attEmp.first_name    ?? ''} ${attEmp.last_name    ?? ''}`.trim() : '') ||
      (attEmpByUser ? `${attEmpByUser.first_name ?? ''} ${attEmpByUser.last_name ?? ''}`.trim() : '') ||
      user.email ||
      'Empleado'

    return {
      id:        user.id,
      email:     ss?.email ?? user.email ?? '',
      full_name: fullName,
      role:      ua?.role  ?? publicProfile?.role ?? 'employee',

      tenant_id:             tenantId,
      tenant_name:           tenant?.business_name    ?? 'Empresa',
      tenant_status:         tenant?.status           ?? null,
      tenant_is_suspended:   tenant?.is_suspended     ?? null,
      tenant_paused_message: tenant?.suspension_reason ?? null,

      employee_id: employeeId,

      // ── Identidad — attendance.employees ─────────────────────────────────
      employee_code:
        ss?.employee_code         ??
        attEmp?.employee_code     ??
        attEmpByUser?.employee_code ??
        pubEmpByUser?.employee_code ??
        undefined,

      biometric_employee_code:
        ss?.biometric_employee_code         ??
        attEmp?.biometric_employee_code     ??
        attEmpByUser?.biometric_employee_code ??
        null,

      // ── Perfil operativo — attendance.employees (doc v4.8.7) ─────────────
      work_mode:
        ss?.work_mode         ??
        attEmp?.work_mode     ??
        attEmpByUser?.work_mode ??
        undefined,

      photo_path:
        attEmp?.photo_path     ??
        attEmpByUser?.photo_path ??
        null,

      geofence_lat:
        ss?.geofence_lat         ??
        attEmp?.geofence_lat     ??
        attEmpByUser?.geofence_lat ??
        null,

      geofence_lng:
        ss?.geofence_lng         ??
        attEmp?.geofence_lng     ??
        attEmpByUser?.geofence_lng ??
        null,

      // ── Columnas nuevas de autogestión — attendance.employee_profile ──────
      geofence_radius_m:
        ss?.geofence_radius_m    ??
        empProfile?.geofence_radius_m ??
        null,

      phone:
        ss?.phone    ??
        empProfile?.phone ??
        null,

      address:
        ss?.address    ??
        empProfile?.address ??
        null,

      pwa_self_service_enabled:
        ss?.pwa_self_service_enabled    ??
        empProfile?.pwa_self_service_enabled ??
        false,

      pwa_self_service_locked:
        ss?.pwa_self_service_locked    ??
        empProfile?.pwa_self_service_locked ??
        false,

      pwa_self_service_completed_at:
        ss?.pwa_self_service_completed_at    ??
        empProfile?.pwa_self_service_completed_at ??
        null,

      // ── Flags de acceso — attendance.employees + public.profiles ─────────
      allow_remote_pwa:
        attEmp?.allow_remote_pwa     ??
        attEmpByUser?.allow_remote_pwa ??
        true,   // permisivo por defecto para no bloquear UAT

      first_login_pending:
        publicProfile?.first_login_pending ??
        attEmp?.first_login_pending        ??
        false,
    }
  }, [])

  // ── loadProfile ─────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (user: User) => {
    const requestId = ++requestSeqRef.current

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const profile = await resolveProfile(user)

      if (!mountedRef.current || requestId !== requestSeqRef.current) return

      profileLoadedRef.current = true
      setState((prev) => ({ ...prev, user, profile, loading: false, error: null }))
    } catch (err: any) {
      console.error('Error cargando perfil:', err)
      if (!mountedRef.current || requestId !== requestSeqRef.current) return

      profileLoadedRef.current = false
      setState((prev) => ({
        ...prev,
        profile: null,
        loading: false,
        error: err?.message || 'Error cargando perfil del empleado.',
      }))
    }
  }, [resolveProfile])

  // ── Bootstrap y listener de sesión ──────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true

    const bootstrap = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!mountedRef.current) return

        bootstrappedRef.current = true

        if (session?.user) {
          setState((prev) => ({ ...prev, user: session.user, session, loading: true, error: null }))
          await loadProfile(session.user)
        } else {
          profileLoadedRef.current = false
          setState({ user: null, session: null, profile: null, loading: false, error: null })
        }
      } catch (err: any) {
        console.error('Error en bootstrap auth:', err)
        if (!mountedRef.current) return

        profileLoadedRef.current = false
        setState({
          user: null, session: null, profile: null, loading: false,
          error: err?.message || 'No se pudo inicializar la sesión.',
        })
      }
    }

    void bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mountedRef.current) return

        const user = session?.user ?? null

        switch (event) {
          case 'INITIAL_SESSION': {
            if (!bootstrappedRef.current && user) {
              setState((prev) => ({ ...prev, user, session, loading: true, error: null }))
              await loadProfile(user)
            }
            break
          }
          case 'SIGNED_IN': {
            if (user) {
              setState((prev) => ({ ...prev, user, session, loading: true, error: null }))
              await loadProfile(user)
            }
            break
          }
          case 'TOKEN_REFRESHED': {
            // CRÍTICO: NO bootstrap completo aquí — solo actualizar tokens
            // Si se llama loadProfile en TOKEN_REFRESHED causa pantalla bloqueada post-marcación
            setState((prev) => ({ ...prev, user, session, loading: false, error: null }))
            if (user && !profileLoadedRef.current) {
              await loadProfile(user)
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
          default: {
            if (user && !profileLoadedRef.current) {
              setState((prev) => ({ ...prev, user, session, loading: true, error: null }))
              await loadProfile(user)
            }
            break
          }
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
    await loadProfile(state.user)
  }, [loadProfile, state.user])

  return { ...state, signIn, signOut, refreshProfile }
}
