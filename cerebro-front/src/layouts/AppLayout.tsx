// src/layouts/AppLayout.tsx
import React, { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Receipt, BarChart3,
  ClipboardList, ShieldCheck, User, Settings,
  LogOut, Menu, X, Zap, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/config/supabase'
import { usePermissions } from '@/App'
import toast from 'react-hot-toast'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/tenants',  icon: Building2,       label: 'Empresas'   },
  { to: '/invoices', icon: Receipt,         label: 'Facturación'},
  { to: '/kpis',     icon: BarChart3,       label: 'KPIs'       },
  { to: '/audit',    icon: ClipboardList,   label: 'Auditoría'  },
  { to: '/access',   icon: ShieldCheck,     label: 'Accesos'    },
]

const BOTTOM_NAV = [
  { to: '/profile',  icon: User,     label: 'Mi Perfil'     },
  { to: '/settings', icon: Settings, label: 'Configuración' },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = usePermissions()
  const nav = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    nav('/login', { replace: true })
  }

  const roleColor = user?.role === 'admin'
    ? 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10'
    : user?.role === 'assistant'
    ? 'text-neon-violet border-neon-violet/30 bg-neon-violet/10'
    : 'text-neon-amber border-neon-amber/30 bg-neon-amber/10'

  const initial = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase()

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-5 py-5 border-b border-white/5 ${collapsed ? 'justify-center px-3' : ''}`}>
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-blue to-neon-cyan flex items-center justify-center shadow-neon-blue">
            <Zap size={18} className="text-white" fill="currentColor" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-neon-green border-2 border-cosmos-900 pulse-ring" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-display font-bold text-lg tracking-widest leading-none">CEREBRO</div>
            <div className="text-slate-600 text-[10px] font-mono tracking-wider mt-0.5">HRCloud Admin</div>
          </div>
        )}
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
              ${isActive
                ? 'nav-active text-white'
                : 'text-slate-500 hover:text-slate-200 hover:bg-white/4'
              }
              ${collapsed ? 'justify-center' : ''}`
            }
            onClick={() => setMobileOpen(false)}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  className={`flex-shrink-0 transition-colors ${isActive ? 'text-neon-cyan' : 'group-hover:text-slate-300'}`}
                />
                {!collapsed && (
                  <span className="text-sm font-medium font-body truncate">{label}</span>
                )}
                {!collapsed && isActive && (
                  <ChevronRight size={13} className="ml-auto text-neon-blue/60" />
                )}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2 py-1 rounded-lg bg-cosmos-800 border border-white/10 text-white text-xs font-body whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-white/5" />

      {/* Nav inferior */}
      <div className="px-3 py-3 space-y-1">
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative
              ${isActive ? 'nav-active text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-white/4'}
              ${collapsed ? 'justify-center' : ''}`
            }
            onClick={() => setMobileOpen(false)}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-neon-cyan' : 'group-hover:text-slate-300'}`} />
                {!collapsed && <span className="text-sm font-body">{label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2 py-1 rounded-lg bg-cosmos-800 border border-white/10 text-white text-xs font-body whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 hover:text-neon-red hover:bg-neon-red/5 transition-all duration-200 group relative ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={16} className="flex-shrink-0 group-hover:text-neon-red transition-colors" />
          {!collapsed && <span className="text-sm font-body">Cerrar sesión</span>}
          {collapsed && (
            <div className="absolute left-full ml-3 px-2 py-1 rounded-lg bg-cosmos-800 border border-white/10 text-white text-xs font-body whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Cerrar sesión
            </div>
          )}
        </button>
      </div>

      {/* User badge */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-xl bg-cosmos-800/60 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue/40 to-neon-cyan/40 flex items-center justify-center text-white text-sm font-bold font-sans flex-shrink-0 border border-neon-blue/20">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-white font-medium font-body truncate">
                {user?.full_name || user?.email?.split('@')[0]}
              </div>
              <span className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border capitalize mt-0.5 ${roleColor}`}>
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="mx-3 mb-3 flex justify-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue/40 to-neon-cyan/40 flex items-center justify-center text-white text-sm font-bold font-sans border border-neon-blue/20">
            {initial}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-screen cosmos-bg overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-bg opacity-100 pointer-events-none" />

      {/* ── Sidebar Desktop ── */}
      <aside
        className={`
          hidden lg:flex flex-col flex-shrink-0 relative z-20
          bg-cosmos-900/80 backdrop-blur-xl
          border-r border-white/5
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[64px]' : 'w-[260px]'}
        `}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-cosmos-800 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:border-neon-blue/30 transition-all z-30 shadow-lg"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronRight size={12} className="rotate-180" />}
        </button>
        <SidebarContent />
      </aside>

      {/* ── Sidebar Mobile ── */}
      <>
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          className={`
            lg:hidden fixed left-0 top-0 bottom-0 w-[260px] z-40
            bg-cosmos-900/95 backdrop-blur-xl border-r border-white/5
            transition-transform duration-300
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
          <SidebarContent />
        </aside>
      </>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 border-b border-white/5 bg-cosmos-900/60 backdrop-blur-xl flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-neon-cyan" fill="currentColor" />
            <span className="text-white font-display font-bold text-base tracking-widest">CEREBRO</span>
          </div>
        </header>

        {/* Scan line ambiental */}
        <div className="relative overflow-hidden flex-shrink-0" style={{ height: '1px' }}>
          <div className="scan-line" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
