import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FileBarChart2, Table2, UploadCloud, CalendarDays } from 'lucide-react'
import TiltCard from '@/components/ui/TiltCard'

export default function ReportsHomePage() {
  const nav = useNavigate()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          Reportes
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          Analítica y exportación. (MVP) incluye reporte detallado + UI de importación USB.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button type="button" onClick={() => nav('/reports/detailed')} className="text-left">
          <TiltCard className="p-5 hover:opacity-95">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
              >
                <Table2 size={20} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Reporte detallado</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                  Tabla con filtros avanzados y exportación a Excel/Word/PDF.
                </p>
              </div>
            </div>
          </TiltCard>
        </button>

        <button type="button" onClick={() => nav('/reports/diario')} className="text-left">
          <TiltCard className="p-5 hover:opacity-95">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--color-accent)', color: 'var(--color-on-primary)' }}
              >
                <CalendarDays size={20} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Reporte diario</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                  Entrada / Comida / Salida + estado (anticipada / a tiempo / atrasado / novedad).
                </p>
              </div>
            </div>
          </TiltCard>
        </button>

        <div>
          <TiltCard className="p-5 opacity-90">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--color-secondary)', color: 'var(--color-on-primary)' }}
              >
                <FileBarChart2 size={20} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Dashboards KPI</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                  Próximo sprint: KPI por rol con drill-down.
                </p>
              </div>
            </div>
          </TiltCard>
        </div>

        <div className="md:col-span-2">
          <TiltCard className="p-5">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--color-accent)', color: 'var(--color-on-primary)' }}
              >
                <UploadCloud size={20} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Carga USB</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                  UI integrada dentro del Reporte Detallado.
                </p>
              </div>
            </div>
          </TiltCard>
        </div>
      </div>
    </div>
  )
}
