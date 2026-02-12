import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/config/supabase'

const AUTH_BYPASS = String(import.meta.env.VITE_AUTH_BYPASS || '0') === '1'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [loading, setLoading] = React.useState(!AUTH_BYPASS)
  const [authed, setAuthed] = React.useState(AUTH_BYPASS)

  React.useEffect(() => {
    if (AUTH_BYPASS) return

    let alive = true

    const run = async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      setAuthed(!!data?.session)
      setLoading(false)
    }

    void run()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      setAuthed(!!session)
      setLoading(false)
    })

    return () => {
      alive = false
      data?.subscription?.unsubscribe()
    }
  }, [])

  if (AUTH_BYPASS) return <>{children}</>

  if (loading) {
    return <div className="px-4 py-6 text-sm text-gray-400">Cargando…</div>
  }

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
