import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import {
  Brain, LayoutDashboard, Building2, Receipt, Settings,
  ClipboardList, LogOut, User, Menu, X, ChevronRight,
  Zap, Bell, Search, Moon, Sun, Activity, Palette, ShieldCheck, BarChart3
} from 'lucide-react'
import { useTheme } from '@/theme/ThemeProvider'
import { PALETTES, PaletteKey, ThemeMode } from '@/theme/theme'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard',    sub: 'Métricas globales', end: true },
  { to: '/tenants',  icon: Building2,       label: 'Empresas',     sub: 'Gestión de clientes' },
  { to: '/invoices', icon: Receipt,         label: 'Facturación',  sub: 'Pagos y facturas' },
  { to: '/kpis',     icon: BarChart3,       label: 'KPIs',         sub: 'Catálogo y widgets' },
  { to: '/access',   icon: ShieldCheck,     label: 'Accesos',      sub: 'Roles y permisos' },
  { to: '/audit',    icon: ClipboardList,   label: 'Auditoría',    sub: 'Logs del sistema' },
  { to: '/settings', icon: Settings,        label: 'Configuración',sub: 'Parámetros globales' },
]

interface AppShellProps {
  children: React.ReactNode
  userEmail: string
  userRole: string
  userName: string
}

export default function AppShell({ children, userEmail, userRole, userName }: AppShellProps) {
  const nav = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    nav('/login')
  }

  const currentPage = NAV.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))

  return (
    <div className="flex h-screen cosmos-bg overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          w-[260px]
          border-r border-white/5
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0
        `}
        style={{
          background: 'linear-gradient(180deg, rgba(9,14,31,0.98) 0%, rgba(4,5,13,0.99) 100%)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Sidebar glow top */}
        <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-neon-blue/8 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(37,99,255,0.2), rgba(6,230,255,0.1))', border: '1px solid rgba(37,99,255,0.3)' }}>
            <Brain size={20} className="text-neon-cyan" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-neon-green pulse-ring" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white tracking-[0.12em] font-display">CEREBRO</p>
            <p className="text-xs text-slate-600 font-body">HRCloud · v4.3.1</p>
          </div>
          <button
            className="lg:hidden text-slate-500 hover:text-white transition p-1 rounded-lg hover:bg-white/5"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-xs text-slate-700 uppercase tracking-widest font-sans px-3 mb-3 mt-1">Navegación</p>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden
                ${isActive ? 'nav-active' : 'text-slate-500 hover:text-slate-200 hover:bg-white/4'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-neon-blue/8 to-transparent pointer-events-none" />
                  )}
                  <item.icon size={18} className={`flex-shrink-0 transition-colors ${isActive ? 'text-neon-cyan' : 'group-hover:text-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium font-body ${isActive ? 'text-white' : ''}`}>{item.label}</p>
                  </div>
                  <ChevronRight size={14} className={`flex-shrink-0 transition-all duration-200 ${isActive ? 'opacity-60 text-neon-cyan' : 'opacity-0 group-hover:opacity-40'}`} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* System status */}
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl border border-neon-green/15 bg-neon-green/5">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-neon-green flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-neon-green font-body">Sistema operativo</p>
              <p className="text-xs text-slate-600 font-body">Supabase · Edge Functions</p>
            </div>
          </div>
        </div>

        {/* User section */}
        <div className="border-t border-white/5 p-3">
          <NavLink to="/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition group mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white font-sans"
              style={{ background: 'linear-gradient(135deg, #2563ff, #9333ea)' }}>
              {(userName || userEmail).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate font-body">{userName || userEmail}</p>
              <p className="text-xs text-slate-600 capitalize font-body">{userRole}</p>
            </div>
            <User size={14} className="text-slate-600 group-hover:text-slate-400 transition flex-shrink-0" />
          </NavLink>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-neon-red hover:bg-neon-red/8 transition text-sm font-body group"
          >
            <LogOut size={16} className="group-hover:animate-pulse" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/5"
          style={{ background: 'rgba(4,5,13,0.85)', backdropFilter: 'blur(20px)' }}>

          {/* Hamburger — visible on mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/6 transition"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600 font-body hidden sm:block">CEREBRO</span>
            <span className="text-slate-700 hidden sm:block">/</span>
            <span className="text-white font-medium font-body">{currentPage?.label || 'Dashboard'}</span>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(s => !s)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/6 transition"
              aria-label="Buscar"
            >
              <Search size={16} />
            </button>

            {/* Notifications placeholder */}
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/6 transition">
              <Bell size={16} />
            </button>

            {/* Theme toggle (day/night) */}
            <button
              onClick={() => theme.setMode(theme.mode === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/6 transition"
              aria-label="Cambiar tema"
              title="Día / Noche"
            >
              {theme.mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Palette selector (limited palettes) */}
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-xl border border-white/5 bg-white/3">
              <Palette size={14} className="text-slate-500" />
              <select
                className="bg-transparent text-xs text-slate-300 outline-none"
                value={theme.palette}
                onChange={(e) => theme.setPalette(e.target.value as PaletteKey)}
                aria-label="Paleta"
              >
                {Object.entries(PALETTES).map(([k, v]) => (
                  <option key={k} value={k} className="text-slate-900">
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Version badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg border border-neon-blue/15 bg-neon-blue/5">
              <Zap size={11} className="text-neon-blue" />
              <span className="text-xs text-neon-blue/70 font-mono">v4.3.1</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6 page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
