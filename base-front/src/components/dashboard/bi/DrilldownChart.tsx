import React from 'react'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { OrgDrillSlice } from '@/pages/dashboard/dashboardOrgDrill'
import { ChartTooltipCard, EmptyPanel, truncateChartLabel } from './shared'

type DrilldownChartProps = {
  title: string
  subtitle: string
  scopeLabel: string
  metricLabel: string
  currentLevelLabel: string
  slices: OrgDrillSlice[]
  currentPathLabels: string[]
  onSliceSelect: (slice: OrgDrillSlice) => void
  onBack: () => void
  onReset: () => void
  formatValue: (value: number) => string
}

function DrilldownChartComponent({
  title,
  subtitle,
  scopeLabel,
  metricLabel,
  currentLevelLabel,
  slices,
  currentPathLabels,
  onSliceSelect,
  onBack,
  onReset,
  formatValue,
}: DrilldownChartProps) {
  const chartData = slices.slice(0, 8).map((slice) => ({
    id: `${slice.nodeId}-${slice.pathIds.join('.')}`,
    label: slice.label,
    shortLabel: truncateChartLabel(slice.label, 10),
    value: slice.value,
    color: slice.color,
    shareHint: slice.hasChildren ? 'Profundizar' : 'Ver foco colaborador',
  }))

  const chartHeight = Math.max(300, chartData.length * 54)

  return (
    <Card
      title={title}
      subtitle={subtitle}
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{metricLabel}</Badge>
          <Badge tone="neutral">{currentLevelLabel}</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Scope actual</p>
            <p className="mt-1 text-sm text-white/72">{scopeLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentPathLabels.length ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/78 transition hover:bg-white/10"
              >
                <ChevronLeft size={15} />
                Subir
              </button>
            ) : null}
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/78 transition hover:bg-white/10"
            >
              <Maximize2 size={15} />
              Ver tenant
            </button>
          </div>
        </div>

        {!chartData.length ? (
          <EmptyPanel
            title="Sin datos para este nivel"
            description="No hay registros suficientes en este tramo del organigrama para construir el drill-down seleccionado."
          />
        ) : (
          <>
            <div className="relative min-w-0 rounded-[1.8rem] border border-white/10 bg-white/5 p-3">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-14 rounded-full bg-gradient-to-r from-cyan-400/12 via-fuchsia-400/10 to-emerald-400/12 blur-2xl" />
              <ResponsiveContainer width="100%" height={Math.min(chartHeight, 540)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 18, bottom: 8, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <defs>
                    <filter id="drillGlow" x="-30%" y="-30%" width="160%" height="180%">
                      <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#22d3ee" floodOpacity="0.2" />
                    </filter>
                  </defs>
                  <XAxis
                    type="number"
                    stroke="rgba(255,255,255,0.38)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={104}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.68)', fontSize: 10 }}
                    tickFormatter={(value) => truncateChartLabel(String(value), 11)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const datum = payload[0]

                      return (
                        <ChartTooltipCard
                          label={String(label)}
                          lines={[
                            {
                              colorClass: 'bg-cyan-400',
                              label: metricLabel,
                              value: formatValue(Number(datum.value ?? 0)),
                            },
                            {
                              colorClass: 'bg-white/40',
                              label: 'Accion',
                              value: String((datum.payload as { shareHint?: string }).shareHint ?? 'Explorar'),
                            },
                          ]}
                        />
                      )
                    }}
                  />
                  <Bar dataKey="value" radius={[14, 14, 14, 14]} filter="url(#drillGlow)" animationDuration={950} animationEasing="ease-out" onClick={(_, index) => {
                    const slice = slices[index]
                    if (slice) onSliceSelect(slice)
                  }}>
                    {chartData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} className="cursor-pointer transition-opacity hover:opacity-90" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {chartData.map((entry, index) => {
                const slice = slices[index]

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => slice && onSliceSelect(slice)}
                    className="group flex min-w-0 items-center justify-between gap-4 rounded-[1.45rem] border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/8"
                    title={entry.label}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-white">{entry.shortLabel}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">{entry.shareHint}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-white">{formatValue(entry.value)}</span>
                      <ChevronRight size={15} className="text-white/38 transition group-hover:text-white/70" />
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export const DrilldownChart = React.memo(DrilldownChartComponent)

export default DrilldownChart
