import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, Settings,
  UploadCloud, Scale, Receipt, Clock, BarChart2,
} from 'lucide-react'

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavItem = {
  to:    string
  label: string
  icon:  React.ReactNode
  sub?:  NavItem[]
}

const NAV: NavItem[] = [
  { to: '/',                  label: 'Dashboard',       icon: <LayoutDashboard size={18} /> },
  { to: '/employees',         label: 'Empleados',        icon: <Users size={18} /> },
  {
    to: '/attendance', label: 'Asistencia', icon: <CalendarDays size={18} />,
    sub: [
      { to: '/attendance/daily',      label: 'Reporte diario',  icon: <CalendarDays size={15} /> },
      { to: '/attendance/novelties',  label: 'Novedades',       icon: <CalendarDays size={15} /> },
      { to: '/attendance/usb-import', label: 'Importación USB', icon: <UploadCloud  size={15} /> },
      { to: '/reports/cira',          label: 'Reporte CIRA',    icon: <BarChart2    size={15} /> },
    ],
  },
  {
    to: '/config', label: 'Configuración', icon: <Settings size={18} />,
    sub: [
      { to: '/config/company',               label: 'Empresa',          icon: <Settings size={15} /> },
      { to: '/config/horarios',              label: 'Horarios',         icon: <Clock    size={15} /> },
      { to: '/config/feriados',              label: 'Feriados',         icon: <CalendarDays size={15} /> },
      { to: '/config/cira/regimen-laboral',  label: 'Régimen Laboral',  icon: <Scale    size={15} /> },
      { to: '/config/cira/multas',           label: 'Multas',           icon: <Receipt  size={15} /> },
      { to: '/config/cira/horas-extra',      label: 'Horas Extra',      icon: <Clock    size={15} /> },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ' +
        (isActive ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5')
      }
    >
      <span className="text-white/75">{item.icon}</span>
      <span className="font-medium">{item.label}</span>
    </NavLink>
  )
}

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-sm text-white/60">HRCloud</div>
        <div className="text-lg font-semibold">Base</div>
      </div>

      <nav className="flex-1 overflow-auto px-3 py-3">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              {item.sub ? (
                <>
                  {/* Parent item — not a link, just a label */}
                  <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/40 select-none">
                    <span>{item.icon}</span>
                    <span className="font-semibold uppercase tracking-wide text-xs">
                      {item.label}
                    </span>
                  </div>
                  {/* Sub-items */}
                  <ul className="ml-3 border-l border-white/10 pl-3 space-y-0.5">
                    {item.sub.map((sub) => (
                      <li key={sub.to}>
                        <NavItemLink item={sub} onNavigate={onNavigate} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <NavItemLink item={item} onNavigate={onNavigate} />
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10 text-xs text-white/50">v4.9.12-cira</div>
    </div>
  )
}
