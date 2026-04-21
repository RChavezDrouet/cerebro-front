import { buildEmptyStep } from './utils'
import type { ApprovalFlowStepInput } from './types'

export type QuickApproverDraft = {
  step_order: number
  job_title: string
  email: string
}

export type QuickSetupResult = {
  level_count: number
  approvers: QuickApproverDraft[]
  steps: ApprovalFlowStepInput[]
}

const DEMO_APPROVERS: Array<{ jobTitle: string; email: string }> = [
  { jobTitle: 'Jefe inmediato', email: 'supervisor.operaciones@demo.hrcloud.ec' },
  { jobTitle: 'Gerente del area', email: 'gerencia.area@demo.hrcloud.ec' },
  { jobTitle: 'Responsable RRHH', email: 'rrhh@demo.hrcloud.ec' },
  { jobTitle: 'Responsable Nomina', email: 'nomina@demo.hrcloud.ec' },
]

export function buildQuickApproverSeed(levelCount: number): QuickApproverDraft[] {
  return Array.from({ length: Math.max(1, Math.min(levelCount, 4)) }, (_, index) => {
    const demo = DEMO_APPROVERS[index] ?? DEMO_APPROVERS[DEMO_APPROVERS.length - 1]
    return {
      step_order: index + 1,
      job_title: demo.jobTitle,
      email: demo.email,
    }
  })
}

export function buildQuickSetupResult(levels: QuickApproverDraft[]): QuickSetupResult {
  const normalizedLevels = levels
    .slice(0, 4)
    .map((level, index) => ({
      step_order: index + 1,
      job_title: level.job_title.trim() || DEMO_APPROVERS[index]?.jobTitle || `Nivel ${index + 1}`,
      email: level.email.trim() || DEMO_APPROVERS[index]?.email || '',
    }))

  const steps = normalizedLevels.map((level, index) => {
    const baseStep = buildEmptyStep(index + 1)

    if (index === 0) {
      return {
        ...baseStep,
        step_name: level.job_title || 'Jefe inmediato',
        approver_type: 'manager',
        candidate_resolution: 'first_available',
      } satisfies ApprovalFlowStepInput
    }

    if (index === 1) {
      return {
        ...baseStep,
        step_name: level.job_title,
        approver_type: 'manager_of_manager',
        candidate_resolution: 'first_available',
      } satisfies ApprovalFlowStepInput
    }

    if (index === 2) {
      return {
        ...baseStep,
        step_name: level.job_title,
        approver_type: 'hr_responsible',
        candidate_resolution: 'shared_queue',
      } satisfies ApprovalFlowStepInput
    }

    return {
      ...baseStep,
      step_name: level.job_title,
      approver_type: 'payroll_responsible',
      candidate_resolution: 'shared_queue',
    } satisfies ApprovalFlowStepInput
  })

  return {
    level_count: normalizedLevels.length,
    approvers: normalizedLevels,
    steps,
  }
}
