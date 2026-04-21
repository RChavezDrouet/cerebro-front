import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

import { Drawer } from '@/components/ui/Drawer'
import { SideNav } from './SideNav'
import { TenantGateBanner } from './TenantGateBanner'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/config/supabase'
import { useTenantGate } from '@/hooks/useTenantGate'

export function AppShell() {
  const [open, setOpen] = React.useState(false)
  const nav = useNavigate()

  const { loading: gateLoading, blocked, title, body } = useTenantGate()

  const signOut = async () => {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    nav('/login', { replace: true })
  }

  // Mientras verifica el estado del tenant, mostrar spinner mínimo
  if (gateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1220]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  // Tenant suspendido o pausado: bloquear toda la app
  if (blocked) {
    return <TenantGateBanner title={title} body={body} />
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:block">
        <div className="h-full bg-[#0b1220]/70 glass border-r border-white/10">
          <SideNav />
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)}>
        <SideNav onNavigate={() => setOpen(false)} />
      </Drawer>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/70 glass">
          <div className="mx-auto flex w-full max-w-screen-2xl min-w-0 items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button className="lg:hidden rounded-2xl border border-white/10 p-2 hover:bg-white/10" onClick={() => setOpen(true)}>
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <div className="text-xs text-white/50">HRCloud Base</div>
                <div className="text-sm font-semibold">Asistencia & RRHH</div>
              </div>
            </div>

            <Button variant="secondary" leftIcon={<LogOut size={16} />} onClick={signOut}>Salir</Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-screen-2xl min-w-0 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
