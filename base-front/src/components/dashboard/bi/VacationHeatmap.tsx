import React from 'react'

import { Card } from '@/components/ui/Card'
import { EmptyPanel, formatDateLabel } from './shared'

type HeatmapRow = {
  label: string
  values: number[]
}

type VacationHeatmapProps = {
  scopeLabel: string
  dates: string[]
  rows: HeatmapRow[]
}

function intensityClass(value: number) {
  if (value >= 4) return 'bg-rose-500/70 text-white'
  if (value >= 3) return 'bg-amber-500/60 text-slate-950'
  if (value >= 2) return 'bg-cyan-500/55 text-white'
  if (value >= 1) return 'bg-emerald-500/45 text-white'
  return 'bg-white/5 text-white/24'
}

function VacationHeatmapComponent({
  scopeLabel,
  dates,
  rows,
}: VacationHeatmapProps) {
  const visibleDates = dates.slice(0, 18)
  const visibleRows = rows.slice(0, 8)

  return (
    <Card
      title="Heatmap vacacional"
      subtitle={`Concentracion de vacaciones por unidad dentro de ${scopeLabel}.`}
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
    >
      {!visibleRows.length || !visibleDates.length ? (
        <EmptyPanel
          title="Sin matriz vacacional"
          description="No hay vacaciones aprobadas para calcular concentracion por fecha y por unidad."
        />
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[48rem] gap-2"
            style={{ gridTemplateColumns: `minmax(14rem, 18rem) repeat(${visibleDates.length}, minmax(2rem, 1fr))` }}
          >
            <div className="sticky left-0 z-10 rounded-2xl bg-[#08111d]/96 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44 backdrop-blur">
              Unidad
            </div>
            {visibleDates.map((date) => (
              <div key={date} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/44">
                {formatDateLabel(date)}
              </div>
            ))}

            {visibleRows.map((row) => (
              <React.Fragment key={row.label}>
                <div className="sticky left-0 z-10 rounded-2xl border border-white/10 bg-[#08111d]/96 px-4 py-3 text-sm font-semibold text-white backdrop-blur">
                  {row.label}
                </div>
                {visibleDates.map((date, index) => {
                  const value = row.values[index] ?? 0

                  return (
                    <div
                      key={`${row.label}-${date}`}
                      className={`flex h-11 items-center justify-center rounded-xl border border-white/6 text-xs font-semibold ${intensityClass(value)}`}
                      title={`${row.label} - ${date}: ${value} colaborador(es)`}
                    >
                      {value || ''}
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

export const VacationHeatmap = React.memo(VacationHeatmapComponent)

export default VacationHeatmap
