import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClockCheck,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarRange,
  CircleDollarSign,
  Clock3,
  FileClock,
  Layers3,
  Sparkles,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { buildOrgPath } from '@/lib/orgStructure'
import {
  isRequestInMonth,
  isRequestInRange,
  type ApprovalRequestDashboardRow,
  type ApprovalRequestStepDashboardRow,
  type DashboardRequestRow,
  type FineLedgerDetailRow,
} from '@/lib/dashboard/biDashboard'
import { buildOrgMetricRows, buildOrgSlices, collectPeopleAtPath, type OrgMetricRow } from './dashboardOrgDrill'
import type { DashboardPeriod } from '@/lib/dashboard/hrDashboard'
import type { ApprovalSetupContext } from '@/features/approvals/types'
import { useDashboardAnalytics } from './useDashboardAnalytics'
import KPICard from '@/components/dashboard/bi/KPICard'
import FiltersBar from '@/components/dashboard/bi/FiltersBar'
import OrgBreadcrumb from '@/components/dashboard/bi/OrgBreadcrumb'
import PendingApprovalsSummary from '@/components/dashboard/bi/PendingApprovalsSummary'
import DetailDrawer, { type CollaboratorDetailPayload } from '@/components/dashboard/bi/DetailDrawer'
import CollaboratorScopeModal, { type CollaboratorScopeRow } from '@/components/dashboard/bi/CollaboratorScopeModal'
import { EmptyPanel, SkeletonPanel, formatCompactNumber, formatCurrency, formatDateLabel, formatPercent } from '@/components/dashboard/bi/shared'
import type { OrgHierarchyExplorerSlice } from '@/components/dashboard/bi/OrgHierarchyExplorer'

const AttendanceDisciplineOverview = React.lazy(() => import('@/components/dashboard/bi/AttendanceDisciplineOverview'))
const DrilldownChart = React.lazy(() => import('@/components/dashboard/bi/DrilldownChart'))
const FinesAnalytics = React.lazy(() => import('@/components/dashboard/bi/FinesAnalytics'))
const OrgHierarchyExplorer = React.lazy(() => import('@/components/dashboard/bi/OrgHierarchyExplorer'))
const RequestsAnalytics = React.lazy(() => import('@/components/dashboard/bi/RequestsAnalytics'))
const VacationTimeline = React.lazy(() => import('@/components/dashboard/bi/VacationTimeline'))
const VacationHeatmap = React.lazy(() => import('@/components/dashboard/bi/VacationHeatmap'))

type DashboardDrillMetric = 'headcount' | 'late' | 'absence' | 'fine_amount' | 'requests_pending' | 'vacation_approved'

type DetailTableRow = {
  employeeId: string
  employeeName: string
  employeeCode: string | null
  orgPath: string
  punctualityPct: number
  lateCount: number
  absenceCount: number
  fineAmount: number
  fineCount: number
  pendingRequests: number
  justificationCount: number
  permissionCount: number
  onVacationToday: boolean
}

type CollaboratorScopeState = {
  pathIds: string[]
  label: string
  levelLabel: string
}

type VacationTimelineItem = {
  id: string
  employeeId: string
  employeeName: string
  orgLabel: string
  impactLabel: string
  startDate: string
  endDate: string
  daysRequested: number
  status: string
}

type ExecutiveCardConfig = {
  label: string
  value: string
  subtitle: string
  icon: React.ReactNode
  accentClass: string
  tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral'
  chip?: string
}

const PERIOD_STORAGE_KEY = 'hrcloud.base.dashboard.bi.period.v1'
const DRILL_COLORS = ['#2BE7FF', '#2D8CFF', '#19F3B1', '#A3FF12', '#FFC641', '#FF8A3D', '#FF4D8B', '#D66BFF']

const DRILL_METRIC_OPTIONS: Array<{ value: DashboardDrillMetric; label: string }> = [
  { value: 'headcount', label: 'Colaboradores' },
  { value: 'late', label: 'Atrasos' },
  { value: 'absence', label: 'Ausencias' },
  { value: 'fine_amount', label: 'Multas' },
  { value: 'requests_pending', label: 'Solicitudes pendientes' },
  { value: 'vacation_approved', label: 'Vacaciones aprobadas' },
]

function readStoredPeriod(): DashboardPeriod {
  if (typeof window === 'undefined') return 'mes'

  try {
    const stored = window.sessionStorage.getItem(PERIOD_STORAGE_KEY)
    if (stored === 'hoy' || stored === 'semana' || stored === 'mes' || stored === 'trimestre') {
      return stored
    }
  } catch {
    return 'mes'
  }

  return 'mes'
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = []
  const cursor = new Date(`${from}T12:00:00Z`)
  const end = new Date(`${to}T12:00:00Z`)

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function differenceInHours(from: string | null, to: string | null) {
  if (!from || !to) return 0
  const left = new Date(from)
  const right = new Date(to)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return 0
  return Math.max((right.getTime() - left.getTime()) / 3_600_000, 0)
}

function metricValueLabel(metric: DashboardDrillMetric, value: number) {
  if (metric === 'fine_amount') return formatCurrency(value)
  return formatCompactNumber(value)
}

function requestKindLabel(kind: DashboardRequestRow['kind']) {
  if (kind === 'attendance_justifications') return 'Justificaciones'
  if (kind === 'permission_requests') return 'Permisos'
  if (kind === 'loan_requests') return 'Prestamos'
  if (kind === 'salary_advance_requests') return 'Adelantos'
  return 'Vacaciones'
}

function getRowPathLabels(rows: OrgMetricRow[], pathIds: string[]) {
  if (!pathIds.length) return []

  const match = rows.find((row) => pathIds.every((id, index) => row.nodes[index]?.nodeId === id))
  if (!match) return []

  return match.nodes.slice(0, pathIds.length).map((node) => ({
    id: node.nodeId,
    label: node.nodeName,
  }))
}

function resolveApproverLabel(
  step: ApprovalRequestStepDashboardRow,
  context: ApprovalSetupContext | null,
) {
  if (!context) {
    if (step.assignedUserId) return `Usuario ${step.assignedUserId.slice(0, 8)}`
    if (step.candidateUserIds.length > 1) return 'Cola compartida'
    if (step.candidateUserIds.length === 1) return `Usuario ${step.candidateUserIds[0].slice(0, 8)}`
    return step.stepName
  }

  const userById = new Map(context.users.map((user) => [user.user_id, user.full_name]))
  const groupById = new Map(context.groups.map((group) => [group.id, group.name]))

  if (step.assignedUserId) {
    return userById.get(step.assignedUserId) ?? `Usuario ${step.assignedUserId.slice(0, 8)}`
  }

  if (step.assignedGroupId) {
    return groupById.get(step.assignedGroupId) ?? 'Grupo aprobador'
  }

  if (step.candidateUserIds.length === 1) {
    const candidate = step.candidateUserIds[0]
    return userById.get(candidate) ?? `Usuario ${candidate.slice(0, 8)}`
  }

  if (step.candidateUserIds.length > 1) {
    return `${step.stepName} | cola compartida`
  }

  return step.stepName
}

function buildApprovalBottlenecks(
  steps: ApprovalRequestStepDashboardRow[],
  requestsById: Map<string, ApprovalRequestDashboardRow>,
) {
  const now = Date.now()
  const grouped = new Map<string, { label: string; pending: number; avgHours: number }>()

  for (const step of steps) {
    const request = requestsById.get(step.approvalRequestId)
    if (!request || request.overallStatus !== 'en_aprobacion') continue
    if (step.status !== 'pendiente' || !step.activatedAt) continue

    const hours = Math.max((now - new Date(step.activatedAt).getTime()) / 3_600_000, 0)
    const key = `${step.stepOrder}-${step.stepName}`
    const current = grouped.get(key)

    if (current) {
      current.pending += 1
      current.avgHours += hours
      continue
    }

    grouped.set(key, {
      label: `Nivel ${step.stepOrder} | ${step.stepName}`,
      pending: 1,
      avgHours: hours,
    })
  }

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      avgHours: row.pending > 0 ? row.avgHours / row.pending : 0,
      color: '#f59e0b',
    }))
    .sort((left, right) => right.pending - left.pending || right.avgHours - left.avgHours)
    .slice(0, 6)
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPanel className="h-48" />
      <SkeletonPanel className="h-28" />
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonPanel className="h-44" />
        <SkeletonPanel className="h-44" />
        <SkeletonPanel className="h-44" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonPanel className="h-[34rem]" />
        <SkeletonPanel className="h-[34rem]" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [period, setPeriod] = React.useState<DashboardPeriod>(() => readStoredPeriod())
  const [requestStatus, setRequestStatus] = React.useState<'all' | 'borrador' | 'pendiente' | 'en_aprobacion' | 'aprobado' | 'rechazado' | 'cancelado'>('all')
  const [requestKind, setRequestKind] = React.useState<'all' | DashboardRequestRow['kind']>('all')
  const [search, setSearch] = React.useState('')
  const [drillMetric, setDrillMetric] = React.useState<DashboardDrillMetric>('headcount')
  const [selectedPathIds, setSelectedPathIds] = React.useState<string[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null)
  const [collaboratorScope, setCollaboratorScope] = React.useState<CollaboratorScopeState | null>(null)
  const [, startTransition] = React.useTransition()
  const deferredSearch = React.useDeferredValue(search)

  const dashboard = useDashboardAnalytics(user?.id, period)

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(PERIOD_STORAGE_KEY, period)
    } catch {
      return
    }
  }, [period])

  React.useEffect(() => {
    setCollaboratorScope(null)
  }, [period, requestKind, requestStatus])

  const data = dashboard.data

  const activeSummaries = React.useMemo(
    () => (data?.summaries ?? []).filter((summary) => summary.isActiveCollaborator),
    [data?.summaries],
  )

  const employeeNameById = React.useMemo(
    () => new Map(activeSummaries.map((summary) => [summary.employeeId, summary.employeeName])),
    [activeSummaries],
  )

  const orgRosterRows = React.useMemo(
    () =>
      data
        ? buildOrgMetricRows(
            activeSummaries.map((summary) => ({
              employeeId: summary.employeeId,
              employeeName: summary.employeeName,
              employeeCode: summary.employeeCode,
              value: 1,
            })),
            data.orgAssignments,
            data.orgUnits,
            data.orgLevels,
          )
        : [],
    [activeSummaries, data],
  )

  const scopeSegments = React.useMemo(
    () => getRowPathLabels(orgRosterRows, selectedPathIds),
    [orgRosterRows, selectedPathIds],
  )

  const scopedEmployeeIds = React.useMemo(
    () => new Set(collectPeopleAtPath(orgRosterRows, selectedPathIds).map((row) => row.employeeId)),
    [orgRosterRows, selectedPathIds],
  )

  const scopedSummaries = React.useMemo(
    () => activeSummaries.filter((summary) => scopedEmployeeIds.has(summary.employeeId)),
    [activeSummaries, scopedEmployeeIds],
  )

  const employeeOrgMetaById = React.useMemo(() => {
    const next = new Map<string, { pathLabel: string; impactLabel: string }>()

    for (const row of orgRosterRows) {
      const pathLabel = row.nodes.length
        ? row.nodes.map((node) => node.nodeName).join(' / ')
        : 'Sin asignacion'
      const scopedNode = row.nodes[selectedPathIds.length] ?? row.nodes[row.nodes.length - 1] ?? null

      next.set(row.employeeId, {
        pathLabel,
        impactLabel: scopedNode?.nodeName ?? 'Sin asignacion',
      })
    }

    return next
  }, [orgRosterRows, selectedPathIds])

  const requestRows = React.useMemo(
    () => (data?.requestDataset.rows ?? []).filter((row) => scopedEmployeeIds.has(row.employeeId)),
    [data?.requestDataset.rows, scopedEmployeeIds],
  )

  const periodRequestRows = React.useMemo(
    () => requestRows.filter((row) => (data ? isRequestInRange(row, data.time.from, data.time.to) : true)),
    [data, requestRows],
  )

  const filteredRequestRows = React.useMemo(
    () =>
      periodRequestRows.filter((row) => {
        const matchesStatus = requestStatus === 'all' || row.requestStatus === requestStatus
        const matchesKind = requestKind === 'all' || row.kind === requestKind
        return matchesStatus && matchesKind
      }),
    [periodRequestRows, requestKind, requestStatus],
  )

  const vacationRows = React.useMemo(
    () => requestRows.filter((row) => row.kind === 'vacation_requests'),
    [requestRows],
  )

  const periodVacationRows = React.useMemo(
    () => vacationRows.filter((row) => (data ? isRequestInRange(row, data.time.from, data.time.to) : true)),
    [data, vacationRows],
  )

  const monthVacationRows = React.useMemo(
    () => vacationRows.filter((row) => (data ? isRequestInMonth(row, data.time.monthFrom, data.time.monthTo) : true)),
    [data, vacationRows],
  )

  const todayVacationRows = React.useMemo(
    () => vacationRows.filter((row) => data ? row.periodStart != null && row.periodEnd != null && row.periodStart <= data.time.today && row.periodEnd >= data.time.today && row.requestStatus === 'aprobado' : false),
    [data, vacationRows],
  )

  const fineRows = React.useMemo(
    () => (data?.fineDataset.rows ?? []).filter((row) => row.employeeId != null && scopedEmployeeIds.has(row.employeeId)),
    [data?.fineDataset.rows, scopedEmployeeIds],
  )

  const periodFineRows = React.useMemo(
    () => fineRows.filter((row) => !data || (row.incidentDate >= data.time.from && row.incidentDate <= data.time.to)),
    [data, fineRows],
  )

  const approvalRequests = React.useMemo(
    () =>
      (data?.approvalRequestsDataset.rows ?? []).filter(
        (row) => row.requestedByEmployeeId == null || scopedEmployeeIds.has(row.requestedByEmployeeId),
      ),
    [data?.approvalRequestsDataset.rows, scopedEmployeeIds],
  )

  const approvalRequestIds = React.useMemo(
    () => new Set(approvalRequests.map((row) => row.id)),
    [approvalRequests],
  )

  const approvalSteps = React.useMemo(
    () => (data?.approvalStepsDataset.rows ?? []).filter((row) => approvalRequestIds.has(row.approvalRequestId)),
    [approvalRequestIds, data?.approvalStepsDataset.rows],
  )

  const myPendingApprovals = React.useMemo(
    () =>
      (data?.myPendingApprovals ?? []).filter(
        (item) => item.collaborator_id == null || scopedEmployeeIds.has(item.collaborator_id),
      ),
    [data?.myPendingApprovals, scopedEmployeeIds],
  )

  const requestsById = React.useMemo(
    () => new Map(approvalRequests.map((row) => [row.id, row])),
    [approvalRequests],
  )

  const justificationCountByEmployee = React.useMemo(() => {
    const next = new Map<string, number>()
    for (const row of filteredRequestRows) {
      if (row.kind !== 'attendance_justifications') continue
      next.set(row.employeeId, (next.get(row.employeeId) ?? 0) + 1)
    }
    return next
  }, [filteredRequestRows])

  const permissionCountByEmployee = React.useMemo(() => {
    const next = new Map<string, number>()
    for (const row of filteredRequestRows) {
      if (row.kind !== 'permission_requests') continue
      next.set(row.employeeId, (next.get(row.employeeId) ?? 0) + 1)
    }
    return next
  }, [filteredRequestRows])

  const pendingRequestCountByEmployee = React.useMemo(() => {
    const next = new Map<string, number>()
    for (const row of requestRows) {
      if (row.requestStatus !== 'pendiente' && row.requestStatus !== 'en_aprobacion') continue
      next.set(row.employeeId, (next.get(row.employeeId) ?? 0) + 1)
    }
    return next
  }, [requestRows])

  const vacationApprovedCountByEmployee = React.useMemo(() => {
    const next = new Map<string, number>()
    for (const row of vacationRows) {
      if (row.requestStatus !== 'aprobado') continue
      next.set(row.employeeId, (next.get(row.employeeId) ?? 0) + 1)
    }
    return next
  }, [vacationRows])

  const onVacationTodayIds = React.useMemo(
    () => new Set(todayVacationRows.map((row) => row.employeeId)),
    [todayVacationRows],
  )

  const fineAmountByEmployee = React.useMemo(() => {
    const next = new Map<string, number>()
    for (const row of periodFineRows) {
      if (!row.employeeId) continue
      next.set(row.employeeId, (next.get(row.employeeId) ?? 0) + row.appliedAmount)
    }
    return next
  }, [periodFineRows])

  const fineCountByEmployee = React.useMemo(() => {
    const next = new Map<string, number>()
    for (const row of periodFineRows) {
      if (!row.employeeId) continue
      next.set(row.employeeId, (next.get(row.employeeId) ?? 0) + 1)
    }
    return next
  }, [periodFineRows])

  const metricRows = React.useMemo(() => {
    if (!data) {
      return {
        headcount: [] as OrgMetricRow[],
        late: [] as OrgMetricRow[],
        absence: [] as OrgMetricRow[],
        fine_amount: [] as OrgMetricRow[],
        requests_pending: [] as OrgMetricRow[],
        vacation_approved: [] as OrgMetricRow[],
      }
    }

    const buildRows = (values: Array<{ employeeId: string; employeeName: string; employeeCode: string | null; value: number }>) =>
      buildOrgMetricRows(values, data.orgAssignments, data.orgUnits, data.orgLevels)

    return {
      headcount: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: 1,
        })),
      ),
      late: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: summary.lateCount,
        })),
      ),
      absence: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: summary.absenceCount,
        })),
      ),
      fine_amount: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: fineAmountByEmployee.get(summary.employeeId) ?? 0,
        })),
      ),
      requests_pending: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: pendingRequestCountByEmployee.get(summary.employeeId) ?? 0,
        })),
      ),
      vacation_approved: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: vacationApprovedCountByEmployee.get(summary.employeeId) ?? 0,
        })),
      ),
    }
  }, [
    activeSummaries,
    data,
    fineAmountByEmployee,
    pendingRequestCountByEmployee,
    vacationApprovedCountByEmployee,
  ])

  const drillSlices = React.useMemo(
    () => buildOrgSlices(metricRows[drillMetric], selectedPathIds, DRILL_COLORS, drillMetric),
    [drillMetric, metricRows, selectedPathIds],
  )

  const auxiliaryMetricRows = React.useMemo(() => {
    if (!data) {
      return {
        attention_points: [] as OrgMetricRow[],
        justifications: [] as OrgMetricRow[],
        permissions: [] as OrgMetricRow[],
      }
    }

    const buildRows = (values: Array<{ employeeId: string; employeeName: string; employeeCode: string | null; value: number }>) =>
      buildOrgMetricRows(values, data.orgAssignments, data.orgUnits, data.orgLevels)

    return {
      attention_points: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value:
            summary.lateCount +
            summary.absenceCount +
            (pendingRequestCountByEmployee.get(summary.employeeId) ?? 0),
        })),
      ),
      justifications: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: justificationCountByEmployee.get(summary.employeeId) ?? 0,
        })),
      ),
      permissions: buildRows(
        activeSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          value: permissionCountByEmployee.get(summary.employeeId) ?? 0,
        })),
      ),
    }
  }, [
    activeSummaries,
    data,
    justificationCountByEmployee,
    pendingRequestCountByEmployee,
    permissionCountByEmployee,
  ])

  const scopeLabel = scopeSegments.length
    ? scopeSegments.map((segment) => segment.label).join(' / ')
    : 'Empresa / Tenant'

  const scopedExpectedDays = scopedSummaries.reduce((acc, summary) => acc + summary.expectedDays, 0)
  const scopedLate = scopedSummaries.reduce((acc, summary) => acc + summary.lateCount, 0)
  const scopedAbsence = scopedSummaries.reduce((acc, summary) => acc + summary.absenceCount, 0)
  const scopedOnTime = scopedSummaries.reduce((acc, summary) => acc + summary.onTimeCount, 0)

  const punctualityPct = scopedOnTime + scopedLate > 0 ? (scopedOnTime / (scopedOnTime + scopedLate)) * 100 : 0
  const absenteeismPct = scopedExpectedDays > 0 ? (scopedAbsence / scopedExpectedDays) * 100 : 0
  const totalFineAmount = periodFineRows.reduce((acc, row) => acc + row.appliedAmount, 0)
  const totalFineCount = periodFineRows.length
  const pendingRequestsTotal = requestRows.filter((row) => row.requestStatus === 'pendiente' || row.requestStatus === 'en_aprobacion').length
  const approvedVacationMonth = monthVacationRows.filter((row) => row.requestStatus === 'aprobado').length
  const rejectedVacationMonth = monthVacationRows.filter((row) => row.requestStatus === 'rechazado').length
  const requestedVacationMonth = monthVacationRows.length
  const onVacationToday = todayVacationRows.length

  const attendanceTrendData = React.useMemo(() => {
    const grouped = new Map<string, { label: string; onTime: number; late: number; absence: number }>()

    for (const row of data?.dailyRows ?? []) {
      if (!row.employee_id || !scopedEmployeeIds.has(row.employee_id)) continue
      const current = grouped.get(row.work_date) ?? {
        label: formatDateLabel(row.work_date),
        onTime: 0,
        late: 0,
        absence: 0,
      }

      const status = String(row.day_status ?? '').toUpperCase()
      if (status.includes('A_TIEM') || status.includes('ATIEM')) current.onTime += 1
      if (status.includes('ATRAS')) current.late += 1

      const joined = `${row.day_status ?? ''} ${row.novelty ?? ''}`.toUpperCase()
      if (joined.includes('AUSEN') || joined.includes('INASIST') || (!row.entry_at && !row.exit_at)) {
        current.absence += 1
      }

      grouped.set(row.work_date, current)
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([, value]) => value)
  }, [data?.dailyRows, scopedEmployeeIds, scopedSummaries])

  const fineTypeData = React.useMemo(() => {
    const grouped = new Map<string, number>()

    for (const row of periodFineRows) {
      const label = row.incidentType.replace(/_/g, ' ')
      grouped.set(label, (grouped.get(label) ?? 0) + 1)
    }

    return Array.from(grouped.entries())
      .map(([label, value], index) => ({
        label,
        value,
        color: DRILL_COLORS[index % DRILL_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value)
  }, [periodFineRows])

  const fineOrgData = React.useMemo(() => {
    const slices = buildOrgSlices(metricRows.fine_amount, selectedPathIds, DRILL_COLORS, 'fine_amount')
    return slices.slice(0, 7).map((slice) => ({
      label: slice.label,
      value: Number(slice.value.toFixed(2)),
      color: slice.color,
    }))
  }, [metricRows.fine_amount, selectedPathIds])

  const fineTrendData = React.useMemo(() => {
    const grouped = new Map<string, { label: string; amount: number; count: number }>()

    for (const row of periodFineRows) {
      const current = grouped.get(row.incidentDate) ?? {
        label: formatDateLabel(row.incidentDate),
        amount: 0,
        count: 0,
      }

      current.amount += row.appliedAmount
      current.count += 1
      grouped.set(row.incidentDate, current)
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([, value]) => ({
        label: value.label,
        amount: Number(value.amount.toFixed(2)),
        count: value.count,
      }))
  }, [periodFineRows])

  const topFineEmployees = React.useMemo(
    () =>
      Array.from(fineAmountByEmployee.entries())
        .map(([employeeId, amount]) => ({
          employeeId,
          label: employeeNameById.get(employeeId) ?? employeeId,
          amount,
          amountLabel: formatCurrency(amount),
          count: periodFineRows.filter((row) => row.employeeId === employeeId).length,
        }))
        .sort((left, right) => right.amount - left.amount || right.count - left.count)
        .map(({ amount: _amount, ...row }) => row)
        .slice(0, 6),
    [employeeNameById, fineAmountByEmployee, periodFineRows],
  )

  const requestTypeData = React.useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of filteredRequestRows) {
      const label = requestKindLabel(row.kind)
      grouped.set(label, (grouped.get(label) ?? 0) + 1)
    }

    return Array.from(grouped.entries())
      .map(([label, value], index) => ({
        label,
        value,
        color: DRILL_COLORS[index % DRILL_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value)
  }, [filteredRequestRows])

  const requestTypeStatusData = React.useMemo(() => {
    const grouped = new Map<string, {
      label: string
      total: number
      borrador: number
      pendiente: number
      en_aprobacion: number
      aprobado: number
      rechazado: number
      cancelado: number
    }>()

    for (const row of filteredRequestRows) {
      const label = requestKindLabel(row.kind)
      const status = row.requestStatus as 'borrador' | 'pendiente' | 'en_aprobacion' | 'aprobado' | 'rechazado' | 'cancelado'
      const current = grouped.get(label) ?? {
        label,
        total: 0,
        borrador: 0,
        pendiente: 0,
        en_aprobacion: 0,
        aprobado: 0,
        rechazado: 0,
        cancelado: 0,
      }

      current.total += 1
      current[status] += 1
      grouped.set(label, current)
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
  }, [filteredRequestRows])

  const requestStatusData = React.useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of filteredRequestRows) {
      grouped.set(row.requestStatus, (grouped.get(row.requestStatus) ?? 0) + 1)
    }

    return Array.from(grouped.entries())
      .map(([label, value], index) => ({
        label,
        value,
        color: DRILL_COLORS[(index + 2) % DRILL_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value)
  }, [filteredRequestRows])

  const requestTrendData = React.useMemo(() => {
    if (!data) return []

    const dates = enumerateDates(data.time.from, data.time.to)
    return dates.map((date) => ({
      label: formatDateLabel(date),
      created: filteredRequestRows.filter((row) => row.createdAt.slice(0, 10) === date).length,
      resolved: filteredRequestRows.filter((row) => row.resolvedAt?.slice(0, 10) === date).length,
    }))
  }, [data, filteredRequestRows])

  const requestResolutionAvgHours = React.useMemo(() => {
    const resolved = filteredRequestRows.filter((row) => row.resolvedAt)
    if (!resolved.length) return 0
    return resolved.reduce((acc, row) => acc + differenceInHours(row.submittedAt ?? row.createdAt, row.resolvedAt), 0) / resolved.length
  }, [filteredRequestRows])

  const backlogData = React.useMemo(() => {
    const grouped = new Map<string, { label: string; pending: number; overdue: number; color: string }>()

    for (const step of approvalSteps) {
      const request = requestsById.get(step.approvalRequestId)
      if (!request || request.overallStatus !== 'en_aprobacion') continue
      if (step.status !== 'pendiente' || !step.activatedAt) continue

      const label = resolveApproverLabel(step, data?.approvalSetupContext ?? null)
      const current = grouped.get(label)
      const overdue = differenceInHours(step.activatedAt, new Date().toISOString()) >= 24 ? 1 : 0

      if (current) {
        current.pending += 1
        current.overdue += overdue
        continue
      }

      grouped.set(label, {
        label,
        pending: 1,
        overdue,
        color: '#22d3ee',
      })
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.pending - left.pending || right.overdue - left.overdue)
      .slice(0, 6)
  }, [approvalSteps, data?.approvalSetupContext, requestsById])

  const bottleneckData = React.useMemo(
    () => buildApprovalBottlenecks(approvalSteps, requestsById),
    [approvalSteps, requestsById],
  )

  const vacationTimelineDates = React.useMemo(() => {
    if (!data) return []
    return enumerateDates(data.time.from, data.time.to)
  }, [data])

  const vacationTimelineItems = React.useMemo<VacationTimelineItem[]>(
    () =>
      periodVacationRows
        .filter((row) => row.requestStatus !== 'cancelado')
        .map((row) => ({
          id: row.id,
          employeeId: row.employeeId,
          employeeName: employeeNameById.get(row.employeeId) ?? row.employeeId,
          orgLabel: employeeOrgMetaById.get(row.employeeId)?.pathLabel ?? scopeLabel,
          impactLabel: employeeOrgMetaById.get(row.employeeId)?.impactLabel ?? scopeLabel,
          startDate: row.periodStart ?? data?.time.from ?? '',
          endDate: row.periodEnd ?? data?.time.to ?? '',
          daysRequested: row.daysRequested ?? 0,
          status: row.requestStatus,
        }))
        .sort((left, right) => {
          const rank = (status: string) => {
            if (status === 'aprobado') return 0
            if (status === 'en_aprobacion') return 1
            if (status === 'pendiente') return 2
            if (status === 'rechazado') return 3
            if (status === 'borrador') return 4
            return 5
          }

          return rank(left.status) - rank(right.status) ||
            left.startDate.localeCompare(right.startDate) ||
            left.employeeName.localeCompare(right.employeeName)
        }),
    [data?.time.from, data?.time.to, employeeNameById, employeeOrgMetaById, periodVacationRows, scopeLabel],
  )

  const vacationHeatmapRows = React.useMemo(() => {
    const dates = vacationTimelineDates.slice(0, 18)
    const grouped = new Map<string, number[]>()

    for (const item of vacationTimelineItems) {
      if (item.status !== 'aprobado') continue

      const label = item.impactLabel || scopeLabel
      const current = grouped.get(label) ?? dates.map(() => 0)

      dates.forEach((date, index) => {
        if (item.startDate <= date && item.endDate >= date) {
          current[index] += 1
        }
      })

      grouped.set(label, current)
    }

    return Array.from(grouped.entries())
      .map(([label, values]) => ({
        label,
        values,
        total: values.reduce((acc, value) => acc + value, 0),
      }))
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
      .slice(0, 8)
      .map(({ total: _total, ...row }) => row)
  }, [scopeLabel, vacationTimelineDates, vacationTimelineItems])

  const collaboratorRowByEmployeeId = React.useMemo(() => {
    const orgUnitByEmployeeId = new Map(
      (data?.orgAssignments ?? []).map((assignment) => [assignment.employee_id, assignment.org_unit_id]),
    )

    return new Map<string, DetailTableRow>(
      activeSummaries.map((summary) => [
        summary.employeeId,
        {
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
          employeeCode: summary.employeeCode,
          orgPath: buildOrgPath(data?.orgUnits ?? [], orgUnitByEmployeeId.get(summary.employeeId) ?? null),
          punctualityPct:
            summary.onTimeCount + summary.lateCount > 0
              ? (summary.onTimeCount / (summary.onTimeCount + summary.lateCount)) * 100
              : 0,
          lateCount: summary.lateCount,
          absenceCount: summary.absenceCount,
          fineAmount: fineAmountByEmployee.get(summary.employeeId) ?? 0,
          fineCount: fineCountByEmployee.get(summary.employeeId) ?? 0,
          pendingRequests: pendingRequestCountByEmployee.get(summary.employeeId) ?? 0,
          justificationCount: justificationCountByEmployee.get(summary.employeeId) ?? 0,
          permissionCount: permissionCountByEmployee.get(summary.employeeId) ?? 0,
          onVacationToday: onVacationTodayIds.has(summary.employeeId),
        },
      ]),
    )
  }, [
    activeSummaries,
    data?.orgAssignments,
    data?.orgUnits,
    fineAmountByEmployee,
    fineCountByEmployee,
    justificationCountByEmployee,
    onVacationTodayIds,
    pendingRequestCountByEmployee,
    permissionCountByEmployee,
  ])

  const detailRows = React.useMemo(() => {
    const text = deferredSearch.trim().toLowerCase()

    return scopedSummaries
      .map((summary) => collaboratorRowByEmployeeId.get(summary.employeeId))
      .filter((row): row is DetailTableRow => row != null)
      .filter((row) => {
        if (!text) return true
        return `${row.employeeName} ${row.employeeCode ?? ''} ${row.orgPath}`.toLowerCase().includes(text)
      })
      .sort((left, right) =>
        right.pendingRequests - left.pendingRequests ||
        right.fineAmount - left.fineAmount ||
        right.lateCount - left.lateCount ||
        left.employeeName.localeCompare(right.employeeName),
      )
  }, [collaboratorRowByEmployeeId, deferredSearch, scopedSummaries])

  const collaboratorScopeRows = React.useMemo<CollaboratorScopeRow[]>(() => {
    if (!collaboratorScope) return []

    const rows = collectPeopleAtPath(orgRosterRows, collaboratorScope.pathIds)
      .map((row) => collaboratorRowByEmployeeId.get(row.employeeId))
      .filter((row): row is DetailTableRow => row != null)
      .sort((left, right) =>
        right.pendingRequests - left.pendingRequests ||
        right.fineAmount - left.fineAmount ||
        left.employeeName.localeCompare(right.employeeName),
      )

    return rows
  }, [collaboratorRowByEmployeeId, collaboratorScope, orgRosterRows])

  const detailPayload = React.useMemo<CollaboratorDetailPayload | null>(() => {
    if (!selectedEmployeeId) return null

    const summary = scopedSummaries.find((item) => item.employeeId === selectedEmployeeId)
    if (!summary) return null

    const orgPath = buildOrgPath(data?.orgUnits ?? [], data?.orgAssignments.find((assignment) => assignment.employee_id === selectedEmployeeId)?.org_unit_id)
    const recentRequests = requestRows
      .filter((row) => row.employeeId === selectedEmployeeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 5)
    const recentFines = fineRows
      .filter((row) => row.employeeId === selectedEmployeeId)
      .sort((left, right) => right.incidentDate.localeCompare(left.incidentDate))
      .slice(0, 5)
    const recentVacations = vacationRows
      .filter((row) => row.employeeId === selectedEmployeeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 4)

    return {
      employeeId: selectedEmployeeId,
      employeeName: summary.employeeName,
      employeeCode: summary.employeeCode,
      orgPath,
      punctualityPct: summary.onTimeCount + summary.lateCount > 0 ? (summary.onTimeCount / (summary.onTimeCount + summary.lateCount)) * 100 : 0,
      absenteeismPct: summary.expectedDays > 0 ? (summary.absenceCount / summary.expectedDays) * 100 : 0,
      lateCount: summary.lateCount,
      absenceCount: summary.absenceCount,
      fineAmount: fineAmountByEmployee.get(selectedEmployeeId) ?? 0,
      fineCount: fineCountByEmployee.get(selectedEmployeeId) ?? 0,
      pendingRequests: pendingRequestCountByEmployee.get(selectedEmployeeId) ?? 0,
      approvedVacations: vacationApprovedCountByEmployee.get(selectedEmployeeId) ?? 0,
      recentRequests,
      recentFines,
      recentVacations,
    }
  }, [
    data?.orgAssignments,
    data?.orgUnits,
    fineAmountByEmployee,
    fineCountByEmployee,
    fineRows,
    pendingRequestCountByEmployee,
    requestRows,
    scopedSummaries,
    selectedEmployeeId,
    vacationApprovedCountByEmployee,
    vacationRows,
  ])

  const hierarchyExplorerSlices = React.useMemo<OrgHierarchyExplorerSlice[]>(() => {
    const headcountSlices = buildOrgSlices(metricRows.headcount, selectedPathIds, DRILL_COLORS, 'headcount')
    const attentionMap = new Map(buildOrgSlices(auxiliaryMetricRows.attention_points, selectedPathIds, DRILL_COLORS, 'attention_points').map((slice) => [slice.pathIds.join('.'), slice.value]))
    const headcountMap = new Map(headcountSlices.map((slice) => [slice.pathIds.join('.'), slice.value]))
    const lateMap = new Map(buildOrgSlices(metricRows.late, selectedPathIds, DRILL_COLORS, 'late').map((slice) => [slice.pathIds.join('.'), slice.value]))
    const absenceMap = new Map(buildOrgSlices(metricRows.absence, selectedPathIds, DRILL_COLORS, 'absence').map((slice) => [slice.pathIds.join('.'), slice.value]))
    const pendingMap = new Map(buildOrgSlices(metricRows.requests_pending, selectedPathIds, DRILL_COLORS, 'requests_pending').map((slice) => [slice.pathIds.join('.'), slice.value]))
    const fineAmountMap = new Map(buildOrgSlices(metricRows.fine_amount, selectedPathIds, DRILL_COLORS, 'fine_amount').map((slice) => [slice.pathIds.join('.'), slice.value]))
    const justificationsMap = new Map(buildOrgSlices(auxiliaryMetricRows.justifications, selectedPathIds, DRILL_COLORS, 'justifications').map((slice) => [slice.pathIds.join('.'), slice.value]))
    const permissionsMap = new Map(buildOrgSlices(auxiliaryMetricRows.permissions, selectedPathIds, DRILL_COLORS, 'permissions').map((slice) => [slice.pathIds.join('.'), slice.value]))

    return headcountSlices
      .map((slice) => {
        const key = slice.pathIds.join('.')

        return {
          id: `${slice.nodeId ?? slice.label}-${key}`,
          label: slice.label,
          pathIds: slice.pathIds,
          hasChildren: slice.hasChildren,
          color: slice.color,
          headcount: headcountMap.get(key) ?? 0,
          lateCount: lateMap.get(key) ?? 0,
          absenceCount: absenceMap.get(key) ?? 0,
          pendingRequests: pendingMap.get(key) ?? 0,
          justificationCount: justificationsMap.get(key) ?? 0,
          permissionCount: permissionsMap.get(key) ?? 0,
          fineAmount: fineAmountMap.get(key) ?? 0,
          attentionPoints: attentionMap.get(key) ?? 0,
        }
      })
      .sort((left, right) =>
        right.attentionPoints - left.attentionPoints ||
        right.pendingRequests - left.pendingRequests ||
        right.fineAmount - left.fineAmount ||
        right.headcount - left.headcount ||
        left.label.localeCompare(right.label),
      )
  }, [auxiliaryMetricRows.attention_points, auxiliaryMetricRows.justifications, auxiliaryMetricRows.permissions, metricRows.absence, metricRows.fine_amount, metricRows.headcount, metricRows.late, metricRows.requests_pending, selectedPathIds])

  const topApprovers = backlogData.slice(0, 5)
  const topBottlenecks = bottleneckData.slice(0, 5)
  const currentLevelLabel = drillSlices[0]?.levelLabel ?? (scopeSegments.length ? 'Colaborador' : 'Nivel 1')
  const collaboratorScopeLabel = collaboratorScope
    ? getRowPathLabels(orgRosterRows, collaboratorScope.pathIds).map((segment) => segment.label).join(' / ')
    : ''
  const handleHierarchySliceSelect = React.useCallback((slice: OrgHierarchyExplorerSlice) => {
    startTransition(() => {
      setSelectedPathIds(slice.pathIds)
    })

    if (!slice.hasChildren) {
      setCollaboratorScope({
        pathIds: slice.pathIds,
        label: slice.label,
        levelLabel: currentLevelLabel,
      })
    } else {
      setCollaboratorScope(null)
    }
  }, [currentLevelLabel, startTransition])

  const handleMetricDrillSelect = React.useCallback((slice: { pathIds: string[]; hasChildren: boolean; label: string; levelLabel: string }) => {
    startTransition(() => {
      setSelectedPathIds(slice.pathIds)
    })

    if (!slice.hasChildren) {
      setCollaboratorScope({
        pathIds: slice.pathIds,
        label: slice.label,
        levelLabel: slice.levelLabel,
      })
    } else {
      setCollaboratorScope(null)
    }
  }, [startTransition])

  const tenantStatusTone =
    dashboard.tenantStatus === 'active'
      ? 'good'
      : dashboard.tenantStatus === 'trial'
        ? 'info'
        : dashboard.tenantStatus === 'paused'
          ? 'warn'
          : 'neutral'
  const hasPartialVisibility =
    data != null && (
      data.fineDataset.unavailable ||
      data.requestDataset.unavailable ||
      data.approvalRequestsDataset.unavailable ||
      data.approvalStepsDataset.unavailable
    )

  const executiveCards: ExecutiveCardConfig[] = [
    {
      label: 'Total colaboradores',
      value: formatCompactNumber(scopedSummaries.length),
      subtitle: 'Base activa dentro del nodo visible del organigrama.',
      icon: <Users size={18} className="text-cyan-100" />,
      accentClass: 'from-cyan-500/18 via-cyan-300/10 to-transparent',
      tone: 'info' as const,
      chip: currentLevelLabel,
    },
    {
      label: 'Puntualidad',
      value: formatPercent(punctualityPct),
      subtitle: `${formatCompactNumber(scopedLate)} atraso(s) dentro del periodo visible.`,
      icon: <AlarmClockCheck size={18} className="text-emerald-100" />,
      accentClass: 'from-emerald-500/18 via-lime-400/10 to-transparent',
      tone: punctualityPct >= 93 ? 'good' : punctualityPct >= 85 ? 'warn' : 'bad',
      chip: 'Disciplina',
    },
    {
      label: 'Ausentismo',
      value: formatPercent(absenteeismPct),
      subtitle: `${formatCompactNumber(scopedAbsence)} ausencia(s) respecto a dias esperados.`,
      icon: <Clock3 size={18} className="text-amber-100" />,
      accentClass: 'from-amber-500/18 via-orange-300/10 to-transparent',
      tone: absenteeismPct <= 4 ? 'good' : absenteeismPct <= 7 ? 'warn' : 'bad',
      chip: 'Asistencia',
    },
    {
      label: 'Multas total monto',
      value: formatCurrency(totalFineAmount),
      subtitle: 'Impacto economico acumulado por falta y atraso en el periodo.',
      icon: <CircleDollarSign size={18} className="text-rose-100" />,
      accentClass: 'from-rose-500/18 via-red-300/10 to-transparent',
      tone: totalFineAmount > 0 ? 'warn' : 'good',
      chip: `${totalFineCount} multa(s)`,
    },
    {
      label: 'Vacaciones aprobadas mes',
      value: formatCompactNumber(approvedVacationMonth),
      subtitle: `${requestedVacationMonth} solicitudes y ${rejectedVacationMonth} rechazadas en el mes actual.`,
      icon: <CalendarRange size={18} className="text-emerald-100" />,
      accentClass: 'from-emerald-500/18 via-teal-300/10 to-transparent',
      tone: 'good' as const,
      chip: `${onVacationToday} hoy`,
    },
    {
      label: 'Solicitudes pendientes',
      value: formatCompactNumber(pendingRequestsTotal),
      subtitle: 'Borradores fuera, solo estados pendientes o en aprobacion.',
      icon: <FileClock size={18} className="text-fuchsia-100" />,
      accentClass: 'from-fuchsia-500/18 via-violet-300/10 to-transparent',
      tone: pendingRequestsTotal > 0 ? 'warn' : 'good',
      chip: requestKind === 'all' ? 'Todos los modulos' : 'Filtrado',
    },
  ]

  if (dashboard.tenantLoading || dashboard.isLoading || !data) {
    return <DashboardSkeleton />
  }

  if (dashboard.error) {
    return (
      <Card title="Dashboard no disponible" subtitle="No se pudieron consolidar las fuentes analiticas del tenant." className="rounded-[2rem] border-white/10 bg-[#08111d]/92">
        <EmptyPanel
          title="No fue posible cargar el dashboard"
          description={dashboard.error instanceof Error ? dashboard.error.message : 'Revisa la conectividad y las tablas necesarias del tenant.'}
        />
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-[#07111d]/92 px-5 py-6 shadow-soft sm:px-6">
          <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-12 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">Dashboard BI</Badge>
                <Badge tone="good">Drill-down organizacional</Badge>
                <Badge tone="warn">Solicitudes + aprobaciones</Badge>
                <Badge tone={tenantStatusTone}>{dashboard.tenantStatus ? `Tenant ${dashboard.tenantStatus}` : 'Tenant'}</Badge>
                {hasPartialVisibility ? <Badge tone="warn">Visibilidad parcial</Badge> : null}
              </div>

              <div className="space-y-3">
                <h1 className="text-[clamp(2rem,4vw,3.4rem)] font-semibold tracking-tight text-white">
                  Analitica gerencial de HRCloud Base
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-white/68 sm:text-base">
                  El dashboard cruza asistencia, disciplina, vacaciones, solicitudes y aprobaciones con el organigrama real
                  del tenant. Toda la lectura baja jerarquicamente desde empresa hasta colaborador sin perder contexto.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Periodo visible</div>
                <div className="mt-2 text-lg font-semibold text-white">{formatDateLabel(data.time.from)} - {formatDateLabel(data.time.to)}</div>
                <div className="mt-2 text-sm text-white/58">{data.time.timeZone}</div>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Scope actual</div>
                <div className="mt-2 text-lg font-semibold text-white">{scopeLabel}</div>
                <div className="mt-2 text-sm text-white/58">{scopeSegments.length ? `${scopeSegments.length} nivel(es)` : 'Vista tenant completa'}</div>
              </div>
            </div>
          </div>
        </section>

        <FiltersBar
          period={period}
          onPeriodChange={(next) => {
            startTransition(() => {
              setPeriod(next)
              setSelectedPathIds([])
            })
          }}
          requestStatus={requestStatus}
          onRequestStatusChange={setRequestStatus}
          requestKind={requestKind}
          onRequestKindChange={setRequestKind}
          drillMetric={drillMetric}
          onDrillMetricChange={(next) => setDrillMetric(next as DashboardDrillMetric)}
          drillMetricOptions={DRILL_METRIC_OPTIONS}
          search={search}
          onSearchChange={setSearch}
        />

        <OrgBreadcrumb
          segments={scopeSegments}
          onReset={() => startTransition(() => setSelectedPathIds([]))}
          onSelect={(index) => startTransition(() => setSelectedPathIds(scopeSegments.slice(0, index + 1).map((segment) => segment.id)))}
        />

        <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
          {executiveCards.map((card) => (
            <KPICard key={card.label} {...card} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <React.Suspense fallback={<SkeletonPanel className="h-[42rem]" />}>
            <DrilldownChart
              title="Drill-down jerarquico"
              subtitle="Selecciona una unidad y profundiza nivel por nivel sobre el organigrama activo."
              scopeLabel={scopeLabel}
              metricLabel={DRILL_METRIC_OPTIONS.find((option) => option.value === drillMetric)?.label ?? drillMetric}
              currentLevelLabel={currentLevelLabel}
              slices={drillSlices}
              currentPathLabels={scopeSegments.map((segment) => segment.label)}
              onSliceSelect={handleMetricDrillSelect}
              onBack={() => startTransition(() => setSelectedPathIds((current) => current.slice(0, -1)))}
              onReset={() => startTransition(() => setSelectedPathIds([]))}
              formatValue={(value) => metricValueLabel(drillMetric, value)}
            />
          </React.Suspense>

          <PendingApprovalsSummary
            myPendingApprovals={myPendingApprovals}
            topApprovers={topApprovers}
            topBottlenecks={topBottlenecks}
            unavailable={data.approvalRequestsDataset.unavailable || data.approvalStepsDataset.unavailable}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
          <React.Suspense fallback={<SkeletonPanel className="h-[40rem]" />}>
            <AttendanceDisciplineOverview
              scopeLabel={scopeLabel}
              punctualityPct={punctualityPct}
              lateCount={scopedLate}
              absenceCount={scopedAbsence}
              trendData={attendanceTrendData}
            />
          </React.Suspense>

          <React.Suspense fallback={<SkeletonPanel className="h-[40rem]" />}>
            <FinesAnalytics
              scopeLabel={scopeLabel}
              totalAmountLabel={formatCurrency(totalFineAmount)}
              totalCount={totalFineCount}
              typeData={fineTypeData}
              orgData={fineOrgData}
              trendData={fineTrendData}
              topEmployees={topFineEmployees}
              unavailable={data.fineDataset.unavailable}
              onEmployeeSelect={setSelectedEmployeeId}
            />
          </React.Suspense>
        </section>

        <React.Suspense fallback={<SkeletonPanel className="h-[52rem]" />}>
          <RequestsAnalytics
            scopeLabel={scopeLabel}
            totalRequests={filteredRequestRows.length}
            pendingRequests={pendingRequestsTotal}
            avgResolutionHours={requestResolutionAvgHours}
            typeData={requestTypeData}
            statusData={requestStatusData}
            typeStatusData={requestTypeStatusData}
            trendData={requestTrendData}
            backlogData={backlogData}
            bottleneckData={bottleneckData}
          />
        </React.Suspense>

        <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
          <KPICard
            label="Vacaciones solicitadas mes"
            value={formatCompactNumber(requestedVacationMonth)}
            subtitle="Solicitudes del modulo de vacaciones en el mes actual."
            icon={<CalendarRange size={18} className="text-cyan-100" />}
            accentClass="from-cyan-500/18 via-sky-300/10 to-transparent"
            tone="info"
          />
          <KPICard
            label="Vacaciones aprobadas mes"
            value={formatCompactNumber(approvedVacationMonth)}
            subtitle="Solicitudes aprobadas y listas para planificacion."
            icon={<BriefcaseBusiness size={18} className="text-emerald-100" />}
            accentClass="from-emerald-500/18 via-teal-300/10 to-transparent"
            tone="good"
          />
          <KPICard
            label="Vacaciones rechazadas mes"
            value={formatCompactNumber(rejectedVacationMonth)}
            subtitle="Casos devueltos o cerrados negativamente en el mes."
            icon={<Layers3 size={18} className="text-amber-100" />}
            accentClass="from-amber-500/18 via-orange-300/10 to-transparent"
            tone={rejectedVacationMonth > 0 ? 'warn' : 'neutral'}
          />
          <KPICard
            label="Colaboradores de vacaciones hoy"
            value={formatCompactNumber(onVacationToday)}
            subtitle="Cruce directo sobre solicitudes aprobadas vigentes hoy."
            icon={<Sparkles size={18} className="text-fuchsia-100" />}
            accentClass="from-fuchsia-500/18 via-violet-300/10 to-transparent"
            tone="info"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <React.Suspense fallback={<SkeletonPanel className="h-[34rem]" />}>
            <VacationTimeline
              scopeLabel={scopeLabel}
              dates={vacationTimelineDates}
              items={vacationTimelineItems}
              onEmployeeSelect={setSelectedEmployeeId}
            />
          </React.Suspense>

          <React.Suspense fallback={<SkeletonPanel className="h-[34rem]" />}>
            <VacationHeatmap
              scopeLabel={scopeLabel}
              dates={vacationTimelineDates}
              rows={vacationHeatmapRows}
            />
          </React.Suspense>
        </section>

        <React.Suspense fallback={<SkeletonPanel className="h-[44rem]" />}>
          <OrgHierarchyExplorer
            scopeLabel={scopeLabel}
            currentLevelLabel={currentLevelLabel}
            currentPathLabels={scopeSegments.map((segment) => segment.label)}
            slices={hierarchyExplorerSlices}
            onSliceSelect={handleHierarchySliceSelect}
            onBack={() => startTransition(() => setSelectedPathIds((current) => current.slice(0, -1)))}
            onReset={() => startTransition(() => setSelectedPathIds([]))}
          />
        </React.Suspense>

        <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <Card
            title="Top colaboradores por foco actual"
            subtitle={`Ranking dentro de ${scopeLabel}. Nunca se muestra fuera del contexto organizacional seleccionado.`}
            className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
          >
            {detailRows.length ? (
              <div className="space-y-3">
                {detailRows.slice(0, 6).map((row, index) => (
                  <button
                    key={row.employeeId}
                    type="button"
                    onClick={() => setSelectedEmployeeId(row.employeeId)}
                    className="flex w-full items-center justify-between gap-4 rounded-[1.45rem] border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/9"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{row.employeeName}</p>
                        <p
                          className="mt-1 truncate text-xs text-white/50"
                          title={`${row.pendingRequests} pendientes | ${formatCurrency(row.fineAmount)}`}
                        >
                          {row.pendingRequests} pendientes | {formatCurrency(row.fineAmount)}
                        </p>
                      </div>
                    </div>
                    <Badge tone={row.pendingRequests > 0 ? 'warn' : row.fineAmount > 0 ? 'bad' : 'good'}>
                      {row.onVacationToday ? 'Vacaciones' : 'Activo'}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="Sin ranking contextual"
                description="No hay colaboradores visibles en el nodo actual del organigrama."
              />
            )}
          </Card>

          <Card
            title="Accesos rapidos"
            subtitle="Entradas directas a las vistas operativas que complementan el dashboard."
            className="rounded-[2rem] border-white/10 bg-[#08111d]/92"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Bandeja de aprobaciones', to: '/management/approvals', tone: 'warn' as const },
                { label: 'Solicitudes', to: '/management/requests', tone: 'info' as const },
                { label: 'Vacaciones', to: '/management/requests/vacations', tone: 'good' as const },
                { label: 'Reportes de multas', to: '/reports/multas', tone: 'bad' as const },
              ].map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex min-h-[7rem] flex-col items-start justify-between rounded-[1.5rem] border border-white/10 bg-white/6 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/9"
                >
                  <Badge tone={item.tone}>{item.label}</Badge>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/74">
                    Abrir vista
                    <ArrowUpRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </section>
      </div>

      <CollaboratorScopeModal
        open={collaboratorScope != null}
        scopeLabel={collaboratorScopeLabel || collaboratorScope?.label || scopeLabel}
        currentLevelLabel={collaboratorScope?.levelLabel ?? currentLevelLabel}
        rows={collaboratorScopeRows}
        onClose={() => setCollaboratorScope(null)}
        onEmployeeSelect={(employeeId) => {
          setCollaboratorScope(null)
          setSelectedEmployeeId(employeeId)
        }}
      />

      <DetailDrawer
        open={detailPayload != null}
        detail={detailPayload}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </>
  )
}
