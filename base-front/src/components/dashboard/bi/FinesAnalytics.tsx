import React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ChartTooltipCard, EmptyPanel, formatCompactNumber, truncateChartLabel } from './shared'

type FinesAnalyticsProps = {
  scopeLabel: string
  totalAmountLabel: string
  totalCount: number
  typeData: Array<{ label: string; value: number; color: string }>
  orgData: Array<{ label: string; value: number; color: string }>
  trendData: Array<{ label: string; amount: number; count: number }>
  topEmployees: Array<{ employeeId: string; label: string; amountLabel: string; count: number }>
  unavailable?: boolean
  onEmployeeSelect: (employeeId: string) => void
}

function FinesAnalyticsComponent({
  scopeLabel,
  totalAmountLabel,
  totalCount,
  typeData,
  orgData,
  trendData,
  topEmployees,
  unavailable = false,
  onEmployeeSelect,
}: FinesAnalyticsProps) {
  const typeRows = typeData.slice(0, 8)
  const orgRows = orgData.slice(0, 7)

  if (unavailable) {
    return (
      <Card title="Multas" subtitle="La tabla fuente de multas no esta disponible en este tenant." className="rounded-[2rem] border-white/10 bg-[#08111d]/92">
        <EmptyPanel
          title="Multas no disponible"
          description="El dashboard detecto que la fuente `attendance.fine_ledger` no esta accesible. El resto de la analitica sigue operativa."
        />
      </Card>
    )
  }

  return (
    <Card
      title="Asistencia y disciplina"
      subtitle={`Multas por falta y atraso dentro de ${scopeLabel}.`}
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
      actions={<Badge tone="warn">{totalCount} registro(s)</Badge>}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Monto total</div>
            <div className="mt-2 text-2xl font-semibold text-white">{totalAmountLabel}</div>
          </div>
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Cantidad total</div>
            <div className="mt-2 text-2xl font-semibold text-white">{formatCompactNumber(totalCount)}</div>
          </div>
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Tipo dominante</div>
            <div className="mt-2 truncate text-xl font-semibold text-white" title={typeData[0]?.label ?? 'Sin datos'}>{typeData[0]?.label ?? 'Sin datos'}</div>
          </div>
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Unidad critica</div>
            <div className="mt-2 truncate text-xl font-semibold text-white" title={orgData[0]?.label ?? 'Sin foco'}>{orgData[0]?.label ?? 'Sin foco'}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr),minmax(0,1fr)]">
          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Distribucion por tipo</p>
                <p className="mt-1 text-xs text-white/50">Atrasos, faltas y salidas tempranas.</p>
              </div>
            </div>

            {typeData.length ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,8.75rem),minmax(0,1fr)] lg:items-center">
                <div className="h-40 min-w-0 sm:h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="finePieGlow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#ff4d8b" floodOpacity="0.25" />
                        </filter>
                      </defs>
                      <Pie data={typeRows} dataKey="value" nameKey="label" innerRadius={34} outerRadius={60} stroke="rgba(255,255,255,0.22)" strokeWidth={2.5} paddingAngle={4} filter="url(#finePieGlow)" isAnimationActive animationDuration={950} animationEasing="ease-out">
                        {typeRows.map((item) => (
                          <Cell key={item.label} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const datum = payload[0]
                          return (
                            <ChartTooltipCard
                              label={String(datum.name ?? 'Tipo')}
                              lines={[{ colorClass: 'bg-rose-400', label: 'Multas', value: String(datum.value ?? 0) }]}
                            />
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {typeRows.map((row) => (
                    <div key={row.label} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-xs">
                      <span className="inline-flex min-w-0 items-center gap-2 text-white/74" title={row.label}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                        <span className="truncate">{truncateChartLabel(row.label, 16)}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyPanel
                title="Sin multas para mostrar"
                description="No hay registros de multas dentro del periodo y del scope seleccionados."
              />
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Tendencia temporal</p>
              <p className="mt-1 text-xs text-white/50">Evolucion del monto aplicado y del volumen de multas.</p>
            </div>

            {trendData.length ? (
              <div className="h-[22rem] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="fineAmountFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff4d8b" stopOpacity={0.72} />
                        <stop offset="60%" stopColor="#ff4d8b" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#ff4d8b" stopOpacity={0.02} />
                      </linearGradient>
                      <filter id="fineAmountGlow" x="-25%" y="-35%" width="150%" height="180%">
                        <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#ff4d8b" floodOpacity="0.24" />
                      </filter>
                    </defs>
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.38)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} label={{ value: 'Periodo', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.44)', fontSize: 11 }} />
                    <YAxis yAxisId="amount" stroke="rgba(255,255,255,0.38)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} label={{ value: 'Monto (USD)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.44)', fontSize: 11 }} />
                    <YAxis yAxisId="count" orientation="right" stroke="rgba(255,255,255,0.3)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} label={{ value: 'Cantidad', angle: 90, position: 'insideRight', fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <ChartTooltipCard
                            label={String(label)}
                            lines={[
                              { colorClass: 'bg-rose-400', label: 'Monto', value: String(payload[0]?.value ?? 0) },
                              { colorClass: 'bg-amber-300', label: 'Cantidad', value: String(payload[1]?.value ?? 0) },
                            ]}
                          />
                        )
                      }}
                    />
                    <Area yAxisId="amount" type="monotone" dataKey="amount" stroke="#ff4d8b" fill="url(#fineAmountFill)" strokeWidth={4} filter="url(#fineAmountGlow)" animationDuration={950} animationEasing="ease-out" />
                    <Area yAxisId="count" type="monotone" dataKey="count" stroke="#ffc641" fill="transparent" strokeWidth={3} animationDuration={950} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel
                title="Sin tendencia visible"
                description="No se registraron multas para construir una serie temporal en el periodo seleccionado."
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Distribucion por unidad</p>
              <p className="mt-1 text-xs text-white/50">Siempre contextualizada por el nodo actual del organigrama.</p>
            </div>

            {orgData.length ? (
              <div className="h-[20rem] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orgRows} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                    <defs>
                      <filter id="fineUnitGlow" x="-25%" y="-35%" width="150%" height="180%">
                        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#5eead4" floodOpacity="0.2" />
                      </filter>
                    </defs>
                    <XAxis type="number" stroke="rgba(255,255,255,0.38)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} label={{ value: 'Monto de multas (USD)', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.44)', fontSize: 11 }} />
                    <YAxis dataKey="label" type="category" width={96} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.68)', fontSize: 10 }} tickFormatter={(value) => truncateChartLabel(String(value), 10)} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <ChartTooltipCard
                            label={String(label)}
                            lines={[{ colorClass: 'bg-cyan-400', label: 'Monto', value: String(payload[0]?.value ?? 0) }]}
                          />
                        )
                      }}
                    />
                    <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={18} filter="url(#fineUnitGlow)" animationDuration={950} animationEasing="ease-out">
                      {orgRows.map((row) => (
                        <Cell key={row.label} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel
                title="Sin focos por unidad"
                description="El scope actual no acumula multas por unidad organizacional."
              />
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Colaboradores con mayor impacto</p>
              <p className="mt-1 text-xs text-white/50">Abre el drawer para ver multas, solicitudes y vacaciones del colaborador.</p>
            </div>

            <div className="space-y-3">
              {topEmployees.length ? topEmployees.map((row) => (
                <button
                  key={row.employeeId}
                  type="button"
                  onClick={() => onEmployeeSelect(row.employeeId)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/9"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{row.label}</p>
                    <p className="mt-1 truncate text-[11px] text-white/50" title={`${row.count} multa(s) registradas.`}>{row.count} multa(s) registradas.</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-white">{row.amountLabel}</span>
                </button>
              )) : (
                <EmptyPanel
                  title="Sin ranking colaborativo"
                  description="No hay colaboradores con multas dentro del contexto actual."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export const FinesAnalytics = React.memo(FinesAnalyticsComponent)

export default FinesAnalytics
