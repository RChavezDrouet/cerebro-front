import React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ChartTooltipCard, EmptyPanel, formatCompactNumber, formatPercent } from './shared'

type AttendanceTrendPoint = {
  label: string
  onTime: number
  late: number
  absence: number
}

type AttendanceDisciplineOverviewProps = {
  scopeLabel: string
  punctualityPct: number
  lateCount: number
  absenceCount: number
  trendData: AttendanceTrendPoint[]
}

function AttendanceDisciplineOverviewComponent({
  scopeLabel,
  punctualityPct,
  lateCount,
  absenceCount,
  trendData,
}: AttendanceDisciplineOverviewProps) {
  return (
    <Card
      title="Puntualidad, atrasos y ausencias"
      subtitle={`Tendencia visible dentro de ${scopeLabel}.`}
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
      actions={<Badge tone={punctualityPct >= 93 ? 'good' : punctualityPct >= 85 ? 'warn' : 'bad'}>{formatPercent(punctualityPct)}</Badge>}
    >
      {trendData.length ? (
        <div className="space-y-4">
          <div className="relative h-[24rem] min-w-0">
            <div className="animate-pulse-slow pointer-events-none absolute inset-x-10 top-2 h-16 rounded-full bg-gradient-to-r from-emerald-400/14 via-cyan-400/10 to-amber-300/14 blur-2xl" />
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="attendanceOnTimeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#19f3b1" stopOpacity={0.72} />
                    <stop offset="55%" stopColor="#19f3b1" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#19f3b1" stopOpacity={0.02} />
                  </linearGradient>
                  <filter id="attendanceGlow" x="-25%" y="-35%" width="150%" height="180%">
                    <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#19f3b1" floodOpacity="0.22" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.38)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} label={{ value: 'Periodo', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.44)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.38)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} label={{ value: 'Colaboradores / eventos', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.44)', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <ChartTooltipCard
                        label={String(label)}
                        lines={[
                          { colorClass: 'bg-emerald-400', label: 'Puntuales', value: String(payload[0]?.value ?? 0) },
                          { colorClass: 'bg-amber-400', label: 'Atrasos', value: String(payload[1]?.value ?? 0) },
                          { colorClass: 'bg-rose-400', label: 'Ausencias', value: String(payload[2]?.value ?? 0) },
                        ]}
                      />
                    )
                  }}
                />
                <Area type="monotone" dataKey="onTime" stroke="#19f3b1" fill="url(#attendanceOnTimeFill)" strokeWidth={4} filter="url(#attendanceGlow)" animationDuration={950} animationEasing="ease-out" />
                <Area type="monotone" dataKey="late" stroke="#ffb01f" fill="transparent" strokeWidth={3} animationDuration={950} animationEasing="ease-out" />
                <Area type="monotone" dataKey="absence" stroke="#ff5d8f" fill="transparent" strokeWidth={3} animationDuration={950} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Puntualidad</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatPercent(punctualityPct)}</div>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Atrasos</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatCompactNumber(lateCount)}</div>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Ausencias</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatCompactNumber(absenceCount)}</div>
            </div>
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="Sin tendencia de asistencia"
          description="No hay registros diarios suficientes para construir la serie del periodo seleccionado."
        />
      )}
    </Card>
  )
}

export const AttendanceDisciplineOverview = React.memo(AttendanceDisciplineOverviewComponent)

export default AttendanceDisciplineOverview
