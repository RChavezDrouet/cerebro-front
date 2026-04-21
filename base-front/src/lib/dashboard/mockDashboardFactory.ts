import type { OrgLevelDefinition, OrgUnit } from '@/lib/orgStructure'

import type {
  DashboardPunchSourceRow,
  DailyAttendanceRow,
  DashboardPeriod,
  EmployeeRosterRow,
  FineLedgerRow,
  OptionalDataset,
  OrgAssignmentRow,
  OvertimeRequestRow,
  PermissionRequestRow,
  TenantNoveltyRow,
} from './hrDashboard'
import {
  buildMockOrgLevels,
  buildMockOrgUnits,
  MOCK_DASHBOARD_TENANT_ID,
  MOCK_DEPARTMENTS,
  MOCK_FIRST_NAMES,
  MOCK_JOURNEYS,
  MOCK_LAST_NAMES,
  MOCK_OPERATIONAL_NOVELTIES,
  MOCK_PERMISSION_LABELS,
  MOCK_SECOND_NAMES,
  MOCK_UNASSIGNED_POOL,
  type MockJourneyProfile,
} from './mockDashboardData'

export type DashboardMockBundle = {
  roster: EmployeeRosterRow[]
  dailyRows: DailyAttendanceRow[]
  punchSourceDataset: OptionalDataset<DashboardPunchSourceRow>
  noveltyDataset: OptionalDataset<TenantNoveltyRow>
  permissionDataset: OptionalDataset<PermissionRequestRow>
  overtimeDataset: OptionalDataset<OvertimeRequestRow>
  fineDataset: OptionalDataset<FineLedgerRow>
  orgLevels: OrgLevelDefinition[]
  orgUnits: OrgUnit[]
  orgAssignments: OrgAssignmentRow[]
}

type MockEmployeeProfile = {
  id: string
  employeeCode: string
  fullName: string
  departmentName: string | null
  topUnitId: string | null
  topUnitName: string | null
  leafUnitId: string | null
  leafUnitName: string | null
  journey: MockJourneyProfile
  risk: {
    late: number
    absence: number
    permission: number
    fine: number
    overtime: number
    novelty: number
  }
  bias: {
    late: number
    absence: number
    permission: number
    fine: number
    overtime: number
    novelty: number
  }
}

export type DashboardDataMode = 'mock' | 'real'

export function resolveDashboardDataMode(search = ''): DashboardDataMode {
  const params = new URLSearchParams(search)
  const forced = String(params.get('dashboardData') ?? '').trim().toLowerCase()

  if (forced === 'real') return 'real'
  if (forced === 'mock') return 'mock'

  return 'real'
}

export function isDashboardMockModeEnabled(search = '') {
  return resolveDashboardDataMode(search) === 'mock'
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hashString(input: string) {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function seededRatio(seed: string) {
  return hashString(seed) / 4294967295
}

function parseIsoDate(value: string) {
  return new Date(`${value}T12:00:00Z`)
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function addDays(value: string, amount: number) {
  const next = parseIsoDate(value)
  next.setUTCDate(next.getUTCDate() + amount)
  return toIsoDate(next)
}

function differenceInDays(left: string, right: string) {
  return Math.round((parseIsoDate(left).getTime() - parseIsoDate(right).getTime()) / 86_400_000)
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = []
  const cursor = parseIsoDate(from)
  const end = parseIsoDate(to)

  while (cursor <= end) {
    dates.push(toIsoDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function weightedPick<T extends { weight: number }>(items: T[], ratio: number) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = ratio * totalWeight

  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) return item
  }

  return items[items.length - 1]
}

function buildFullName(index: number) {
  const firstName = MOCK_FIRST_NAMES[index % MOCK_FIRST_NAMES.length]
  const secondName = index % 3 === 0 ? ` ${MOCK_SECOND_NAMES[(index * 3) % MOCK_SECOND_NAMES.length]}` : ''
  const lastNameA = MOCK_LAST_NAMES[(index * 5) % MOCK_LAST_NAMES.length]
  const lastNameB = MOCK_LAST_NAMES[(index * 7 + 9) % MOCK_LAST_NAMES.length]

  return `${firstName}${secondName} ${lastNameA} ${lastNameB}`.trim()
}

function buildJourneyMap() {
  return new Map(MOCK_JOURNEYS.map((journey) => [journey.label, journey]))
}

function buildMockEmployeeProfiles() {
  const journeyMap = buildJourneyMap()
  const profiles: MockEmployeeProfile[] = []
  let employeeIndex = 1

  for (const department of MOCK_DEPARTMENTS) {
    for (const unit of department.units) {
      for (let count = 0; count < unit.headcount; count += 1) {
        const id = `mock-emp-${String(employeeIndex).padStart(3, '0')}`
        const journeyLabel = weightedPick(unit.journeyMix, seededRatio(`journey|${unit.id}|${count}`)).label
        const journey = journeyMap.get(journeyLabel)

        if (!journey) continue

        profiles.push({
          id,
          employeeCode: `HC-${String(employeeIndex).padStart(3, '0')}`,
          fullName: buildFullName(employeeIndex),
          departmentName: department.name,
          topUnitId: department.id,
          topUnitName: department.name,
          leafUnitId: unit.id,
          leafUnitName: unit.name,
          journey,
          risk: unit.risk,
          bias: {
            late: 0.82 + seededRatio(`late-bias|${id}`) * 0.56,
            absence: 0.84 + seededRatio(`absence-bias|${id}`) * 0.48,
            permission: 0.8 + seededRatio(`permission-bias|${id}`) * 0.54,
            fine: 0.82 + seededRatio(`fine-bias|${id}`) * 0.52,
            overtime: 0.78 + seededRatio(`ot-bias|${id}`) * 0.72,
            novelty: 0.76 + seededRatio(`novelty-bias|${id}`) * 0.62,
          },
        })

        employeeIndex += 1
      }
    }
  }

  for (let count = 0; count < MOCK_UNASSIGNED_POOL.headcount; count += 1) {
    const id = `mock-emp-${String(employeeIndex).padStart(3, '0')}`
    const journeyLabel = weightedPick(MOCK_UNASSIGNED_POOL.journeyMix, seededRatio(`journey|unassigned|${count}`)).label
    const journey = journeyMap.get(journeyLabel)

    if (!journey) continue

    profiles.push({
      id,
      employeeCode: `HC-${String(employeeIndex).padStart(3, '0')}`,
      fullName: buildFullName(employeeIndex),
      departmentName: null,
      topUnitId: null,
      topUnitName: null,
      leafUnitId: null,
      leafUnitName: null,
      journey,
      risk: MOCK_UNASSIGNED_POOL.risk,
      bias: {
        late: 0.86 + seededRatio(`late-bias|${id}`) * 0.5,
        absence: 0.9 + seededRatio(`absence-bias|${id}`) * 0.46,
        permission: 0.84 + seededRatio(`permission-bias|${id}`) * 0.5,
        fine: 0.88 + seededRatio(`fine-bias|${id}`) * 0.48,
        overtime: 0.82 + seededRatio(`ot-bias|${id}`) * 0.56,
        novelty: 0.88 + seededRatio(`novelty-bias|${id}`) * 0.5,
      },
    })

    employeeIndex += 1
  }

  return profiles
}

function buildRoster(profiles: MockEmployeeProfile[]): EmployeeRosterRow[] {
  return profiles.map((profile) => ({
    id: profile.id,
    employeeCode: profile.employeeCode,
    fullName: profile.fullName,
    employmentStatus: 'active',
    attendanceStatus: 'active',
    departmentName: profile.departmentName,
  }))
}

function buildAssignments(profiles: MockEmployeeProfile[]): OrgAssignmentRow[] {
  return profiles.map((profile) => ({
    employee_id: profile.id,
    org_unit_id: profile.leafUnitId,
  }))
}

function buildPeriodBias(period: DashboardPeriod) {
  switch (period) {
    case 'hoy':
      return { late: 1.36, absence: 1.22, permission: 2.18, fine: 1.28, overtime: 0.92, novelty: 1.32 }
    case 'semana':
      return { late: 1.18, absence: 1.12, permission: 1.34, fine: 1.22, overtime: 1.08, novelty: 1.18 }
    case 'mes':
      return { late: 1.08, absence: 1.06, permission: 1.08, fine: 1.1, overtime: 1.18, novelty: 1.1 }
    case 'trimestre':
      return { late: 1.12, absence: 1.1, permission: 0.96, fine: 1.2, overtime: 1.28, novelty: 1.16 }
    default:
      return { late: 1, absence: 1, permission: 1, fine: 1, overtime: 1, novelty: 1 }
  }
}

function buildTemporalPressure(dateIso: string, todayIso: string) {
  const daysAgo = differenceInDays(todayIso, dateIso)
  const dayOfMonth = parseIsoDate(dateIso).getUTCDate()
  const currentWeek = daysAgo <= 6
  const previousWeek = daysAgo >= 7 && daysAgo <= 13

  return {
    daysAgo,
    late: daysAgo === 0 ? 1.54 : currentWeek ? 1.26 : previousWeek ? 0.94 : 0.86,
    absence: daysAgo === 0 ? 1.42 : currentWeek ? 1.16 : previousWeek ? 0.96 : 0.9,
    permission: daysAgo <= 2 ? 1.18 : currentWeek ? 1.08 : 1,
    fine: daysAgo === 0 ? 1.62 : currentWeek ? 1.34 : previousWeek ? 0.9 : 0.84,
    overtime: dayOfMonth >= 24 ? 1.28 : daysAgo <= 3 ? 1.16 : 1,
    novelty: daysAgo === 0 ? 1.34 : currentWeek ? 1.16 : 1.02,
  }
}

function buildOperationalPressure(profile: MockEmployeeProfile, dateIso: string, todayIso: string) {
  const daysAgo = differenceInDays(todayIso, dateIso)
  const dayOfMonth = parseIsoDate(dateIso).getUTCDate()

  let late = 1
  let absence = 1
  let permission = 1
  let fine = 1
  let overtime = 1
  let novelty = 1

  if (profile.topUnitName === 'Operaciones' && daysAgo <= 6) {
    late *= 1.16
    absence *= 1.08
    fine *= 1.18
    novelty *= 1.12
  }

  if (profile.topUnitName === 'Comercial' && daysAgo <= 2) {
    late *= 1.08
    absence *= 1.08
    permission *= 1.06
  }

  if (profile.leafUnitName === 'Campo' && daysAgo === 0) {
    absence *= 1.34
    fine *= 1.16
  }

  if (profile.leafUnitName === 'Logistica' && daysAgo <= 2) {
    late *= 1.14
    overtime *= 1.12
  }

  if (profile.leafUnitName === 'Atencion al cliente' && daysAgo <= 1) {
    absence *= 1.2
    late *= 1.08
    novelty *= 1.14
  }

  if (profile.leafUnitName === 'Nomina' && dayOfMonth >= 24) {
    overtime *= 1.42
  }

  if (profile.leafUnitName === 'Contabilidad' && dayOfMonth >= 26) {
    overtime *= 1.36
  }

  if (profile.journey.label === 'Nocturna' && daysAgo <= 2) {
    late *= 1.12
    absence *= 1.1
    fine *= 1.12
  }

  if (profile.journey.label === 'Mixta' && dayOfMonth >= 24) {
    overtime *= 1.18
  }

  return { late, absence, permission, fine, overtime, novelty }
}

function isExpectedWorkday(profile: MockEmployeeProfile, dateIso: string) {
  const date = parseIsoDate(dateIso)
  const dayOfWeek = date.getUTCDay()

  if (dayOfWeek === 0) {
    let sundayRate = profile.journey.sundayRate
    if (profile.topUnitName === 'Operaciones') sundayRate += 0.1
    if (profile.topUnitName === 'Comercial') sundayRate += 0.06
    return seededRatio(`sun|${profile.id}|${dateIso}`) < clamp(sundayRate, 0, 0.9)
  }

  if (dayOfWeek === 6) {
    let saturdayRate = profile.journey.saturdayRate
    if (profile.topUnitName === 'Operaciones') saturdayRate += 0.08
    if (profile.topUnitName === 'Comercial') saturdayRate += 0.04
    return seededRatio(`sat|${profile.id}|${dateIso}`) < clamp(saturdayRate, 0.12, 1)
  }

  return true
}

function buildTimestamp(dateIso: string, timeValue: string, crossesMidnight = false) {
  const targetDate = crossesMidnight ? addDays(dateIso, 1) : dateIso
  return `${targetDate}T${timeValue}:00-05:00`
}

function buildEntryTime(profile: MockEmployeeProfile, dateIso: string, late: boolean) {
  const [hourText, minuteText] = profile.journey.scheduleStart.split(':')
  const baseMinutes = Number(hourText) * 60 + Number(minuteText)
  const shift = late
    ? 12 + Math.floor(seededRatio(`late-minutes|${profile.id}|${dateIso}`) * 35)
    : -4 + Math.floor(seededRatio(`on-time-minutes|${profile.id}|${dateIso}`) * 11)
  const totalMinutes = Math.max(baseMinutes + shift, 0)
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const minutes = String(totalMinutes % 60).padStart(2, '0')
  return buildTimestamp(dateIso, `${hours}:${minutes}`)
}

function buildExitTime(profile: MockEmployeeProfile, dateIso: string) {
  return buildTimestamp(dateIso, profile.journey.scheduleEnd, Boolean(profile.journey.crossesMidnight))
}

function pickPermissionStatus(dateIso: string, profile: MockEmployeeProfile, todayIso: string) {
  const daysAgo = differenceInDays(todayIso, dateIso)
  const ratio = seededRatio(`permission-status|${profile.id}|${dateIso}`)
  const approvedCap = daysAgo <= 2 ? 0.48 : 0.62
  const pendingCap = daysAgo <= 2 ? 0.86 : 0.88

  if (ratio < approvedCap) return 'approved'
  if (ratio < pendingCap) return 'pending'
  return 'rejected'
}

function pickAbsenceDecision(profile: MockEmployeeProfile, dateIso: string, todayIso: string) {
  const daysAgo = differenceInDays(todayIso, dateIso)
  const ratio = seededRatio(`absence-decision|${profile.id}|${dateIso}`)
  const officeBonus = profile.topUnitName === 'RRHH' || profile.topUnitName === 'Finanzas' ? 0.08 : 0
  const justifiedCap = 0.34 + officeBonus
  const pendingCap = daysAgo <= 2 ? 0.84 : 0.74

  if (ratio < justifiedCap) return 'justified' as const
  if (ratio < pendingCap) return 'pending' as const
  return 'rejected' as const
}

function pickPermissionLabel(profile: MockEmployeeProfile, dateIso: string) {
  const index = Math.floor(seededRatio(`permission-label|${profile.id}|${dateIso}`) * MOCK_PERMISSION_LABELS.length)
  return MOCK_PERMISSION_LABELS[index] ?? 'Permiso personal'
}

function pickOperationalNovelty(profile: MockEmployeeProfile, dateIso: string) {
  const index = Math.floor(seededRatio(`novelty-label|${profile.id}|${dateIso}`) * MOCK_OPERATIONAL_NOVELTIES.length)
  return MOCK_OPERATIONAL_NOVELTIES[index] ?? 'Registro manual'
}

function pickMarkingChannel(profile: MockEmployeeProfile, dateIso: string) {
  const ratio = seededRatio(`marking-channel|${profile.id}|${dateIso}`)

  let webWeight = profile.topUnitName === 'TI' ? 0.24 : profile.topUnitName === 'RRHH' || profile.topUnitName === 'Finanzas' ? 0.18 : 0.08
  let facialWeight = profile.topUnitName === 'RRHH' || profile.topUnitName === 'Finanzas' ? 0.34 : 0.2
  let fingerprintWeight = profile.topUnitName === 'Operaciones' || profile.topUnitName === 'Comercial' ? 0.42 : 0.26
  let codeWeight = profile.journey.label === 'Nocturna' || profile.topUnitName === 'Operaciones' ? 0.22 : 0.12

  if (profile.journey.label === 'Administrativa') {
    webWeight += 0.06
    facialWeight += 0.08
    fingerprintWeight -= 0.08
  }

  if (profile.journey.label === 'Nocturna') {
    webWeight -= 0.04
    facialWeight -= 0.06
    fingerprintWeight += 0.08
    codeWeight += 0.08
  }

  if (profile.journey.label === 'Mixta') {
    webWeight += 0.04
    codeWeight += 0.04
  }

  const weights = [
    { channel: 'web' as const, weight: clamp(webWeight, 0.04, 0.34) },
    { channel: 'facial' as const, weight: clamp(facialWeight, 0.08, 0.42) },
    { channel: 'fingerprint' as const, weight: clamp(fingerprintWeight, 0.12, 0.52) },
    { channel: 'code' as const, weight: clamp(codeWeight, 0.06, 0.28) },
  ]

  return weightedPick(weights, ratio).channel
}

function buildMockDatasets(
  profiles: MockEmployeeProfile[],
  period: DashboardPeriod,
  from: string,
  to: string,
) {
  const dailyRows: DailyAttendanceRow[] = []
  const punchSourceRows: DashboardPunchSourceRow[] = []
  const noveltyRows: TenantNoveltyRow[] = []
  const permissionRows: PermissionRequestRow[] = []
  const overtimeRows: OvertimeRequestRow[] = []
  const fineRows: FineLedgerRow[] = []
  const dates = enumerateDates(from, to)
  const periodBias = buildPeriodBias(period)

  for (const dateIso of dates) {
    const temporal = buildTemporalPressure(dateIso, to)

    for (const profile of profiles) {
      if (!isExpectedWorkday(profile, dateIso)) continue

      const operational = buildOperationalPressure(profile, dateIso, to)
      const absenceProbability = clamp(
        0.045
        * profile.risk.absence
        * profile.bias.absence
        * profile.journey.absenceMultiplier
        * temporal.absence
        * operational.absence
        * periodBias.absence,
        0.016,
        0.3,
      )
      const lateProbability = clamp(
        0.138
        * profile.risk.late
        * profile.bias.late
        * profile.journey.lateMultiplier
        * temporal.late
        * operational.late
        * periodBias.late,
        0.05,
        0.42,
      )
      const noveltyProbability = clamp(
        0.08
        * profile.risk.novelty
        * profile.bias.novelty
        * temporal.novelty
        * operational.novelty
        * periodBias.novelty,
        0.03,
        0.34,
      )
      const permissionProbability = clamp(
        0.03
        * profile.risk.permission
        * profile.bias.permission
        * profile.journey.permissionMultiplier
        * temporal.permission
        * operational.permission
        * periodBias.permission,
        0.01,
        0.11,
      )
      const overtimeProbability = clamp(
        0.024
        * profile.risk.overtime
        * profile.bias.overtime
        * profile.journey.overtimeMultiplier
        * temporal.overtime
        * operational.overtime
        * periodBias.overtime,
        0.008,
        0.14,
      )

      const absenceRoll = seededRatio(`absence|${profile.id}|${dateIso}`)
      const permissionRoll = seededRatio(`permission|${profile.id}|${dateIso}`)
      const overtimeRoll = seededRatio(`overtime|${profile.id}|${dateIso}`)

      if (permissionRoll < permissionProbability) {
        const duration = seededRatio(`permission-span|${profile.id}|${dateIso}`) > 0.76 ? 2 : 1
        permissionRows.push({
          employeeId: profile.id,
          status: pickPermissionStatus(dateIso, profile, to),
          requestLabel: pickPermissionLabel(profile, dateIso),
          rangeStart: dateIso,
          rangeEnd: addDays(dateIso, duration - 1),
        })
      }

      if (absenceRoll < absenceProbability) {
        const decisionStatus = pickAbsenceDecision(profile, dateIso, to)

        dailyRows.push({
          work_date: dateIso,
          employee_id: profile.id,
          employee_code: profile.employeeCode,
          employee_name: profile.fullName,
          department_name: profile.topUnitName,
          schedule_name: profile.journey.label,
          turn_name: profile.journey.label,
          day_status: 'AUSENTE',
          novelty: 'Ausencia detectada',
          employee_active: true,
          employee_status: 'ACTIVE',
        })

        noveltyRows.push({
          employee_id: profile.id,
          employee_code: profile.employeeCode,
          employee_name: profile.fullName,
          department_name: profile.topUnitName,
          work_date: dateIso,
          day_status: 'AUSENTE',
          novelty: 'Ausencia detectada',
          decision_status: decisionStatus,
        })

        if (decisionStatus === 'rejected') {
          const fineChance = clamp(
            0.46 * profile.risk.fine * profile.bias.fine * temporal.fine * operational.fine * periodBias.fine,
            0.14,
            0.8,
          )

          if (seededRatio(`absence-fine|${profile.id}|${dateIso}`) < fineChance) {
            fineRows.push({
              employee_id: profile.id,
              incident_date: dateIso,
              applied_amount: Math.round(34 + seededRatio(`absence-fine-amount|${profile.id}|${dateIso}`) * 56),
            })
          }
        }

        continue
      }

      const isLate = seededRatio(`late|${profile.id}|${dateIso}`) < lateProbability
      const hasNovelty =
        seededRatio(`novelty|${profile.id}|${dateIso}`) < noveltyProbability
        || (isLate && seededRatio(`late-novelty|${profile.id}|${dateIso}`) < 0.42)

      dailyRows.push({
        work_date: dateIso,
        employee_id: profile.id,
        employee_code: profile.employeeCode,
        employee_name: profile.fullName,
        department_name: profile.topUnitName,
        schedule_name: profile.journey.label,
        turn_name: profile.journey.label,
        entry_at: buildEntryTime(profile, dateIso, isLate),
        exit_at: buildExitTime(profile, dateIso),
        day_status: isLate ? 'ATRASADO' : 'A_TIEMPO',
        novelty: hasNovelty ? pickOperationalNovelty(profile, dateIso) : null,
        employee_active: true,
        employee_status: 'ACTIVE',
      })

      const channel = pickMarkingChannel(profile, dateIso)
      punchSourceRows.push({
        work_date: dateIso,
        employee_id: profile.id,
        sources: [channel === 'web' ? 'WEB' : 'BIOMETRIC'],
        biometric_methods:
          channel === 'facial' ? ['Facial']
            : channel === 'fingerprint' ? ['Huella']
              : channel === 'code' ? ['Codigo']
                : null,
        biometric_verify_types:
          channel === 'facial' ? ['15']
            : channel === 'fingerprint' ? ['1']
              : channel === 'code' ? ['3']
                : null,
        serial_nos: channel === 'web' ? null : [`DEV-${profile.topUnitId ?? 'NA'}`],
      })

      if (isLate) {
        const lateFineChance = clamp(
          0.28 * profile.risk.fine * profile.bias.fine * temporal.fine * operational.fine * periodBias.fine,
          0.08,
          0.62,
        )

        if (seededRatio(`late-fine|${profile.id}|${dateIso}`) < lateFineChance) {
          fineRows.push({
            employee_id: profile.id,
            incident_date: dateIso,
            applied_amount: Math.round(14 + seededRatio(`late-fine-amount|${profile.id}|${dateIso}`) * 26),
          })
        }
      }

      if (overtimeRoll < overtimeProbability) {
        const statusRoll = seededRatio(`overtime-status|${profile.id}|${dateIso}`)
        const hoursRequested =
          1.5
          + seededRatio(`overtime-hours|${profile.id}|${dateIso}`) * (profile.journey.label === 'Mixta' ? 3.8 : 3)

        overtimeRows.push({
          employee_id: profile.id,
          requested_date: dateIso,
          hours_requested: Number(hoursRequested.toFixed(1)),
          status: statusRoll < 0.76 ? 'approved' : statusRoll < 0.9 ? 'pending' : 'rejected',
        })
      }
    }
  }

  return {
    dailyRows,
    punchSourceDataset: { rows: punchSourceRows, unavailable: false } satisfies OptionalDataset<DashboardPunchSourceRow>,
    noveltyDataset: { rows: noveltyRows, unavailable: false } satisfies OptionalDataset<TenantNoveltyRow>,
    permissionDataset: { rows: permissionRows, unavailable: false } satisfies OptionalDataset<PermissionRequestRow>,
    overtimeDataset: { rows: overtimeRows, unavailable: false } satisfies OptionalDataset<OvertimeRequestRow>,
    fineDataset: { rows: fineRows, unavailable: false } satisfies OptionalDataset<FineLedgerRow>,
  }
}

export async function buildMockDashboardBundle(args: {
  tenantId?: string | null
  period: DashboardPeriod
  from: string
  to: string
}): Promise<DashboardMockBundle> {
  const tenantId = args.tenantId ?? MOCK_DASHBOARD_TENANT_ID
  const orgLevels = buildMockOrgLevels(tenantId)
  const orgUnits = buildMockOrgUnits(tenantId)
  const profiles = buildMockEmployeeProfiles()

  return {
    roster: buildRoster(profiles),
    orgLevels,
    orgUnits,
    orgAssignments: buildAssignments(profiles),
    ...buildMockDatasets(profiles, args.period, args.from, args.to),
  }
}
