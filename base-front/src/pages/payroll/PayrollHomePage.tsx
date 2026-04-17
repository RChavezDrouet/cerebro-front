import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Play,
  FileText,
  Users,
  CreditCard,
  BarChart2,
  ChevronRight,
} from 'lucide-react'

interface PayrollCard {
  icon: React.ReactNode
  title: string
  description: string
  path: string
  color: string
  textColor: string
  badge?: string
}

const cards: PayrollCard[] = [
  {
    icon: <CalendarDays className="w-6 h-6" />,
    title: 'Períodos de Nómina',
    description: 'Crea y administra períodos mensuales de liquidación.',
    path: '/payroll/periods',
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700',
  },
  {
    icon: <Play className="w-6 h-6" />,
    title: 'Ejecuciones (Runs)',
    description: 'Calcula, revisa y cierra corridas de nómina por período.',
    path: '/payroll/runs',
    color: 'bg-emerald-50 border-emerald-200',
    textColor: 'text-emerald-700',
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: 'Conceptos',
    description: 'Catálogo de ingresos, deducciones, provisiones y contribuciones patronales.',
    path: '/payroll/concepts',
    color: 'bg-violet-50 border-violet-200',
    textColor: 'text-violet-700',
    badge: 'Próximamente',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Colaboradores',
    description: 'Perfiles de nómina, salarios base, datos IESS y SRI por empleado.',
    path: '/payroll/collaborators',
    color: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-700',
    badge: 'Próximamente',
  },
  {
    icon: <CreditCard className="w-6 h-6" />,
    title: 'Préstamos y Anticipos',
    description: 'Gestiona préstamos internos y anticipos de sueldo con descuento automático.',
    path: '/payroll/loans',
    color: 'bg-rose-50 border-rose-200',
    textColor: 'text-rose-700',
    badge: 'Próximamente',
  },
  {
    icon: <BarChart2 className="w-6 h-6" />,
    title: 'Exportaciones',
    description: 'Genera archivos para el IESS (planilla) y el SRI (formulario 107).',
    path: '/payroll/exports',
    color: 'bg-cyan-50 border-cyan-200',
    textColor: 'text-cyan-700',
    badge: 'Próximamente',
  },
]

export default function PayrollHomePage() {
  const navigate = useNavigate()
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nómina</h1>
        <p className="text-gray-500 text-sm mt-1">
          Liquidación mensual, cálculo de IESS, impuesto a la renta, provisiones y exportaciones legales.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((c) => (
          <button
            key={c.path}
            onClick={() => navigate(c.path)}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border ${c.color} hover:shadow-md transition-all text-left group`}
          >
            <div className={`${c.textColor} flex-shrink-0`}>{c.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{c.title}</span>
                {c.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.textColor} ${c.color} border`}>
                    {c.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-gray-600 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
