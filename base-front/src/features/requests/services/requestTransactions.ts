import { supabase } from '@/config/supabase'
import { submitApprovalRequest } from '@/features/approvals/services/approvalFlows'
import type { ApprovalFlowCode } from '@/features/approvals/types'
import { REQUEST_PAGE_CONFIGS } from '../config'
import type {
  ActorProfile,
  AttendanceJustificationDraft,
  AttendanceJustificationRecord,
  EmployeeOption,
  LoanRequestDraft,
  LoanRequestRecord,
  PermissionRequestDraft,
  PermissionRequestRecord,
  RequestDraftMap,
  RequestKind,
  RequestRecordMap,
  SalaryAdvanceRequestDraft,
  SalaryAdvanceRequestRecord,
  VacationRequestDraft,
  VacationRequestRecord,
} from '../types'

function ensure<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message)
  return value
}

export async function fetchEmployeeOptions(tenantId: string): Promise<EmployeeOption[]> {
  const viewQuery = await supabase
    .schema('public')
    .from('v_employees_full')
    .select('id, employee_code, first_name, last_name')
    .eq('tenant_id', tenantId)
    .order('first_name')

  if (!viewQuery.error && viewQuery.data) {
    return (viewQuery.data as Array<Record<string, unknown>>).map((row) => ({
      employee_id: String(row.id),
      employee_code: row.employee_code ? String(row.employee_code) : null,
      full_name: `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim(),
    }))
  }

  const fallbackQuery = await supabase
    .schema('public')
    .from('employees')
    .select('id, employee_code, first_name, last_name')
    .eq('tenant_id', tenantId)
    .order('first_name')

  if (fallbackQuery.error) throw fallbackQuery.error

  return (fallbackQuery.data as Array<Record<string, unknown>> | null ?? []).map((row) => ({
    employee_id: String(row.id),
    employee_code: row.employee_code ? String(row.employee_code) : null,
    full_name: `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim(),
  }))
}

export async function fetchActorProfile(userId: string): Promise<ActorProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, employee_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  return {
    user_id: userId,
    employee_id: data?.employee_id ?? null,
    role: data?.role ?? null,
  }
}

async function listTableRows<T>(table: RequestKind, orderColumn: string): Promise<T[]> {
  const { data, error } = await supabase
    .schema('attendance')
    .from(table as never)
    .select('*')
    .order(orderColumn, { ascending: false })

  if (error) throw error
  return (data ?? []) as T[]
}

export async function listTransactionalRequests<K extends RequestKind>(kind: K): Promise<RequestRecordMap[K][]> {
  switch (kind) {
    case 'attendance_justifications':
      return (await listTableRows<AttendanceJustificationRecord>('attendance_justifications', 'work_date')) as RequestRecordMap[K][]
    case 'permission_requests':
      return (await listTableRows<PermissionRequestRecord>('permission_requests', 'start_date')) as RequestRecordMap[K][]
    case 'loan_requests':
      return (await listTableRows<LoanRequestRecord>('loan_requests', 'created_at')) as RequestRecordMap[K][]
    case 'salary_advance_requests':
      return (await listTableRows<SalaryAdvanceRequestRecord>('salary_advance_requests', 'created_at')) as RequestRecordMap[K][]
    case 'vacation_requests':
      return (await listTableRows<VacationRequestRecord>('vacation_requests', 'start_date')) as RequestRecordMap[K][]
    default:
      throw new Error('Tipo de solicitud no soportado')
  }
}

type InsertPayloadMap = {
  attendance_justifications: Omit<AttendanceJustificationDraft, 'id'>
  permission_requests: Omit<PermissionRequestDraft, 'id'>
  loan_requests: Omit<LoanRequestDraft, 'id'>
  salary_advance_requests: Omit<SalaryAdvanceRequestDraft, 'id'>
  vacation_requests: Omit<VacationRequestDraft, 'id'>
}

async function insertOrUpdate<K extends RequestKind>(
  table: K,
  id: string | undefined,
  payload: InsertPayloadMap[K],
): Promise<string> {
  if (id) {
    const { data, error } = await supabase
      .schema('attendance')
      .from(table as never)
      .update(payload as never)
      .eq('id', id)
      .select('id')
      .single()

    if (error) throw error
    return ensure((data as { id?: string } | null)?.id, 'No se pudo actualizar el registro')
  }

  const { data, error } = await supabase
    .schema('attendance')
    .from(table as never)
    .insert(payload as never)
    .select('id')
    .single()

  if (error) throw error
  return ensure((data as { id?: string } | null)?.id, 'No se pudo crear el registro')
}

export async function saveTransactionalRequest<K extends RequestKind>(
  kind: K,
  draft: RequestDraftMap[K],
): Promise<string> {
  switch (kind) {
    case 'attendance_justifications': {
      const typedDraft = draft as AttendanceJustificationDraft
      return insertOrUpdate('attendance_justifications', typedDraft.id, {
        employee_id: typedDraft.employee_id,
        justification_type: typedDraft.justification_type,
        work_date: typedDraft.work_date,
        related_punch_id: typedDraft.related_punch_id,
        reason: typedDraft.reason.trim(),
        attachment_url: typedDraft.attachment_url?.trim() || null,
      })
    }
    case 'permission_requests': {
      const typedDraft = draft as PermissionRequestDraft
      return insertOrUpdate('permission_requests', typedDraft.id, {
        employee_id: typedDraft.employee_id,
        request_type: typedDraft.request_type.trim(),
        start_date: typedDraft.start_date,
        end_date: typedDraft.end_date,
        start_time: typedDraft.start_time,
        end_time: typedDraft.end_time,
        hours_requested: typedDraft.hours_requested,
        reason: typedDraft.reason.trim(),
        attachment_url: typedDraft.attachment_url?.trim() || null,
      })
    }
    case 'loan_requests': {
      const typedDraft = draft as LoanRequestDraft
      return insertOrUpdate('loan_requests', typedDraft.id, {
        employee_id: typedDraft.employee_id,
        amount_requested: ensure(typedDraft.amount_requested, 'El monto es obligatorio'),
        currency_code: typedDraft.currency_code.trim() || 'USD',
        installments: typedDraft.installments,
        reason: typedDraft.reason.trim(),
      })
    }
    case 'salary_advance_requests': {
      const typedDraft = draft as SalaryAdvanceRequestDraft
      return insertOrUpdate('salary_advance_requests', typedDraft.id, {
        employee_id: typedDraft.employee_id,
        amount_requested: ensure(typedDraft.amount_requested, 'El monto es obligatorio'),
        currency_code: typedDraft.currency_code.trim() || 'USD',
        requested_pay_date: typedDraft.requested_pay_date,
        reason: typedDraft.reason.trim(),
      })
    }
    case 'vacation_requests': {
      const typedDraft = draft as VacationRequestDraft
      return insertOrUpdate('vacation_requests', typedDraft.id, {
        employee_id: typedDraft.employee_id,
        start_date: typedDraft.start_date,
        end_date: typedDraft.end_date,
        days_requested: typedDraft.days_requested,
        available_balance_days: typedDraft.available_balance_days,
        reason: typedDraft.reason.trim(),
      })
    }
    default:
      throw new Error('Tipo de solicitud no soportado')
  }
}

export async function deleteTransactionalRequest(kind: RequestKind, id: string): Promise<void> {
  const { error } = await supabase
    .schema('attendance')
    .from(kind as never)
    .delete()
    .eq('id', id)

  if (error) throw error
}

function resolveFlowCode<K extends RequestKind>(kind: K, draft: RequestDraftMap[K]): ApprovalFlowCode {
  switch (kind) {
    case 'attendance_justifications':
      return REQUEST_PAGE_CONFIGS.attendance_justifications.resolveFlowCode(draft as AttendanceJustificationDraft)
    case 'permission_requests':
      return REQUEST_PAGE_CONFIGS.permission_requests.resolveFlowCode(draft as PermissionRequestDraft)
    case 'loan_requests':
      return REQUEST_PAGE_CONFIGS.loan_requests.resolveFlowCode(draft as LoanRequestDraft)
    case 'salary_advance_requests':
      return REQUEST_PAGE_CONFIGS.salary_advance_requests.resolveFlowCode(draft as SalaryAdvanceRequestDraft)
    case 'vacation_requests':
      return REQUEST_PAGE_CONFIGS.vacation_requests.resolveFlowCode(draft as VacationRequestDraft)
    default:
      throw new Error('Tipo de solicitud no soportado')
  }
}

export async function submitTransactionalRequest<K extends RequestKind>(
  kind: K,
  draft: RequestDraftMap[K],
  requestedByUserId: string,
  requestedByEmployeeId?: string | null,
): Promise<string> {
  const recordId = await saveTransactionalRequest(kind, draft)
  const flowCode = resolveFlowCode(kind, draft)

  return submitApprovalRequest({
    flow_code: flowCode,
    source_table: kind,
    source_record_id: recordId,
    requested_by_user_id: requestedByUserId,
    requested_by_employee_id: requestedByEmployeeId ?? null,
    metadata: {
      source: 'base-front',
      request_kind: kind,
    },
  })
}
