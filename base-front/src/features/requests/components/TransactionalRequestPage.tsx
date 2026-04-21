import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  CheckCircle2,
  FileClock,
  History,
  PencilRuler,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/contexts/AuthContext'
import type { ApprovalOverallStatus } from '@/features/approvals/types'
import { getApprovalHistory } from '@/features/approvals/services/approvalFlows'
import { formatDateTime } from '@/features/approvals/utils'
import { useTenantContext } from '@/hooks/useTenantContext'
import { REQUEST_PAGE_CONFIGS } from '../config'
import { RequestApprovalHistoryModal } from './RequestApprovalHistoryModal'
import { RequestFormModal } from './RequestFormModal'
import { RequestStatusBadge } from './RequestStatusBadge'
import {
  deleteTransactionalRequest,
  fetchActorProfile,
  fetchEmployeeOptions,
  listTransactionalRequests,
  saveTransactionalRequest,
  submitTransactionalRequest,
} from '../services/requestTransactions'
import { canManageRequests, formatMoney } from '../utils'
import type {
  AttendanceJustificationDraft,
  AttendanceJustificationRecord,
  LoanRequestDraft,
  LoanRequestRecord,
  PermissionRequestDraft,
  PermissionRequestRecord,
  RequestDraftMap,
  RequestKind,
  RequestPageConfig,
  RequestRecordMap,
  SalaryAdvanceRequestDraft,
  SalaryAdvanceRequestRecord,
  VacationRequestDraft,
  VacationRequestRecord,
} from '../types'

function recordToDraft<K extends RequestKind>(kind: K, record: RequestRecordMap[K]): RequestDraftMap[K] {
  switch (kind) {
    case 'attendance_justifications': {
      const typedRecord = record as AttendanceJustificationRecord
      return {
        id: typedRecord.id,
        employee_id: typedRecord.employee_id,
        justification_type: typedRecord.justification_type,
        work_date: typedRecord.work_date,
        related_punch_id: typedRecord.related_punch_id,
        reason: typedRecord.reason,
        attachment_url: typedRecord.attachment_url,
      } as RequestDraftMap[K]
    }
    case 'permission_requests': {
      const typedRecord = record as PermissionRequestRecord
      return {
        id: typedRecord.id,
        employee_id: typedRecord.employee_id,
        request_type: typedRecord.request_type,
        start_date: typedRecord.start_date,
        end_date: typedRecord.end_date,
        start_time: typedRecord.start_time,
        end_time: typedRecord.end_time,
        hours_requested: typedRecord.hours_requested,
        reason: typedRecord.reason,
        attachment_url: typedRecord.attachment_url,
      } as RequestDraftMap[K]
    }
    case 'loan_requests': {
      const typedRecord = record as LoanRequestRecord
      return {
        id: typedRecord.id,
        employee_id: typedRecord.employee_id,
        amount_requested: typedRecord.amount_requested,
        currency_code: typedRecord.currency_code,
        installments: typedRecord.installments,
        reason: typedRecord.reason,
      } as RequestDraftMap[K]
    }
    case 'salary_advance_requests': {
      const typedRecord = record as SalaryAdvanceRequestRecord
      return {
        id: typedRecord.id,
        employee_id: typedRecord.employee_id,
        amount_requested: typedRecord.amount_requested,
        currency_code: typedRecord.currency_code,
        requested_pay_date: typedRecord.requested_pay_date,
        reason: typedRecord.reason,
      } as RequestDraftMap[K]
    }
    case 'vacation_requests': {
      const typedRecord = record as VacationRequestRecord
      return {
        id: typedRecord.id,
        employee_id: typedRecord.employee_id,
        start_date: typedRecord.start_date,
        end_date: typedRecord.end_date,
        days_requested: typedRecord.days_requested,
        available_balance_days: typedRecord.available_balance_days,
        reason: typedRecord.reason ?? '',
      } as RequestDraftMap[K]
    }
    default:
      throw new Error('Tipo de solicitud no soportado')
  }
}

function renderRecordMeta<K extends RequestKind>(
  kind: K,
  record: RequestRecordMap[K],
  config: RequestPageConfig<K, RequestRecordMap[K], RequestDraftMap[K]>,
): string {
  switch (kind) {
    case 'loan_requests': {
      const typedRecord = record as LoanRequestRecord
      return `${formatMoney(typedRecord.amount_requested, typedRecord.currency_code)} - ${typedRecord.installments} cuota(s)`
    }
    case 'salary_advance_requests': {
      const typedRecord = record as SalaryAdvanceRequestRecord
      return `${formatMoney(typedRecord.amount_requested, typedRecord.currency_code)} - ${typedRecord.requested_pay_date ?? 'sin fecha'}`
    }
    case 'vacation_requests': {
      const typedRecord = record as VacationRequestRecord
      return `${typedRecord.days_requested} dia(s) - saldo ${typedRecord.available_balance_days ?? 'n/d'}`
    }
    default:
      return config.getMeta(record)
  }
}

function getStatusSurface(status: ApprovalOverallStatus): string {
  if (status === 'aprobado') return 'border-emerald-500/25 bg-emerald-500/8'
  if (status === 'rechazado') return 'border-rose-500/25 bg-rose-500/8'
  if (status === 'en_aprobacion' || status === 'pendiente') return 'border-amber-500/25 bg-amber-500/8'
  return 'border-sky-500/20 bg-sky-500/8'
}

export function TransactionalRequestPage<K extends RequestKind>({ kind }: { kind: K }) {
  const config = REQUEST_PAGE_CONFIGS[kind] as unknown as RequestPageConfig<K, RequestRecordMap[K], RequestDraftMap[K]>
  const qc = useQueryClient()
  const { user } = useAuth()
  const tenantContext = useTenantContext(user?.id)
  const tenantId = tenantContext.data?.tenantId

  const actorProfileQuery = useQuery({
    queryKey: ['request-actor-profile', user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchActorProfile(user!.id),
  })

  const employeeOptionsQuery = useQuery({
    queryKey: ['request-employee-options', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchEmployeeOptions(tenantId!),
  })

  const recordsQuery = useQuery<RequestRecordMap[K][]>({
    queryKey: ['request-records', kind],
    enabled: !!tenantId,
    queryFn: () => listTransactionalRequests(kind),
  })

  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [employeeFilter, setEmployeeFilter] = React.useState('all')
  const [draft, setDraft] = React.useState<RequestDraftMap[K] | null>(null)
  const [historyRequestId, setHistoryRequestId] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)

  const historyQuery = useQuery({
    queryKey: ['request-history', historyRequestId],
    enabled: !!historyRequestId,
    queryFn: () => getApprovalHistory(historyRequestId!),
  })

  const actorProfile = actorProfileQuery.data ?? null
  const employeeOptions = employeeOptionsQuery.data ?? []
  const employeeById = React.useMemo(
    () => new Map(employeeOptions.map((employee) => [employee.employee_id, employee])),
    [employeeOptions],
  )

  const visibleRecords = React.useMemo(() => {
    const base = recordsQuery.data ?? []
    return base.filter((record) => {
      const employee = employeeById.get(record.employee_id)
      const searchableText = `${employee?.full_name ?? ''} ${employee?.employee_code ?? ''} ${config.getSummary(record)} ${config.getMeta(record)}`.toLowerCase()
      const matchesSearch = search.trim() === '' || searchableText.includes(search.trim().toLowerCase())
      const matchesStatus = statusFilter === 'all' || record.request_status === statusFilter
      const matchesEmployee = employeeFilter === 'all' || record.employee_id === employeeFilter
      return matchesSearch && matchesStatus && matchesEmployee
    })
  }, [config, employeeById, employeeFilter, recordsQuery.data, search, statusFilter])

  const summary = React.useMemo(
    () => ({
      borrador: visibleRecords.filter((record) => record.request_status === 'borrador').length,
      en_aprobacion: visibleRecords.filter((record) => record.request_status === 'en_aprobacion').length,
      aprobado: visibleRecords.filter((record) => record.request_status === 'aprobado').length,
      rechazado: visibleRecords.filter((record) => record.request_status === 'rechazado').length,
    }),
    [visibleRecords],
  )

  const totalRecords = recordsQuery.data?.length ?? 0
  const flowStartedCount = recordsQuery.data?.filter((record) => record.approval_request_id != null).length ?? 0
  const actionableCount = visibleRecords.filter(
    (record) => record.request_status === 'borrador' || record.request_status === 'rechazado',
  ).length
  const latestRecordAt = visibleRecords[0]?.created_at ?? recordsQuery.data?.[0]?.created_at ?? null

  const invalidateCurrent = React.useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['request-records', kind] }),
      qc.invalidateQueries({ queryKey: ['pending-approvals'] }),
      qc.invalidateQueries({ queryKey: ['approval-history'] }),
      qc.invalidateQueries({ queryKey: ['request-history'] }),
    ])
  }, [kind, qc])

  const saveMutation = useMutation<string, Error, RequestDraftMap[K]>({
    mutationFn: (nextDraft) => saveTransactionalRequest(kind, nextDraft),
    onSuccess: async () => {
      toast.success('Borrador guardado')
      setFormOpen(false)
      await invalidateCurrent()
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo guardar el borrador')
    },
  })

  const submitMutation = useMutation<string, Error, RequestDraftMap[K]>({
    mutationFn: async (nextDraft) => {
      if (!user) throw new Error('No hay sesion activa')
      return submitTransactionalRequest(kind, nextDraft, user.id, actorProfile?.employee_id)
    },
    onSuccess: async () => {
      toast.success('Solicitud enviada a aprobacion')
      setFormOpen(false)
      await invalidateCurrent()
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo enviar a aprobacion')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransactionalRequest(kind, id),
    onSuccess: async () => {
      toast.success('Solicitud eliminada')
      await invalidateCurrent()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo eliminar la solicitud')
    },
  })

  const openCreate = React.useCallback(() => {
    const employeeId = canManageRequests(actorProfile?.role) ? null : actorProfile?.employee_id ?? null
    setDraft(config.buildEmptyDraft(employeeId))
    setFormOpen(true)
  }, [actorProfile?.employee_id, actorProfile?.role, config])

  const openEdit = React.useCallback((record: RequestRecordMap[K]) => {
    setDraft(recordToDraft(kind, record))
    setFormOpen(true)
  }, [kind])

  const pendingAction = saveMutation.isPending || submitMutation.isPending || deleteMutation.isPending

  if (tenantContext.isLoading || actorProfileQuery.isLoading || employeeOptionsQuery.isLoading || recordsQuery.isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.15rem] border border-white/10 bg-[#08111d]/92 px-5 py-6 shadow-soft sm:px-6">
        <div className="pointer-events-none absolute -right-16 top-0 h-44 w-44 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-16 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <RequestStatusBadge status="en_aprobacion" />
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-white/72">
                Flujo transaccional
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.15rem]">{config.title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-white/72 sm:text-base">{config.subtitle}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
                {config.createLabel}
              </Button>
              <Link
                to="/management/approvals"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ir a aprobaciones
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-200">
                  <FileClock size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Registros totales</div>
                <p className="mt-1 text-sm text-white/60">{totalRecords} solicitudes cargadas en este modulo.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
                  <PencilRuler size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Pendientes de accion</div>
                <p className="mt-1 text-sm text-white/60">
                  {actionableCount} borradores o rechazadas pueden editarse y reenviarse.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200">
                  <CheckCircle2 size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Con flujo iniciado</div>
                <p className="mt-1 text-sm text-white/60">
                  {flowStartedCount} registros ya tienen trazabilidad de aprobacion.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="rounded-[1.7rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">Borradores</div>
              <div className="mt-3 text-4xl font-semibold">{summary.borrador}</div>
              <div className="mt-2 text-sm text-white/60">Listos para revisar antes de envio.</div>
            </Card>
            <Card className="rounded-[1.7rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">En flujo</div>
              <div className="mt-3 text-4xl font-semibold">{summary.en_aprobacion}</div>
              <div className="mt-2 text-sm text-white/60">Solicitudes actualmente en aprobacion.</div>
            </Card>
            <Card className="rounded-[1.7rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">Aprobadas</div>
              <div className="mt-3 text-4xl font-semibold">{summary.aprobado}</div>
              <div className="mt-2 text-sm text-white/60">Registros cerrados de forma positiva.</div>
            </Card>
            <Card className="rounded-[1.7rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">Ultima actividad</div>
              <div className="mt-3 text-lg font-semibold">{latestRecordAt ? formatDateTime(latestRecordAt) : 'Sin registros'}</div>
              <div className="mt-2 text-sm text-white/60">{summary.rechazado} rechazadas para correccion.</div>
            </Card>
          </div>
        </div>
      </section>

      <Card title="Filtros" subtitle="Acota la vista por estado, colaborador y texto libre." className="rounded-[2rem]">
        <div className="grid gap-4 lg:grid-cols-3">
          <Input
            label="Buscar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Colaborador, motivo, tipo..."
          />
          <Select
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'borrador', label: 'Borrador' },
              { value: 'en_aprobacion', label: 'En aprobacion' },
              { value: 'aprobado', label: 'Aprobado' },
              { value: 'rechazado', label: 'Rechazado' },
              { value: 'cancelado', label: 'Cancelado' },
            ]}
            placeholder="Todos"
          />
          <Select
            label="Colaborador"
            value={employeeFilter}
            onChange={setEmployeeFilter}
            options={employeeOptions.map((employee) => ({ value: employee.employee_id, label: employee.full_name }))}
            placeholder="Todos"
          />
        </div>
      </Card>

      <Card
        title="Solicitudes registradas"
        subtitle="Cada tarjeta refleja el estado actual, el resumen del origen y las acciones disponibles."
        className="rounded-[2rem]"
      >
        {visibleRecords.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            No hay registros para los filtros actuales.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRecords.map((record) => {
              const employee = employeeById.get(record.employee_id)
              const canEdit = record.request_status === 'borrador' || record.request_status === 'rechazado'

              return (
                <div key={record.id} className={`rounded-[1.8rem] border p-5 ${getStatusSurface(record.request_status)}`}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold">{employee?.full_name ?? record.employee_id}</div>
                        <RequestStatusBadge status={record.request_status} />
                        {record.approval_request_id ? (
                          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                            Historial activo
                          </span>
                        ) : null}
                      </div>

                      <div className="text-sm text-[var(--text-secondary)]">{config.getSummary(record)}</div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Detalle</div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">{renderRecordMeta(kind, record, config)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Creado</div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">{formatDateTime(record.created_at)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Resolucion</div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">
                            {record.resolved_at ? formatDateTime(record.resolved_at) : 'Aun sin cierre'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      {record.approval_request_id ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<History size={14} />}
                          onClick={() => setHistoryRequestId(record.approval_request_id)}
                        >
                          Historial
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Send size={14} />}
                          onClick={() => openEdit(record)}
                        >
                          {record.request_status === 'rechazado' ? 'Corregir y reenviar' : 'Editar'}
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 size={14} />}
                          disabled={pendingAction}
                          onClick={() => deleteMutation.mutate(record.id)}
                        >
                          Eliminar
                        </Button>
                      ) : null}
                      {!canEdit && record.request_status === 'aprobado' ? (
                        <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">
                          <CheckCircle2 size={14} />
                          Cierre aprobado
                        </span>
                      ) : null}
                      {!canEdit && record.request_status === 'rechazado' ? (
                        <span className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">
                          <XCircle size={14} />
                          Pendiente de correccion
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <RequestFormModal
        open={formOpen}
        kind={kind}
        title={draft?.id ? `Editar ${config.title.toLowerCase()}` : config.createLabel}
        actorProfile={actorProfile}
        employees={employeeOptions}
        initialDraft={draft}
        saving={pendingAction}
        onClose={() => setFormOpen(false)}
        onSaveDraft={async (nextDraft) => {
          await saveMutation.mutateAsync(nextDraft as RequestDraftMap[K])
        }}
        onSaveAndSubmit={async (nextDraft) => {
          await submitMutation.mutateAsync(nextDraft as RequestDraftMap[K])
        }}
      />

      <RequestApprovalHistoryModal
        open={historyRequestId != null}
        loading={historyQuery.isLoading}
        history={historyQuery.data ?? null}
        onClose={() => setHistoryRequestId(null)}
      />
    </div>
  )
}
