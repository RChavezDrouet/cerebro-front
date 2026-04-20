import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  ChevronRight,
  Clock3,
  Layers3,
  Radar,
  Search,
  Sparkles,
  TimerReset,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'

import { ExecutiveTrendChart } from '@/components/dashboard/ExecutiveTrendChart'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import {
  fetchOrgLevelDefinitions,
  fetchOrgUnits,
  type OrgLevelDefinition,
  type OrgUnit,
} from '@/lib/orgStructure'
import {
  buildAttendanceChannelPulse,
  buildDashboardKpis,
  buildEmployeeSummaries,
  buildJourneyMetrics,
  buildMetricBaseRows,
  buildMetricStatusBreakdown,
  fetchCurrentOrgAssignments,
  fetchDailyAttendanceRows,
  fetchEmployeeRoster,
  fetchFineLedgerRows,
  fetchOvertimeRequestRows,
  fetchPunchSourceRows,
  fetchPermissionRequestRows,
  fetchTenantNoveltyRows,
  filterSummariesByJourney,
  formatCurrency,
  formatHours,
  formatNumber,
  formatPeriodLabel,
  periodRange,
  type DashboardEmployeeSummary,
  type DashboardMetricKey,
  type DashboardPeriod,
} from '@/lib/dashboard/hrDashboard'
import {
  buildMockDashboardBundle,
  resolveDashboardDataMode,
} from '@/lib/dashboard/mockDashboardFactory'
import { baseDebug } from '@/lib/debug'
import {
  buildOrgMetricRows,
  buildOrgSlices,
  collectPeopleAtPath,
  getOrgDepth,
  type OrgDrillSlice,
  type OrgMetricRow,
} from './dashboardOrgDrill'

type DashboardBundle = {
  roster: Awaited<ReturnType<typeof fetchEmployeeRoster>>
  dailyRows: Awaited<ReturnType<typeof fetchDailyAttendanceRows>>
  punchSourceDataset: Awaited<ReturnType<typeof fetchPunchSourceRows>>
  noveltyDataset: Awaited<ReturnType<typeof fetchTenantNoveltyRows>>
  permissionDataset: Awaited<ReturnType<typeof fetchPermissionRequestRows>>
  overtimeDataset: Awaited<ReturnType<typeof fetchOvertimeRequestRows>>
  fineDataset: Awaited<ReturnType<typeof fetchFineLedgerRows>>
  orgLevels: OrgLevelDefinition[]
  orgUnits: OrgUnit[]
  orgAssignments: Awaited<ReturnType<typeof fetchCurrentOrgAssignments>>
}

type DrillState = Record<DashboardMetricKey, string[]>

type PeopleDrawerState = {
  metricKey: DashboardMetricKey
  metricTitle: string
  pathLabels: string[]
  journeyLabel: string | null
  people: Array<{
    employeeId: string
    pathLabels: string[]
    metricValue: number
  }>
}

type KpiTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

type MetricConfig = {
  title: string
  shortLabel: string
  subtitle: string
  colors: string[]
  tint: string
  border: string
  tone: KpiTone
  emptyLabel: string
}

type KpiCardDefinition = {
  label: string
  value: string
  subtitle: string
  icon: React.ReactNode
  tone: KpiTone
  iconWrapClass: string
  chipLabel?: string
  chipTone?: KpiTone
}

type DashboardAbsenceBreakdown = {
  justified: number
  pending: number
  unjustified: number
}

type DashboardPermissionBreakdown = {
  approved: number
  pending: number
  rejected: number
}

const EMPTY_ABSENCE_BREAKDOWN: DashboardAbsenceBreakdown = {
  justified: 0,
  pending: 0,
  unjustified: 0,
}

const EMPTY_PERMISSION_BREAKDOWN: DashboardPermissionBreakdown = {
  approved: 0,
  pending: 0,
  rejected: 0,
}

const DASHBOARD_PERIOD_STORAGE_KEY = 'hrcloud.base.dashboard.period.v1'

const PERIODS: DashboardPeriod[] = ['hoy', 'semana', 'mes', 'trimestre']

const PERIOD_OPTIONS: Array<{
  key: DashboardPeriod
  label: string
  hint: string
}> = [
  { key: 'hoy', label: 'Diario', hint: '24h' },
  { key: 'semana', label: 'Semanal', hint: 'Vista base' },
  { key: 'mes', label: 'Mensual', hint: '30 días' },
  { key: 'trimestre', label: 'Trimestral', hint: '90 días' },
]

function isDashboardPeriod(value: string): value is DashboardPeriod {
  return PERIODS.includes(value as DashboardPeriod)
}

function readStoredDashboardPeriod(): DashboardPeriod {
  if (typeof window === 'undefined') return 'semana'

  try {
    const stored = window.sessionStorage.getItem(DASHBOARD_PERIOD_STORAGE_KEY)
    if (stored && isDashboardPeriod(stored)) {
      return stored
    }
  } catch {
    // Ignore storage failures and fall back to the default weekly view.
  }

  return 'semana'
}

function getPunctualityBand(value: number) {
  if (value >= 95) {
    return {
      label: 'Optimo',
      description: 'Muy por encima de la meta.',
      tone: 'good' as const,
    }
  }

  if (value >= 93) {
    return {
      label: 'Aceptable',
      description: 'Cumple la meta con margen ajustado.',
      tone: 'info' as const,
    }
  }

  if (value >= 88) {
    return {
      label: 'Riesgo',
      description: 'Todavia es recuperable con accion puntual.',
      tone: 'warn' as const,
    }
  }

  return {
    label: 'Critico',
    description: 'Requiere intervencion prioritaria.',
    tone: 'bad' as const,
  }
}

const METRIC_CONFIG: Record<DashboardMetricKey, MetricConfig> = {
  late: {
    title: 'Atrasos por unidad organizacional',
    shortLabel: 'Atrasos',
    subtitle: 'Explora el organigrama real para ver donde se concentra la impuntualidad.',
    colors: ['#fb7185', '#f97316', '#f59e0b', '#38bdf8', '#60a5fa', '#a78bfa', '#14b8a6'],
    tint: 'from-orange-500/16 via-rose-500/10 to-transparent',
    border: 'border-orange-400/20',
    tone: 'bad',
    emptyLabel: 'No se registraron atrasos en el periodo seleccionado.',
  },
  absence: {
    title: 'Faltas y ausentismo por unidad',
    shortLabel: 'Faltas',
    subtitle: 'Separa el ausentismo por nodo y clasifica lo justificable si la fuente existe.',
    colors: ['#ef4444', '#f97316', '#facc15', '#38bdf8', '#2dd4bf', '#818cf8', '#f472b6'],
    tint: 'from-red-500/18 via-amber-500/10 to-transparent',
    border: 'border-red-400/20',
    tone: 'bad',
    emptyLabel: 'No se detectaron faltas ni ausencias en el periodo.',
  },
  permission: {
    title: 'Permisos por unidad organizacional',
    shortLabel: 'Permisos',
    subtitle: 'Agrupa permisos aprobados, pendientes y rechazados sobre el organigrama real.',
    colors: ['#a855f7', '#8b5cf6', '#38bdf8', '#14b8a6', '#22c55e', '#f59e0b', '#fb7185'],
    tint: 'from-violet-500/18 via-fuchsia-500/10 to-transparent',
    border: 'border-violet-400/20',
    tone: 'info',
    emptyLabel: 'No se registraron permisos en el rango actual.',
  },
  fine: {
    title: 'Multas por unidad organizacional',
    shortLabel: 'Multas',
    subtitle: 'Mide monto economico afectado por multas, no solo volumen de incidentes.',
    colors: ['#e11d48', '#ef4444', '#fb7185', '#f59e0b', '#38bdf8', '#a78bfa', '#34d399'],
    tint: 'from-rose-600/18 via-red-500/10 to-transparent',
    border: 'border-rose-500/20',
    tone: 'warn',
    emptyLabel: 'No hay multas registradas para este periodo.',
  },
  overtime: {
    title: 'Horas extra por unidad organizacional',
    shortLabel: 'Horas extra',
    subtitle: 'Distribuye horas extra aprobadas sobre la estructura operativa del tenant.',
    colors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#22c55e'],
    tint: 'from-cyan-500/18 via-sky-500/10 to-transparent',
    border: 'border-cyan-400/20',
    tone: 'info',
    emptyLabel: 'No se registraron horas extra aprobadas en el periodo.',
  },
}

const JOURNEY_METRIC_OPTIONS: Array<{ key: DashboardMetricKey; label: string }> = [
  { key: 'late', label: 'Atrasos' },
  { key: 'absence', label: 'Faltas' },
  { key: 'overtime', label: 'Horas extra' },
  { key: 'permission', label: 'Permisos' },
]

function createEmptyDrillState(): DrillState {
  return {
    late: [],
    absence: [],
    permission: [],
    fine: [],
    overtime: [],
  }
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function isAbsenceBreakdown(
  breakdown: ReturnType<typeof buildMetricStatusBreakdown>,
): breakdown is DashboardAbsenceBreakdown {
  return breakdown !== null && 'justified' in breakdown && 'unjustified' in breakdown
}

function isPermissionBreakdown(
  breakdown: ReturnType<typeof buildMetricStatusBreakdown>,
): breakdown is DashboardPermissionBreakdown {
  return breakdown !== null && 'approved' in breakdown && 'rejected' in breakdown
}

function formatPercent(value: number) {
  return `${formatNumber(safePercent(value))}%`
}

function formatMetricValue(metricKey: DashboardMetricKey, value: number) {
  if (metricKey === 'fine') return formatCurrency(value)
  if (metricKey === 'overtime') return formatHours(value)
  return formatNumber(value)
}

function buildShareLabel(value: number, total: number) {
  if (total <= 0) return 'Sin peso relativo'
  return `${formatPercent((value / total) * 100)} del total`
}

function computeRealOrgDepth(
  orgUnits: OrgUnit[],
  orgLevels: OrgLevelDefinition[],
  metricRows: Record<DashboardMetricKey, OrgMetricRow[]>,
) {
  const configuredDepth = orgUnits.reduce((maxDepth, unit) => Math.max(maxDepth, unit.level_no), 0)
  const enabledDepth = orgLevels
    .filter((level) => level.is_enabled !== false)
    .reduce((maxDepth, level) => Math.max(maxDepth, level.level_no), 0)

  const observedDepth = Math.max(
    getOrgDepth(metricRows.late),
    getOrgDepth(metricRows.absence),
    getOrgDepth(metricRows.permission),
    getOrgDepth(metricRows.fine),
    getOrgDepth(metricRows.overtime),
  )

  return Math.max(configuredDepth, enabledDepth, observedDepth, 1)
}

function buildExecutiveStatus(kpis: ReturnType<typeof buildDashboardKpis>) {
  if (kpis.punctualityPct >= 93 && kpis.absenteeismPct <= 4) {
    return {
      title: 'Operacion estable',
      tone: 'good' as const,
      description: 'La asistencia se mantiene controlada y no hay presion atipica en puntualidad.',
    }
  }

  if (kpis.absenteeismPct >= 7 || kpis.totalLate >= Math.max(12, kpis.totalCollaborators)) {
    return {
      title: 'Atencion operativa',
      tone: 'bad' as const,
      description: 'Hay friccion visible en cumplimiento y conviene profundizar por unidad y jornada.',
    }
  }

  return {
    title: 'Monitoreo activo',
    tone: 'warn' as const,
    description: 'El nivel general es recuperable, pero ya existen focos que ameritan seguimiento.',
  }
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/8 ${className}`} />
}

function toneChipClass(tone: KpiTone) {
  if (tone === 'good') return 'border-emerald-400/25 bg-emerald-500/14 text-emerald-200'
  if (tone === 'warn') return 'border-amber-400/25 bg-amber-500/14 text-amber-200'
  if (tone === 'bad') return 'border-rose-400/25 bg-rose-500/14 text-rose-200'
  if (tone === 'info') return 'border-sky-400/25 bg-sky-500/14 text-sky-200'
  return 'border-white/12 bg-white/8 text-white/70'
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200',
        active
          ? 'border-white/30 bg-white text-slate-950 shadow-[0_14px_40px_rgba(255,255,255,0.22)]'
          : 'border-white/10 bg-slate-950/35 text-white/75 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function PeriodSelector({
  value,
  options,
  onChange,
}: {
  value: DashboardPeriod
  options: Array<{ key: DashboardPeriod; label: string; hint: string }>
  onChange: (next: DashboardPeriod) => void
}) {
  return (
    <div className="rounded-[1.55rem] border border-white/10 bg-white/[0.045] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const active = value === option.key

          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.key)}
              className={[
                'group flex min-h-[4.2rem] flex-col justify-center rounded-[1.15rem] border px-4 py-3 text-left transition-all duration-200',
                active
                  ? 'border-white/30 bg-white text-slate-950 shadow-[0_18px_32px_rgba(15,23,42,0.28)]'
                  : 'border-white/10 bg-white/[0.02] text-white/76 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8',
              ].join(' ')}
            >
              <span className={`text-sm font-semibold tracking-tight ${active ? 'text-slate-950' : 'text-white'}`}>
                {option.label}
              </span>
              <span className={`mt-1 text-[11px] uppercase tracking-[0.18em] ${active ? 'text-slate-600' : 'text-white/42'}`}>
                {option.hint}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  tone,
  iconWrapClass,
  chipLabel,
  chipTone = 'neutral',
}: KpiCardDefinition) {
  const border =
    tone === 'good'
      ? 'border-emerald-400/22'
      : tone === 'warn'
        ? 'border-amber-400/22'
        : tone === 'bad'
          ? 'border-rose-400/22'
          : tone === 'info'
            ? 'border-sky-400/22'
            : 'border-white/10'

  const glow =
    tone === 'good'
      ? 'from-emerald-500/22 via-emerald-300/10'
      : tone === 'warn'
        ? 'from-amber-500/22 via-orange-300/10'
        : tone === 'bad'
          ? 'from-rose-500/22 via-red-300/10'
          : tone === 'info'
            ? 'from-sky-500/22 via-cyan-300/10'
            : 'from-white/14 via-white/6'

  return (
    <div
      title={`${label}: ${value}`}
      className={`relative min-h-[11.75rem] overflow-hidden rounded-[1.9rem] border ${border} bg-[#07111d]/88 p-5 shadow-soft transition-transform duration-200 hover:-translate-y-0.5`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${glow} to-transparent`} />
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="absolute -right-5 top-0 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/44">{label}</p>
              {chipLabel ? (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneChipClass(chipTone)}`}>
                  {chipLabel}
                </span>
              ) : null}
            </div>
            <p className="text-[2rem] font-semibold tracking-tight text-white sm:text-[2.25rem]">{value}</p>
            <p className="max-w-[17rem] text-sm leading-6 text-white/62">{subtitle}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-[1.2rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_20px_38px_rgba(15,23,42,0.34)] ${iconWrapClass}`}>
            {icon}
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/36">
          <span className="h-2 w-2 rounded-full bg-white/55" />
          <span>Resumen ejecutivo</span>
        </div>
      </div>
    </div>
  )
}

function ExecutiveInsight({
  tone,
  title,
  description,
}: {
  tone: KpiTone
  title: string
  description: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 ${toneChipClass(tone)}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      <div className="relative space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{title}</Badge>
          <Badge tone="neutral">Meta 93%</Badge>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Lectura ejecutiva</p>
        <p className="max-w-2xl text-sm leading-6 text-white/70">{description}</p>
      </div>
    </div>
  )
}

function SpotlightCard({
  eyebrow,
  title,
  description,
  tone,
  icon,
}: {
  eyebrow: string
  title: string
  description: string
  tone: KpiTone
  icon: React.ReactNode
}) {
  return (
    <div className={`relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 ${toneChipClass(tone)}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{eyebrow}</p>
          <p className="text-lg font-semibold text-white">{title}</p>
          <p className="max-w-[30rem] text-sm leading-6 text-white/60">{description}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${toneChipClass(tone)}`}>{icon}</div>
      </div>
    </div>
  )
}

function MetricMiniCard({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone: KpiTone
}) {
  const accent =
    tone === 'good'
      ? 'from-emerald-400 to-lime-300'
      : tone === 'warn'
        ? 'from-amber-400 to-orange-300'
        : tone === 'bad'
          ? 'from-rose-400 to-fuchsia-300'
          : tone === 'info'
            ? 'from-cyan-400 to-sky-300'
            : 'from-white/40 to-white/20'

  return (
    <div className="relative min-h-[8.5rem] overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent}`} />
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">{label}</p>
          <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${accent}`} />
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-2 text-sm leading-6 text-white/60">{note}</p>
        </div>
      </div>
    </div>
  )
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180

  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  }
}

function PunctualityProgressCard({
  value,
  target,
  label,
  subtitle,
}: {
  value: number
  target: number
  label: string
  subtitle: string
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const targetClamped = Math.max(0, Math.min(100, Number.isFinite(target) ? target : 93))
  const band = getPunctualityBand(clamped)
  const gradientId = React.useId().replace(/:/g, '')
  const radius = 118
  const circumference = 2 * Math.PI * radius
  const progressOffset = circumference - (clamped / 100) * circumference
  const markerPoint = polarToCartesian(160, 160, radius, targetClamped * 3.6 - 90)

  return (
    <div className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[#07111d]/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_38%),radial-gradient(circle_at_bottom,rgba(56,189,248,0.12),transparent_30%)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Puntualidad ejecutiva</p>
            <p className="mt-2 text-lg font-semibold text-white">{label}</p>
          </div>
          <Badge tone={band.tone}>{band.label}</Badge>
        </div>

        <div className="mt-4 flex items-center justify-center">
          <svg viewBox="0 0 320 320" className="h-[18rem] w-[18rem] max-w-full">
            <defs>
              <linearGradient id={`${gradientId}-track`} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
              </linearGradient>
              <linearGradient id={`${gradientId}-progress`} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="48%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id={`${gradientId}-shadow`} x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(15,23,42,0.96)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.72)" />
              </linearGradient>
              <filter id={`${gradientId}-glow`}>
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx="160" cy="160" r={radius} fill="none" stroke={`url(#${gradientId}-track)`} strokeWidth="28" />
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="28"
              strokeLinecap="round"
              strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
              strokeDashoffset={progressOffset}
              transform="rotate(-90 160 160)"
              filter={`url(#${gradientId}-glow)`}
            />
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              stroke={`url(#${gradientId}-progress)`}
              strokeWidth="24"
              strokeLinecap="round"
              strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
              strokeDashoffset={progressOffset}
              transform="rotate(-90 160 160)"
              filter={`url(#${gradientId}-glow)`}
            />
            <circle
              cx="160"
              cy="160"
              r="86"
              fill={`url(#${gradientId}-shadow)`}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
            />

            <circle
              cx="160"
              cy="40"
              r="7"
              fill="#f8fafc"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2"
              opacity="0.92"
            />

            <line
              x1="160"
              y1="42"
              x2="160"
              y2="62"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2"
            />

            <text x="160" y="150" fill="#ffffff" fontSize="42" fontWeight="700" textAnchor="middle">
              {formatPercent(clamped)}
            </text>
            <text x="160" y="176" fill="rgba(255,255,255,0.58)" fontSize="12" fontWeight="500" textAnchor="middle">
              Meta {formatPercent(targetClamped)} · {band.description}
            </text>
            <text x="160" y="198" fill="rgba(255,255,255,0.42)" fontSize="11" textAnchor="middle">
              Brecha {formatNumber(Math.abs(targetClamped - clamped))} pp
            </text>

            <circle
              cx="160"
              cy="160"
              r="48"
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />

            <circle
              cx={markerPoint.x}
              cy={markerPoint.y}
              r="6.5"
              fill="rgba(255,255,255,0.96)"
              stroke="rgba(34,197,94,0.9)"
              strokeWidth="3"
            />
            <text x="160" y="236" fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="middle">
              Estado semántico: {band.label}
            </text>
          </svg>
        </div>

        <div className="mt-1 grid gap-3 sm:grid-cols-3">
          <MetricMiniCard
            label="Actual"
            value={formatPercent(clamped)}
            note="Puntualidad observada en el rango."
            tone={band.tone}
          />
          <MetricMiniCard
            label="Meta"
            value={formatPercent(targetClamped)}
            note="Objetivo de control visible."
            tone="good"
          />
          <MetricMiniCard
            label="Brecha"
            value={`${formatNumber(Math.abs(targetClamped - clamped))} pp`}
            note="Distancia al objetivo."
            tone={band.tone}
          />
        </div>

        <p className="mt-3 text-center text-sm leading-6 text-white/60">{subtitle}</p>
      </div>
    </div>
  )
}

type PulseSvgPoint = {
  x: number
  y: number
}

function buildPulsePath(points: PulseSvgPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function MiniTrend({
  points,
  color,
}: {
  points: number[]
  color: string
}) {
  if (!points.length) {
    return <div className="h-20 rounded-3xl border border-dashed border-white/10 bg-white/5" />
  }

  const width = 240
  const height = 80
  const maxValue = points.reduce((max, value) => Math.max(max, value), 1)
  const step = points.length > 1 ? (width - 12) / (points.length - 1) : 0
  const coords = points.map<PulseSvgPoint>((value, index) => ({
    x: 6 + step * index,
    y: 8 + ((maxValue - value) / maxValue) * (height - 16),
  }))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full">
      <path
        d={buildPulsePath(coords)}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      {coords.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="2.8" fill={color} />
      ))}
    </svg>
  )
}

function JourneySnapshot({
  journeyMetrics,
  activeLabel,
  onSelect,
}: {
  journeyMetrics: ReturnType<typeof buildJourneyMetrics>
  activeLabel: string | null
  onSelect: (label: string) => void
}) {
  const topItems = journeyMetrics.slice(0, 4)

  if (!topItems.length) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
        No hay jornadas con suficiente volumen para construir el panel.
      </div>
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {topItems.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onSelect(item.label)}
          className={[
            'rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-200',
            activeLabel === item.label
              ? 'border-white/25 bg-white/12 shadow-soft'
              : 'border-white/10 bg-white/5 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              {formatNumber(item.employees)} colab.
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{formatMetricValue(item.metricKey, item.value)}</p>
          <p className="mt-2 text-sm text-white/58">
            {activeLabel === item.label ? 'Contexto activo para el drill.' : 'Pulsa para fijar esta jornada en el panel.'}
          </p>
        </button>
      ))}
    </div>
  )
}

function BarRow3D({
  label,
  valueLabel,
  shareLabel,
  color,
  pct,
  active,
  hint,
  onClick,
}: {
  label: string
  valueLabel: string
  shareLabel: string
  color: string
  pct: number
  active?: boolean
  hint: string
  onClick: () => void
}) {
  const width = Math.max(Math.min(pct, 100), pct > 0 ? 10 : 0)

  return (
    <button
      type="button"
      title={`${label}: ${valueLabel}`}
      onClick={onClick}
      className={[
        'group relative w-full overflow-hidden rounded-3xl border px-4 py-4 text-left transition-all duration-200',
        active
          ? 'border-white/25 bg-white/12 shadow-soft'
          : 'border-white/10 bg-white/5 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8',
      ].join(' ')}
    >
      <div
        className="absolute inset-y-2 left-0 rounded-r-[1.4rem] opacity-95 shadow-[0_12px_26px_rgba(15,23,42,0.32)] transition-all duration-200 group-hover:opacity-100"
        style={{
          width: `${width}%`,
          background: `linear-gradient(135deg, ${color}, rgba(255,255,255,0.14))`,
        }}
      />
      <div
        className="absolute left-2 top-2 h-2 rounded-full bg-white/20 blur-sm"
        style={{ width: `${Math.max(width - 8, 0)}%` }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-white/55">{shareLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-white">{valueLabel}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">{hint}</p>
        </div>
      </div>
    </button>
  )
}

function LoadingDashboardShell() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-[#0b1220]/75 p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-10 w-72" />
            <SkeletonBlock className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-11 w-24" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-36 rounded-3xl" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <SkeletonBlock className="h-[28rem] rounded-[2rem] xl:col-span-7" />
        <SkeletonBlock className="h-[28rem] rounded-[2rem] xl:col-span-5" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <SkeletonBlock className="h-[26rem] rounded-[2rem] xl:col-span-4" />
        <SkeletonBlock className="h-[26rem] rounded-[2rem] xl:col-span-8" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-[24rem] rounded-[2rem]" />
        ))}
      </div>
    </div>
  )
}

function DataSourceBadge({ label, tone }: { label: string; tone: KpiTone }) {
  return <Badge tone={tone}>{label}</Badge>
}

function PeopleDrawer({
  state,
  summariesById,
  periodLabel,
  onClose,
}: {
  state: PeopleDrawerState | null
  summariesById: Map<string, DashboardEmployeeSummary>
  periodLabel: string
  onClose: () => void
}) {
  const [search, setSearch] = React.useState('')
  const deferredSearch = React.useDeferredValue(search)

  React.useEffect(() => {
    setSearch('')
  }, [state?.metricKey, state?.journeyLabel, state?.pathLabels.join('|')])

  const rows = React.useMemo(() => {
    if (!state) return []

    const normalized = deferredSearch.trim().toLowerCase()

    return state.people
      .map((entry) => {
        const summary = summariesById.get(entry.employeeId)
        if (!summary) return null

        return {
          summary,
          pathLabels: entry.pathLabels,
          metricValue: entry.metricValue,
        }
      })
      .filter((row): row is { summary: DashboardEmployeeSummary; pathLabels: string[]; metricValue: number } => Boolean(row))
      .filter((row) => {
        if (!normalized) return true

        const haystack = [
          row.summary.employeeName,
          row.summary.employeeCode ?? '',
          row.summary.journeyLabel,
          row.pathLabels.join(' / '),
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalized)
      })
      .sort((left, right) => {
        if (right.metricValue !== left.metricValue) return right.metricValue - left.metricValue
        return left.summary.employeeName.localeCompare(right.summary.employeeName)
      })
  }, [deferredSearch, state, summariesById])

  if (!state) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-[min(560px,96vw)] overflow-hidden border-l border-white/10 bg-[#08101d]/95 shadow-soft">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{state.metricTitle}</Badge>
                  {state.journeyLabel ? <Badge tone="warn">{state.journeyLabel}</Badge> : null}
                  <Badge tone="neutral">{periodLabel}</Badge>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Detalle de personas</h2>
                  <p className="mt-1 text-sm text-white/60">{state.pathLabels.join(' / ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, codigo, jornada o ruta"
                right={<Search size={16} className="text-white/40" />}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-4 flex items-center justify-between text-sm text-white/60">
              <span>{rows.length} personas encontradas</span>
              <span>Resumen del periodo actual</span>
            </div>

            <div className="space-y-3">
              {rows.map(({ summary, pathLabels, metricValue }) => (
                <div key={summary.employeeId} className="rounded-3xl border border-white/10 bg-white/6 p-4 shadow-soft">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="text-base font-semibold text-white">{summary.employeeName}</p>
                        <p className="mt-1 text-sm text-white/55">
                          {summary.employeeCode ? `Codigo ${summary.employeeCode}` : 'Sin codigo'} | {summary.journeyLabel}
                        </p>
                      </div>
                      <p className="text-sm text-white/60">{pathLabels.join(' / ')}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{state.metricTitle}</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {formatMetricValue(state.metricKey, metricValue)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <DataSourceBadge label={`Atrasos ${formatNumber(summary.lateCount)}`} tone="bad" />
                    <DataSourceBadge label={`Faltas ${formatNumber(summary.absenceCount)}`} tone="bad" />
                    <DataSourceBadge label={`Permisos ${formatNumber(summary.permissionTotal)}`} tone="info" />
                    <DataSourceBadge label={`Multas ${formatCurrency(summary.fineAmount)}`} tone="warn" />
                    <DataSourceBadge label={`Horas extra ${formatHours(summary.approvedOvertimeHours)}`} tone="info" />
                    <DataSourceBadge
                      label={`Presentismo ${formatPercent(summary.expectedDays > 0 ? (summary.presenceCount / summary.expectedDays) * 100 : 0)}`}
                      tone="good"
                    />
                  </div>
                </div>
              ))}

              {!rows.length ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/55">
                  No hay personas que coincidan con la busqueda actual.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

function MetricDrillCard({
  metricKey,
  totalLabel,
  totalValue,
  totalMeta,
  slices,
  currentPathIds,
  currentPathLabels,
  currentLevelLabel,
  unavailable,
  unavailableLabel,
  breakdownBadges,
  transitionHint,
  onSliceClick,
  onBack,
  onReset,
  onBreadcrumbClick,
}: {
  metricKey: DashboardMetricKey
  totalLabel: string
  totalValue: string
  totalMeta: string
  slices: OrgDrillSlice[]
  currentPathIds: string[]
  currentPathLabels: string[]
  currentLevelLabel: string
  unavailable: boolean
  unavailableLabel?: string
  breakdownBadges?: React.ReactNode
  transitionHint?: string | null
  onSliceClick: (slice: OrgDrillSlice) => void
  onBack: () => void
  onReset: () => void
  onBreadcrumbClick: (index: number) => void
}) {
  const config = METRIC_CONFIG[metricKey]
  const maxValue = slices.reduce((max, slice) => Math.max(max, slice.value), 1)
  const totalValueAtLevel = slices.reduce((sum, slice) => sum + slice.value, 0)

  return (
    <Card
      title={config.title}
      subtitle={config.subtitle}
      className={`relative overflow-hidden rounded-[2rem] border ${config.border} bg-[#0b1220]/72`}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge tone={config.tone}>{totalLabel}</Badge>
          {unavailable ? <Badge tone="warn">{unavailableLabel ?? 'Fuente no disponible'}</Badge> : null}
        </div>
      }
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${config.tint}`} />
      <div className="relative space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-3xl font-semibold text-white">{totalValue}</p>
            <p className="mt-1 text-sm text-white/55">{totalMeta}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentPathIds.length ? (
              <>
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Subir
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Reiniciar
                </button>
              </>
            ) : null}
            <Badge tone="neutral">{currentLevelLabel}</Badge>
            {transitionHint ? <Badge tone="info">{transitionHint}</Badge> : null}
          </div>
        </div>

        {breakdownBadges ? <div className="flex flex-wrap gap-2">{breakdownBadges}</div> : null}

        <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Vista actual</p>
              <p className="mt-1 text-sm font-medium text-white">
                {currentPathLabels.length ? currentPathLabels[currentPathLabels.length - 1] : 'Vista corporativa'}
              </p>
              <p className="mt-1 text-sm text-white/55">
                {currentLevelLabel} · {formatNumber(slices.length)} nodos visibles en este nivel.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <DataSourceBadge label={currentPathLabels.length ? 'Drill activo' : 'Vista global'} tone={currentPathLabels.length ? 'info' : 'neutral'} />
              <DataSourceBadge label={slices.some((slice) => slice.hasChildren) ? 'Exploracion jerarquica' : 'Nivel hoja'} tone={slices.some((slice) => slice.hasChildren) ? 'info' : 'good'} />
            </div>
          </div>
        </div>

        {currentPathLabels.length ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
            <button type="button" onClick={onReset} className="text-white/75 transition hover:text-white">
              Vista global
            </button>
            {currentPathLabels.map((label, index) => (
              <React.Fragment key={`${label}-${index}`}>
                <ChevronRight size={14} className="text-white/35" />
                <button
                  type="button"
                  onClick={() => onBreadcrumbClick(index)}
                  className={`transition ${index === currentPathLabels.length - 1 ? 'text-white' : 'text-white/70 hover:text-white'}`}
                >
                  {label}
                </button>
              </React.Fragment>
            ))}
          </div>
        ) : null}

        {slices.length ? (
          <div className="space-y-3">
            {slices.slice(0, 8).map((slice) => (
              <BarRow3D
                key={`${metricKey}-${slice.nodeId}-${slice.pathIds.join('.')}`}
                label={slice.label}
                valueLabel={formatMetricValue(metricKey, slice.value)}
                shareLabel={buildShareLabel(slice.value, totalValueAtLevel)}
                color={slice.color}
                pct={(slice.value / maxValue) * 100}
                active={currentPathIds.join('|') === slice.pathIds.join('|')}
                hint={slice.hasChildren ? 'Profundizar' : 'Ver personas'}
                onClick={() => onSliceClick(slice)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
            {unavailable ? unavailableLabel ?? 'Fuente no disponible para esta metrica.' : config.emptyLabel}
          </div>
        )}
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const tenantContext = useTenantContext(user?.id)
  const location = useLocation()

  const [period, setPeriod] = React.useState<DashboardPeriod>(() => readStoredDashboardPeriod())
  const [journeyMetric, setJourneyMetric] = React.useState<DashboardMetricKey>('late')
  const [journeyFilter, setJourneyFilter] = React.useState<string | null>(null)
  const [journeyPathIds, setJourneyPathIds] = React.useState<string[]>([])
  const [drillState, setDrillState] = React.useState<DrillState>(() => createEmptyDrillState())
  const [peopleDrawer, setPeopleDrawer] = React.useState<PeopleDrawerState | null>(null)
  const [isPendingTransition, startTransition] = React.useTransition()

  const dashboardDataMode = React.useMemo(() => resolveDashboardDataMode(location.search), [location.search])
  const isMockMode = dashboardDataMode === 'mock'
  const tenantId = tenantContext.data?.tenantId ?? null
  const effectiveTenantId = isMockMode ? '__dashboard-mock__' : tenantId
  const range = React.useMemo(() => periodRange(period), [period])
  const periodLabel = React.useMemo(() => formatPeriodLabel(range.from, range.to), [range.from, range.to])

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(DASHBOARD_PERIOD_STORAGE_KEY, period)
    } catch {
      // Ignore storage failures and keep the state local.
    }
  }, [period])

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-bi-v3', dashboardDataMode, effectiveTenantId, period, range.from, range.to],
    enabled: Boolean(effectiveTenantId),
    placeholderData: (previousData) => previousData,
    queryFn: async (): Promise<DashboardBundle> => {
      baseDebug('dashboard.query.start', {
        mode: import.meta.env.MODE,
        prod: import.meta.env.PROD,
        dashboardDataMode,
        isMockMode,
        tenantId,
        effectiveTenantId,
        period,
        from: range.from,
        to: range.to,
      })

      if (isMockMode) {
        const bundle = await buildMockDashboardBundle({
          tenantId: tenantId ?? effectiveTenantId,
          period,
          from: range.from,
          to: range.to,
        })
        baseDebug('dashboard.query.mock-result', {
          roster: bundle.roster.length,
          dailyRows: bundle.dailyRows.length,
          punchRows: bundle.punchSourceDataset.rows.length,
          noveltyRows: bundle.noveltyDataset.rows.length,
          permissionRows: bundle.permissionDataset.rows.length,
          overtimeRows: bundle.overtimeDataset.rows.length,
          fineRows: bundle.fineDataset.rows.length,
        })
        return bundle
      }

      const resolvedTenantId = tenantId!

      const [
        roster,
        dailyRows,
        punchSourceDataset,
        noveltyDataset,
        permissionDataset,
        overtimeDataset,
        fineDataset,
        orgLevels,
        orgUnits,
        orgAssignments,
      ] = await Promise.all([
        fetchEmployeeRoster(resolvedTenantId),
        fetchDailyAttendanceRows(resolvedTenantId, range.from, range.to),
        fetchPunchSourceRows(resolvedTenantId, range.from, range.to),
        fetchTenantNoveltyRows(resolvedTenantId, range.from, range.to),
        fetchPermissionRequestRows(resolvedTenantId, range.from, range.to),
        fetchOvertimeRequestRows(resolvedTenantId, range.from, range.to),
        fetchFineLedgerRows(resolvedTenantId, range.from, range.to),
        fetchOrgLevelDefinitions(resolvedTenantId),
        fetchOrgUnits(resolvedTenantId),
        fetchCurrentOrgAssignments(resolvedTenantId),
      ])

      const bundle = {
        roster,
        dailyRows,
        punchSourceDataset,
        noveltyDataset,
        permissionDataset,
        overtimeDataset,
        fineDataset,
        orgLevels,
        orgUnits,
        orgAssignments,
      }
      baseDebug('dashboard.query.real-result', {
        roster: bundle.roster.length,
        dailyRows: bundle.dailyRows.length,
        punchRows: bundle.punchSourceDataset.rows.length,
        noveltyRows: bundle.noveltyDataset.rows.length,
        permissionRows: bundle.permissionDataset.rows.length,
        overtimeRows: bundle.overtimeDataset.rows.length,
        fineRows: bundle.fineDataset.rows.length,
        orgLevels: bundle.orgLevels.length,
        orgUnits: bundle.orgUnits.length,
        orgAssignments: bundle.orgAssignments.length,
      })
      return bundle
    },
    staleTime: 60_000,
  })

  React.useEffect(() => {
    setDrillState(createEmptyDrillState())
    setJourneyPathIds([])
    setJourneyFilter(null)
    setPeopleDrawer(null)
  }, [effectiveTenantId, range.from, range.to])

  React.useEffect(() => {
    setJourneyPathIds([])
  }, [journeyFilter, journeyMetric])

  const data = dashboardQuery.data

  const summaries = React.useMemo(() => {
    if (!data) return []

    return buildEmployeeSummaries({
      roster: data.roster,
      dailyRows: data.dailyRows,
      noveltyRows: data.noveltyDataset.rows,
      permissionRows: data.permissionDataset.rows,
      overtimeRows: data.overtimeDataset.rows,
      fineRows: data.fineDataset.rows,
    })
  }, [data])

  const summariesById = React.useMemo(
    () => new Map(summaries.map((summary) => [summary.employeeId, summary])),
    [summaries],
  )

  const kpis = React.useMemo(() => buildDashboardKpis(summaries), [summaries])
  const channelPulse = React.useMemo(() => (data ? buildAttendanceChannelPulse(data.punchSourceDataset.rows) : []), [data])
  const absenceBreakdown = React.useMemo<DashboardAbsenceBreakdown>(() => {
    const breakdown = buildMetricStatusBreakdown(summaries, 'absence')
    return isAbsenceBreakdown(breakdown) ? breakdown : EMPTY_ABSENCE_BREAKDOWN
  }, [summaries])

  const permissionBreakdown = React.useMemo<DashboardPermissionBreakdown>(() => {
    const breakdown = buildMetricStatusBreakdown(summaries, 'permission')
    return isPermissionBreakdown(breakdown) ? breakdown : EMPTY_PERMISSION_BREAKDOWN
  }, [summaries])

  const metricRows = React.useMemo<Record<DashboardMetricKey, OrgMetricRow[]>>(() => {
    if (!data) {
      return {
        late: [],
        absence: [],
        permission: [],
        fine: [],
        overtime: [],
      }
    }

    const baseArgs = [data.orgAssignments, data.orgUnits, data.orgLevels] as const

    return {
      late: buildOrgMetricRows(buildMetricBaseRows(summaries, 'late'), ...baseArgs),
      absence: buildOrgMetricRows(buildMetricBaseRows(summaries, 'absence'), ...baseArgs),
      permission: buildOrgMetricRows(buildMetricBaseRows(summaries, 'permission'), ...baseArgs),
      fine: buildOrgMetricRows(buildMetricBaseRows(summaries, 'fine'), ...baseArgs),
      overtime: buildOrgMetricRows(buildMetricBaseRows(summaries, 'overtime'), ...baseArgs),
    }
  }, [data, summaries])

  const slicesByMetric = React.useMemo<Record<DashboardMetricKey, OrgDrillSlice[]>>(
    () => ({
      late: buildOrgSlices(metricRows.late, drillState.late, METRIC_CONFIG.late.colors, 'late'),
      absence: buildOrgSlices(metricRows.absence, drillState.absence, METRIC_CONFIG.absence.colors, 'absence'),
      permission: buildOrgSlices(metricRows.permission, drillState.permission, METRIC_CONFIG.permission.colors, 'permission'),
      fine: buildOrgSlices(metricRows.fine, drillState.fine, METRIC_CONFIG.fine.colors, 'fine'),
      overtime: buildOrgSlices(metricRows.overtime, drillState.overtime, METRIC_CONFIG.overtime.colors, 'overtime'),
    }),
    [drillState, metricRows],
  )

  const rootLateSlices = React.useMemo(
    () => buildOrgSlices(metricRows.late, [], METRIC_CONFIG.late.colors, 'late-root'),
    [metricRows],
  )

  const journeyMetrics = React.useMemo(
    () => buildJourneyMetrics(summaries, journeyMetric),
    [journeyMetric, summaries],
  )
  const journeyScopedSummaries = React.useMemo(
    () => filterSummariesByJourney(summaries, journeyFilter),
    [journeyFilter, summaries],
  )

  const journeyScopedRows = React.useMemo(() => {
    if (!data || !journeyFilter) return []

    return buildOrgMetricRows(
      buildMetricBaseRows(journeyScopedSummaries, journeyMetric),
      data.orgAssignments,
      data.orgUnits,
      data.orgLevels,
    )
  }, [data, journeyFilter, journeyMetric, journeyScopedSummaries])

  const journeySlices = React.useMemo(
    () => buildOrgSlices(journeyScopedRows, journeyPathIds, METRIC_CONFIG[journeyMetric].colors, `journey-${journeyMetric}`),
    [journeyMetric, journeyPathIds, journeyScopedRows],
  )

  const realOrgDepth = React.useMemo(
    () => (data ? computeRealOrgDepth(data.orgUnits, data.orgLevels, metricRows) : 1),
    [data, metricRows],
  )

  const assignedEmployees = React.useMemo(() => {
    if (!data) return new Set<string>()

    return new Set(
      data.orgAssignments
        .filter((row) => Boolean(row.org_unit_id))
        .map((row) => row.employee_id),
    )
  }, [data])

  const activeSummaries = React.useMemo(
    () => summaries.filter((summary) => summary.isActiveCollaborator),
    [summaries],
  )

  const orgCoveragePct = React.useMemo(() => {
    if (!activeSummaries.length) return 0
    const assigned = activeSummaries.filter((summary) => assignedEmployees.has(summary.employeeId)).length
    return (assigned / activeSummaries.length) * 100
  }, [activeSummaries, assignedEmployees])

  const executiveStatus = React.useMemo(() => buildExecutiveStatus(kpis), [kpis])
  const topLateSlice = rootLateSlices[0] ?? null
  const topJourney = React.useMemo(() => buildJourneyMetrics(summaries, 'late')[0] ?? null, [summaries])
  const channelTotals = React.useMemo(
    () => channelPulse.reduce(
      (acc, point) => {
        acc.onsite += point.onsite
        acc.remote += point.remote
        acc.facial += point.facial
        acc.fingerprint += point.fingerprint
        acc.code += point.code
        return acc
      },
      { onsite: 0, remote: 0, facial: 0, fingerprint: 0, code: 0 },
    ),
    [channelPulse],
  )
  const dominantMarkingChannel =
    channelTotals.onsite === 0 && channelTotals.remote === 0
      ? 'Sin canal dominante'
      : channelTotals.onsite >= channelTotals.remote
        ? 'Presencial'
        : 'Web'
  const dominantMarkingBadgeLabel =
    dominantMarkingChannel === 'Sin canal dominante'
      ? dominantMarkingChannel
      : `${dominantMarkingChannel} dominante`

  const isInitialLoading =
    authLoading
    || (!isMockMode && tenantContext.isLoading)
    || (!dashboardQuery.data && dashboardQuery.isLoading)
  const isRefreshing = Boolean(dashboardQuery.data) && dashboardQuery.isFetching

  React.useEffect(() => {
    baseDebug('dashboard.state', {
      mode: import.meta.env.MODE,
      prod: import.meta.env.PROD,
      dashboardDataMode,
      tenantId,
      effectiveTenantId,
      isInitialLoading,
      hasData: Boolean(data),
      isFetching: dashboardQuery.isFetching,
      isError: dashboardQuery.isError,
      error: dashboardQuery.error instanceof Error ? dashboardQuery.error.message : dashboardQuery.error ? String(dashboardQuery.error) : null,
      roster: data?.roster.length ?? null,
      dailyRows: data?.dailyRows.length ?? null,
    })
  }, [dashboardDataMode, tenantId, effectiveTenantId, isInitialLoading, data, dashboardQuery.isFetching, dashboardQuery.isError, dashboardQuery.error])

  const openPeopleDrawer = React.useCallback(
    (
      metricKey: DashboardMetricKey,
      rows: OrgMetricRow[],
      pathIds: string[],
      pathLabels: string[],
      journeyLabel: string | null,
    ) => {
      const unique = new Map<string, { employeeId: string; pathLabels: string[]; metricValue: number }>()

      for (const row of collectPeopleAtPath(rows, pathIds)) {
        if (unique.has(row.employeeId)) continue
        const lastNode = row.nodes[row.nodes.length - 1]

        unique.set(row.employeeId, {
          employeeId: row.employeeId,
          pathLabels: lastNode?.pathLabels ?? pathLabels,
          metricValue: row.value,
        })
      }

      setPeopleDrawer({
        metricKey,
        metricTitle: METRIC_CONFIG[metricKey].shortLabel,
        pathLabels,
        journeyLabel,
        people: Array.from(unique.values()),
      })
    },
    [],
  )

  const updateMetricPath = React.useCallback(
    (metricKey: DashboardMetricKey, nextPathIds: string[]) => {
      startTransition(() => {
        setDrillState((current) => ({
          ...current,
          [metricKey]: nextPathIds,
        }))
      })
    },
    [startTransition],
  )

  const handleMetricSliceClick = React.useCallback(
    (metricKey: DashboardMetricKey, slice: OrgDrillSlice) => {
      if (slice.hasChildren) {
        updateMetricPath(metricKey, slice.pathIds)
        return
      }

      openPeopleDrawer(metricKey, metricRows[metricKey], slice.pathIds, slice.pathLabels, null)
    },
    [metricRows, openPeopleDrawer, updateMetricPath],
  )

  const handleMetricBack = React.useCallback(
    (metricKey: DashboardMetricKey) => {
      const currentPath = drillState[metricKey]
      updateMetricPath(metricKey, currentPath.slice(0, -1))
    },
    [drillState, updateMetricPath],
  )

  const handleMetricBreadcrumbClick = React.useCallback(
    (metricKey: DashboardMetricKey, index: number) => {
      const nextPath = drillState[metricKey].slice(0, index + 1)
      updateMetricPath(metricKey, nextPath)
    },
    [drillState, updateMetricPath],
  )

  const handleJourneySliceClick = React.useCallback(
    (slice: OrgDrillSlice) => {
      if (slice.hasChildren) {
        startTransition(() => {
          setJourneyPathIds(slice.pathIds)
        })
        return
      }

      openPeopleDrawer(journeyMetric, journeyScopedRows, slice.pathIds, slice.pathLabels, journeyFilter)
    },
    [journeyFilter, journeyMetric, journeyScopedRows, openPeopleDrawer, startTransition],
  )

  const handleJourneyBreadcrumbClick = React.useCallback((index: number) => {
    setJourneyPathIds((current) => current.slice(0, index + 1))
  }, [])

  const latePressurePct = safePercent(100 - kpis.punctualityPct)
  const punctualityTone: KpiTone = kpis.punctualityPct >= 93 ? 'good' : kpis.punctualityPct >= 88 ? 'warn' : 'bad'
  const absenteeismTone: KpiTone = kpis.absenteeismPct <= 4 ? 'good' : kpis.absenteeismPct <= 7 ? 'warn' : 'bad'
  const presentismTone: KpiTone = kpis.presentismPct >= 94 ? 'good' : kpis.presentismPct >= 88 ? 'warn' : 'bad'
  const pressureTone: KpiTone = latePressurePct <= 7 ? 'good' : latePressurePct <= 12 ? 'warn' : 'bad'
  const pressureLabel = latePressurePct <= 7 ? 'Bajo' : latePressurePct <= 12 ? 'Medio' : 'Alto'
  const punctualityInsightLabel =
    kpis.punctualityPct >= 93 ? 'Ritmo estable'
      : kpis.punctualityPct >= 88 ? 'Vigilancia activa'
        : 'Foco critico'
  const punctualityBand = getPunctualityBand(kpis.punctualityPct)

  const kpiCards: KpiCardDefinition[] = [
    {
      label: 'Total colaboradores',
      value: formatNumber(kpis.totalCollaborators),
      subtitle: 'Base activa del tenant para el periodo actual',
      icon: <Users size={20} className="text-white" />,
      tone: 'info',
      iconWrapClass: 'border-sky-300/35 bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-400 text-white shadow-[0_18px_38px_rgba(14,165,233,0.28)]',
      chipLabel: 'Base',
      chipTone: 'info',
    },
    {
      label: '% puntualidad',
      value: formatPercent(kpis.punctualityPct),
      subtitle: 'Sobre marcaciones con presencia y control horario',
      icon: <Clock3 size={20} className="text-white" />,
      tone: punctualityTone,
      iconWrapClass: 'border-emerald-300/35 bg-gradient-to-br from-emerald-500 via-lime-400 to-cyan-400 text-white shadow-[0_18px_38px_rgba(16,185,129,0.28)]',
      chipLabel: kpis.punctualityPct >= 93 ? 'En meta' : 'Seguimiento',
      chipTone: punctualityTone,
    },
    {
      label: '% ausentismo',
      value: formatPercent(kpis.absenteeismPct),
      subtitle: `${formatNumber(kpis.totalAbsence)} faltas detectadas en el rango`,
      icon: <AlertTriangle size={20} className="text-white" />,
      tone: absenteeismTone,
      iconWrapClass: 'border-amber-300/35 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-400 text-white shadow-[0_18px_38px_rgba(245,158,11,0.28)]',
      chipLabel: absenteeismTone === 'good' ? 'Controlado' : 'Sensitivo',
      chipTone: absenteeismTone,
    },
    {
      label: 'Total atrasos',
      value: formatNumber(kpis.totalLate),
      subtitle: 'Incidentes acumulados de entrada tardia',
      icon: <TimerReset size={20} className="text-white" />,
      tone: pressureTone,
      iconWrapClass: 'border-orange-300/35 bg-gradient-to-br from-orange-500 via-amber-500 to-fuchsia-400 text-white shadow-[0_18px_38px_rgba(249,115,22,0.28)]',
      chipLabel: pressureLabel,
      chipTone: pressureTone,
    },
    {
      label: 'Total permisos',
      value: data?.permissionDataset.unavailable ? 'N/D' : formatNumber(kpis.totalPermissions),
      subtitle: data?.permissionDataset.unavailable ? 'Fuente no disponible' : 'Solicitudes dentro del rango seleccionado',
      icon: <CalendarRange size={20} className="text-white" />,
      tone: data?.permissionDataset.unavailable ? 'neutral' : 'info',
      iconWrapClass: 'border-violet-300/35 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-sky-400 text-white shadow-[0_18px_38px_rgba(139,92,246,0.28)]',
      chipLabel: data?.permissionDataset.unavailable ? 'Offline' : 'Workflow',
      chipTone: data?.permissionDataset.unavailable ? 'neutral' : 'info',
    },
    {
      label: 'Total multas',
      value: data?.fineDataset.unavailable ? 'N/D' : formatCurrency(kpis.totalFinesAmount),
      subtitle: data?.fineDataset.unavailable ? 'Fuente no disponible' : `${formatNumber(kpis.totalFinesCount)} multas aplicadas`,
      icon: <TrendingUp size={20} className="text-white" />,
      tone: data?.fineDataset.unavailable ? 'neutral' : kpis.totalFinesAmount > 0 ? 'warn' : 'good',
      iconWrapClass: 'border-rose-300/35 bg-gradient-to-br from-rose-500 via-red-500 to-orange-400 text-white shadow-[0_18px_38px_rgba(244,63,94,0.28)]',
      chipLabel: data?.fineDataset.unavailable ? 'Offline' : kpis.totalFinesAmount > 0 ? 'Impacto' : 'Limpio',
      chipTone: data?.fineDataset.unavailable ? 'neutral' : kpis.totalFinesAmount > 0 ? 'warn' : 'good',
    },
    {
      label: 'Horas extra aprobadas',
      value: data?.overtimeDataset.unavailable ? 'N/D' : formatHours(kpis.approvedOvertimeHours),
      subtitle: data?.overtimeDataset.unavailable ? 'Fuente no disponible' : 'Carga acumulada aprobada en el periodo',
      icon: <Layers3 size={20} className="text-white" />,
      tone: data?.overtimeDataset.unavailable ? 'neutral' : 'info',
      iconWrapClass: 'border-cyan-300/35 bg-gradient-to-br from-cyan-500 via-sky-500 to-violet-400 text-white shadow-[0_18px_38px_rgba(34,211,238,0.28)]',
      chipLabel: data?.overtimeDataset.unavailable ? 'Offline' : 'Capacidad',
      chipTone: data?.overtimeDataset.unavailable ? 'neutral' : 'info',
    },
    {
      label: '% presentismo',
      value: formatPercent(kpis.presentismPct),
      subtitle: `${formatNumber(kpis.totalNovelty)} novedades operativas registradas`,
      icon: <Building2 size={20} className="text-white" />,
      tone: presentismTone,
      iconWrapClass: 'border-lime-300/35 bg-gradient-to-br from-lime-500 via-emerald-400 to-cyan-400 text-white shadow-[0_18px_38px_rgba(132,204,22,0.28)]',
      chipLabel: presentismTone === 'good' ? 'Estable' : 'Seguimiento',
      chipTone: presentismTone,
    },
  ]

  if (isInitialLoading) {
    return <LoadingDashboardShell />
  }

  if ((!isMockMode && tenantContext.error) || dashboardQuery.error) {
    const message = (!isMockMode && tenantContext.error instanceof Error)
      ? tenantContext.error.message
      : dashboardQuery.error instanceof Error
        ? dashboardQuery.error.message
        : 'No fue posible cargar el dashboard.'

    return (
      <Card title="Dashboard no disponible" subtitle="No se pudo consolidar la vista ejecutiva." className="rounded-[2rem]">
        <div className="space-y-4">
          <p className="text-sm text-white/70">{message}</p>
          <button
            type="button"
            onClick={() => dashboardQuery.refetch()}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Reintentar
          </button>
        </div>
      </Card>
    )
  }

  if (!effectiveTenantId) {
    return (
      <Card
        title="Tenant no resuelto"
        subtitle="No fue posible identificar el tenant activo para construir el dashboard."
        className="rounded-[2rem]"
      >
        <p className="text-sm text-white/70">
          Verifica la relacion del usuario con `public.profiles` y la resolucion de `tenant_id` antes de cargar metricas.
        </p>
      </Card>
    )
  }

  const absenceBadges = (
    <>
      <DataSourceBadge label={`Justificadas ${formatNumber(absenceBreakdown.justified)}`} tone="good" />
      <DataSourceBadge label={`Pendientes ${formatNumber(absenceBreakdown.pending)}`} tone="warn" />
      <DataSourceBadge label={`No justificadas ${formatNumber(absenceBreakdown.unjustified)}`} tone="bad" />
    </>
  )

  const permissionBadges = (
    <>
      <DataSourceBadge label={`Aprobados ${formatNumber(permissionBreakdown.approved)}`} tone="good" />
      <DataSourceBadge label={`Pendientes ${formatNumber(permissionBreakdown.pending)}`} tone="warn" />
      <DataSourceBadge label={`Rechazados ${formatNumber(permissionBreakdown.rejected)}`} tone="bad" />
    </>
  )

  const journeySliceTotal = journeySlices.reduce((sum, slice) => sum + slice.value, 0)

  return (
    <>
      <div className="relative pb-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.6rem]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(56,189,248,0.16),transparent_22%),radial-gradient(circle_at_92%_4%,rgba(244,63,94,0.14),transparent_26%),radial-gradient(circle_at_65%_78%,rgba(234,179,8,0.10),transparent_22%)]" />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent 72%)',
            }}
          />
        </div>

        <div className="relative space-y-6">
          <section className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-[#07111e]/88 px-5 py-6 shadow-soft sm:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_65%)]" />
            <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-cyan-400/10 via-transparent to-transparent xl:block" />
            <div className="relative space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={executiveStatus.tone}>{executiveStatus.title}</Badge>
                <Badge tone="neutral">{periodLabel}</Badge>
                <Badge tone="info">{realOrgDepth} niveles organizacionales</Badge>
                <Badge tone="info">Cobertura {formatPercent(orgCoveragePct)}</Badge>
                {isRefreshing ? <Badge tone="info">Actualizando</Badge> : null}
              </div>

              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/42">HRCloud Control Room</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Dashboard ejecutivo de RRHH y Asistencia
                  </h1>
                  <p className="mt-4 text-sm leading-7 text-white/65">
                    {executiveStatus.description} La interfaz prioriza una lectura premium de RRHH: primero estado
                    general, luego focos operativos, y al final drill por organigrama sin romper el contexto.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <DataSourceBadge label={`Presentismo ${formatPercent(kpis.presentismPct)}`} tone={presentismTone} />
                    <DataSourceBadge label={`Novedades ${formatNumber(kpis.totalNovelty)}`} tone="warn" />
                    <DataSourceBadge label={`Atrasos ${formatNumber(kpis.totalLate)}`} tone={pressureTone} />
                    {data?.permissionDataset.unavailable ? <DataSourceBadge label="Permisos offline" tone="warn" /> : null}
                    {data?.fineDataset.unavailable ? <DataSourceBadge label="Multas offline" tone="warn" /> : null}
                    {data?.overtimeDataset.unavailable ? <DataSourceBadge label="Horas extra offline" tone="warn" /> : null}
                  </div>
                </div>

                <PeriodSelector value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <KpiCard key={card.label} {...card} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Card
              title="Pulso de marcación"
              subtitle="Canales presenciales vs web con una sola visual protagonista"
              className="relative overflow-hidden rounded-[2.1rem] border border-white/10 bg-[#0b1220]/76 xl:col-span-7"
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">Executive analytics</Badge>
                  <Badge tone="info">{dominantMarkingBadgeLabel}</Badge>
                </div>
              }
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/12 via-transparent to-violet-500/12" />
              <div className="relative space-y-5">
                <div className="grid gap-3 xl:grid-cols-3">
                  <SpotlightCard
                    eyebrow="Canal dominante"
                    title={dominantMarkingChannel}
                    description={
                      channelTotals.onsite || channelTotals.remote
                        ? `Presencial ${formatNumber(channelTotals.onsite)} · Web ${formatNumber(channelTotals.remote)} · Facial ${formatNumber(channelTotals.facial)} · Huella ${formatNumber(channelTotals.fingerprint)} · Codigo ${formatNumber(channelTotals.code)}.`
                        : 'Aun no hay suficientes marcaciones clasificadas por canal para destacar una tendencia.'
                    }
                    tone="info"
                    icon={<Sparkles size={18} className="text-cyan-100" />}
                  />
                  <SpotlightCard
                    eyebrow="Foco principal"
                    title={topLateSlice ? topLateSlice.label : 'Sin focos de atraso'}
                    description={
                      topLateSlice
                        ? `${formatMetricValue('late', topLateSlice.value)} explican la mayor presion de puntualidad.`
                        : 'No hay atrasos relevantes que escalar en este corte.'
                    }
                    tone="bad"
                    icon={<AlertTriangle size={18} className="text-rose-100" />}
                  />
                  <SpotlightCard
                    eyebrow="Jornada sensible"
                    title={topJourney ? topJourney.label : 'Sin jornada dominante'}
                    description={
                      topJourney
                        ? `${formatMetricValue('late', topJourney.value)} atrasos recaen en la jornada con mayor friccion.`
                        : 'No hay suficiente variacion por jornada para destacar una concentracion.'
                    }
                    tone="info"
                    icon={<Radar size={18} className="text-cyan-100" />}
                  />
                </div>

                <ExecutiveTrendChart points={channelPulse} contextLabel={periodLabel} />
              </div>
            </Card>

            <Card
              title="Puntualidad ejecutiva"
              subtitle="Lectura radial con meta, riesgo y contexto operativo"
              className="relative overflow-hidden rounded-[2.1rem] border border-emerald-400/20 bg-[#0b1220]/76 xl:col-span-5"
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={punctualityBand.tone}>{punctualityBand.label}</Badge>
                  <Badge tone="good">Meta 93%</Badge>
                </div>
              }
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/12 via-transparent to-cyan-400/10" />
              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,18rem),minmax(0,1fr)] xl:items-start">
                <PunctualityProgressCard
                  value={kpis.punctualityPct}
                  target={93}
                  label="Puntualidad"
                  subtitle={periodLabel}
                />

                <div className="space-y-4">
                  <ExecutiveInsight
                    tone={punctualityTone}
                    title={punctualityInsightLabel}
                    description={
                      kpis.totalLate > 0
                        ? `Se registran ${formatNumber(kpis.totalLate)} atrasos en ${periodLabel.toLowerCase()}, con impacto directo en disciplina operativa y foco por jornada.`
                        : 'No se registran atrasos relevantes para el periodo seleccionado; el foco operativo sigue estable.'
                    }
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricMiniCard
                      label="Presentismo efectivo"
                      value={formatPercent(kpis.presentismPct)}
                      note="Marcaciones efectivas sobre el corte visible."
                      tone={presentismTone}
                    />
                    <MetricMiniCard
                      label="Ausentismo"
                      value={formatPercent(kpis.absenteeismPct)}
                      note={`${formatNumber(kpis.totalAbsence)} faltas detectadas.`}
                      tone={absenteeismTone}
                    />
                    <MetricMiniCard
                      label="Cobertura organica"
                      value={formatPercent(orgCoveragePct)}
                      note="Colaboradores activos con nodo asignado."
                      tone={orgCoveragePct >= 90 ? 'good' : orgCoveragePct >= 75 ? 'warn' : 'bad'}
                    />
                    <MetricMiniCard
                      label="Horas extra"
                      value={data?.overtimeDataset.unavailable ? 'N/D' : formatHours(kpis.approvedOvertimeHours)}
                      note={data?.overtimeDataset.unavailable ? 'Fuente no disponible.' : 'Carga aprobada del periodo.'}
                      tone={data?.overtimeDataset.unavailable ? 'neutral' : 'info'}
                    />
                  </div>

                  <div className="rounded-[1.55rem] border border-white/10 bg-slate-950/35 p-4">
                    <div className="mb-2 flex items-center justify-between text-sm text-white/60">
                      <span>Presion de atraso</span>
                      <span>{formatPercent(latePressurePct)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 shadow-[0_0_20px_rgba(251,146,60,0.35)]"
                        style={{ width: `${Math.max(latePressurePct, kpis.totalLate > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <DataSourceBadge label="Meta 93%" tone="good" />
                      <DataSourceBadge label={`Multas ${data?.fineDataset.unavailable ? 'N/D' : formatCurrency(kpis.totalFinesAmount)}`} tone="warn" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Card
              title="Ranking superior"
              subtitle="Unidades con mayor presion de atrasos"
              className="relative overflow-hidden rounded-[2rem] border border-rose-400/20 bg-[#0b1220]/74 xl:col-span-4"
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="bad">Top operativo</Badge>
                </div>
              }
            >
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/12 via-transparent to-orange-500/10" />
              <div className="relative space-y-4">
                <MiniTrend points={rootLateSlices.slice(0, 6).map((slice) => slice.value)} color="#fb7185" />

                {rootLateSlices.length ? (
                  rootLateSlices.slice(0, 6).map((slice) => (
                    <BarRow3D
                      key={`ranking-${slice.nodeId}-${slice.pathIds.join('.')}`}
                      label={slice.label}
                      valueLabel={formatMetricValue('late', slice.value)}
                      shareLabel={buildShareLabel(slice.value, kpis.totalLate)}
                      color={slice.color}
                      pct={(slice.value / Math.max(rootLateSlices[0]?.value ?? 1, 1)) * 100}
                      hint={slice.hasChildren ? 'Abrir drill' : 'Ver personas'}
                      onClick={() => handleMetricSliceClick('late', slice)}
                    />
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                    No hay atrasos para construir el ranking superior.
                  </div>
                )}
              </div>
            </Card>

            <Card
              title="Analisis por jornada"
              subtitle="Selecciona una metrica y fija una jornada antes de bajar por unidad."
              className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[#0b1220]/74 xl:col-span-8"
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">Jornada</Badge>
                </div>
              }
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10" />
              <div className="relative grid gap-6 xl:grid-cols-12">
                <div className="space-y-4 xl:col-span-5">
                  <div className="flex flex-wrap gap-2">
                    {JOURNEY_METRIC_OPTIONS.map((option) => (
                      <FilterChip
                        key={option.key}
                        active={journeyMetric === option.key}
                        label={option.label}
                        onClick={() => setJourneyMetric(option.key)}
                      />
                    ))}
                  </div>

                  <JourneySnapshot
                    journeyMetrics={journeyMetrics}
                    activeLabel={journeyFilter}
                    onSelect={(label) => setJourneyFilter((current) => (current === label ? null : label))}
                  />

                  <div className="rounded-[1.55rem] border border-white/10 bg-white/[0.045] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Pulso por jornada</p>
                    <MiniTrend points={journeyMetrics.slice(0, 6).map((item) => item.value)} color={METRIC_CONFIG[journeyMetric].colors[0]} />
                  </div>
                </div>

                <div className="xl:col-span-7">
                  {journeyFilter ? (
                    <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone="warn">{journeyFilter}</Badge>
                            <Badge tone="neutral">{METRIC_CONFIG[journeyMetric].shortLabel}</Badge>
                          </div>
                          <h3 className="mt-3 text-xl font-semibold text-white">Drill contextual por unidad</h3>
                          <p className="mt-1 text-sm text-white/60">
                            La jerarquia baja nivel por nivel dentro de la jornada seleccionada.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {journeyPathIds.length ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setJourneyPathIds((current) => current.slice(0, -1))}
                                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                              >
                                Subir
                              </button>
                              <button
                                type="button"
                                onClick={() => setJourneyPathIds([])}
                                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                              >
                                Reiniciar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {journeyPathIds.length ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/60">
                          <button
                            type="button"
                            onClick={() => setJourneyPathIds([])}
                            className="text-white/75 transition hover:text-white"
                          >
                            Jornada
                          </button>
                          {journeySlices[0]?.pathLabels?.slice(0, journeyPathIds.length)?.map((label, index) => (
                            <React.Fragment key={`${label}-${index}`}>
                              <ChevronRight size={14} className="text-white/35" />
                              <button
                                type="button"
                                onClick={() => handleJourneyBreadcrumbClick(index)}
                                className={`transition ${index === journeyPathIds.length - 1 ? 'text-white' : 'text-white/70 hover:text-white'}`}
                              >
                                {label}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-3">
                        {journeySlices.length ? journeySlices.slice(0, 8).map((slice) => (
                          <BarRow3D
                            key={`journey-context-${slice.nodeId}-${slice.pathIds.join('.')}`}
                            label={slice.label}
                            valueLabel={formatMetricValue(journeyMetric, slice.value)}
                            shareLabel={buildShareLabel(slice.value, journeySliceTotal)}
                            color={slice.color}
                            pct={(slice.value / Math.max(journeySlices[0]?.value ?? 1, 1)) * 100}
                            hint={slice.hasChildren ? 'Profundizar' : 'Ver personas'}
                            onClick={() => handleJourneySliceClick(slice)}
                          />
                        )) : (
                          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                            No hay unidades con esta metrica dentro de la jornada seleccionada.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[18rem] items-center justify-center rounded-[1.75rem] border border-dashed border-white/10 bg-white/5 px-6 text-center text-sm text-white/55">
                      Selecciona una jornada en la izquierda para ver el ranking por unidad y continuar el drill jerarquico.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <MetricDrillCard
            metricKey="late"
            totalLabel="Atrasos"
            totalValue={formatMetricValue('late', kpis.totalLate)}
            totalMeta={`${formatPercent(kpis.punctualityPct)} de puntualidad general`}
            slices={slicesByMetric.late}
            currentPathIds={drillState.late}
            currentPathLabels={slicesByMetric.late[0]?.pathLabels?.slice(0, drillState.late.length) ?? []}
            currentLevelLabel={slicesByMetric.late[0]?.levelLabel ?? `Nivel ${drillState.late.length + 1}`}
            unavailable={false}
            breakdownBadges={<DataSourceBadge label={`Top ${topLateSlice?.label ?? 'sin foco'}`} tone="bad" />}
            transitionHint={isPendingTransition ? 'Navegando' : null}
            onSliceClick={(slice) => handleMetricSliceClick('late', slice)}
            onBack={() => handleMetricBack('late')}
            onReset={() => updateMetricPath('late', [])}
            onBreadcrumbClick={(index) => handleMetricBreadcrumbClick('late', index)}
          />

          <MetricDrillCard
            metricKey="absence"
            totalLabel="Ausentismo"
            totalValue={formatMetricValue('absence', kpis.totalAbsence)}
            totalMeta={`${formatPercent(kpis.absenteeismPct)} sobre dias esperados`}
            slices={slicesByMetric.absence}
            currentPathIds={drillState.absence}
            currentPathLabels={slicesByMetric.absence[0]?.pathLabels?.slice(0, drillState.absence.length) ?? []}
            currentLevelLabel={slicesByMetric.absence[0]?.levelLabel ?? `Nivel ${drillState.absence.length + 1}`}
            unavailable={false}
            breakdownBadges={absenceBadges}
            transitionHint={isPendingTransition ? 'Navegando' : null}
            onSliceClick={(slice) => handleMetricSliceClick('absence', slice)}
            onBack={() => handleMetricBack('absence')}
            onReset={() => updateMetricPath('absence', [])}
            onBreadcrumbClick={(index) => handleMetricBreadcrumbClick('absence', index)}
          />

          <MetricDrillCard
            metricKey="permission"
            totalLabel="Permisos"
            totalValue={data?.permissionDataset.unavailable ? 'N/D' : formatMetricValue('permission', kpis.totalPermissions)}
            totalMeta={data?.permissionDataset.unavailable ? 'La tabla fuente no esta disponible para este tenant.' : 'Solicitudes consolidadas por organigrama'}
            slices={slicesByMetric.permission}
            currentPathIds={drillState.permission}
            currentPathLabels={slicesByMetric.permission[0]?.pathLabels?.slice(0, drillState.permission.length) ?? []}
            currentLevelLabel={slicesByMetric.permission[0]?.levelLabel ?? `Nivel ${drillState.permission.length + 1}`}
            unavailable={Boolean(data?.permissionDataset.unavailable)}
            unavailableLabel="Permisos no disponible"
            breakdownBadges={permissionBadges}
            transitionHint={isPendingTransition ? 'Navegando' : null}
            onSliceClick={(slice) => handleMetricSliceClick('permission', slice)}
            onBack={() => handleMetricBack('permission')}
            onReset={() => updateMetricPath('permission', [])}
            onBreadcrumbClick={(index) => handleMetricBreadcrumbClick('permission', index)}
          />

          <MetricDrillCard
            metricKey="fine"
            totalLabel="Impacto economico"
            totalValue={data?.fineDataset.unavailable ? 'N/D' : formatMetricValue('fine', kpis.totalFinesAmount)}
            totalMeta={data?.fineDataset.unavailable ? 'La tabla fuente no esta disponible para este tenant.' : `${formatNumber(kpis.totalFinesCount)} multas aplicadas`}
            slices={slicesByMetric.fine}
            currentPathIds={drillState.fine}
            currentPathLabels={slicesByMetric.fine[0]?.pathLabels?.slice(0, drillState.fine.length) ?? []}
            currentLevelLabel={slicesByMetric.fine[0]?.levelLabel ?? `Nivel ${drillState.fine.length + 1}`}
            unavailable={Boolean(data?.fineDataset.unavailable)}
            unavailableLabel="Multas no disponible"
            breakdownBadges={<DataSourceBadge label={`${formatNumber(kpis.totalFinesCount)} registros`} tone="warn" />}
            transitionHint={isPendingTransition ? 'Navegando' : null}
            onSliceClick={(slice) => handleMetricSliceClick('fine', slice)}
            onBack={() => handleMetricBack('fine')}
            onReset={() => updateMetricPath('fine', [])}
            onBreadcrumbClick={(index) => handleMetricBreadcrumbClick('fine', index)}
          />

          <MetricDrillCard
            metricKey="overtime"
            totalLabel="Capacidad extendida"
            totalValue={data?.overtimeDataset.unavailable ? 'N/D' : formatMetricValue('overtime', kpis.approvedOvertimeHours)}
            totalMeta={data?.overtimeDataset.unavailable ? 'La tabla fuente no esta disponible para este tenant.' : 'Horas extra aprobadas distribuidas por unidad'}
            slices={slicesByMetric.overtime}
            currentPathIds={drillState.overtime}
            currentPathLabels={slicesByMetric.overtime[0]?.pathLabels?.slice(0, drillState.overtime.length) ?? []}
            currentLevelLabel={slicesByMetric.overtime[0]?.levelLabel ?? `Nivel ${drillState.overtime.length + 1}`}
            unavailable={Boolean(data?.overtimeDataset.unavailable)}
            unavailableLabel="Horas extra no disponible"
            breakdownBadges={
              <DataSourceBadge
                label={`Promedio ${kpis.totalCollaborators > 0 ? formatHours(kpis.approvedOvertimeHours / kpis.totalCollaborators) : formatHours(0)}`}
                tone="info"
              />
            }
            transitionHint={isPendingTransition ? 'Navegando' : null}
            onSliceClick={(slice) => handleMetricSliceClick('overtime', slice)}
            onBack={() => handleMetricBack('overtime')}
            onReset={() => updateMetricPath('overtime', [])}
            onBreadcrumbClick={(index) => handleMetricBreadcrumbClick('overtime', index)}
          />
        </section>
      </div>
      </div>

      <PeopleDrawer
        state={peopleDrawer}
        summariesById={summariesById}
        periodLabel={periodLabel}
        onClose={() => setPeopleDrawer(null)}
      />
    </>
  )
}
