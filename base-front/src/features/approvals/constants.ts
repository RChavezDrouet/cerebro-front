import type {
  ApproverType,
  ApprovalOverallStatus,
  ApprovalStepStatus,
  CandidateResolution,
  FlowExecutionMode,
} from './types'

export const APPROVER_TYPE_OPTIONS: Array<{ value: ApproverType; label: string }> = [
  { value: 'manager', label: 'Jefe inmediato' },
  { value: 'manager_of_manager', label: 'Jefe del jefe' },
  { value: 'hr_responsible', label: 'Responsable RRHH' },
  { value: 'payroll_responsible', label: 'Responsable Nomina' },
  { value: 'role', label: 'Rol del sistema' },
  { value: 'specific_user', label: 'Usuario especifico' },
  { value: 'approver_group', label: 'Grupo aprobador' },
]

export const APPROVER_TYPE_LABELS: Record<ApproverType, string> = {
  role: 'Rol',
  manager: 'Jefe inmediato',
  manager_of_manager: 'Jefe del jefe',
  hr_responsible: 'RRHH',
  payroll_responsible: 'Nomina',
  specific_user: 'Usuario especifico',
  approver_group: 'Grupo aprobador',
}

export const EXECUTION_MODE_OPTIONS: Array<{ value: FlowExecutionMode; label: string }> = [
  { value: 'sequential', label: 'Secuencial' },
  { value: 'parallel', label: 'Paralela' },
]

export const CANDIDATE_RESOLUTION_OPTIONS: Array<{ value: CandidateResolution; label: string }> = [
  { value: 'shared_queue', label: 'Bandeja compartida' },
  { value: 'first_available', label: 'Primer usuario' },
]

export const APPROVAL_STATUS_LABELS: Record<ApprovalOverallStatus, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  en_aprobacion: 'En aprobacion',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
}

export const STEP_STATUS_LABELS: Record<ApprovalStepStatus, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  omitido: 'Omitido',
}

export const GROUP_KIND_OPTIONS = [
  { value: 'generic', label: 'Generico' },
  { value: 'hr_responsible', label: 'Grupo RRHH' },
  { value: 'payroll_responsible', label: 'Grupo Nomina' },
] as const
