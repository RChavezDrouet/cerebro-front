import { APPROVAL_STATUS_LABELS } from '@/features/approvals/constants'
import type { ApprovalOverallStatus } from '@/features/approvals/types'
import type { RequestKind } from './types'

export function canManageRequests(role?: string | null): boolean {
  return ['tenant_admin', 'hr_admin', 'admin', 'payroll_admin', 'payroll_manager'].includes(role ?? '')
}

export function getRequestStatusTone(status: ApprovalOverallStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'aprobado') return 'good'
  if (status === 'rechazado' || status === 'cancelado') return 'bad'
  if (status === 'en_aprobacion' || status === 'pendiente') return 'warn'
  return 'neutral'
}

export function getRequestStatusLabel(status: ApprovalOverallStatus): string {
  return APPROVAL_STATUS_LABELS[status] ?? status
}

export function calculateVacationDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1
  const diff = end.getTime() - start.getTime()
  if (diff < 0) return 1
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
}

export function formatMoney(value: number | null | undefined, currencyCode = 'USD'): string {
  if (value == null || Number.isNaN(value)) return `${currencyCode} 0.00`
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: currencyCode,
  }).format(value)
}

export function getRequestKindLabel(kind: RequestKind): string {
  switch (kind) {
    case 'attendance_justifications':
      return 'Justificaciones'
    case 'permission_requests':
      return 'Permisos'
    case 'loan_requests':
      return 'Préstamos'
    case 'salary_advance_requests':
      return 'Adelantos'
    case 'vacation_requests':
      return 'Vacaciones'
    default:
      return kind
  }
}
