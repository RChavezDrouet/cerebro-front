import React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/config/supabase'

type AuthState = { loading: boolean; session: Session | null; user: User | null }

const AuthContext = React.createContext<AuthState>({ loading: true, session: null, user: null })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ loading: true, session: null, user: null })

  React.useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setState({ loading: false, session: data.session, user: data.session?.user ?? null })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, session, user: session?.user ?? null })
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return React.useContext(AuthContext)
}
