import React from 'react'
import { CalendarRange, ReceiptText, TriangleAlert, Wallet, X } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import type { DashboardRequestRow, FineLedgerDetailRow } from '@/lib/dashboard/biDashboard'
import { formatCurrency, formatDateLabel, formatPercent } from './shared'

export type CollaboratorDetailPayload = {
  employeeId: string
  employeeName: string
  employeeCode: string | null
  orgPath: string
  punctualityPct: number
  absenteeismPct: number
  lateCount: number
  absenceCount: number
  fineAmount: number
  fineCount: number
  pendingRequests: number
  approvedVacations: number
  recentRequests: DashboardRequestRow[]
  recentFines: FineLedgerDetailRow[]
  recentVacations: DashboardRequestRow[]
}

type DetailDrawerProps = {
  open: boolean
  detail: CollaboratorDetailPayload | null
  onClose: () => void
}

function DetailDrawerComponent({ open, detail, onClose }: DetailDrawerProps) {
  if (!open || !detail) return null

  return (
    <div className="fixed inset-0 z-50 isolate overscroll-none">
      <button
        type="button"
        aria-label="Cerrar detalle"
        className="absolute inset-0 bg-[#02060c]/92 backdrop-blur-lg"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-[44rem] overflow-y-auto overflow-x-hidden border-l border-cyan-400/10 bg-[linear-gradient(180deg,#07111d_0%,#091525_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.72)]">
        <div className="pointer-events-none absolute -left-20 top-12 h-52 w-52 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#07111d]/98 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">Colaborador</Badge>
                {detail.employeeCode ? <Badge tone="neutral">{detail.employeeCode}</Badge> : null}
              </div>
              <h2 className="mt-3 text-[clamp(1.45rem,2vw,2rem)] font-semibold tracking-tight text-white">{detail.employeeName}</h2>
              <p className="mt-1 text-sm leading-6 text-white/62">{detail.orgPath || 'Sin asignacion organizacional'}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/72 transition hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="relative space-y-5 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#0c1828]/88 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Puntualidad</div>
              <div className="mt-2 text-3xl font-semibold text-white">{formatPercent(detail.punctualityPct)}</div>
              <p className="mt-2 text-sm text-white/58">{detail.lateCount} atraso(s) y {detail.absenceCount} ausencia(s) en el periodo.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-[#0c1828]/88 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Impacto economico</div>
              <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(detail.fineAmount)}</div>
              <p className="mt-2 text-sm text-white/58">{detail.fineCount} multa(s), {detail.pendingRequests} solicitud(es) pendiente(s).</p>
            </div>
          </div>

          <section className="rounded-[1.7rem] border border-white/10 bg-[#0a1523]/88 p-4">
            <div className="mb-4 flex items-center gap-3">
              <ReceiptText size={16} className="text-cyan-300" />
              <div>
                <p className="text-sm font-semibold text-white">Solicitudes recientes</p>
                <p className="mt-1 text-xs text-white/50">Ultimos movimientos del workflow asociados al colaborador.</p>
              </div>
            </div>

            <div className="space-y-3">
              {detail.recentRequests.length ? detail.recentRequests.map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-[#0c1828]/88 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{row.typeLabel}</p>
                    <Badge tone={row.requestStatus === 'aprobado' ? 'good' : row.requestStatus === 'rechazado' ? 'bad' : row.requestStatus === 'en_aprobacion' ? 'warn' : 'neutral'}>
                      {row.requestStatus}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-white/60">{row.reason || 'Sin observacion registrada.'}</p>
                  <p className="mt-2 text-xs text-white/48">
                    {formatDateLabel(row.periodStart ?? row.createdAt.slice(0, 10))}
                    {row.periodEnd && row.periodEnd !== row.periodStart ? ` - ${formatDateLabel(row.periodEnd)}` : ''}
                  </p>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/12 bg-[#0b1726]/78 px-4 py-8 text-center text-sm text-white/54">
                  No hay solicitudes recientes para este colaborador.
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-[1.7rem] border border-white/10 bg-[#0a1523]/88 p-4">
              <div className="mb-4 flex items-center gap-3">
                <TriangleAlert size={16} className="text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-white">Multas recientes</p>
                  <p className="mt-1 text-xs text-white/50">Detalle del impacto monetario asociado al colaborador.</p>
                </div>
              </div>

              <div className="space-y-3">
                {detail.recentFines.length ? detail.recentFines.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-white/10 bg-[#0c1828]/88 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{row.incidentType.replace(/_/g, ' ')}</p>
                      <span className="text-sm font-semibold text-white">{formatCurrency(row.appliedAmount)}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/48">{formatDateLabel(row.incidentDate)}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-[#0b1726]/78 px-4 py-8 text-center text-sm text-white/54">
                    No se registran multas recientes.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-white/10 bg-[#0a1523]/88 p-4">
              <div className="mb-4 flex items-center gap-3">
                <CalendarRange size={16} className="text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-white">Vacaciones recientes</p>
                  <p className="mt-1 text-xs text-white/50">{detail.approvedVacations} solicitud(es) aprobadas visibles.</p>
                </div>
              </div>

              <div className="space-y-3">
                {detail.recentVacations.length ? detail.recentVacations.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-white/10 bg-[#0c1828]/88 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">Vacaciones</p>
                      <Badge tone={row.requestStatus === 'aprobado' ? 'good' : row.requestStatus === 'rechazado' ? 'bad' : 'warn'}>
                        {row.requestStatus}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-white/60">
                      {formatDateLabel(row.periodStart ?? '')}
                      {row.periodEnd ? ` - ${formatDateLabel(row.periodEnd)}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-white/48">{row.daysRequested ?? 0} dia(s) solicitados</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-[#0b1726]/78 px-4 py-8 text-center text-sm text-white/54">
                    No hay solicitudes de vacaciones recientes.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-[1.7rem] border border-white/10 bg-[#0a1523]/88 p-4">
            <div className="mb-4 flex items-center gap-3">
              <Wallet size={16} className="text-fuchsia-300" />
              <div>
                <p className="text-sm font-semibold text-white">Lectura gerencial</p>
                <p className="mt-1 text-xs text-white/50">Resumen rapido del comportamiento del colaborador dentro del scope actual.</p>
              </div>
            </div>

            <p className="text-sm leading-7 text-white/64">
              Este colaborador muestra {detail.lateCount > 0 ? 'presion en puntualidad' : 'estabilidad en puntualidad'},
              un ausentismo de {formatPercent(detail.absenteeismPct)} y un impacto monetario acumulado de {formatCurrency(detail.fineAmount)}.
              La cola visible registra {detail.pendingRequests} solicitud(es) pendiente(s) y {detail.approvedVacations} solicitud(es) de vacaciones aprobada(s).
            </p>
          </section>
        </div>
      </aside>
    </div>
  )
}

export const DetailDrawer = React.memo(DetailDrawerComponent)

export default DetailDrawer
