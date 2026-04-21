import React from 'react'
import { ArrowRight, Clock3, ShieldAlert, TimerReset, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { PendingApprovalItem } from '@/features/approvals/types'
import { formatPendingMinutes } from '@/features/approvals/utils'

type PendingApprovalsSummaryProps = {
  myPendingApprovals: PendingApprovalItem[]
  topApprovers: Array<{ label: string; pending: number; overdue: number }>
  topBottlenecks: Array<{ label: string; pending: number; avgHours: number }>
  unavailable?: boolean
}

function PendingApprovalsSummaryComponent({
  myPendingApprovals,
  topApprovers,
  topBottlenecks,
  unavailable = false,
}: PendingApprovalsSummaryProps) {
  const total = myPendingApprovals.length
  const highPriority = myPendingApprovals.filter((item) => item.priority_visual === 'alta').length
  const overdue = myPendingApprovals.filter((item) => item.pending_minutes >= 24 * 60).length
  const avgPendingMinutes =
    total === 0 ? 0 : Math.round(myPendingApprovals.reduce((acc, item) => acc + item.pending_minutes, 0) / total)

  return (
    <Card
      title="Solicitudes y aprobaciones"
      subtitle="Cruza tu bandeja real con la presion del workflow por aprobador y por nivel."
      className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
      actions={<Badge tone={unavailable ? 'warn' : 'info'}>{unavailable ? 'Visibilidad parcial' : 'Workflow activo'}</Badge>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-100">
              <Clock3 size={18} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Mi bandeja</div>
            <div className="mt-2 text-3xl font-semibold text-white">{total}</div>
            <p className="mt-2 text-sm text-white/60">{highPriority} en alta prioridad y {overdue} con mas de 24 horas.</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-100">
              <TimerReset size={18} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Tiempo medio</div>
            <div className="mt-2 text-3xl font-semibold text-white">{formatPendingMinutes(avgPendingMinutes)}</div>
            <p className="mt-2 text-sm text-white/60">Promedio de antiguedad de tu cola activa.</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Backlog por aprobador</p>
                <p className="mt-1 text-xs text-white/50">Muestra la carga abierta dentro de los pasos activos visibles.</p>
              </div>
              <Users size={16} className="text-white/38" />
            </div>

            <div className="space-y-3">
              {topApprovers.length ? topApprovers.map((row) => (
                <div key={row.label} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{row.label}</p>
                      <p className="mt-1 text-xs text-white/50">{row.overdue} vencidas o cerca del SLA.</p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold text-white">{row.pending}</span>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 px-4 py-8 text-center text-sm text-white/54">
                  No hay backlog visible para el alcance actual.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Cuellos de botella</p>
                <p className="mt-1 text-xs text-white/50">Niveles con mayor acumulacion y tiempo promedio.</p>
              </div>
              <ShieldAlert size={16} className="text-white/38" />
            </div>

            <div className="space-y-3">
              {topBottlenecks.length ? topBottlenecks.map((row) => (
                <div key={row.label} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{row.label}</p>
                      <p className="mt-1 text-xs text-white/50">{row.avgHours.toFixed(1)} h promedio pendiente</p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold text-white">{row.pending}</span>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 px-4 py-8 text-center text-sm text-white/54">
                  No se detectan cuellos de botella en la cola visible.
                </div>
              )}
            </div>
          </div>
        </div>

        <Link
          to="/management/approvals"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/78 transition hover:bg-white/10"
        >
          Abrir bandeja de aprobaciones
          <ArrowRight size={15} />
        </Link>
      </div>
    </Card>
  )
}

export const PendingApprovalsSummary = React.memo(PendingApprovalsSummaryComponent)

export default PendingApprovalsSummary
