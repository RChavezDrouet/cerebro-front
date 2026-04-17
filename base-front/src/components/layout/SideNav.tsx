import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Settings, BarChart2, Banknote,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubItem = { to: string; label: string }

// ─── Data ─────────────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { to: '/',          label: 'Dashboard',     icon: <LayoutDashboard size={18} /> },
  { to: '/employees', label: 'Empleados',     icon: <Users           size={18} /> },
  { to: '/reports',   label: 'Reportes',      icon: <BarChart2       size={18} /> },
  { to: '/payroll',   label: 'Nómina',        icon: <Banknote        size={18} /> },
  { to: '/config',    label: 'Configuración', icon: <Settings        size={18} /> },
]

const REPORTS_SUB: SubItem[] = [
  { to: '/reports/marcaciones', label: 'Marcaciones'     },
  { to: '/reports/asistencia',  label: 'Resumen Mensual' },
  { to: '/reports/cira',        label: 'Reporte CIRA'    },
]

const PAYROLL_SUB: SubItem[] = [
  { to: '/payroll/periods', label: 'Períodos'   },
  { to: '/payroll/runs',    label: 'Ejecuciones' },
]

// CIRA V2.0 items live under Configuración
const CONFIG_CIRA_SUB: SubItem[] = [
  { to: '/config/cira/regimen-laboral', label: 'Régimen Laboral' },
  { to: '/config/cira/multas',          label: 'Multas'          },
  { to: '/config/cira/horas-extra',     label: 'Horas Extra'     },
  { to: '/config/jornadas',             label: 'Jornadas'        },
  { to: '/config/jornadas/asignacion',  label: 'Asignación'      },
]

// ─── Components ───────────────────────────────────────────────────────────────

function MainLink({
  to, label, icon, end = false, onNavigate,
}: {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ' +
        (isActive ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5')
      }
    >
      <span className="text-white/75">{icon}</span>
      <span className="font-medium">{label}</span>
    </NavLink>
  )
}

function SubLink({ to, label, onNavigate }: SubItem & { onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition ' +
        (isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')
      }
    >
      <span className="w-1 h-1 rounded-full bg-white/30 shrink-0" />
      {label}
    </NavLink>
  )
}

// ─── SideNav ──────────────────────────────────────────────────────────────────

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-sm text-white/60">HRCloud</div>
        <div className="text-lg font-semibold">Base</div>
      </div>

      <nav className="flex-1 overflow-auto px-3 py-3 space-y-0.5">
        {MAIN_NAV.map((item) => (
          <React.Fragment key={item.to}>
            <MainLink
              to={item.to}
              label={item.label}
              icon={item.icon}
              end={item.to === '/'}
              onNavigate={onNavigate}
            />

            {/* Reportes sub-items */}
            {item.to === '/reports' && (
              <div className="ml-3 border-l border-white/10 pl-3 pt-0.5 pb-1 space-y-0.5">
                {REPORTS_SUB.map((s) => (
                  <SubLink key={s.to} {...s} onNavigate={onNavigate} />
                ))}
              </div>
            )}

            {/* Nómina sub-items */}
            {item.to === '/payroll' && (
              <div className="ml-3 border-l border-white/10 pl-3 pt-0.5 pb-1 space-y-0.5">
                {PAYROLL_SUB.map((s) => (
                  <SubLink key={s.to} {...s} onNavigate={onNavigate} />
                ))}
              </div>
            )}

            {/* Configuración sub-items — CIRA V2.0 */}
            {item.to === '/config' && (
              <div className="ml-3 border-l border-white/10 pl-3 pt-0.5 pb-1 space-y-0.5">
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                  CIRA V2.0
                </p>
                {CONFIG_CIRA_SUB.map((s) => (
                  <SubLink key={s.to} {...s} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 text-xs text-white/50">v4.9.14-nav</div>
    </div>
  )
}
