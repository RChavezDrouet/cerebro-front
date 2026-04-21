import React from 'react'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  APPROVER_TYPE_LABELS,
  APPROVER_TYPE_OPTIONS,
  CANDIDATE_RESOLUTION_OPTIONS,
} from '../constants'
import type {
  ApprovalApproverGroupWithMembers,
  ApprovalFlowStepInput,
  ApprovalSetupUser,
} from '../types'

type Props = {
  step: ApprovalFlowStepInput
  index: number
  totalSteps: number
  roles: string[]
  users: ApprovalSetupUser[]
  groups: ApprovalApproverGroupWithMembers[]
  lockAsImmediateManager?: boolean
  disableMoveUp?: boolean
  disableMoveDown?: boolean
  disableRemove?: boolean
  onChange: (patch: Partial<ApprovalFlowStepInput>) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDrop: (index: number) => void
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-2xl border px-4 py-2 text-sm transition ${
        checked
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)]'
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full px-1 transition ${
          checked ? 'justify-end bg-emerald-500/70' : 'justify-start bg-white/10'
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </button>
  )
}

export function ApprovalFlowStepEditor({
  step,
  index,
  totalSteps,
  roles,
  users,
  groups,
  lockAsImmediateManager = false,
  disableMoveUp = false,
  disableMoveDown = false,
  disableRemove = false,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const roleOptions = roles.map((role) => ({ value: role, label: role }))
  const userOptions = users.map((user) => ({
    value: user.user_id,
    label: user.employee_code ? `${user.full_name} (${user.employee_code})` : user.full_name,
  }))
  const groupOptions = groups.map((group) => ({ value: group.id, label: group.name }))

  return (
    <div
      draggable={!lockAsImmediateManager}
      onDragStart={() => {
        if (lockAsImmediateManager) return
        onDragStart(index)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(index)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(index)
      }}
    >
      <Card
        title={`Nivel ${index + 1}`}
        subtitle={lockAsImmediateManager ? 'Jefe inmediato obligatorio' : APPROVER_TYPE_LABELS[step.approver_type]}
        actions={
          <div className="flex items-center gap-2">
            <span className={`rounded-xl border p-2 ${lockAsImmediateManager ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-[var(--text-muted)]'}`}>
              <GripVertical size={16} />
            </span>
            <Button variant="ghost" size="sm" onClick={onMoveUp} disabled={disableMoveUp || index === 0} leftIcon={<ArrowUp size={14} />}>
              Subir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              disabled={disableMoveDown || index === totalSteps - 1}
              leftIcon={<ArrowDown size={14} />}
            >
              Bajar
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={disableRemove || totalSteps === 1} leftIcon={<Trash2 size={14} />}>
              Quitar
            </Button>
          </div>
        }
        className="border border-[var(--border-subtle)] bg-[var(--surface-elevated)]"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Input
            label="Nombre del nivel"
            value={step.step_name}
            onChange={(event) => onChange({ step_name: event.target.value })}
            placeholder={`Nivel ${index + 1}`}
          />

          <Select
            label="Tipo de aprobador"
            value={step.approver_type}
            disabled={lockAsImmediateManager}
            onChange={(value) =>
              onChange({
                approver_type: value as ApprovalFlowStepInput['approver_type'],
                approver_role_code: null,
                approver_user_id: null,
                approver_group_id: null,
              })
            }
            options={APPROVER_TYPE_OPTIONS}
          />

          {step.approver_type === 'role' ? (
            <Select
              label="Rol"
              value={step.approver_role_code ?? ''}
              onChange={(value) => onChange({ approver_role_code: value || null })}
              options={roleOptions}
              placeholder="Seleccione un rol"
            />
          ) : null}

          {step.approver_type === 'specific_user' ? (
            <Select
              label="Usuario"
              value={step.approver_user_id ?? ''}
              onChange={(value) => onChange({ approver_user_id: value || null })}
              options={userOptions}
              placeholder="Seleccione un usuario"
            />
          ) : null}

          {step.approver_type === 'approver_group' ? (
            <Select
              label="Grupo aprobador"
              value={step.approver_group_id ?? ''}
              onChange={(value) => onChange({ approver_group_id: value || null })}
              options={groupOptions}
              placeholder="Seleccione un grupo"
            />
          ) : null}

          <Select
            label="Resolucion cuando hay varios candidatos"
            value={step.candidate_resolution}
            onChange={(value) => onChange({ candidate_resolution: value as ApprovalFlowStepInput['candidate_resolution'] })}
            options={CANDIDATE_RESOLUTION_OPTIONS}
          />

          <Input
            label="Grupo paralelo"
            value={step.parallel_group ?? ''}
            onChange={(event) => onChange({ parallel_group: event.target.value.trim() || null })}
            placeholder="Opcional"
            hint="Solo informativo por ahora. Sirve para agrupar pasos paralelos futuros."
          />
        </div>

        {lockAsImmediateManager ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Este primer nivel queda fijo como jefe inmediato. Cumple la regla base del motor y no puede moverse ni eliminarse.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Toggle label="Nivel requerido" checked={step.is_required} onChange={(next) => onChange({ is_required: next })} />
          <Toggle label="Permitir delegado" checked={step.allow_delegate} onChange={(next) => onChange({ allow_delegate: next })} />
          <Toggle
            label="Autoaprobacion futura"
            checked={step.auto_rule_enabled ?? false}
            onChange={(next) => onChange({ auto_rule_enabled: next })}
          />
        </div>
      </Card>
    </div>
  )
}
