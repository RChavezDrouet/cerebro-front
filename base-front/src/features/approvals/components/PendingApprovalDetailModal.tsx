import React from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { APPROVAL_STATUS_LABELS } from '../constants'
import { ApprovalHistoryTimeline } from './ApprovalHistoryTimeline'
import { formatDateTime, getOverallStatusTone } from '../utils'
import type { ApprovalHistoryPayload } from '../types'

type Props = {
  open: boolean
  loading: boolean
  history: ApprovalHistoryPayload | null
  actionPending: boolean
  onClose: () => void
  onApprove: (comment: string) => Promise<void> | void
  onReject: (comment: string) => Promise<void> | void
}

function renderScalar(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

export function PendingApprovalDetailModal({
  open,
  loading,
  history,
  actionPending,
  onClose,
  onApprove,
  onReject,
}: Props) {
  const [comment, setComment] = React.useState('')
  const trimmedComment = comment.trim()
  const noteRequired = trimmedComment.length === 0

  React.useEffect(() => {
    if (!open) {
      setComment('')
    }
  }, [open])

  const sourceEntries = Object.entries(history?.source_record ?? {}).filter(([, value]) => value != null).slice(0, 8)

  return (
    <Modal open={open} onClose={onClose} title="Detalle de aprobacion">
      {loading || !history ? (
        <div className="flex min-h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
        </div>
      ) : (
        <div className="space-y-5">
          <Card
            title={history.request.flow_code}
            subtitle={`Solicitud enviada el ${formatDateTime(history.request.created_at)}`}
            actions={<Badge tone={getOverallStatusTone(history.request.overall_status)}>{APPROVAL_STATUS_LABELS[history.request.overall_status]}</Badge>}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Origen</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {history.request.source_table} / {history.request.source_record_id}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Modo</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">{history.request.execution_mode}</div>
              </div>
            </div>
          </Card>

          <Card title="Resumen de la solicitud">
            <div className="grid gap-3 md:grid-cols-2">
              {sourceEntries.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">No hay campos escalares visibles para este origen.</div>
              ) : (
                sourceEntries.map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{key}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{renderScalar(value)}</div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <ApprovalHistoryTimeline steps={history.steps} audit={history.audit} />

          <Card title="Accion del aprobador" subtitle="La nota es obligatoria tanto para aprobar como para rechazar.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                Registra el motivo de la decision. Esta nota queda visible en el historial y en la auditoria del flujo.
              </div>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                placeholder="Escribe el motivo de aceptacion o rechazo"
              />
              {noteRequired ? (
                <div className="text-xs text-amber-300">
                  La nota es obligatoria antes de confirmar la decision.
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                <Button variant="danger" disabled={actionPending || noteRequired} onClick={() => onReject(trimmedComment)}>
                  {actionPending ? 'Procesando...' : 'Rechazar'}
                </Button>
                <Button disabled={actionPending || noteRequired} onClick={() => onApprove(trimmedComment)}>
                  {actionPending ? 'Procesando...' : 'Aprobar'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Modal>
  )
}
