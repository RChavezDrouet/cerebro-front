import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/Button'

const AUTH_BYPASS = String(import.meta.env.VITE_AUTH_BYPASS || '0') === '1'

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  async function logout() {
    if (AUTH_BYPASS) {
      navigate('/attendance/report')
      return
    }
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItem = (to: string, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 text-sm ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`
      }
    >
      {label}
    </NavLink>
  )

  return (
    <div className="min-h-full">
      <div className="border-b border-white/10 bg-black/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm font-bold tracking-wide">
            HRCloud Base
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              {navItem('/config/turnos', 'Turnos')}
              {navItem('/config/horarios', 'Horarios')}
              {navItem('/employees', 'Empleados')}
              {navItem('/attendance/report', 'Reporte')}
            </div>

            {AUTH_BYPASS ? (
              <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Modo pruebas (sin login)
              </div>
            ) : (
              <Button variant="secondary" onClick={logout}>
                Salir
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}





