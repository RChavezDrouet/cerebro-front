import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, UploadCloud, Clock3, Settings2 } from 'lucide-react'

import { Card } from '@/components/ui/Card'

function ActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="text-left w-full">
      <div className="card glass p-5 h-full hover:bg-white/5 transition border border-white/10 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/10 text-white/85">
            {icon}
          </div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-sm text-white/60">{desc}</div>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function AttendanceHomePage() {
  const nav = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Asistencia &amp; RRHH</h1>
        <p className="mt-1 text-sm text-white/60">
          Acceso rápido al reporte operativo diario, importación USB y parametrización de turnos y horarios.
        </p>
      </div>

      <Card title="Módulos principales" subtitle="Versión saneada y alineada con el flujo operativo vigente.">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ActionCard
            icon={<CalendarDays size={20} />}
            title="Reporte diario"
            desc="Entrada, comida, salida, estado del día y fuente de marcación."
            onClick={() => nav('/attendance/daily')}
          />
          <ActionCard
            icon={<UploadCloud size={20} />}
            title="Importación USB"
            desc="Carga masiva de marcaciones desde XLSX o CSV usando la RPC de importación."
            onClick={() => nav('/attendance/usb-import')}
          />
          <ActionCard
            icon={<Clock3 size={20} />}
            title="Turnos"
            desc="Configura días activos, tipo de turno y color para dashboards y reportes."
            onClick={() => nav('/config/turnos')}
          />
          <ActionCard
            icon={<Settings2 size={20} />}
            title="Horarios"
            desc="Define ventanas de entrada, salida, comida, corte y tolerancias del día."
            onClick={() => nav('/config/horarios')}
          />
        </div>
      </Card>
    </div>
  )
}
