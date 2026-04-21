import { supabase, ATT_SCHEMA } from '@/config/supabase'

export type DashboardPeriod = 'hoy' | 'semana' | 'mes' | 'trimestre'
export type DashboardMetricKey = 'late' | 'absence' | 'permission' | 'fine' | 'overtime'

export type OptionalDataset<T> = {
  rows: T[]
  unavailable: boolean
}

export type EmployeeRosterRow = {
  id: string
  employeeCode: string | null
  fullName: string
  employmentStatus: string | null
  attendanceStatus: string | null
  departmentName: string | null
}

export type DailyAttendanceRow = {
  work_date: string
  employee_id: string | null
  employee_code: string | null
  employee_name: string
  department_name: string | null
  schedule_name?: string | null
  turn_name?: string | null
  entry_at?: string | null
  exit_at?: string | null
  entry_status?: string | null
  exit_status?: string | null
  day_status: string | null
  novelty: string | null
  employee_active?: boolean | null
  employee_status?: string | null
}

export type TenantNoveltyRow = {
  employee_id: string
  employee_code: string | null
  employee_name: string
  department_name: string | null
  work_date: string
  day_status: string | null
  novelty: string | null
  decision_status: 'pending' | 'justified' | 'rejected' | null
}

export type PermissionRequestRow = {
  employeeId: string
  status: 'approved' | 'pending' | 'rejected'
  requestLabel: string
  rangeStart: string | null
  rangeEnd: string | null
}

export type OvertimeRequestRow = {
  employee_id: string | null
  requested_date: string
  hours_requested: number | null
  status: string | null
}

export type FineLedgerRow = {
  employee_id: string | null
  incident_date: string
  applied_amount: number | null
}

export type OrgAssignmentRow = {
  employee_id: string
  org_unit_id: string | null
}

export type DashboardEmployeeSummary = {
  employeeId: string
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  employmentStatus: string | null
  attendanceStatus: string | null
  isActiveCollaborator: boolean
  expectedDays: number
  presenceCount: number
  onTimeCount: number
  lateCount: number
  absenceCount: number
  justifiedAbsenceCount: number
  unjustifiedAbsenceCount: number
  pendingAbsenceCount: number
  permissionTotal: number
  permissionApproved: number
  permissionPending: number
  permissionRejected: number
  fineAmount: number
  fineCount: number
  approvedOvertimeHours: number
  noveltyCount: number
  journeyLabel: string
  journeySource: 'turn' | 'schedule' | 'unknown'
}

export type JourneyMetricDatum = {
  label: string
  value: number
  employees: number
  metricKey: DashboardMetricKey
}

export type DashboardPulsePoint = {
  date: string
  label: string
  late: number
  absence: number
  presence: number
  novelty: number
}

export type DashboardPunchSourceRow = {
  work_date: string
  employee_id: string
  sources: string[] | null
  biometric_methods?: string[] | null
  biometric_verify_types?: string[] | null
  serial_nos?: string[] | null
}

export type DashboardAttendanceChannelPoint = {
  date: string
  label: string
  facial: number
  fingerprint: number
  code: number
  web: number
  onsite: number
  remote: number
}

export type DashboardKpis = {
  totalCollaborators: number
  punctualityPct: number
  absenteeismPct: number
  totalAbsence: number
  totalLate: number
  totalPermissions: number
  totalFinesAmount: number
  totalFinesCount: number
  approvedOvertimeHours: number
  presentismPct: number
  totalNovelty: number
}

type GenericRow = Record<string, unknown>

export const DEFAULT_DASHBOARD_TIMEZONE = 'America/Guayaquil'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function isoDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
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

  const year = get('year')
  const month = get('month')
  const day = get('day')

  if (!year || !month || !day) {
    return null
  }

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    iso: `${year}-${month}-${day}`,
  }
}

function createDateFromIsoAtNoon(iso: string) {
  return new Date(`${iso}T12:00:00Z`)
}

function addDaysToIso(iso: string, amount: number) {
  const next = createDateFromIsoAtNoon(iso)
  next.setUTCDate(next.getUTCDate() + amount)
  return isoDate(next)
}

export function periodRange(period: DashboardPeriod, timeZone = DEFAULT_DASHBOARD_TIMEZONE) {
  const zonedNow = getDatePartsInTimeZone(timeZone) ?? getDatePartsInTimeZone(DEFAULT_DASHBOARD_TIMEZONE) ?? getDatePartsInTimeZone('UTC')

  const today = zonedNow?.iso ?? isoDate(new Date())
  const todayMonth = zonedNow?.month ?? new Date().getMonth() + 1
  const todayYear = zonedNow?.year ?? new Date().getFullYear()
  const to = today

  if (period === 'hoy') return { from: to, to }

  if (period === 'semana') {
    const mondayBase = createDateFromIsoAtNoon(today)
    const offset = mondayBase.getUTCDay() === 0 ? 6 : mondayBase.getUTCDay() - 1
    return { from: addDaysToIso(today, -offset), to }
  }

  if (period === 'mes') {
    return { from: `${todayYear}-${pad(todayMonth)}-01`, to }
  }

  const quarterStartMonth = Math.floor((todayMonth - 1) / 3) * 3 + 1
  return { from: `${todayYear}-${pad(quarterStartMonth)}-01`, to }
}

export async function fetchDashboardTimezone(tenantId: string): Promise<string> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('attendance_rules_v2')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    if (isMissingEntityError(error, 'attendance_rules_v2')) {
      return DEFAULT_DASHBOARD_TIMEZONE
    }
    throw error
  }

  const timezone = String((data as GenericRow | null)?.timezone ?? '').trim()
  return timezone || DEFAULT_DASHBOARD_TIMEZONE
}

export function formatDateLabel(value: string, timeZone = DEFAULT_DASHBOARD_TIMEZONE) {
  if (!value) return 'N/A'
  try {
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone,
    }).format(new Date(`${value}T00:00:00`))
  } catch {
    return value
  }
}

export function formatPeriodLabel(from: string, to: string, timeZone = DEFAULT_DASHBOARD_TIMEZONE) {
  if (from === to) return formatDateLabel(from, timeZone)
  return `${formatDateLabel(from, timeZone)} - ${formatDateLabel(to, timeZone)}`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

export function formatHours(value: number) {
  return `${formatNumber(value)} h`
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function normalizeText(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
}

function includesAny(base: string, tokens: string[]) {
  return tokens.some((token) => base.includes(token))
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

function toIsoDateFromUnknown(value: unknown) {
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

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const timeZoneName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i)

  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3] ?? 0)
  return sign * (hours * 60 + minutes)
}

function buildEcDayBoundary(dateIso: string, endOfDay = false, timeZone = DEFAULT_DASHBOARD_TIMEZONE) {
  const [year, month, day] = dateIso.split('-').map((value) => Number(value))
  if (!year || !month || !day) return new Date(`${dateIso}T12:00:00Z`).toISOString()

  const localHour = endOfDay ? 23 : 0
  const localMinute = endOfDay ? 59 : 0
  const localSecond = endOfDay ? 59 : 0
  const approximateUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const offsetMinutes = getTimeZoneOffsetMinutes(approximateUtc, timeZone)
  const utcMillis = Date.UTC(year, month - 1, day, localHour, localMinute, localSecond) - (offsetMinutes * 60_000)
  return new Date(utcMillis).toISOString()
}

function normalizeBiometricMethodLabel(method: string) {
  const value = normalizeText(method)
  if (!value) return ''

  if (
    value === '1' ||
    value === 'FP' ||
    value.includes('HUELLA') ||
    value.includes('FINGER') ||
    value.includes('FINGERPRINT') ||
    value.includes('HUELLA_DACTILAR')
  ) {
    return 'Huella'
  }

  if (
    value === '15' ||
    value.includes('FACIAL') ||
    value.includes('FACE') ||
    value.includes('RECONOCIMIENTO_FACIAL') ||
    value.includes('ROSTRO')
  ) {
    return 'Facial'
  }

  if (
    value === '3' ||
    value.includes('CODIGO') ||
    value.includes('PASSWORD') ||
    value.includes('PIN') ||
    value.includes('CLAVE')
  ) {
    return 'Codigo'
  }

  return method
}

function extractPunchMethod(raw: GenericRow) {
  const meta = typeof raw.meta === 'object' && raw.meta !== null ? (raw.meta as GenericRow) : null

  const candidate =
    raw.biometric_method ??
    raw.verify_type ??
    meta?.biometric_method ??
    meta?.biometricMethod ??
    meta?.verify_type ??
    meta?.verifyType

  return candidate ? normalizeBiometricMethodLabel(String(candidate)) : ''
}

function buildPunchSourceRowsFromPunches(
  punches: Array<{
    employee_id: string | null
    punched_at: string
    source: string | null
    serial_no?: string | null
    meta?: GenericRow | null
    biometric_method?: string | null
    verify_type?: string | null
  }>,
) {
  const grouped = new Map<string, {
    work_date: string
    employee_id: string
    sources: Set<string>
    methods: Set<string>
    serials: Set<string>
  }>()

  for (const punch of punches) {
    if (!punch.employee_id) continue

    const workDate = toIsoDateFromUnknown(punch.punched_at)
    if (!workDate) continue

    const key = `${workDate}::${punch.employee_id}`
    const current = grouped.get(key) ?? {
      work_date: workDate,
      employee_id: punch.employee_id,
      sources: new Set<string>(),
      methods: new Set<string>(),
      serials: new Set<string>(),
    }

    const source = String(punch.source ?? '').trim()
    if (source) current.sources.add(source)

    const method = extractPunchMethod(punch as unknown as GenericRow)
    if (method) current.methods.add(method)

    const serial = String(punch.serial_no ?? '').trim()
    if (serial) current.serials.add(serial)

    grouped.set(key, current)
  }

  return Array.from(grouped.values()).map<DashboardPunchSourceRow>((row) => ({
    work_date: row.work_date,
    employee_id: row.employee_id,
    sources: row.sources.size ? Array.from(row.sources) : null,
    biometric_methods: row.methods.size ? Array.from(row.methods) : null,
    biometric_verify_types: null,
    serial_nos: row.serials.size ? Array.from(row.serials) : null,
  }))
}

function normalizeRosterStatus(value: string | null | undefined) {
  const status = normalizeText(value)
  return status || null
}

function isActiveCollaborator(row: EmployeeRosterRow) {
  const employmentStatus = normalizeRosterStatus(row.employmentStatus)
  const attendanceStatus = normalizeRosterStatus(row.attendanceStatus)

  if (includesAny(employmentStatus ?? '', ['INACTIVE', 'TERMINATED', 'RETIRED', 'DISMISSED'])) return false
  if (includesAny(attendanceStatus ?? '', ['INACTIVE', 'TERMINATED'])) return false

  return true
}

function isAttendanceExpected(row: DailyAttendanceRow) {
  if (row.employee_active === false) return false

  const status = normalizeText(row.employee_status)
  if (includesAny(status, ['VACATION', 'VACACIONES', 'LEAVE', 'PERMISO', 'INACTIVE', 'TERMINATED'])) return false

  return true
}

function isLateRow(row: DailyAttendanceRow) {
  return includesAny(normalizeText(row.day_status), ['ATRAS'])
}

function isOnTimeRow(row: DailyAttendanceRow) {
  return includesAny(normalizeText(row.day_status), ['A_TIEM', 'ATIEM'])
}

function isAbsenceRow(row: DailyAttendanceRow) {
  const combined = normalizeText(`${row.day_status ?? ''} ${row.novelty ?? ''}`)
  if (includesAny(combined, ['AUSEN', 'INASIST'])) return true
  return isAttendanceExpected(row) && !row.entry_at && !row.exit_at
}

function isNoveltyRow(row: DailyAttendanceRow) {
  const combined = normalizeText(`${row.day_status ?? ''} ${row.novelty ?? ''}`)
  return Boolean(String(row.novelty ?? '').trim()) || includesAny(combined, ['NOVE', 'AUSEN', 'INCONS'])
}

function isPresenceRow(row: DailyAttendanceRow) {
  if (!isAttendanceExpected(row)) return false
  if (isAbsenceRow(row)) return false
  if (row.entry_at || row.exit_at) return true
  return includesAny(normalizeText(row.day_status), ['A_TIEM', 'ATRAS', 'ANTIC'])
}

function isAbsenceNovelty(row: TenantNoveltyRow) {
  return includesAny(normalizeText(`${row.day_status ?? ''} ${row.novelty ?? ''}`), ['AUSEN', 'INASIST'])
}

function resolveJourneyLabel(summary: DashboardEmployeeSummary) {
  return summary.journeyLabel || 'Sin jornada'
}

function getMetricValue(summary: DashboardEmployeeSummary, metricKey: DashboardMetricKey) {
  switch (metricKey) {
    case 'late':
      return summary.lateCount
    case 'absence':
      return summary.absenceCount
    case 'permission':
      return summary.permissionTotal
    case 'fine':
      return summary.fineAmount
    case 'overtime':
      return summary.approvedOvertimeHours
    default:
      return 0
  }
}

async function fetchEmployeesFallback(tenantId: string): Promise<EmployeeRosterRow[]> {
  const attendanceEmployees = await supabase
    .schema(ATT_SCHEMA)
    .from('employees')
    .select('id, employee_code, first_name, last_name, status')
    .eq('tenant_id', tenantId)
    .order('first_name')

  if (!attendanceEmployees.error && attendanceEmployees.data) {
    return (attendanceEmployees.data as Array<{
      id: string
      employee_code: string | null
      first_name: string | null
      last_name: string | null
      status: string | null
    }>).map((row) => ({
      id: row.id,
      employeeCode: row.employee_code ?? null,
      fullName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
      employmentStatus: null,
      attendanceStatus: row.status ?? null,
      departmentName: null,
    }))
  }

  const { data, error } = await supabase
    .schema('public')
    .from('employees')
    .select('id, employee_number, first_name, last_name, employment_status, department_id')
    .eq('tenant_id', tenantId)
    .order('first_name')

  if (error) throw error

  return ((data ?? []) as Array<{
    id: string
    employee_number: string | null
    first_name: string | null
    last_name: string | null
    employment_status: string | null
  }>).map((row) => ({
    id: row.id,
    employeeCode: row.employee_number ?? null,
    fullName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
    employmentStatus: row.employment_status ?? null,
    attendanceStatus: null,
    departmentName: null,
  }))
}

export async function fetchEmployeeRoster(tenantId: string): Promise<EmployeeRosterRow[]> {
  const rosterView = await supabase
    .schema('public')
    .from('v_employees_full')
    .select('id, employee_code, first_name, last_name, employment_status, attendance_status, department_name')
    .eq('tenant_id', tenantId)
    .order('first_name')

  if (!rosterView.error && rosterView.data) {
    return (rosterView.data as Array<{
      id: string
      employee_code: string | null
      first_name: string | null
      last_name: string | null
      employment_status: string | null
      attendance_status: string | null
      department_name: string | null
    }>).map((row) => ({
      id: row.id,
      employeeCode: row.employee_code ?? null,
      fullName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
      employmentStatus: row.employment_status ?? null,
      attendanceStatus: row.attendance_status ?? null,
      departmentName: row.department_name ?? null,
    }))
  }

  return fetchEmployeesFallback(tenantId)
}

export async function fetchDailyAttendanceRows(tenantId: string, from: string, to: string): Promise<DailyAttendanceRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_daily_attendance_report_v2', {
      p_tenant_id: tenantId,
      p_date_from: from,
      p_date_to: to,
    })

  if (error) throw error
  return (data ?? []) as DailyAttendanceRow[]
}

export async function fetchPunchSourceRows(
  tenantId: string,
  from: string,
  to: string,
  timeZone = DEFAULT_DASHBOARD_TIMEZONE,
): Promise<OptionalDataset<DashboardPunchSourceRow>> {
  const rpcResult = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_punch_sources_summary', {
      p_tenant_id: tenantId,
      p_date_from: from,
      p_date_to: to,
    })

  if (!rpcResult.error) {
    return {
      rows: (rpcResult.data ?? []) as DashboardPunchSourceRow[],
      unavailable: false,
    }
  }

  if (!isMissingEntityError(rpcResult.error, 'get_punch_sources_summary')) {
    throw rpcResult.error
  }

  const fallback = await supabase
    .schema(ATT_SCHEMA)
    .from('punches')
    .select('employee_id, punched_at, source, serial_no, meta')
    .eq('tenant_id', tenantId)
    .gte('punched_at', buildEcDayBoundary(from, false, timeZone))
    .lte('punched_at', buildEcDayBoundary(to, true, timeZone))
    .order('punched_at')

  if (fallback.error) {
    if (isMissingEntityError(fallback.error, 'punches')) {
      return { rows: [], unavailable: true }
    }
    throw fallback.error
  }

  return {
    rows: buildPunchSourceRowsFromPunches(
      (fallback.data ?? []) as Array<{
        employee_id: string | null
        punched_at: string
        source: string | null
        serial_no?: string | null
        meta?: GenericRow | null
      }>,
    ),
    unavailable: false,
  }
}

export async function fetchTenantNoveltyRows(tenantId: string, from: string, to: string): Promise<OptionalDataset<TenantNoveltyRow>> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_tenant_novelties', {
      p_tenant_id: tenantId,
      p_from: from,
      p_to: to,
    })

  if (error) {
    if (isMissingEntityError(error, 'get_tenant_novelties')) {
      return { rows: [], unavailable: true }
    }
    throw error
  }

  return {
    rows: (Array.isArray(data) ? data : []).map((row) => ({
      employee_id: String((row as GenericRow).employee_id ?? ''),
      employee_code: (row as GenericRow).employee_code ? String((row as GenericRow).employee_code) : null,
      employee_name: String((row as GenericRow).employee_name ?? ''),
      department_name: (row as GenericRow).department_name ? String((row as GenericRow).department_name) : null,
      work_date: String((row as GenericRow).work_date ?? ''),
      day_status: (row as GenericRow).day_status ? String((row as GenericRow).day_status) : null,
      novelty: (row as GenericRow).novelty ? String((row as GenericRow).novelty) : null,
      decision_status: (row as GenericRow).decision_status === 'justified' || (row as GenericRow).decision_status === 'rejected'
        ? ((row as GenericRow).decision_status as 'justified' | 'rejected')
        : (row as GenericRow).decision_status === 'pending'
          ? 'pending'
          : null,
    })),
    unavailable: false,
  }
}

function normalizePermissionStatus(raw: GenericRow): 'approved' | 'pending' | 'rejected' {
  const status = normalizeText(
    String(
      raw.status ??
      raw.request_status ??
      raw.decision_status ??
      raw.approval_status ??
      'pending',
    ),
  )

  if (includesAny(status, ['APPROV', 'ACEPT', 'AUTORIZ'])) return 'approved'
  if (includesAny(status, ['REJECT', 'DENEG', 'DECLIN'])) return 'rejected'
  return 'pending'
}

function resolvePermissionEmployeeId(raw: GenericRow) {
  const value = raw.employee_id ?? raw.employeeId ?? raw.requester_employee_id ?? raw.collaborator_id
  return value ? String(value) : null
}

function resolvePermissionRange(raw: GenericRow) {
  const start =
    toIsoDateFromUnknown(raw.start_date) ??
    toIsoDateFromUnknown(raw.from_date) ??
    toIsoDateFromUnknown(raw.date_from) ??
    toIsoDateFromUnknown(raw.request_date) ??
    toIsoDateFromUnknown(raw.requested_date) ??
    toIsoDateFromUnknown(raw.work_date) ??
    toIsoDateFromUnknown(raw.created_at)

  const end =
    toIsoDateFromUnknown(raw.end_date) ??
    toIsoDateFromUnknown(raw.to_date) ??
    toIsoDateFromUnknown(raw.date_to) ??
    start

  return { start, end }
}

export async function fetchPermissionRequestRows(tenantId: string, from: string, to: string): Promise<OptionalDataset<PermissionRequestRow>> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('permission_requests')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) {
    if (isMissingEntityError(error, 'permission_requests')) {
      return { rows: [], unavailable: true }
    }
    throw error
  }

  const rows = ((data ?? []) as GenericRow[])
    .map((row) => {
      const employeeId = resolvePermissionEmployeeId(row)
      if (!employeeId) return null

      const { start, end } = resolvePermissionRange(row)
      if (!rangeOverlapsRange(start, end, from, to) && !dateWithinRange(start, from, to) && !dateWithinRange(end, from, to)) {
        return null
      }

      return {
        employeeId,
        status: normalizePermissionStatus(row),
        requestLabel: String(row.request_type ?? row.permission_type ?? row.reason ?? row.type ?? 'Permiso'),
        rangeStart: start,
        rangeEnd: end,
      } satisfies PermissionRequestRow
    })
    .filter((row): row is PermissionRequestRow => Boolean(row))

  return {
    rows,
    unavailable: false,
  }
}

export async function fetchOvertimeRequestRows(tenantId: string, from: string, to: string): Promise<OptionalDataset<OvertimeRequestRow>> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('overtime_requests')
    .select('employee_id, requested_date, hours_requested, status')
    .eq('tenant_id', tenantId)
    .gte('requested_date', from)
    .lte('requested_date', to)

  if (error) {
    if (isMissingEntityError(error, 'overtime_requests')) {
      return { rows: [], unavailable: true }
    }
    throw error
  }

  return {
    rows: (data ?? []) as OvertimeRequestRow[],
    unavailable: false,
  }
}

export async function fetchFineLedgerRows(tenantId: string, from: string, to: string): Promise<OptionalDataset<FineLedgerRow>> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('fine_ledger')
    .select('employee_id, incident_date, applied_amount')
    .eq('tenant_id', tenantId)
    .gte('incident_date', from)
    .lte('incident_date', to)

  if (error) {
    if (isMissingEntityError(error, 'fine_ledger')) {
      return { rows: [], unavailable: true }
    }
    throw error
  }

  return {
    rows: (data ?? []) as FineLedgerRow[],
    unavailable: false,
  }
}

export async function fetchCurrentOrgAssignments(tenantId: string): Promise<OrgAssignmentRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_org_assignments')
    .select('employee_id, org_unit_id, effective_to, effective_from')
    .eq('tenant_id', tenantId)
    .is('effective_to', null)
    .order('effective_from', { ascending: false, nullsFirst: false })

  if (error) {
    if (isMissingEntityError(error, 'employee_org_assignments')) return []
    throw error
  }

  const seen = new Set<string>()
  const rows: OrgAssignmentRow[] = []

  for (const row of (data ?? []) as Array<{ employee_id: string; org_unit_id: string | null }>) {
    if (!row.employee_id || seen.has(row.employee_id)) continue
    seen.add(row.employee_id)
    rows.push({
      employee_id: row.employee_id,
      org_unit_id: row.org_unit_id,
    })
  }

  return rows
}

function buildInitialSummary(roster: EmployeeRosterRow) {
  return {
    employeeId: roster.id,
    employeeCode: roster.employeeCode,
    employeeName: roster.fullName,
    departmentName: roster.departmentName,
    employmentStatus: roster.employmentStatus,
    attendanceStatus: roster.attendanceStatus,
    isActiveCollaborator: isActiveCollaborator(roster),
    expectedDays: 0,
    presenceCount: 0,
    onTimeCount: 0,
    lateCount: 0,
    absenceCount: 0,
    justifiedAbsenceCount: 0,
    unjustifiedAbsenceCount: 0,
    pendingAbsenceCount: 0,
    permissionTotal: 0,
    permissionApproved: 0,
    permissionPending: 0,
    permissionRejected: 0,
    fineAmount: 0,
    fineCount: 0,
    approvedOvertimeHours: 0,
    noveltyCount: 0,
    journeyLabel: 'Sin jornada',
    journeySource: 'unknown' as const,
  } satisfies DashboardEmployeeSummary
}

export function buildEmployeeSummaries(input: {
  roster: EmployeeRosterRow[]
  dailyRows: DailyAttendanceRow[]
  noveltyRows: TenantNoveltyRow[]
  permissionRows: PermissionRequestRow[]
  overtimeRows: OvertimeRequestRow[]
  fineRows: FineLedgerRow[]
}) {
  const byId = new Map<string, DashboardEmployeeSummary>()
  const rosterById = new Map(input.roster.map((row) => [row.id, row]))

  const ensure = (employeeId: string, fallback?: Partial<DashboardEmployeeSummary>) => {
    const current = byId.get(employeeId)
    if (current) return current

    const roster = rosterById.get(employeeId)
    const next = roster
      ? buildInitialSummary(roster)
      : ({
          employeeId,
          employeeCode: fallback?.employeeCode ?? null,
          employeeName: fallback?.employeeName ?? employeeId,
          departmentName: fallback?.departmentName ?? null,
          employmentStatus: fallback?.employmentStatus ?? null,
          attendanceStatus: fallback?.attendanceStatus ?? null,
          isActiveCollaborator: true,
          expectedDays: 0,
          presenceCount: 0,
          onTimeCount: 0,
          lateCount: 0,
          absenceCount: 0,
          justifiedAbsenceCount: 0,
          unjustifiedAbsenceCount: 0,
          pendingAbsenceCount: 0,
          permissionTotal: 0,
          permissionApproved: 0,
          permissionPending: 0,
          permissionRejected: 0,
          fineAmount: 0,
          fineCount: 0,
          approvedOvertimeHours: 0,
          noveltyCount: 0,
          journeyLabel: 'Sin jornada',
          journeySource: 'unknown' as const,
        } satisfies DashboardEmployeeSummary)

    byId.set(employeeId, next)
    return next
  }

  for (const roster of input.roster) {
    ensure(roster.id)
  }

  for (const row of input.dailyRows) {
    if (!row.employee_id) continue

    const summary = ensure(row.employee_id, {
      employeeCode: row.employee_code ?? null,
      employeeName: row.employee_name || row.employee_id,
      departmentName: row.department_name ?? null,
      employmentStatus: row.employee_status ?? null,
      attendanceStatus: null,
    })

    if (row.department_name && !summary.departmentName) {
      summary.departmentName = row.department_name
    }

    if (row.turn_name) {
      summary.journeyLabel = row.turn_name
      summary.journeySource = 'turn'
    } else if (row.schedule_name && summary.journeySource !== 'turn') {
      summary.journeyLabel = row.schedule_name
      summary.journeySource = 'schedule'
    }

    if (row.employee_status && !summary.employmentStatus) {
      summary.employmentStatus = row.employee_status
    }

    if (isAttendanceExpected(row)) {
      summary.expectedDays += 1
    }

    if (isPresenceRow(row)) {
      summary.presenceCount += 1
    }

    if (isOnTimeRow(row)) {
      summary.onTimeCount += 1
    }

    if (isLateRow(row)) {
      summary.lateCount += 1
    }

    if (isAbsenceRow(row)) {
      summary.absenceCount += 1
    }

    if (isNoveltyRow(row)) {
      summary.noveltyCount += 1
    }
  }

  for (const row of input.noveltyRows) {
    if (!row.employee_id) continue
    if (!isAbsenceNovelty(row)) continue

    const summary = ensure(row.employee_id, {
      employeeCode: row.employee_code ?? null,
      employeeName: row.employee_name || row.employee_id,
      departmentName: row.department_name ?? null,
    })

    if (row.decision_status === 'justified') summary.justifiedAbsenceCount += 1
    else if (row.decision_status === 'rejected') summary.unjustifiedAbsenceCount += 1
    else summary.pendingAbsenceCount += 1
  }

  for (const row of input.permissionRows) {
    const summary = ensure(row.employeeId)
    summary.permissionTotal += 1

    if (row.status === 'approved') summary.permissionApproved += 1
    else if (row.status === 'rejected') summary.permissionRejected += 1
    else summary.permissionPending += 1
  }

  for (const row of input.overtimeRows) {
    if (!row.employee_id) continue
    if (normalizeText(row.status) !== 'APPROVED') continue

    const summary = ensure(row.employee_id)
    summary.approvedOvertimeHours += Number(row.hours_requested ?? 0)
  }

  for (const row of input.fineRows) {
    if (!row.employee_id) continue
    const summary = ensure(row.employee_id)
    summary.fineCount += 1
    summary.fineAmount += Number(row.applied_amount ?? 0)
  }

  return Array.from(byId.values())
}

export function buildDashboardKpis(summaries: DashboardEmployeeSummary[]) {
  const activeSummaries = summaries.filter((summary) => summary.isActiveCollaborator)

  const totals = activeSummaries.reduce(
    (acc, summary) => {
      acc.expectedDays += summary.expectedDays
      acc.presence += summary.presenceCount
      acc.onTime += summary.onTimeCount
      acc.late += summary.lateCount
      acc.absence += summary.absenceCount
      acc.permissions += summary.permissionTotal
      acc.fineAmount += summary.fineAmount
      acc.fineCount += summary.fineCount
      acc.overtime += summary.approvedOvertimeHours
      acc.novelties += summary.noveltyCount
      return acc
    },
    {
      expectedDays: 0,
      presence: 0,
      onTime: 0,
      late: 0,
      absence: 0,
      permissions: 0,
      fineAmount: 0,
      fineCount: 0,
      overtime: 0,
      novelties: 0,
    },
  )

  const punctualityBase = totals.onTime + totals.late

  return {
    totalCollaborators: activeSummaries.length,
    punctualityPct: punctualityBase > 0 ? (totals.onTime / punctualityBase) * 100 : 0,
    absenteeismPct: totals.expectedDays > 0 ? (totals.absence / totals.expectedDays) * 100 : 0,
    totalAbsence: totals.absence,
    totalLate: totals.late,
    totalPermissions: totals.permissions,
    totalFinesAmount: totals.fineAmount,
    totalFinesCount: totals.fineCount,
    approvedOvertimeHours: totals.overtime,
    presentismPct: totals.expectedDays > 0 ? (totals.presence / totals.expectedDays) * 100 : 0,
    totalNovelty: totals.novelties,
  } satisfies DashboardKpis
}

export function buildMetricBaseRows(
  summaries: DashboardEmployeeSummary[],
  metricKey: DashboardMetricKey,
) {
  return summaries
    .filter((summary) => summary.isActiveCollaborator)
    .map((summary) => ({
      employeeId: summary.employeeId,
      employeeName: summary.employeeName,
      employeeCode: summary.employeeCode,
      value: getMetricValue(summary, metricKey),
    }))
    .filter((row) => row.value > 0)
}

export function buildJourneyMetrics(
  summaries: DashboardEmployeeSummary[],
  metricKey: DashboardMetricKey,
) {
  const byJourney = new Map<string, JourneyMetricDatum>()

  for (const summary of summaries) {
    if (!summary.isActiveCollaborator) continue

    const value = getMetricValue(summary, metricKey)
    if (value <= 0) continue

    const label = resolveJourneyLabel(summary)
    const current = byJourney.get(label)

    if (current) {
      current.value += value
      current.employees += 1
      continue
    }

    byJourney.set(label, {
      label,
      value,
      employees: 1,
      metricKey,
    })
  }

  return Array.from(byJourney.values()).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
}

export function buildDailyPulse(dailyRows: DailyAttendanceRow[]) {
  const byDate = new Map<string, DashboardPulsePoint>()

  for (const row of dailyRows) {
    if (!row.work_date) continue

    const current = byDate.get(row.work_date) ?? {
      date: row.work_date,
      label: formatDateLabel(row.work_date),
      late: 0,
      absence: 0,
      presence: 0,
      novelty: 0,
    }

    if (isLateRow(row)) current.late += 1
    if (isAbsenceRow(row)) current.absence += 1
    if (isPresenceRow(row)) current.presence += 1
    if (isNoveltyRow(row)) current.novelty += 1

    byDate.set(row.work_date, current)
  }

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date))
}

export function buildAttendanceChannelPulse(rows: DashboardPunchSourceRow[]) {
  const byDate = new Map<string, DashboardAttendanceChannelPoint>()

  for (const row of rows) {
    if (!row.work_date) continue

    const current = byDate.get(row.work_date) ?? {
      date: row.work_date,
      label: formatDateLabel(row.work_date),
      facial: 0,
      fingerprint: 0,
      code: 0,
      web: 0,
      onsite: 0,
      remote: 0,
    }

    const sourceValues = (row.sources ?? [])
      .filter(Boolean)
      .map((value) => normalizeText(String(value)))
      .filter(Boolean)

    const methodValues = Array.from(
      new Set(
        (row.biometric_methods ?? row.biometric_verify_types ?? [])
          .filter(Boolean)
          .map((value) => normalizeBiometricMethodLabel(String(value)))
          .filter(Boolean),
      ),
    )

    const hasWeb = sourceValues.some((value) => value === 'WEB' || value.includes('PWA') || value.includes('REMOTE'))
    const hasBiometricSignal =
      methodValues.length > 0 ||
      sourceValues.some((value) => value.includes('BIO') || value.includes('DEVICE') || value.includes('ZK') || value.includes('RELOJ')) ||
      (row.serial_nos ?? []).filter(Boolean).length > 0

    if (hasWeb) current.web += 1

    let onsiteHits = 0
    for (const method of methodValues) {
      const normalizedMethod = normalizeText(method)
      if (normalizedMethod.includes('FACIAL') || normalizedMethod.includes('FACE') || normalizedMethod.includes('ROSTRO')) {
        current.facial += 1
        onsiteHits += 1
        continue
      }

      if (normalizedMethod.includes('HUELLA') || normalizedMethod.includes('FINGER') || normalizedMethod === 'FP') {
        current.fingerprint += 1
        onsiteHits += 1
        continue
      }

      if (normalizedMethod.includes('CODIGO') || normalizedMethod.includes('PASSWORD') || normalizedMethod.includes('PIN') || normalizedMethod.includes('CLAVE')) {
        current.code += 1
        onsiteHits += 1
      }
    }

    if (hasBiometricSignal && onsiteHits === 0) {
      current.fingerprint += 1
      onsiteHits = 1
    }

    current.onsite += onsiteHits
    current.remote = current.web
    byDate.set(row.work_date, current)
  }

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date))
}

export function filterSummariesByJourney(
  summaries: DashboardEmployeeSummary[],
  journeyLabel: string | null,
) {
  if (!journeyLabel) return summaries
  return summaries.filter((summary) => resolveJourneyLabel(summary) === journeyLabel)
}

export function buildMetricStatusBreakdown(
  summaries: DashboardEmployeeSummary[],
  metricKey: DashboardMetricKey,
) {
  if (metricKey === 'absence') {
    return summaries.reduce(
      (acc, summary) => {
        acc.justified += summary.justifiedAbsenceCount
        acc.pending += summary.pendingAbsenceCount
        acc.unjustified += summary.unjustifiedAbsenceCount
        return acc
      },
      { justified: 0, pending: 0, unjustified: 0 },
    )
  }

  if (metricKey === 'permission') {
    return summaries.reduce(
      (acc, summary) => {
        acc.approved += summary.permissionApproved
        acc.pending += summary.permissionPending
        acc.rejected += summary.permissionRejected
        return acc
      },
      { approved: 0, pending: 0, rejected: 0 },
    )
  }

  return null
}
