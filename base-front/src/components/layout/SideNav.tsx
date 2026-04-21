import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart2,
  Banknote,
  Inbox,
} from 'lucide-react'

type SubItem = { to: string; label: string }

const MAIN_NAV = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/employees', label: 'Colaboradores', icon: <Users size={18} /> },
  { to: '/management', label: 'Gestion', icon: <Inbox size={18} /> },
  { to: '/reports', label: 'Reportes', icon: <BarChart2 size={18} /> },
  { to: '/payroll', label: 'Nomina', icon: <Banknote size={18} /> },
  { to: '/config', label: 'Configuracion', icon: <Settings size={18} /> },
]

const MANAGEMENT_SUB: SubItem[] = [
  { to: '/management/requests', label: 'Solicitudes' },
  { to: '/management/approvals', label: 'Aprobaciones pendientes' },
]

const REPORTS_SUB: SubItem[] = [
  { to: '/reports/marcaciones', label: 'Marcaciones' },
  { to: '/reports/asistencia', label: 'Resumen mensual' },
  { to: '/reports/cira', label: 'Reporte CIRA' },
]

const PAYROLL_SUB: SubItem[] = [
  { to: '/payroll/periods', label: 'Periodos' },
  { to: '/payroll/runs', label: 'Ejecuciones' },
]

const CONFIG_GENERAL_SUB: SubItem[] = [
  { to: '/config/approval-flows', label: 'Flujos de aprobacion' },
]

const CONFIG_CIRA_SUB: SubItem[] = [
  { to: '/config/cira/regimen-laboral', label: 'Regimen laboral' },
  { to: '/config/cira/multas', label: 'Multas' },
  { to: '/config/cira/horas-extra', label: 'Horas extra' },
  { to: '/config/jornadas', label: 'Jornadas' },
  { to: '/config/jornadas/asignacion', label: 'Asignacion' },
]

function MainLink({
  to,
  label,
  icon,
  end = false,
  onNavigate,
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
        (isActive ? 'border border-white/10 bg-white/10' : 'hover:bg-white/5')
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
      <span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />
      {label}
    </NavLink>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  )
}

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-sm text-white/60">HRCloud</div>
        <div className="text-lg font-semibold">Base</div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-auto px-3 py-3">
        {MAIN_NAV.map((item) => (
          <React.Fragment key={item.to}>
            <MainLink
              to={item.to}
              label={item.label}
              icon={item.icon}
              end={item.to === '/'}
              onNavigate={onNavigate}
            />

            {item.to === '/management' && (
              <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3 pt-0.5 pb-1">
                {MANAGEMENT_SUB.map((subItem) => (
                  <SubLink key={subItem.to} {...subItem} onNavigate={onNavigate} />
                ))}
              </div>
            )}

            {item.to === '/reports' && (
              <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3 pt-0.5 pb-1">
                {REPORTS_SUB.map((subItem) => (
                  <SubLink key={subItem.to} {...subItem} onNavigate={onNavigate} />
                ))}
              </div>
            )}

            {item.to === '/payroll' && (
              <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3 pt-0.5 pb-1">
                {PAYROLL_SUB.map((subItem) => (
                  <SubLink key={subItem.to} {...subItem} onNavigate={onNavigate} />
                ))}
              </div>
            )}

            {item.to === '/config' && (
              <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3 pt-0.5 pb-1">
                <SectionLabel>RRHH</SectionLabel>
                {CONFIG_GENERAL_SUB.map((subItem) => (
                  <SubLink key={subItem.to} {...subItem} onNavigate={onNavigate} />
                ))}
                <SectionLabel>CIRA V2.0</SectionLabel>
                {CONFIG_CIRA_SUB.map((subItem) => (
                  <SubLink key={subItem.to} {...subItem} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4 text-xs text-white/50">v4.9.15-approval-nav</div>
    </div>
  )
}
