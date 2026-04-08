import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

import { Drawer } from '@/components/ui/Drawer'
import { SideNav } from './SideNav'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/config/supabase'

export function AppShell() {
  const [open, setOpen] = React.useState(false)
  const nav = useNavigate()

  const signOut = async () => {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
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
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button className="lg:hidden rounded-2xl border border-white/10 p-2 hover:bg-white/10" onClick={() => setOpen(true)}>
                <Menu size={18} />
              </button>
              <div>
                <div className="text-xs text-white/50">HRCloud Base</div>
                <div className="text-sm font-semibold">Asistencia & RRHH</div>
              </div>
            </div>

            <Button variant="secondary" leftIcon={<LogOut size={16} />} onClick={signOut}>Salir</Button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
