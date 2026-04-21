import React from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'

import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { ApprovalOverallStatus } from '@/features/approvals/types'
import type { RequestKind } from '@/features/requests/types'
import type { DashboardPeriod } from '@/lib/dashboard/hrDashboard'

type DrillMetricOption = {
  value: string
  label: string
}

type FiltersBarProps = {
  period: DashboardPeriod
  onPeriodChange: (next: DashboardPeriod) => void
  requestStatus: ApprovalOverallStatus | 'all'
  onRequestStatusChange: (next: ApprovalOverallStatus | 'all') => void
  requestKind: RequestKind | 'all'
  onRequestKindChange: (next: RequestKind | 'all') => void
  drillMetric: string
  onDrillMetricChange: (next: string) => void
  drillMetricOptions: DrillMetricOption[]
  search: string
  onSearchChange: (next: string) => void
}

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'trimestre', label: 'Trimestre' },
]

function FiltersBarComponent({
  period,
  onPeriodChange,
  requestStatus,
  onRequestStatusChange,
  requestKind,
  onRequestKindChange,
  drillMetric,
  onDrillMetricChange,
  drillMetricOptions,
  search,
  onSearchChange,
}: FiltersBarProps) {
  return (
    <div className="rounded-[1.9rem] border border-white/10 bg-[#07111d]/88 p-4 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Filtros ejecutivos</p>
          <p className="mt-1 text-sm text-white/64">Separa periodo, tipo de solicitud, estado y la metrica base del drill-down.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/68">
          <SlidersHorizontal size={14} />
          Analitica BI
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Select
          label="Periodo"
          value={period}
          onChange={(next) => onPeriodChange(next as DashboardPeriod)}
          options={PERIOD_OPTIONS}
        />
        <Select
          label="Metrica de drill"
          value={drillMetric}
          onChange={onDrillMetricChange}
          options={drillMetricOptions}
        />
        <Select
          label="Estado de solicitud"
          value={requestStatus}
          onChange={(next) => onRequestStatusChange(next as ApprovalOverallStatus | 'all')}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'borrador', label: 'Borrador' },
            { value: 'pendiente', label: 'Pendiente' },
            { value: 'en_aprobacion', label: 'En aprobacion' },
            { value: 'aprobado', label: 'Aprobado' },
            { value: 'rechazado', label: 'Rechazado' },
            { value: 'cancelado', label: 'Cancelado' },
          ]}
        />
        <Select
          label="Tipo de solicitud"
          value={requestKind}
          onChange={(next) => onRequestKindChange(next as RequestKind | 'all')}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'attendance_justifications', label: 'Justificaciones' },
            { value: 'permission_requests', label: 'Permisos' },
            { value: 'loan_requests', label: 'Prestamos' },
            { value: 'salary_advance_requests', label: 'Adelantos' },
            { value: 'vacation_requests', label: 'Vacaciones' },
          ]}
        />
        <Input
          label="Buscar en exploracion"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Colaborador, unidad o solicitud"
          right={<Search size={16} className="text-white/40" />}
          className="pr-10"
        />
      </div>
    </div>
  )
}

export const FiltersBar = React.memo(FiltersBarComponent)

export default FiltersBar
