import React from 'react'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { APPROVER_TYPE_LABELS, STEP_STATUS_LABELS } from '../constants'
import { formatDateTime, getStepTone } from '../utils'
import type { ApprovalHistoryAuditItem, ApprovalHistoryStep } from '../types'

export function ApprovalHistoryTimeline({
  steps,
  audit,
}: {
  steps: ApprovalHistoryStep[]
  audit: ApprovalHistoryAuditItem[]
}) {
  return (
    <div className="space-y-4">
      <Card title="Timeline de niveles">
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">
                      Nivel {step.step_order}: {step.step_name}
                    </div>
                    <Badge tone={getStepTone(step)}>{step.status === 'pendiente' && !step.activated_at ? 'No iniciado' : STEP_STATUS_LABELS[step.status]}</Badge>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">{APPROVER_TYPE_LABELS[step.approver_type]}</div>
                  {step.assigned_user_name ? <div className="text-sm text-[var(--text-secondary)]">Asignado a: {step.assigned_user_name}</div> : null}
                  {step.assigned_role_code ? <div className="text-sm text-[var(--text-secondary)]">Rol: {step.assigned_role_code}</div> : null}
                  {step.candidate_user_names.length > 1 ? (
                    <div className="text-sm text-[var(--text-secondary)]">Candidatos: {step.candidate_user_names.join(', ')}</div>
                  ) : null}
                  {step.comments ? <div className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-[var(--text-secondary)]">{step.comments}</div> : null}
                </div>
                <div className="space-y-1 text-right text-xs text-[var(--text-muted)]">
                  <div>Activado: {formatDateTime(step.activated_at)}</div>
                  <div>Resuelto: {formatDateTime(step.acted_at)}</div>
                  {step.acted_by_user_name ? <div>Actor: {step.acted_by_user_name}</div> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Auditoria">
        <div className="space-y-3">
          {audit.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">Sin eventos registrados.</div>
          ) : (
            audit.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{item.action}</div>
                  <div className="text-xs text-[var(--text-muted)]">{item.acted_by_user_name ?? 'Sistema'}</div>
                  {item.comments ? <div className="mt-1 text-sm text-[var(--text-secondary)]">{item.comments}</div> : null}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{formatDateTime(item.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
