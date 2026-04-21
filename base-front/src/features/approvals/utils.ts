import { APPROVER_TYPE_LABELS } from './constants'
import type {
  ApprovalFlowStepInput,
  ApprovalHistoryStep,
  ApprovalOverallStatus,
  ApprovalStepStatus,
  ApproverType,
  ApprovalSetupContext,
} from './types'

export function buildEmptyStep(order: number): ApprovalFlowStepInput {
  return {
    step_order: order,
    step_name: `Nivel ${order}`,
    approver_type: 'manager',
    approver_role_code: null,
    approver_user_id: null,
    approver_group_id: null,
    is_required: true,
    allow_delegate: false,
    parallel_group: null,
    candidate_resolution: 'shared_queue',
    auto_rule_enabled: false,
    auto_rule: {},
  }
}

export function reorderSteps(steps: ApprovalFlowStepInput[], fromIndex: number, toIndex: number): ApprovalFlowStepInput[] {
  const copy = [...steps]
  const [moved] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, moved)
  return copy.map((step, index) => ({ ...step, step_order: index + 1 }))
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Sin fecha'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function formatPendingMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours < 24) return remaining > 0 ? `${hours} h ${remaining} min` : `${hours} h`
  const days = Math.floor(hours / 24)
  const extraHours = hours % 24
  return extraHours > 0 ? `${days} d ${extraHours} h` : `${days} d`
}

export function getApproverDescriptor(
  step: Pick<ApprovalFlowStepInput, 'approver_type' | 'approver_role_code' | 'approver_user_id' | 'approver_group_id'>,
  context: ApprovalSetupContext | null,
): string {
  switch (step.approver_type) {
    case 'role':
      return step.approver_role_code || APPROVER_TYPE_LABELS.role
    case 'specific_user':
      return context?.users.find((user) => user.user_id === step.approver_user_id)?.full_name || 'Usuario especifico'
    case 'approver_group':
      return context?.groups.find((group) => group.id === step.approver_group_id)?.name || 'Grupo aprobador'
    default:
      return APPROVER_TYPE_LABELS[step.approver_type as ApproverType]
  }
}

export function getStepTone(step: Pick<ApprovalHistoryStep, 'status' | 'activated_at'>): 'good' | 'warn' | 'bad' | 'neutral' {
  if (step.status === 'aprobado') return 'good'
  if (step.status === 'rechazado') return 'bad'
  if (step.status === 'omitido') return 'neutral'
  return step.activated_at ? 'warn' : 'neutral'
}

export function getOverallStatusTone(status: ApprovalOverallStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'aprobado') return 'good'
  if (status === 'rechazado' || status === 'cancelado') return 'bad'
  if (status === 'en_aprobacion' || status === 'pendiente') return 'warn'
  return 'neutral'
}

export function getStepStatusTone(status: ApprovalStepStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'aprobado') return 'good'
  if (status === 'rechazado') return 'bad'
  if (status === 'pendiente') return 'warn'
  return 'neutral'
}
