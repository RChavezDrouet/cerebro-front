import type {
  AttendanceJustificationDraft,
  AttendanceJustificationRecord,
  LoanRequestDraft,
  LoanRequestRecord,
  PermissionRequestDraft,
  PermissionRequestRecord,
  RequestKind,
  RequestPageConfig,
  SalaryAdvanceRequestDraft,
  SalaryAdvanceRequestRecord,
  VacationRequestDraft,
  VacationRequestRecord,
} from './types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function justificationFlowCode(draft: AttendanceJustificationDraft) {
  switch (draft.justification_type) {
    case 'late':
      return 'attendance_late_justification'
    case 'absence':
      return 'attendance_absence_justification'
    case 'early_exit':
      return 'attendance_early_exit_justification'
    case 'early_break':
      return 'attendance_early_break_justification'
    default:
      return 'attendance_late_justification'
  }
}

export const JUSTIFICATION_TYPE_OPTIONS = [
  { value: 'late', label: 'Atraso' },
  { value: 'absence', label: 'Falta' },
  { value: 'early_exit', label: 'Salida anticipada' },
  { value: 'early_break', label: 'Ingreso anticipado a break' },
] as const

export const REQUEST_PAGE_CONFIGS: {
  attendance_justifications: RequestPageConfig<'attendance_justifications', AttendanceJustificationRecord, AttendanceJustificationDraft>
  permission_requests: RequestPageConfig<'permission_requests', PermissionRequestRecord, PermissionRequestDraft>
  loan_requests: RequestPageConfig<'loan_requests', LoanRequestRecord, LoanRequestDraft>
  salary_advance_requests: RequestPageConfig<'salary_advance_requests', SalaryAdvanceRequestRecord, SalaryAdvanceRequestDraft>
  vacation_requests: RequestPageConfig<'vacation_requests', VacationRequestRecord, VacationRequestDraft>
} = {
  attendance_justifications: {
    kind: 'attendance_justifications',
    route: '/management/requests/justifications',
    title: 'Justificaciones',
    subtitle: 'Registra borradores de atrasos, faltas, salidas anticipadas y break anticipado, y envíalos al motor común de aprobación.',
    createLabel: 'Nueva justificación',
    resolveFlowCode: justificationFlowCode,
    buildEmptyDraft: (employeeId) => ({
      employee_id: employeeId ?? '',
      justification_type: 'late',
      work_date: today(),
      related_punch_id: null,
      reason: '',
      attachment_url: null,
    }),
    getSummary: (record) => record.reason,
    getMeta: (record) => `${record.justification_type} • ${record.work_date}`,
  },
  permission_requests: {
    kind: 'permission_requests',
    route: '/management/requests/permissions',
    title: 'Solicitudes de permisos',
    subtitle: 'Permisos por horas o por días con estado transaccional, borrador y envío a aprobación.',
    createLabel: 'Nuevo permiso',
    resolveFlowCode: () => 'permission_request',
    buildEmptyDraft: (employeeId) => ({
      employee_id: employeeId ?? '',
      request_type: 'general',
      start_date: today(),
      end_date: today(),
      start_time: null,
      end_time: null,
      hours_requested: null,
      reason: '',
      attachment_url: null,
    }),
    getSummary: (record) => record.reason,
    getMeta: (record) => `${record.request_type} • ${record.start_date}${record.end_date !== record.start_date ? ` al ${record.end_date}` : ''}`,
  },
  loan_requests: {
    kind: 'loan_requests',
    route: '/management/requests/loans',
    title: 'Solicitudes de préstamos',
    subtitle: 'Préstamos internos con cuotas, motivo y envío a aprobación para RRHH y jefaturas.',
    createLabel: 'Nuevo préstamo',
    resolveFlowCode: () => 'loan_request',
    buildEmptyDraft: (employeeId) => ({
      employee_id: employeeId ?? '',
      amount_requested: null,
      currency_code: 'USD',
      installments: 1,
      reason: '',
    }),
    getSummary: (record) => `${record.currency_code} ${record.amount_requested.toFixed(2)}`,
    getMeta: (record) => `${record.installments} cuota(s)`,
  },
  salary_advance_requests: {
    kind: 'salary_advance_requests',
    route: '/management/requests/salary-advances',
    title: 'Solicitudes de adelanto',
    subtitle: 'Adelantos o anticipos de sueldo listos para integrarse luego con nómina.',
    createLabel: 'Nuevo adelanto',
    resolveFlowCode: () => 'salary_advance_request',
    buildEmptyDraft: (employeeId) => ({
      employee_id: employeeId ?? '',
      amount_requested: null,
      currency_code: 'USD',
      requested_pay_date: today(),
      reason: '',
    }),
    getSummary: (record) => `${record.currency_code} ${record.amount_requested.toFixed(2)}`,
    getMeta: (record) => record.requested_pay_date ? `Pago solicitado: ${record.requested_pay_date}` : 'Sin fecha de pago',
  },
  vacation_requests: {
    kind: 'vacation_requests',
    route: '/management/requests/vacations',
    title: 'Solicitudes de vacaciones',
    subtitle: 'Vacaciones con control de saldo declarado, días solicitados y trazabilidad del flujo.',
    createLabel: 'Nueva solicitud',
    resolveFlowCode: () => 'vacation_request',
    buildEmptyDraft: (employeeId) => ({
      employee_id: employeeId ?? '',
      start_date: today(),
      end_date: today(),
      days_requested: 1,
      available_balance_days: null,
      reason: '',
    }),
    getSummary: (record) => `${record.days_requested} día(s) solicitados`,
    getMeta: (record) => `${record.start_date} al ${record.end_date}`,
  },
}

export const REQUEST_KIND_ORDER: RequestKind[] = [
  'attendance_justifications',
  'permission_requests',
  'loan_requests',
  'salary_advance_requests',
  'vacation_requests',
]
