import { ATT_SCHEMA, supabase } from '@/config/supabase'
import type { ApprovalOverallStatus, ApprovalSetupContext, PendingApprovalItem } from '@/features/approvals/types'
import type {
  AttendanceJustificationRecord,
  LoanRequestRecord,
  PermissionRequestRecord,
  RequestKind,
  SalaryAdvanceRequestRecord,
  VacationRequestRecord,
} from '@/features/requests/types'
import { listTransactionalRequests } from '@/features/requests/services/requestTransactions'
import {
  buildDashboardKpis,
  buildEmployeeSummaries,
  DEFAULT_DASHBOARD_TIMEZONE,
  fetchCurrentOrgAssignments,
  fetchDailyAttendanceRows,
  fetchDashboardTimezone,
  fetchEmployeeRoster,
  fetchFineLedgerRows,
  fetchOvertimeRequestRows,
  fetchPermissionRequestRows,
  fetchTenantNoveltyRows,
  normalizeText,
  periodRange,
  type DashboardEmployeeSummary,
  type DashboardKpis,
  type DashboardPeriod,
  type OptionalDataset,
} from './hrDashboard'
import { fetchOrgLevelDefinitions, fetchOrgUnits, type OrgLevelDefinition, type OrgUnit } from '@/lib/orgStructure'

export type DashboardRequestRecord =
  | AttendanceJustificationRecord
  | PermissionRequestRecord
  | LoanRequestRecord
  | SalaryAdvanceRequestRecord
  | VacationRequestRecord

export type DashboardRequestRow = {
  id: string
  kind: RequestKind
  typeLabel: string
  employeeId: string
  requestStatus: ApprovalOverallStatus
  approvalRequestId: string | null
  createdAt: string
  submittedAt: string | null
  resolvedAt: string | null
  reason: string | null
  periodStart: string | null
  periodEnd: string | null
  daysRequested: number | null
  amountRequested: number | null
  currencyCode: string | null
}

export type FineLedgerDetailRow = {
  id: string
  employeeId: string | null
  incidentDate: string
  incidentType: string
  calculatedAmount: number
  appliedAmount: number
  wasCapped: boolean
  capExcess: number
  monthYear: string | null
}

export type ApprovalRequestDashboardRow = {
  id: string
  flowCode: string
  sourceTable: string
  sourceRecordId: string
  requestedByEmployeeId: string | null
  currentStepOrder: number | null
  overallStatus: ApprovalOverallStatus
  createdAt: string
  updatedAt: string
}

export type ApprovalRequestStepDashboardRow = {
  id: string
  approvalRequestId: string
  stepOrder: number
  stepName: string
  approverType: string
  assignedUserId: string | null
  assignedGroupId: string | null
  candidateUserIds: string[]
  status: string
  activatedAt: string | null
  actedAt: string | null
}

export type DashboardTimeContext = {
  timeZone: string
  from: string
  to: string
  today: string
  monthFrom: string
  monthTo: string
}

export type DashboardDataBundle = {
  time: DashboardTimeContext
  roster: Awaited<ReturnType<typeof fetchEmployeeRoster>>
  summaries: DashboardEmployeeSummary[]
  kpis: DashboardKpis
  dailyRows: Awaited<ReturnType<typeof fetchDailyAttendanceRows>>
  orgLevels: OrgLevelDefinition[]
  orgUnits: OrgUnit[]
  orgAssignments: Awaited<ReturnType<typeof fetchCurrentOrgAssignments>>
  requestDataset: OptionalDataset<DashboardRequestRow>
  fineDataset: OptionalDataset<FineLedgerDetailRow>
  approvalRequestsDataset: OptionalDataset<ApprovalRequestDashboardRow>
  approvalStepsDataset: OptionalDataset<ApprovalRequestStepDashboardRow>
  approvalSetupContext: ApprovalSetupContext | null
  myPendingApprovals: PendingApprovalItem[]
  flowNameByCode: Record<string, string>
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return [
      record.message,
      record.details,
      record.hint,
      record.code,
      record.error_description,
      record.error,
    ]
      .filter((value) => value != null && String(value).trim() !== '')
      .map((value) => String(value))
      .join(' | ')
  }
  return String(error ?? '')
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const record = error as Record<string, unknown>
  const raw = record.status ?? record.statusCode
  return typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null
}

function errorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const record = error as Record<string, unknown>
  return String(record.code ?? '').trim().toUpperCase()
}

function isMissingEntityError(error: unknown, entityName: string) {
  const message = errorMessage(error).toLowerCase()
  const status = errorStatus(error)
  const code = errorCode(error)
  const normalizedEntity = entityName.toLowerCase()

  return (
    status === 404 ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42883' ||
    code === '42703' ||
    message.includes(normalizedEntity) ||
    message.includes('could not find the table') ||
    message.includes('could not find the function') ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('undefined column')
  )
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function getDatePartsInTimeZone(timeZone: string, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return {
    year,
    month,
    day,
    iso: `${year}-${pad(month)}-${pad(day)}`,
  }
}

function buildMonthRange(timeZone: string) {
  const parts =
    getDatePartsInTimeZone(timeZone) ??
    getDatePartsInTimeZone(DEFAULT_DASHBOARD_TIMEZONE) ??
    getDatePartsInTimeZone('UTC')

  const year = parts?.year ?? new Date().getFullYear()
  const month = parts?.month ?? new Date().getMonth() + 1
  return {
    today: parts?.iso ?? new Date().toISOString().slice(0, 10),
    monthFrom: `${year}-${pad(month)}-01`,
    monthTo: `${year}-${pad(month)}-31`,
  }
}

function toIsoDate(value: unknown) {
  if (!value) return null

  const text = String(value).trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString().slice(0, 10)
}

function dateWithinRange(value: string | null, from: string, to: string) {
  if (!value) return false
  return value >= from && value <= to
}

function rangeOverlapsRange(start: string | null, end: string | null, from: string, to: string) {
  const resolvedStart = start ?? end
  const resolvedEnd = end ?? start
  if (!resolvedStart && !resolvedEnd) return false
  const left = resolvedStart ?? resolvedEnd!
  const right = resolvedEnd ?? resolvedStart!
  return left <= to && right >= from
}

function kindLabel(kind: RequestKind) {
  switch (kind) {
    case 'attendance_justifications':
      return 'Justificaciones'
    case 'permission_requests':
      return 'Permisos'
    case 'loan_requests':
      return 'Prestamos'
    case 'salary_advance_requests':
      return 'Adelantos'
    case 'vacation_requests':
      return 'Vacaciones'
    default:
      return kind
  }
}

function buildRequestTypeLabel(kind: RequestKind, record: DashboardRequestRecord) {
  if (kind === 'attendance_justifications') {
    const typed = record as AttendanceJustificationRecord
    const normalized = normalizeText(typed.justification_type)

    if (normalized === 'LATE') return 'Justificacion de atraso'
    if (normalized === 'ABSENCE') return 'Justificacion de falta'
    if (normalized === 'EARLY_EXIT') return 'Justificacion de salida anticipada'
    if (normalized === 'EARLY_BREAK') return 'Justificacion de break anticipado'
  }

  if (kind === 'permission_requests') {
    const typed = record as PermissionRequestRecord
    return typed.request_type ? `Permiso - ${typed.request_type}` : 'Permiso'
  }

  return kindLabel(kind)
}

function mapRequestRecord(kind: RequestKind, record: DashboardRequestRecord): DashboardRequestRow {
  if (kind === 'attendance_justifications') {
    const typed = record as AttendanceJustificationRecord
    return {
      id: typed.id,
      kind,
      typeLabel: buildRequestTypeLabel(kind, typed),
      employeeId: typed.employee_id,
      requestStatus: typed.request_status,
      approvalRequestId: typed.approval_request_id,
      createdAt: typed.created_at,
      submittedAt: typed.submitted_at,
      resolvedAt: typed.resolved_at,
      reason: typed.reason,
      periodStart: typed.work_date,
      periodEnd: typed.work_date,
      daysRequested: null,
      amountRequested: null,
      currencyCode: null,
    }
  }

  if (kind === 'permission_requests') {
    const typed = record as PermissionRequestRecord
    return {
      id: typed.id,
      kind,
      typeLabel: buildRequestTypeLabel(kind, typed),
      employeeId: typed.employee_id,
      requestStatus: typed.request_status,
      approvalRequestId: typed.approval_request_id,
      createdAt: typed.created_at,
      submittedAt: typed.submitted_at,
      resolvedAt: typed.resolved_at,
      reason: typed.reason,
      periodStart: typed.start_date,
      periodEnd: typed.end_date,
      daysRequested: null,
      amountRequested: typed.hours_requested,
      currencyCode: null,
    }
  }

  if (kind === 'loan_requests') {
    const typed = record as LoanRequestRecord
    return {
      id: typed.id,
      kind,
      typeLabel: 'Prestamo',
      employeeId: typed.employee_id,
      requestStatus: typed.request_status,
      approvalRequestId: typed.approval_request_id,
      createdAt: typed.created_at,
      submittedAt: typed.submitted_at,
      resolvedAt: typed.resolved_at,
      reason: typed.reason,
      periodStart: toIsoDate(typed.created_at),
      periodEnd: toIsoDate(typed.created_at),
      daysRequested: null,
      amountRequested: typed.amount_requested,
      currencyCode: typed.currency_code,
    }
  }

  if (kind === 'salary_advance_requests') {
    const typed = record as SalaryAdvanceRequestRecord
    return {
      id: typed.id,
      kind,
      typeLabel: 'Adelanto',
      employeeId: typed.employee_id,
      requestStatus: typed.request_status,
      approvalRequestId: typed.approval_request_id,
      createdAt: typed.created_at,
      submittedAt: typed.submitted_at,
      resolvedAt: typed.resolved_at,
      reason: typed.reason,
      periodStart: typed.requested_pay_date ?? toIsoDate(typed.created_at),
      periodEnd: typed.requested_pay_date ?? toIsoDate(typed.created_at),
      daysRequested: null,
      amountRequested: typed.amount_requested,
      currencyCode: typed.currency_code,
    }
  }

  const typed = record as VacationRequestRecord
  return {
    id: typed.id,
    kind,
    typeLabel: 'Vacaciones',
    employeeId: typed.employee_id,
    requestStatus: typed.request_status,
    approvalRequestId: typed.approval_request_id,
    createdAt: typed.created_at,
    submittedAt: typed.submitted_at,
    resolvedAt: typed.resolved_at,
    reason: typed.reason,
    periodStart: typed.start_date,
    periodEnd: typed.end_date,
    daysRequested: typed.days_requested,
    amountRequested: typed.available_balance_days,
    currencyCode: null,
  }
}

async function fetchRequestKindRows(kind: RequestKind) {
  try {
    const rows = await listTransactionalRequests(kind)
    return {
      rows: rows.map((record) => mapRequestRecord(kind, record as DashboardRequestRecord)),
      unavailable: false,
    } satisfies OptionalDataset<DashboardRequestRow>
  } catch (error) {
    if (isMissingEntityError(error, kind)) {
      return {
        rows: [],
        unavailable: true,
      } satisfies OptionalDataset<DashboardRequestRow>
    }

    throw error
  }
}

async function fetchTransactionalRequestRows(): Promise<OptionalDataset<DashboardRequestRow>> {
  const results = await Promise.allSettled([
    fetchRequestKindRows('attendance_justifications'),
    fetchRequestKindRows('permission_requests'),
    fetchRequestKindRows('loan_requests'),
    fetchRequestKindRows('salary_advance_requests'),
    fetchRequestKindRows('vacation_requests'),
  ])

  const datasets = results.map((result) =>
    result.status === 'fulfilled'
      ? result.value
      : ({
          rows: [],
          unavailable: true,
        } satisfies OptionalDataset<DashboardRequestRow>),
  )

  return {
    rows: datasets.flatMap((dataset) => dataset.rows),
    unavailable: datasets.every((dataset) => dataset.unavailable),
  }
}

function unavailableDataset<T>(): OptionalDataset<T> {
  return {
    rows: [],
    unavailable: true,
  }
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === 'fulfilled' ? result.value : fallback
}

async function fetchFineLedgerDetails(tenantId: string): Promise<OptionalDataset<FineLedgerDetailRow>> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('fine_ledger')
    .select('id, employee_id, incident_date, incident_type, calculated_amount, applied_amount, was_capped, cap_excess, month_year')
    .eq('tenant_id', tenantId)
    .order('incident_date', { ascending: false })

  if (error) {
    if (isMissingEntityError(error, 'fine_ledger')) {
      return {
        rows: [],
        unavailable: true,
      }
    }

    throw error
  }

  return {
    rows: ((data ?? []) as Array<{
      id: string
      employee_id: string | null
      incident_date: string
      incident_type: string
      calculated_amount: number | null
      applied_amount: number | null
      was_capped: boolean | null
      cap_excess: number | null
      month_year: string | null
    }>).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      incidentDate: row.incident_date,
      incidentType: row.incident_type,
      calculatedAmount: Number(row.calculated_amount ?? 0),
      appliedAmount: Number(row.applied_amount ?? 0),
      wasCapped: Boolean(row.was_capped),
      capExcess: Number(row.cap_excess ?? 0),
      monthYear: row.month_year ?? null,
    })),
    unavailable: false,
  }
}

async function fetchApprovalRequests(tenantId: string): Promise<OptionalDataset<ApprovalRequestDashboardRow>> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('approval_requests')
    .select('id, flow_code, source_table, source_record_id, requested_by_employee_id, current_step_order, overall_status, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingEntityError(error, 'approval_requests')) {
      return {
        rows: [],
        unavailable: true,
      }
    }

    return {
      rows: [],
      unavailable: true,
    }
  }

  return {
    rows: ((data ?? []) as Array<{
      id: string
      flow_code: string
      source_table: string
      source_record_id: string
      requested_by_employee_id: string | null
      current_step_order: number | null
      overall_status: ApprovalOverallStatus
      created_at: string
      updated_at: string
    }>).map((row) => ({
      id: row.id,
      flowCode: row.flow_code,
      sourceTable: row.source_table,
      sourceRecordId: row.source_record_id,
      requestedByEmployeeId: row.requested_by_employee_id,
      currentStepOrder: row.current_step_order,
      overallStatus: row.overall_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    unavailable: false,
  }
}

async function fetchApprovalSteps(tenantId: string): Promise<OptionalDataset<ApprovalRequestStepDashboardRow>> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('approval_request_steps')
    .select('id, approval_request_id, step_order, step_name, approver_type, assigned_user_id, assigned_group_id, candidate_user_ids, status, activated_at, acted_at')
    .eq('tenant_id', tenantId)
    .order('approval_request_id', { ascending: false })

  if (error) {
    if (isMissingEntityError(error, 'approval_request_steps')) {
      return {
        rows: [],
        unavailable: true,
      }
    }

    return {
      rows: [],
      unavailable: true,
    }
  }

  return {
    rows: ((data ?? []) as Array<{
      id: string
      approval_request_id: string
      step_order: number
      step_name: string
      approver_type: string
      assigned_user_id: string | null
      assigned_group_id: string | null
      candidate_user_ids: string[] | null
      status: string
      activated_at: string | null
      acted_at: string | null
    }>).map((row) => ({
      id: row.id,
      approvalRequestId: row.approval_request_id,
      stepOrder: row.step_order,
      stepName: row.step_name,
      approverType: row.approver_type,
      assignedUserId: row.assigned_user_id,
      assignedGroupId: row.assigned_group_id,
      candidateUserIds: row.candidate_user_ids ?? [],
      status: row.status,
      activatedAt: row.activated_at,
      actedAt: row.acted_at,
    })),
    unavailable: false,
  }
}

async function fetchApprovalSetupContext() {
  const { data, error } = await supabase.schema(ATT_SCHEMA).rpc('rpc_get_approval_setup_context')

  if (error || data == null) {
    return null
  }

  return data as ApprovalSetupContext
}

async function fetchMyPendingApprovals() {
  const { data, error } = await supabase.schema(ATT_SCHEMA).rpc('rpc_get_pending_approvals')

  if (error) {
    if (isMissingEntityError(error, 'rpc_get_pending_approvals')) {
      return [] as PendingApprovalItem[]
    }

    return [] as PendingApprovalItem[]
  }

  return ((data ?? []) as PendingApprovalItem[]) ?? []
}

async function fetchFlowNameMap() {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('approval_flow_catalog')
    .select('flow_code, flow_name')
    .eq('is_active', true)

  if (error) return {}

  return ((data ?? []) as Array<{ flow_code: string; flow_name: string }>).reduce<Record<string, string>>(
    (acc, row) => {
      acc[row.flow_code] = row.flow_name
      return acc
    },
    {},
  )
}

export function isRequestInRange(row: DashboardRequestRow, from: string, to: string) {
  if (row.kind === 'loan_requests' || row.kind === 'salary_advance_requests') {
    return dateWithinRange(toIsoDate(row.createdAt), from, to)
  }

  return (
    rangeOverlapsRange(row.periodStart, row.periodEnd, from, to) ||
    dateWithinRange(row.periodStart, from, to) ||
    dateWithinRange(row.periodEnd, from, to)
  )
}

export function isRequestInMonth(row: DashboardRequestRow, monthFrom: string, monthTo: string) {
  return isRequestInRange(row, monthFrom, monthTo)
}

export async function loadDashboardData(tenantId: string, period: DashboardPeriod): Promise<DashboardDataBundle> {
  const timeZone = await fetchDashboardTimezone(tenantId).catch(() => DEFAULT_DASHBOARD_TIMEZONE)
  const { from, to } = periodRange(period, timeZone)
  const { today, monthFrom, monthTo } = buildMonthRange(timeZone)

  const [
    roster,
    dailyRows,
    orgLevels,
    orgUnits,
    orgAssignments,
  ] = await Promise.all([
    fetchEmployeeRoster(tenantId),
    fetchDailyAttendanceRows(tenantId, from, to),
    fetchOrgLevelDefinitions(tenantId),
    fetchOrgUnits(tenantId),
    fetchCurrentOrgAssignments(tenantId),
  ])

  const optionalResults = await Promise.allSettled([
    fetchTenantNoveltyRows(tenantId, from, to),
    fetchPermissionRequestRows(tenantId, from, to),
    fetchOvertimeRequestRows(tenantId, from, to),
    fetchFineLedgerRows(tenantId, from, to),
    fetchTransactionalRequestRows(),
    fetchFineLedgerDetails(tenantId),
    fetchApprovalRequests(tenantId),
    fetchApprovalSteps(tenantId),
    fetchApprovalSetupContext(),
    fetchMyPendingApprovals(),
    fetchFlowNameMap(),
  ])

  const noveltyDataset = settledValue(optionalResults[0], unavailableDataset<Awaited<ReturnType<typeof fetchTenantNoveltyRows>>['rows'][number]>())
  const permissionDataset = settledValue(optionalResults[1], unavailableDataset<Awaited<ReturnType<typeof fetchPermissionRequestRows>>['rows'][number]>())
  const overtimeDataset = settledValue(optionalResults[2], unavailableDataset<Awaited<ReturnType<typeof fetchOvertimeRequestRows>>['rows'][number]>())
  const fineSummaryDataset = settledValue(optionalResults[3], unavailableDataset<Awaited<ReturnType<typeof fetchFineLedgerRows>>['rows'][number]>())
  const requestDataset = settledValue(optionalResults[4], unavailableDataset<DashboardRequestRow>())
  const fineDataset = settledValue(optionalResults[5], unavailableDataset<FineLedgerDetailRow>())
  const approvalRequestsDataset = settledValue(optionalResults[6], unavailableDataset<ApprovalRequestDashboardRow>())
  const approvalStepsDataset = settledValue(optionalResults[7], unavailableDataset<ApprovalRequestStepDashboardRow>())
  const approvalSetupContext = settledValue(optionalResults[8], null)
  const myPendingApprovals = settledValue(optionalResults[9], [] as PendingApprovalItem[])
  const flowNameByCode = settledValue(optionalResults[10], {} as Record<string, string>)

  const summaries = buildEmployeeSummaries({
    roster,
    dailyRows,
    noveltyRows: noveltyDataset.rows,
    permissionRows: permissionDataset.rows,
    overtimeRows: overtimeDataset.rows,
    fineRows: fineSummaryDataset.rows,
  })

  return {
    time: {
      timeZone,
      from,
      to,
      today,
      monthFrom,
      monthTo,
    },
    roster,
    summaries,
    kpis: buildDashboardKpis(summaries),
    dailyRows,
    orgLevels,
    orgUnits,
    orgAssignments,
    requestDataset,
    fineDataset,
    approvalRequestsDataset,
    approvalStepsDataset,
    approvalSetupContext,
    myPendingApprovals,
    flowNameByCode,
  }
}
