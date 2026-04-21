import React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

type RequestTypeStatusRow = {
  label: string
  total: number
  borrador: number
  pendiente: number
  en_aprobacion: number
  aprobado: number
  rechazado: number
  cancelado: number
}

type RequestsAnalyticsProps = {
  scopeLabel: string
  totalRequests: number
  pendingRequests: number
  avgResolutionHours: number
  typeData: Array<{ label: string; value: number; color: string }>
  statusData: Array<{ label: string; value: number; color: string }>
  typeStatusData: RequestTypeStatusRow[]
  trendData: Array<{ label: string; created: number; resolved: number }>
  backlogData: Array<{ label: string; pending: number; overdue: number; color: string }>
  bottleneckData: Array<{ label: string; pending: number; avgHours: number; color: string }>
}

const STATUS_META = [
  { key: 'borrador', label: 'Borrador', color: '#94a3b8', colorClass: 'bg-slate-400' },
  { key: 'pendiente', label: 'Pendiente', color: '#fbbf24', colorClass: 'bg-amber-300' },
  { key: 'en_aprobacion', label: 'En aprob.', color: '#2be7ff', colorClass: 'bg-cyan-400' },
  { key: 'aprobado', label: 'Aprobado', color: '#19f3b1', colorClass: 'bg-emerald-400' },
  { key: 'rechazado', label: 'Rechazado', color: '#ff5d8f', colorClass: 'bg-rose-400' },
  { key: 'cancelado', label: 'Cancelado', color: '#c084fc', colorClass: 'bg-violet-400' },
] as const

function RequestsAnalyticsComponent({
  scopeLabel,
  totalRequests,
  pendingRequests,
  avgResolutionHours,
  typeData,
  statusData,
  typeStatusData,
  trendData,
  backlogData,
  bottleneckData,
}: RequestsAnalyticsProps) {
  const typeRows = typeData.slice(0, 8)
  const statusRows = statusData.slice(0, 6)
  const typeStatusRows = typeStatusData.slice(0, 6)

  return (
    <Card
      title="Solicitudes y aprobaciones"
      subtitle={`Analitica gerencial de workflow dentro de ${scopeLabel}.`}
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
      actions={<Badge tone="info">{pendingRequests} pendiente(s)</Badge>}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Solicitudes</div>
            <div className="mt-2 text-2xl font-semibold text-white">{formatCompactNumber(totalRequests)}</div>
          </div>
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Pendientes</div>
            <div className="mt-2 text-2xl font-semibold text-white">{formatCompactNumber(pendingRequests)}</div>
          </div>
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Resolucion media</div>
            <div className="mt-2 text-2xl font-semibold text-white">{avgResolutionHours.toFixed(1)} h</div>
          </div>
          <div className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Tipo dominante</div>
            <div className="mt-2 truncate text-xl font-semibold text-white" title={typeData[0]?.label ?? 'Sin datos'}>
              {typeData[0]?.label ?? 'Sin datos'}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Solicitudes por tipo</p>
              <p className="mt-1 text-xs text-white/50">Justificaciones, permisos, prestamos, adelantos y vacaciones.</p>
            </div>

            {typeData.length ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,8.75rem),minmax(0,1fr)] lg:items-center">
                <div className="h-40 min-w-0 sm:h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="requestPieGlow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#38bdf8" floodOpacity="0.24" />
                        </filter>
                      </defs>
                      <Pie
                        data={typeRows}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={34}
                        outerRadius={60}
                        stroke="rgba(255,255,255,0.22)"
                        strokeWidth={2.5}
                        paddingAngle={4}
                        filter="url(#requestPieGlow)"
                        isAnimationActive
                        animationDuration={950}
                        animationEasing="ease-out"
                      >
                        {typeRows.map((item) => (
                          <Cell key={item.label} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <ChartTooltipCard
                              label={String(payload[0]?.name ?? 'Tipo')}
                              lines={[{ colorClass: 'bg-cyan-400', label: 'Solicitudes', value: String(payload[0]?.value ?? 0) }]}
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
                title="Sin solicitudes por tipo"
                description="No hay solicitudes dentro del periodo y del alcance seleccionados."
              />
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Solicitudes por estado</p>
              <p className="mt-1 text-xs text-white/50">Borrador, flujo, aprobadas, rechazadas y canceladas.</p>
            </div>

            {statusData.length ? (
              <div className="h-[20rem] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusRows} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <defs>
                      <filter id="requestStatusGlow" x="-25%" y="-35%" width="150%" height="180%">
                        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#38bdf8" floodOpacity="0.2" />
                      </filter>
                    </defs>
                    <XAxis
                      dataKey="label"
                      stroke="rgba(255,255,255,0.38)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => truncateChartLabel(String(value), 9)}
                      label={{ value: 'Estados', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.44)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.38)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Cantidad de solicitudes', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.44)', fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <ChartTooltipCard
                            label={String(label)}
                            lines={[{ colorClass: 'bg-cyan-400', label: 'Solicitudes', value: String(payload[0]?.value ?? 0) }]}
                          />
                        )
                      }}
                    />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={28} filter="url(#requestStatusGlow)" animationDuration={950} animationEasing="ease-out">
                      {statusRows.map((row) => (
                        <Cell key={row.label} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel
                title="Sin estados para graficar"
                description="No hay estados disponibles en el conjunto filtrado."
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr),minmax(0,0.95fr)]">
          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Tendencia de solicitudes</p>
              <p className="mt-1 text-xs text-white/50">Eje Y = cantidad de solicitudes creadas y resueltas en el periodo.</p>
            </div>

            {trendData.length ? (
              <div className="h-[22rem] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}>
                    <defs>
                      <linearGradient id="requestCreatedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2be7ff" stopOpacity={0.72} />
                        <stop offset="60%" stopColor="#2be7ff" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#2be7ff" stopOpacity={0.02} />
                      </linearGradient>
                      <filter id="requestTrendGlow" x="-25%" y="-35%" width="150%" height="180%">
                        <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#2be7ff" floodOpacity="0.22" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="rgba(255,255,255,0.38)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Periodo', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.44)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.38)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Cantidad de solicitudes', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.44)', fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <ChartTooltipCard
                            label={String(label)}
                            lines={[
                              { colorClass: 'bg-cyan-400', label: 'Creadas', value: String(payload[0]?.value ?? 0) },
                              { colorClass: 'bg-emerald-400', label: 'Resueltas', value: String(payload[1]?.value ?? 0) },
                            ]}
                          />
                        )
                      }}
                    />
                    <Area type="monotone" dataKey="created" stroke="#2be7ff" fill="url(#requestCreatedFill)" strokeWidth={4} filter="url(#requestTrendGlow)" animationDuration={950} animationEasing="ease-out" />
                    <Area type="monotone" dataKey="resolved" stroke="#24f2a1" fill="transparent" strokeWidth={3} animationDuration={950} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel
                title="Sin tendencia de workflow"
                description="No hay suficientes eventos para construir la serie de solicitudes."
              />
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Tipo por estado</p>
              <p className="mt-1 text-xs text-white/50">Combina tipo de solicitud con su estado real para detectar donde se concentra la carga.</p>
            </div>

            <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-white/58">
              {STATUS_META.map((status) => (
                <span key={status.key} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.label}
                </span>
              ))}
            </div>

            {typeStatusRows.length ? (
              <div className="h-[22rem] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeStatusRows} layout="vertical" margin={{ top: 8, right: 18, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="rgba(255,255,255,0.38)"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Cantidad de solicitudes', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.44)', fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.68)', fontSize: 10 }}
                      tickFormatter={(value) => truncateChartLabel(String(value), 11)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null

                        const lines = STATUS_META
                          .map((status) => ({
                            meta: status,
                            value: Number(payload.find((entry) => entry.dataKey === status.key)?.value ?? 0),
                          }))
                          .filter((line) => line.value > 0)
                          .map((line) => ({
                            colorClass: line.meta.colorClass,
                            label: line.meta.label,
                            value: formatCompactNumber(line.value),
                          }))

                        return (
                          <ChartTooltipCard
                            label={String(label)}
                            lines={lines.length ? lines : [{ colorClass: 'bg-white/40', label: 'Solicitudes', value: '0' }]}
                          />
                        )
                      }}
                    />

                    {STATUS_META.map((status) => (
                      <Bar
                        key={status.key}
                        dataKey={status.key}
                        stackId="request-status"
                        fill={status.color}
                        radius={status.key === 'cancelado' ? [12, 12, 12, 12] : [0, 0, 0, 0]}
                        animationDuration={950}
                        animationEasing="ease-out"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel
                title="Sin cruce tipo/estado"
                description="No hay suficiente data para construir la matriz de tipos y estados."
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Backlog por aprobador</p>
              <p className="mt-1 text-xs text-white/50">Carga abierta por actor o cola compartida.</p>
            </div>
            <div className="space-y-3">
              {backlogData.length ? backlogData.map((row) => (
                <div key={row.label} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white" title={row.label}>{row.label}</p>
                      <p className="mt-1 text-xs text-white/50">{row.overdue} vencidas.</p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold text-white">{row.pending}</span>
                  </div>
                </div>
              )) : (
                <EmptyPanel
                  title="Sin backlog visible"
                  description="No hay aprobadores con carga abierta dentro del alcance actual."
                />
              )}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Cuellos de botella por nivel</p>
              <p className="mt-1 text-xs text-white/50">Etapas con mas casos y mayor tiempo medio.</p>
            </div>
            <div className="space-y-3">
              {bottleneckData.length ? bottleneckData.map((row) => (
                <div key={row.label} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white" title={row.label}>{row.label}</p>
                      <p className="mt-1 text-xs text-white/50">{row.avgHours.toFixed(1)} h promedio.</p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold text-white">{row.pending}</span>
                  </div>
                </div>
              )) : (
                <EmptyPanel
                  title="Sin cuello de botella visible"
                  description="La cola filtrada no tiene etapas bloqueadas actualmente."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export const RequestsAnalytics = React.memo(RequestsAnalyticsComponent)

export default RequestsAnalytics
