import React from 'react'

import { Card } from '@/components/ui/Card'
import { EmptyPanel, formatDateLabel } from './shared'

type TimelineRow = {
  id: string
  employeeId: string
  employeeName: string
  orgLabel: string
  startDate: string
  endDate: string
  daysRequested: number
  status: string
}

type VacationTimelineProps = {
  scopeLabel: string
  dates: string[]
  items: TimelineRow[]
  onEmployeeSelect: (employeeId: string) => void
}

function statusChipClass(status: string) {
  if (status === 'aprobado') return 'border-emerald-400/20 bg-emerald-400/12 text-emerald-100'
  if (status === 'rechazado') return 'border-rose-400/20 bg-rose-400/12 text-rose-100'
  if (status === 'en_aprobacion' || status === 'pendiente') return 'border-amber-400/20 bg-amber-400/12 text-amber-100'
  return 'border-white/10 bg-white/8 text-white/72'
}

function VacationTimelineComponent({
  scopeLabel,
  dates,
  items,
  onEmployeeSelect,
}: VacationTimelineProps) {
  const visibleDates = dates.slice(0, 18)
  const firstDate = visibleDates[0]

  const timelineItems = items.slice(0, 8).map((item) => {
    const startIndex = Math.max(visibleDates.indexOf(item.startDate), 0)
    const endIndex = visibleDates.indexOf(item.endDate)
    const span = Math.max((endIndex >= 0 ? endIndex : visibleDates.length - 1) - startIndex + 1, 1)

    return {
      ...item,
      startIndex,
      span,
    }
  })

  return (
    <Card
      title="Timeline vacacional"
      subtitle={`Gantt compacto de solicitudes visibles dentro de ${scopeLabel}.`}
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
    >
      {!timelineItems.length || !firstDate ? (
        <EmptyPanel
          title="Sin vacaciones visibles"
          description="No hay solicitudes de vacaciones dentro del contexto actual para construir el timeline."
        />
      ) : (
        <div className="space-y-4 overflow-x-auto">
          <div
            className="grid min-w-[48rem] gap-2"
            style={{ gridTemplateColumns: `minmax(16rem, 20rem) repeat(${visibleDates.length}, minmax(2.2rem, 1fr))` }}
          >
            <div className="sticky left-0 z-10 rounded-2xl bg-[#08111d]/96 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44 backdrop-blur">
              Colaborador
            </div>
            {visibleDates.map((date) => (
              <div key={date} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/44">
                {formatDateLabel(date)}
              </div>
            ))}

            {timelineItems.map((item) => (
              <React.Fragment key={item.id}>
                <button
                  type="button"
                  onClick={() => onEmployeeSelect(item.employeeId)}
                  className="sticky left-0 z-10 rounded-2xl border border-white/10 bg-[#08111d]/96 px-4 py-3 text-left backdrop-blur transition hover:bg-[#0c1726]"
                >
                  <p className="truncate text-sm font-semibold text-white">{item.employeeName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-xs text-white/50">{item.orgLabel}</p>
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusChipClass(item.status)}`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </button>

                {visibleDates.map((date, index) => {
                  const active = index >= item.startIndex && index < item.startIndex + item.span

                  return (
                    <div key={`${item.id}-${date}`} className="flex items-center justify-center">
                      <div
                        className={`h-9 w-full rounded-xl border ${
                          active
                            ? item.status === 'aprobado'
                              ? 'border-emerald-400/20 bg-emerald-400/28'
                              : item.status === 'rechazado'
                                ? 'border-rose-400/20 bg-rose-400/20'
                                : 'border-amber-400/20 bg-amber-400/24'
                            : 'border-white/6 bg-white/4'
                        }`}
                        title={`${item.employeeName}: ${item.startDate} - ${item.endDate} (${item.daysRequested} dia(s))`}
                      />
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export const VacationTimeline = React.memo(VacationTimelineComponent)

export default VacationTimeline
