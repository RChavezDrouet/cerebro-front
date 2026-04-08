import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, CalendarDays, Settings, UploadCloud } from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/employees', label: 'Empleados', icon: <Users size={18} /> },
  { to: '/attendance', label: 'Asistencia', icon: <CalendarDays size={18} /> },
  { to: '/attendance/usb-import', label: 'Importación USB', icon: <UploadCloud size={18} /> },
  { to: '/config', label: 'Configuración', icon: <Settings size={18} /> },
]

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-sm text-white/60">HRCloud</div>
        <div className="text-lg font-semibold">Base</div>
      </div>

      <nav className="flex-1 overflow-auto px-3 py-3">
        <ul className="space-y-1">
          {nav.map((i) => (
            <li key={i.to}>
              <NavLink
                to={i.to}
                onClick={() => onNavigate?.()}
                className={({ isActive }) =>
                  'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ' +
                  (isActive ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5')
                }
              >
                <span className="text-white/75">{i.icon}</span>
                <span className="font-medium">{i.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10 text-xs text-white/50">v4.9.11-nav</div>
    </div>
  )
}
