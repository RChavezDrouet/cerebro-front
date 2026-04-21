import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, Filter, Inbox, Search, ShieldAlert, TimerReset, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/contexts/AuthContext'
import { PendingApprovalDetailModal } from '@/features/approvals/components/PendingApprovalDetailModal'
import {
  approveApprovalRequest,
  getApprovalHistory,
  listPendingApprovals,
  rejectApprovalRequest,
} from '@/features/approvals/services/approvalFlows'
import { formatDateTime, formatPendingMinutes } from '@/features/approvals/utils'
import { useTenantContext } from '@/hooks/useTenantContext'

function getPriorityTone(priority: string): 'bad' | 'warn' | 'info' {
  if (priority === 'alta') return 'bad'
  if (priority === 'media') return 'warn'
  return 'info'
}

function getPrioritySurface(priority: string): string {
  if (priority === 'alta') return 'border-rose-500/30 bg-rose-500/8'
  if (priority === 'media') return 'border-amber-500/30 bg-amber-500/8'
  return 'border-sky-500/20 bg-sky-500/8'
}

export default function PendingApprovalsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const tenantContext = useTenantContext(user?.id)
  const tenantId = tenantContext.data?.tenantId

  const pendingApprovalsQuery = useQuery({
    queryKey: ['pending-approvals'],
    enabled: !!tenantId,
    queryFn: listPendingApprovals,
  })

  const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [flowFilter, setFlowFilter] = React.useState('all')
  const [priorityFilter, setPriorityFilter] = React.useState('all')

  const historyQuery = useQuery({
    queryKey: ['approval-history', selectedRequestId],
    enabled: !!selectedRequestId,
    queryFn: () => getApprovalHistory(selectedRequestId!),
  })

  const approveMutation = useMutation({
    mutationFn: async (comment: string) => {
      if (!selectedRequestId) throw new Error('No hay solicitud seleccionada')
      await approveApprovalRequest(selectedRequestId, comment)
    },
    onSuccess: async () => {
      toast.success('Solicitud aprobada')
      setSelectedRequestId(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['pending-approvals'] }),
        qc.invalidateQueries({ queryKey: ['approval-history'] }),
      ])
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo aprobar la solicitud')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (comment: string) => {
      if (!selectedRequestId) throw new Error('No hay solicitud seleccionada')
      await rejectApprovalRequest(selectedRequestId, comment)
    },
    onSuccess: async () => {
      toast.success('Solicitud rechazada')
      setSelectedRequestId(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['pending-approvals'] }),
        qc.invalidateQueries({ queryKey: ['approval-history'] }),
      ])
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo rechazar la solicitud')
    },
  })

  const items = pendingApprovalsQuery.data ?? []

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const term = search.trim().toLowerCase()
      const matchesSearch =
        term === '' ||
        item.collaborator_name.toLowerCase().includes(term) ||
        item.flow_name.toLowerCase().includes(term) ||
        item.current_step_name.toLowerCase().includes(term)

      const matchesFlow = flowFilter === 'all' || item.flow_code === flowFilter
      const matchesPriority = priorityFilter === 'all' || item.priority_visual === priorityFilter

      return matchesSearch && matchesFlow && matchesPriority
    })
  }, [flowFilter, items, priorityFilter, search])

  const flowOptions = React.useMemo(() => {
    const unique = [...new Set(items.map((item) => `${item.flow_code}:::${item.flow_name}`))]
    return unique.map((value) => {
      const [flowCode, flowName] = value.split(':::')
      return { value: flowCode, label: flowName }
    })
  }, [items])

  const queueMetrics = React.useMemo(() => {
    const total = items.length
    const highPriority = items.filter((item) => item.priority_visual === 'alta').length
    const overdue = items.filter((item) => item.pending_minutes >= 24 * 60).length
    const sharedFlows = new Set(items.map((item) => item.flow_code)).size
    const averagePendingMinutes =
      total === 0 ? 0 : Math.round(items.reduce((acc, item) => acc + item.pending_minutes, 0) / total)

    const focusItems = [...items]
      .sort((left, right) => {
        const leftScore = (left.priority_visual === 'alta' ? 2 : left.priority_visual === 'media' ? 1 : 0) * 100000 + left.pending_minutes
        const rightScore = (right.priority_visual === 'alta' ? 2 : right.priority_visual === 'media' ? 1 : 0) * 100000 + right.pending_minutes
        return rightScore - leftScore
      })
      .slice(0, 3)

    return {
      total,
      highPriority,
      overdue,
      sharedFlows,
      averagePendingMinutes,
      focusItems,
    }
  }, [items])

  if (tenantContext.isLoading || pendingApprovalsQuery.isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.3rem] border border-white/10 bg-[#08101d]/92 px-5 py-6 shadow-soft sm:px-6">
        <div className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full bg-rose-500/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="warn">Bandeja de aprobacion</Badge>
              <Badge tone="info">Nota obligatoria</Badge>
              <Badge tone="good">Auditoria completa</Badge>
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.2rem]">
                Cola activa de decisiones del tenant
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
                Aqui ves las solicitudes que te corresponden como aprobador vigente. El rechazo cierra el flujo cuando la
                regla lo exige y cada decision queda registrada con comentario.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/management/requests"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] shadow-soft transition hover:brightness-110"
              >
                Ver solicitudes
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/management/requests/vacations"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Abrir un modulo
                <Users size={16} />
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200">
                  <ShieldAlert size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Grupos y roles</div>
                <p className="mt-1 text-sm text-white/60">
                  La bandeja soporta aprobador unico o cola compartida segun la configuracion del flujo.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                  <TimerReset size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Tiempo pendiente</div>
                <p className="mt-1 text-sm text-white/60">
                  El mockup resalta antiguedad y prioridad para acelerar el despacho de solicitudes.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                  <Inbox size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Detalle accionable</div>
                <p className="mt-1 text-sm text-white/60">
                  Desde el modal puedes revisar origen, historial y dejar la nota de aprobacion o rechazo.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Pendientes totales</div>
              <div className="mt-3 text-4xl font-semibold">{queueMetrics.total}</div>
              <div className="mt-2 text-sm text-white/60">Elementos hoy en tu cola de aprobacion.</div>
            </Card>
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Alta prioridad</div>
              <div className="mt-3 text-4xl font-semibold">{queueMetrics.highPriority}</div>
              <div className="mt-2 text-sm text-white/60">Solicitudes que requieren accion mas rapida.</div>
            </Card>
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Promedio pendiente</div>
              <div className="mt-3 text-4xl font-semibold">{formatPendingMinutes(queueMetrics.averagePendingMinutes)}</div>
              <div className="mt-2 text-sm text-white/60">Antiguedad media de la cola actual.</div>
            </Card>
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Flujos activos</div>
              <div className="mt-3 text-4xl font-semibold">{queueMetrics.sharedFlows}</div>
              <div className="mt-2 text-sm text-white/60">{queueMetrics.overdue} superan 24 horas pendientes.</div>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
        <Card
          title="Filtros de bandeja"
          subtitle="Busca por colaborador, flujo o nivel y enfoca la cola por prioridad."
          className="rounded-[2rem]"
          actions={<Filter size={18} className="text-white/50" />}
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <Input
              label="Buscar"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Colaborador, flujo o nivel"
              right={<Search size={16} className="text-[var(--text-muted)]" />}
            />
            <Select
              label="Tipo"
              value={flowFilter}
              onChange={setFlowFilter}
              options={flowOptions}
              placeholder="Todos"
            />
            <Select
              label="Prioridad"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'media', label: 'Media' },
                { value: 'alta', label: 'Alta' },
              ]}
              placeholder="Todas"
            />
            <div className="rounded-[1.6rem] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Vista filtrada</div>
              <div className="mt-2 text-3xl font-semibold">{filteredItems.length}</div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">elementos visibles con los filtros actuales</div>
            </div>
          </div>
        </Card>

        <Card
          title="Foco inmediato"
          subtitle="Las primeras tres prioridades segun urgencia y tiempo."
          className="rounded-[2rem]"
          actions={<Badge tone="warn">Top 3</Badge>}
        >
          <div className="space-y-3">
            {queueMetrics.focusItems.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                No hay aprobaciones pendientes.
              </div>
            ) : (
              queueMetrics.focusItems.map((item) => (
                <button
                  key={item.approval_request_step_id}
                  type="button"
                  onClick={() => setSelectedRequestId(item.approval_request_id)}
                  className={`w-full rounded-[1.6rem] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${getPrioritySurface(item.priority_visual)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{item.flow_name}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{item.collaborator_name}</div>
                    </div>
                    <Badge tone={getPriorityTone(item.priority_visual)}>{item.priority_visual}</Badge>
                  </div>
                  <div className="mt-3 text-sm text-[var(--text-secondary)]">{item.current_step_name}</div>
                  <div className="mt-2 text-xs text-[var(--text-muted)]">
                    Pendiente {formatPendingMinutes(item.pending_minutes)} desde {formatDateTime(item.requested_at)}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </section>

      <Card title="Bandeja activa" subtitle="Selecciona una tarjeta para abrir el detalle y decidir." className="rounded-[2rem]">
        {filteredItems.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            No hay solicitudes pendientes con los filtros actuales.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.approval_request_step_id}
                className={`rounded-[1.8rem] border p-5 ${getPrioritySurface(item.priority_visual)}`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold">{item.flow_name}</div>
                      <Badge tone={getPriorityTone(item.priority_visual)}>{item.priority_visual}</Badge>
                      <Badge tone="warn">Nivel {item.current_step_order}</Badge>
                      <Badge tone="neutral">{item.source_table}</Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Colaborador</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{item.collaborator_name}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Paso actual</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{item.current_step_name}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Fecha envio</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{formatDateTime(item.requested_at)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 xl:items-end">
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Tiempo pendiente</div>
                      <div className="mt-1 text-lg font-semibold">{formatPendingMinutes(item.pending_minutes)}</div>
                    </div>
                    <Button onClick={() => setSelectedRequestId(item.approval_request_id)}>Ver detalle</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <PendingApprovalDetailModal
        open={selectedRequestId != null}
        loading={historyQuery.isLoading}
        history={historyQuery.data ?? null}
        actionPending={approveMutation.isPending || rejectMutation.isPending}
        onClose={() => setSelectedRequestId(null)}
        onApprove={async (comment) => approveMutation.mutateAsync(comment)}
        onReject={async (comment) => rejectMutation.mutateAsync(comment)}
      />
    </div>
  )
}
