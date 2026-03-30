// =============================================
// HRCloud Attendance PWA - Auth Hook
// =============================================
import { useState, useEffect, useCallback } from 'react'
import { supabase, safeSelect } from '../lib/supabase'
import type { UserProfile } from '../types'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  })

  // Carga el perfil del empleado asociado al usuario
  const loadProfile = useCallback(async (user: User) => {
    try {
      // 1) Fuente de verdad recomendada en Base: public.profiles (id = auth.users.id)
      const prof = await safeSelect<{ tenant_id: string; employee_id: string | null; full_name?: string | null }>(() =>
        supabase
          .from('profiles')
          .select('tenant_id, employee_id, full_name')
          .eq('id', user.id)
          .maybeSingle()
      )

      // 2) Fallback: tabla employees por user_id (si existe en tu esquema)
      const empByUser = !prof?.employee_id
        ? await safeSelect<any>(() =>
            supabase
              .schema('attendance')
              .from('employees')
              .select('id, tenant_id, first_name, last_name, status, photo_path, geofence_lat, geofence_lng')
              .eq('user_id', user.id)
              .maybeSingle()
          )
        : null

      const tenantId = prof?.tenant_id || empByUser?.tenant_id
      const employeeId = (prof?.employee_id as string | null) || empByUser?.id

      if (!tenantId || !employeeId) {
        setState(prev => ({
          ...prev,
          error: 'No se pudo resolver tenant/employee para este usuario. Verifica public.profiles (tenant_id, employee_id).',
          loading: false,
        }))
        return
      }

      // Obtener nombre del tenant (no asumimos legacy_business)
      const tenant = await safeSelect<any>(() =>
        supabase.from('tenants').select('id,name,status,paused_message').eq('id', tenantId).maybeSingle()
      )

      const fullName =
        prof?.full_name ||
        (empByUser ? `${empByUser.first_name ?? ''} ${empByUser.last_name ?? ''}`.trim() : '') ||
        (user.email || 'Empleado')

      const profile: UserProfile = {
        id: user.id,
        email: user.email || '',
        full_name: fullName,
        role: 'employee',
        tenant_id: tenantId,
        tenant_name: tenant?.name || 'Empresa',
        tenant_status: tenant?.status ?? null,
        tenant_paused_message: tenant?.paused_message ?? null,
        employee_id: employeeId,
        // extras opcionales (para geofence / foto)
        photo_path: empByUser?.photo_path ?? null,
        geofence_lat: empByUser?.geofence_lat ?? null,
        geofence_lng: empByUser?.geofence_lng ?? null,
      } as any

      setState(prev => ({ ...prev, profile, loading: false, error: null }))
    } catch (err: any) {
      console.error('Error cargando perfil:', err)
      setState(prev => ({
        ...prev,
        error: 'Error cargando perfil del empleado.',
        loading: false,
      }))
    }
  }, [])

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({ ...prev, user: session.user, session }))
        loadProfile(session.user)
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user || null,
          session,
        }))
        if (session?.user) {
          loadProfile(session.user)
        } else {
          setState(prev => ({ ...prev, profile: null, loading: false }))
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // Login con email/password
  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message === 'Invalid login credentials'
          ? 'Credenciales inválidas. Verifica tu correo y contraseña.'
          : error.message,
      }))
    }
  }

  // Logout
  const signOut = async () => {
    await supabase.auth.signOut()
    setState({
      user: null,
      session: null,
      profile: null,
      loading: false,
      error: null,
    })
  }

  return { ...state, signIn, signOut }
}

