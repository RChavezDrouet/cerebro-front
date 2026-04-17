import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Camera,
  Clock,
  Shield,
  SlidersHorizontal,
  ChevronRight,
  Cpu,
  Mail,
  CalendarDays,
  KeyRound,
  GitBranch,
  Scale,
  DollarSign,
  Timer,
} from 'lucide-react'

interface ConfigItem {
  icon: React.ReactNode
  title: string
  description: string
  path: string
  badge?: string
  color: string
  textColor: string
}

// ─── Configuración general ────────────────────────────────────────────────────

const generalItems: ConfigItem[] = [
  {
    icon: <GitBranch className="w-6 h-6" />,
    title: 'Organigrama / Estructura organizacional',
    description: 'Define el organigrama de la empresa y administra hasta 7 niveles jerárquicos por tenant.',
    path: '/config/organigrama',
    badge: 'Hasta 7 niveles',
    color: 'bg-violet-50 border-violet-200',
    textColor: 'text-violet-700',
  },
  {
    icon: <Building2 className="w-6 h-6" />,
    title: 'Empresa',
    description: 'Nombre, logo, zona horaria y datos generales de tu empresa.',
    path: '/config/company',
    color: 'bg-slate-50 border-slate-200',
    textColor: 'text-slate-600',
  },
  {
    icon: <Camera className="w-6 h-6" />,
    title: 'Reconocimiento Facial',
    description: 'Parámetros de calidad de foto, captura facial y detección de vivacidad.',
    path: '/config/reconocimiento-facial',
    color: 'bg-indigo-50 border-indigo-200',
    textColor: 'text-indigo-600',
  },
  {
    icon: <SlidersHorizontal className="w-6 h-6" />,
    title: 'Parámetros de Marcación',
    description: 'Tolerancias, ventanas, duplicados y reglas de interpretación de marcaciones.',
    path: '/config/marcacion',
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-600',
  },
  {
    icon: <Cpu className="w-6 h-6" />,
    title: 'Biométricos / Ubicaciones',
    description: 'Alias operativos como Entrada principal, Bodega o Sala de reuniones.',
    path: '/config/biometricos',
    color: 'bg-cyan-50 border-cyan-200',
    textColor: 'text-cyan-600',
  },
  {
    icon: <KeyRound className="w-6 h-6" />,
    title: 'Roles y Permisos',
    description: 'Define accesos por rol para módulos y funcionalidades.',
    path: '/config/roles-permisos',
    color: 'bg-fuchsia-50 border-fuchsia-200',
    textColor: 'text-fuchsia-600',
  },
  {
    icon: <CalendarDays className="w-6 h-6" />,
    title: 'Feriados',
    description: 'Configura feriados oficiales y obligatorios por tenant.',
    path: '/config/feriados',
    color: 'bg-lime-50 border-lime-200',
    textColor: 'text-lime-600',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Seguridad',
    description: 'Políticas de contraseñas, vencimiento y seguridad de acceso.',
    path: '/config/seguridad',
    color: 'bg-red-50 border-red-200',
    textColor: 'text-red-600',
  },
  {
    icon: <Mail className="w-6 h-6" />,
    title: 'Correo SMTP',
    description: 'Servidor de correo corporativo para notificaciones y credenciales.',
    path: '/config/correo',
    color: 'bg-sky-50 border-sky-200',
    textColor: 'text-sky-600',
  },
]

// ─── CIRA V2.0 ────────────────────────────────────────────────────────────────

const ciraItems: ConfigItem[] = [
  {
    icon: <Scale className="w-6 h-6" />,
    title: 'Régimen Laboral',
    description: 'Configura LOSEP o Código de Trabajo, franjas nocturnas y límites de suplementarias.',
    path: '/config/cira/regimen-laboral',
    badge: 'CIRA V2.0',
    color: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700',
  },
  {
    icon: <CalendarDays className="w-6 h-6" />,
    title: 'Jornadas',
    description: 'Define jornadas laborales, bloques horarios y asignación a empleados.',
    path: '/config/jornadas',
    badge: 'CIRA V2.0',
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700',
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: 'Multas',
    description: 'Parámetros de cálculo de multas por atraso, salida anticipada y ausencia injustificada.',
    path: '/config/cira/multas',
    badge: 'CIRA V2.0',
    color: 'bg-rose-50 border-rose-200',
    textColor: 'text-rose-700',
  },
  {
    icon: <Timer className="w-6 h-6" />,
    title: 'Horas Extra',
    description: 'Solicitudes, aprobaciones y liquidación de horas suplementarias y extraordinarias.',
    path: '/config/cira/horas-extra',
    badge: 'CIRA V2.0',
    color: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-700',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

function CardGrid({ items }: { items: ConfigItem[] }) {
  const navigate = useNavigate()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`w-full flex items-center gap-4 p-5 rounded-2xl border ${item.color} hover:shadow-md transition-all text-left group`}
        >
          <div className={`${item.textColor} flex-shrink-0`}>{item.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{item.title}</span>
              {item.badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.textColor} ${item.color} border`}>
                  {item.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-gray-600 transition-colors" />
        </button>
      ))}
    </div>
  )
}

export default function ConfigHomePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">
          Personaliza el sistema según las necesidades de tu empresa. El organigrama es la fuente única de verdad
          para niveles jerárquicos, jefaturas y ubicación organizacional del empleado.
        </p>
      </div>

      <CardGrid items={generalItems} />

      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">CIRA V2.0</span>
          <span className="flex-1 h-px bg-gray-200" />
        </div>
        <CardGrid items={ciraItems} />
      </div>
    </div>
  )
}
