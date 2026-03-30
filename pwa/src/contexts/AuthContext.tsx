import React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, attendanceDb, publicDb, safeSelect } from '../lib/supabase'
import type { UserProfile } from '../types'

type AuthContextValue = {
  loading: boolean
  session: Session | null
  user: User | null
  profile: UserProfile | null
  mustChangePassword: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  sendResetEmail: (email: string) => Promise<void>
  completeFirstLogin: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  mustChangePassword: false,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  sendResetEmail: async () => {},
  completeFirstLogin: async () => {},
  refreshProfile: async () => {},
})

async function loadEmployee(userId: string) {
  return safeSelect<any>(() =>
    attendanceDb
      .from('employees')
      .select(
        'id,tenant_id,user_id,employee_code,first_name,last_name,status,work_mode,geofence_lat,geofence_lng,facial_photo_url,first_login_pending'
      )
      .eq('user_id', userId)
      .maybeSingle()
  )
}

async function loadMembership(userId: string) {
  return safeSelect<any>(() =>
    attendanceDb
      .from('memberships')
      .select('tenant_id,role')
      .eq('user_id', userId)
      .maybeSingle()
  )
}

async function loadProfileRow(userId: string) {
  return safeSelect<any>(() =>
    publicDb
      .from('profiles')
      .select('tenant_id,role,first_login_pending,is_active')
      .eq('id', userId)
      .maybeSingle()
  )
}

async function loadTenant(tenantId: string) {
  return safeSelect<any>(() =>
    publicDb
      .from('tenants')
      .select('id,business_name,name,status,is_suspended')
      .eq('id', tenantId)
      .maybeSingle()
  )
}

async function resolveAuthProfile(user: User): Promise<{
  profile: UserProfile | null
  mustChangePassword: boolean
  error: string | null
}> {
  const [profileRow, membership, employee] = await Promise.all([
    loadProfileRow(user.id),
    loadMembership(user.id),
    loadEmployee(user.id),
  ])

  const tenantId =
    (user.user_metadata as any)?.tenant_id ??
    profileRow?.tenant_id ??
    membership?.tenant_id ??
    employee?.tenant_id ??
    null

  if (!tenantId) {
    return {
      profile: null,
      mustChangePassword: false,
      error: 'No se pudo resolver el tenant del usuario autenticado.',
    }
  }

  const tenant = await loadTenant(tenantId)

  if (profileRow?.is_active === false) {
    return {
      profile: null,
      mustChangePassword: false,
      error: 'El usuario se encuentra inactivo.',
    }
  }

  if (!employee) {
    return {
      profile: null,
      mustChangePassword: Boolean(profileRow?.first_login_pending),
      error: 'La cuenta Auth existe, pero no está vinculada a attendance.employees.',
    }
  }

  const fullName =
    `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() ||
    user.email ||
    'Empleado'

  const profile: UserProfile = {
    id: user.id,
    email: user.email ?? '',
    full_name: fullName,
    role: membership?.role ?? profileRow?.role ?? 'employee',
    tenant_id: tenantId,
    tenant_name: tenant?.business_name ?? tenant?.name ?? 'Empresa',
    tenant_status: tenant?.status ?? null,
    tenant_is_suspended: tenant?.is_suspended ?? null,
    tenant_paused_message: null,
    employee_id: employee.id,
    employee_code: employee.employee_code ?? undefined,
    photo_path: employee.facial_photo_url ?? null,
    geofence_lat: employee.geofence_lat ?? null,
    geofence_lng: employee.geofence_lng ?? null,
    work_mode: employee.work_mode ?? null,
  }

  return {
    profile,
    mustChangePassword: Boolean(
      profileRow?.first_login_pending ?? employee?.first_login_pending
    ),
    error: null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true)
  const [session, setSession] = React.useState<Session | null>(null)
  const [user, setUser] = React.useState<User | null>(null)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [mustChangePassword, setMustChangePassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const bootstrap = React.useCallback(
    async (currentUser: User | null, currentSession: Session | null) => {
      setSession(currentSession)
      setUser(currentUser)

      if (!currentUser) {
        setProfile(null)
        setMustChangePassword(false)
        setError(null)
        setLoading(false)
        return
      }

      const resolved = await resolveAuthProfile(currentUser)
      setProfile(resolved.profile)
      setMustChangePassword(resolved.mustChangePassword)
      setError(resolved.error)
      setLoading(false)
    },
    []
  )

  React.useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      await bootstrap(data.session?.user ?? null, data.session ?? null)
    })

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await bootstrap(nextSession?.user ?? null, nextSession ?? null)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [bootstrap])

  const signIn = React.useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setLoading(false)
      throw error
    }
  }, [])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setMustChangePassword(false)
    setError(null)
  }, [])

  const sendResetEmail = React.useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }
    )

    if (error) throw error
  }, [])

  const completeFirstLogin = React.useCallback(
    async (password: string) => {
      if (!user) throw new Error('No hay sesión activa.')

      const { error: pwdError } = await supabase.auth.updateUser({ password })
      if (pwdError) throw pwdError

      const { error: clearError } = await supabase.rpc('clear_first_login_flags', {
        p_user_id: user.id,
      })

      if (clearError) {
        const { error: profileError } = await publicDb
          .from('profiles')
          .update({ first_login_pending: false })
          .eq('id', user.id)

        if (profileError) throw profileError
      }

      setMustChangePassword(false)
    },
    [user]
  )

  const refreshProfile = React.useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    await bootstrap(data.user ?? null, session)
  }, [bootstrap, session])

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user,
        profile,
        mustChangePassword,
        error,
        signIn,
        signOut,
        sendResetEmail,
        completeFirstLogin,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return React.useContext(AuthContext)
}