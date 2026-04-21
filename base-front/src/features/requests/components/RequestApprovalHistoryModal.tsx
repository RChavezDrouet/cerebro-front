import React from 'react'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ApprovalHistoryTimeline } from '@/features/approvals/components/ApprovalHistoryTimeline'
import type { ApprovalHistoryPayload } from '@/features/approvals/types'
import { formatDateTime, getOverallStatusTone } from '@/features/approvals/utils'
import { getRequestStatusLabel } from '../utils'

function renderScalar(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function RequestApprovalHistoryModal({
  open,
  loading,
  history,
  onClose,
}: {
  open: boolean
  loading: boolean
  history: ApprovalHistoryPayload | null
  onClose: () => void
}) {
  const sourceEntries = Object.entries(history?.source_record ?? {}).filter(([, value]) => value != null).slice(0, 10)

  return (
    <Modal open={open} onClose={onClose} title="Trazabilidad de la solicitud">
      {loading || !history ? (
        <div className="flex min-h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
        </div>
      ) : (
        <div className="space-y-5">
          <Card
            title={history.request.flow_code}
            subtitle={`Creada el ${formatDateTime(history.request.created_at)}`}
            actions={
              <Badge tone={getOverallStatusTone(history.request.overall_status)}>
                {getRequestStatusLabel(history.request.overall_status)}
              </Badge>
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Origen</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {history.request.source_table} / {history.request.source_record_id}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Estado final</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {history.request.final_decision_at ? formatDateTime(history.request.final_decision_at) : 'En curso'}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Resumen del registro">
            <div className="grid gap-3 md:grid-cols-2">
              {sourceEntries.map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{key}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">{renderScalar(value)}</div>
                </div>
              ))}
            </div>
          </Card>

          <ApprovalHistoryTimeline steps={history.steps} audit={history.audit} />
        </div>
      )}
    </Modal>
  )
}
