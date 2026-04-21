import type { ApprovalFlowCode, ApprovalOverallStatus } from '@/features/approvals/types'

export type RequestKind =
  | 'attendance_justifications'
  | 'permission_requests'
  | 'loan_requests'
  | 'salary_advance_requests'
  | 'vacation_requests'

export interface EmployeeOption {
  employee_id: string
  employee_code: string | null
  full_name: string
}

export interface ActorProfile {
  user_id: string
  employee_id: string | null
  role: string | null
}

export interface BaseTransactionalRecord {
  id: string
  tenant_id: string
  employee_id: string
  request_status: ApprovalOverallStatus
  approval_request_id: string | null
  submitted_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

export type AttendanceJustificationType = 'late' | 'absence' | 'early_exit' | 'early_break'

export interface AttendanceJustificationRecord extends BaseTransactionalRecord {
  justification_type: AttendanceJustificationType
  work_date: string
  related_punch_id: string | null
  reason: string
  attachment_url: string | null
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface PermissionRequestRecord extends BaseTransactionalRecord {
  request_type: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  hours_requested: number | null
  reason: string
  attachment_url: string | null
}

export interface LoanRequestRecord extends BaseTransactionalRecord {
  amount_requested: number
  currency_code: string
  installments: number
  reason: string
}

export interface SalaryAdvanceRequestRecord extends BaseTransactionalRecord {
  amount_requested: number
  currency_code: string
  requested_pay_date: string | null
  reason: string
}

export interface VacationRequestRecord extends BaseTransactionalRecord {
  start_date: string
  end_date: string
  days_requested: number
  available_balance_days: number | null
  reason: string | null
}

export type TransactionalRequestRecord =
  | AttendanceJustificationRecord
  | PermissionRequestRecord
  | LoanRequestRecord
  | SalaryAdvanceRequestRecord
  | VacationRequestRecord

export interface RequestRecordMap {
  attendance_justifications: AttendanceJustificationRecord
  permission_requests: PermissionRequestRecord
  loan_requests: LoanRequestRecord
  salary_advance_requests: SalaryAdvanceRequestRecord
  vacation_requests: VacationRequestRecord
}

export interface AttendanceJustificationDraft {
  id?: string
  employee_id: string
  justification_type: AttendanceJustificationType
  work_date: string
  related_punch_id: string | null
  reason: string
  attachment_url: string | null
}

export interface PermissionRequestDraft {
  id?: string
  employee_id: string
  request_type: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  hours_requested: number | null
  reason: string
  attachment_url: string | null
}

export interface LoanRequestDraft {
  id?: string
  employee_id: string
  amount_requested: number | null
  currency_code: string
  installments: number
  reason: string
}

export interface SalaryAdvanceRequestDraft {
  id?: string
  employee_id: string
  amount_requested: number | null
  currency_code: string
  requested_pay_date: string | null
  reason: string
}

export interface VacationRequestDraft {
  id?: string
  employee_id: string
  start_date: string
  end_date: string
  days_requested: number
  available_balance_days: number | null
  reason: string
}

export type TransactionalRequestDraft =
  | AttendanceJustificationDraft
  | PermissionRequestDraft
  | LoanRequestDraft
  | SalaryAdvanceRequestDraft
  | VacationRequestDraft

export interface RequestDraftMap {
  attendance_justifications: AttendanceJustificationDraft
  permission_requests: PermissionRequestDraft
  loan_requests: LoanRequestDraft
  salary_advance_requests: SalaryAdvanceRequestDraft
  vacation_requests: VacationRequestDraft
}

export interface RequestPageConfig<K extends RequestKind, R extends TransactionalRequestRecord, D extends TransactionalRequestDraft> {
  kind: K
  route: string
  title: string
  subtitle: string
  createLabel: string
  resolveFlowCode: (draft: D) => ApprovalFlowCode
  buildEmptyDraft: (employeeId?: string | null) => D
  getSummary: (record: R) => string
  getMeta: (record: R) => string
}
