import React from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Users } from 'lucide-react'
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
import { ChartTooltipCard, EmptyPanel, formatCompactNumber, formatCurrency, truncateChartLabel } from './shared'

export type OrgHierarchyExplorerSlice = {
  id: string
  label: string
  pathIds: string[]
  hasChildren: boolean
  color: string
  headcount: number
  lateCount: number
  absenceCount: number
  pendingRequests: number
  justificationCount: number
  permissionCount: number
  fineAmount: number
  attentionPoints: number
}

type OrgHierarchyExplorerProps = {
  scopeLabel: string
  currentLevelLabel: string
  currentPathLabels: string[]
  slices: OrgHierarchyExplorerSlice[]
  onSliceSelect: (slice: OrgHierarchyExplorerSlice) => void
  onBack: () => void
  onReset: () => void
}

function OrgHierarchyExplorerComponent({
  scopeLabel,
  currentLevelLabel,
  currentPathLabels,
  slices,
  onSliceSelect,
  onBack,
  onReset,
}: OrgHierarchyExplorerProps) {
  const chartData = slices.slice(0, 8).map((slice) => ({
    ...slice,
    shortLabel: truncateChartLabel(slice.label, 11),
  }))
  const hasOperationalAttention = chartData.some((slice) => slice.attentionPoints > 0)

  return (
    <Card
      title="Exploracion ejecutiva"
      subtitle="Vista general por unidad. El clic baja por el organigrama y el ultimo nivel abre el modal de colaboradores."
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{hasOperationalAttention ? 'Incidencias + pendientes' : 'Colaboradores visibles'}</Badge>
          <Badge tone="neutral">{currentLevelLabel}</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.45rem] border border-white/10 bg-white/6 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Scope actual</p>
            <p className="mt-1 truncate text-sm text-white/72">{scopeLabel}</p>
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
            title="Sin unidades para explorar"
            description="No hay suficientes datos operativos en el tramo actual del organigrama."
          />
        ) : (
          <>
            <div className="relative min-w-0 rounded-[1.8rem] border border-white/10 bg-white/5 p-4">
              <div className="pointer-events-none absolute inset-x-10 top-2 h-16 rounded-full bg-gradient-to-r from-cyan-400/14 via-fuchsia-400/10 to-emerald-400/12 blur-2xl" />

              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/54">
                <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">Atrasos</span>
                <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">Ausencias</span>
                <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">Pendientes</span>
                <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">Tooltip: multas, permisos y justificaciones</span>
              </div>

              <div className="h-[22rem] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, bottom: 16, left: 2 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="rgba(255,255,255,0.38)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      label={{ value: hasOperationalAttention ? 'Incidencias visibles + solicitudes pendientes' : 'Colaboradores visibles', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.44)', fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={106}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.68)', fontSize: 10 }}
                      tickFormatter={(value) => truncateChartLabel(String(value), 11)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const datum = payload[0].payload as OrgHierarchyExplorerSlice

                        return (
                          <ChartTooltipCard
                            label={String(label)}
                            lines={[
                              { colorClass: 'bg-cyan-400', label: 'Colaboradores', value: formatCompactNumber(datum.headcount) },
                              { colorClass: 'bg-amber-400', label: 'Atrasos', value: formatCompactNumber(datum.lateCount) },
                              { colorClass: 'bg-rose-400', label: 'Ausencias', value: formatCompactNumber(datum.absenceCount) },
                              { colorClass: 'bg-fuchsia-400', label: 'Pendientes', value: formatCompactNumber(datum.pendingRequests) },
                              { colorClass: 'bg-emerald-400', label: 'Justificaciones', value: formatCompactNumber(datum.justificationCount) },
                              { colorClass: 'bg-sky-400', label: 'Permisos', value: formatCompactNumber(datum.permissionCount) },
                              { colorClass: 'bg-white/40', label: 'Multas', value: formatCurrency(datum.fineAmount) },
                            ]}
                          />
                        )
                      }}
                    />
                    <Bar
                      dataKey={hasOperationalAttention ? 'attentionPoints' : 'headcount'}
                      radius={[14, 14, 14, 14]}
                      animationDuration={950}
                      animationEasing="ease-out"
                      onClick={(_, index) => {
                        const slice = slices[index]
                        if (slice) onSliceSelect(slice)
                      }}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} className="cursor-pointer transition-opacity hover:opacity-90" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {chartData.map((slice) => (
                <button
                  key={slice.id}
                  type="button"
                  onClick={() => onSliceSelect(slice)}
                  className="group rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/8"
                  title={slice.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{slice.label}</p>
                        <Badge tone={slice.hasChildren ? 'info' : 'good'}>
                          {slice.hasChildren ? 'Profundizar' : 'Ver colaboradores'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-white/52">
                        {slice.attentionPoints > 0
                          ? `${slice.attentionPoints} punto(s) de atencion visibles en este tramo.`
                          : 'Sin friccion visible en este tramo con los filtros actuales.'}
                      </p>
                    </div>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/70 transition group-hover:bg-cyan-400/16 group-hover:text-white">
                      {slice.hasChildren ? <ChevronRight size={16} /> : <Users size={16} />}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Colab.</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatCompactNumber(slice.headcount)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Atrasos</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatCompactNumber(slice.lateCount)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Ausencias</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatCompactNumber(slice.absenceCount)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Pend.</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatCompactNumber(slice.pendingRequests)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/62">
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                      Justif. {formatCompactNumber(slice.justificationCount)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                      Permisos {formatCompactNumber(slice.permissionCount)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                      {formatCurrency(slice.fineAmount)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export const OrgHierarchyExplorer = React.memo(OrgHierarchyExplorerComponent)

export default OrgHierarchyExplorer
