import React from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarDays, Download, Filter, Search, RefreshCw, Info, X } from 'lucide-react'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

type DailyRow = {
  work_date: string
  employee_id?: string
  employee_code: string
  employee_name: string
  department_name: string | null
  schedule_name?: string | null
  turn_name?: string | null
  entry_at: string | null
  lunch_out_at?: string | null
  lunch_in_at?: string | null
  exit_at: string | null
  entry_status?: string | null
  lunch_out_status?: string | null
  lunch_in_status?: string | null
  lunch_status?: string | null
  exit_status?: string | null
  day_status: string | null
  novelty: string | null
  employee_active?: boolean | null
  employee_status?: string | null
}

type SourceRow = {
  work_date: string
  employee_id: string
  sources: string[] | null
  biometric_methods?: string[] | null
  biometric_verify_types?: string[] | null
  serial_nos?: string[] | null
}

type Filters = {
  q: string
  dateFrom: string
  dateTo: string
  department: string
  dayStatus: string
}

type ColumnKey =
  | 'work_date'
  | 'employee_name'
  | 'department_name'
  | 'turn_name'
  | 'schedule_name'
  | 'entry_at'
  | 'lunch_out_at'
  | 'lunch_in_at'
  | 'exit_at'
  | 'source'
  | 'day_status'
  | 'novelty'
  | 'employee_code'

type StoredColumnConfig = boolean | { visible?: boolean; label?: string; order?: number; required?: boolean }

type ReportColumn = {
  key: ColumnKey
  label: string
  order: number
  visible: boolean
  required?: boolean
  width: number
}

type NormalizedDailyRow = DailyRow & {
  displayEntryAt: string | null
  displayExitAt: string | null
  displayEntryStatus: string | null | undefined
  displayExitStatus: string | null | undefined
}

type NoveltyPopoverState = {
  rect: { top: number; left: number; width: number; height: number }
  employeeName: string
  dayStatus: string | null
  novelty: string
}

const REPORT_TIMEZONE = 'America/Guayaquil'

const REPORT_COLUMNS: ReportColumn[] = [
  { key: 'work_date', label: 'Fecha de la marcación', order: 1, visible: true, required: true, width: 88 },
  { key: 'employee_name', label: 'Empleado nombre', order: 2, visible: true, required: true, width: 132 },
  { key: 'department_name', label: 'Departamento / jefatura asignada', order: 3, visible: true, width: 160 },
  { key: 'turn_name', label: 'Turno', order: 4, visible: false, width: 82 },
  { key: 'schedule_name', label: 'Horario', order: 5, visible: false, width: 110 },
  { key: 'entry_at', label: 'Hora de ingreso', order: 6, visible: true, width: 120 },
  { key: 'lunch_out_at', label: 'Hora de inicio de comida', order: 7, visible: true, width: 136 },
  { key: 'lunch_in_at', label: 'Hora de fin de comida', order: 8, visible: true, width: 128 },
  { key: 'exit_at', label: 'Hora de salida', order: 9, visible: true, width: 120 },
  { key: 'source', label: 'Tipo de marcación', order: 10, visible: true, width: 112 },
  { key: 'day_status', label: 'Estado del día', order: 11, visible: true, required: true, width: 96 },
  { key: 'novelty', label: 'Novedad', order: 12, visible: true, width: 220 },
  { key: 'employee_code', label: 'Código empleado', order: 13, visible: false, width: 92 },
]

const LEGACY_KEY_MAP: Record<string, ColumnKey> = {
  date: 'work_date',
  employee: 'employee_name',
  department: 'department_name',
  turn: 'turn_name',
  schedule: 'schedule_name',
  entry: 'entry_at',
  lunch_out: 'lunch_out_at',
  lunch_in: 'lunch_in_at',
  exit: 'exit_at',
  source: 'source',
  status: 'day_status',
  novelty: 'novelty',
  emp_code: 'employee_code',
}

function iso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    const d = new Date(String(value))
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: REPORT_TIMEZONE,
      }).format(d)
    }
  } catch {}
  return String(value)
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  return String(value).slice(0, 10)
}

function toneForStatus(status?: string | null): 'good' | 'warn' | 'bad' | 'info' | 'neutral' {
  const v = String(status || '').toUpperCase()
  if (!v) return 'neutral'
  if (v.includes('A_TIEM')) return 'good'
  if (v.includes('ANTIC')) return 'info'
  if (v.includes('ATRAS')) return 'warn'
  if (v.includes('NOVE') || v.includes('AUSEN') || v.includes('INCONS')) return 'bad'
  return 'neutral'
}

function labelForTimingStatus(status?: string | null) {
  const v = String(status || '').toUpperCase()
  if (!v) return '—'
  if (v.includes('NOVE')) return 'Obs.'
  if (v.includes('A_TIEM')) return 'A tiempo'
  if (v.includes('ANTIC')) return 'Ant.'
  if (v.includes('ATRAS')) return 'Tarde'
  return status || '—'
}

function isNoveltyStatus(status?: string | null) {
  return String(status || '').toUpperCase().includes('NOVE')
}

function isOutsideShiftOrHolidayNovelty(novelty?: string | null) {
  const v = String(novelty || '').toLowerCase()
  return v.includes('día no laborable del turno') || v.includes('dia no laborable del turno') || v.includes('feriado de descanso obligatorio')
}

function normalizeAttendanceRow(row: DailyRow): NormalizedDailyRow {
  const outsideShift = isOutsideShiftOrHolidayNovelty(row.novelty)
  const hasOnlyExitLikePunch = !row.entry_at && !!row.exit_at && outsideShift

  return {
    ...row,
    displayEntryAt: hasOnlyExitLikePunch ? row.exit_at : row.entry_at,
    displayExitAt: hasOnlyExitLikePunch ? null : row.exit_at,
    displayEntryStatus: hasOnlyExitLikePunch ? row.day_status ?? row.entry_status : row.entry_status,
    displayExitStatus: hasOnlyExitLikePunch ? null : row.exit_status,
  }
}

async function fetchDaily(tenantId: string, dateFrom: string, dateTo: string): Promise<DailyRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_daily_attendance_report_v2', {
      p_tenant_id: tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    })

  if (error) throw error
  return (data ?? []) as DailyRow[]
}

async function fetchSources(tenantId: string, dateFrom: string, dateTo: string): Promise<SourceRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_punch_sources_summary', {
      p_tenant_id: tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    })

  if (error) throw error
  return (data ?? []) as SourceRow[]
}

async function fetchReportConfig(tenantId: string): Promise<Record<string, StoredColumnConfig> | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('tenant_reports_config')
    .select('columns_config')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return (data?.columns_config as Record<string, StoredColumnConfig> | null | undefined) ?? null
}

function normalizeMethodLabel(method: string) {
  const v = method.trim().toUpperCase()
  if (!v) return ''

  if (
    v === '1' ||
    v === 'FP' ||
    v.includes('HUELLA') ||
    v.includes('FINGER') ||
    v.includes('FINGERPRINT') ||
    v.includes('HUELLA_DACTILAR')
  ) {
    return 'Huella'
  }

  if (
    v === '15' ||
    v.includes('FACIAL') ||
    v.includes('FACE') ||
    v.includes('RECONOCIMIENTO_FACIAL') ||
    v.includes('ROSTRO')
  ) {
    return 'Facial'
  }

  if (
    v === '3' ||
    v.includes('CODIGO') ||
    v.includes('CÓDIGO') ||
    v.includes('PASSWORD') ||
    v.includes('PIN') ||
    v.includes('CLAVE')
  ) {
    return 'Código'
  }

  if (v === '2' || v.includes('TARJETA') || v.includes('CARD')) {
    return 'Tarjeta'
  }

  if (v.includes('USB')) {
    return 'USB'
  }

  return method
}

function sourceLabel(row?: SourceRow | null) {
  if (!row) return '—'

  const sourceValues = (row.sources ?? [])
    .filter(Boolean)
    .map((s) => String(s).trim().toUpperCase())
    .filter(Boolean)

  const sourceSet = new Set(sourceValues)

  const methodLabels = Array.from(
    new Set(
      (row.biometric_methods ?? row.biometric_verify_types ?? [])
        .filter(Boolean)
        .map((m) => normalizeMethodLabel(String(m)))
        .filter(Boolean),
    ),
  )

  const hasBiometricSignal =
    methodLabels.length > 0 ||
    sourceValues.some(
      (s) =>
        s.includes('BIO') ||
        s.includes('DEVICE') ||
        s.includes('ZK') ||
        s.includes('RELOJ'),
    ) ||
    (row.serial_nos ?? []).filter(Boolean).length > 0

  const labels: string[] = []

  const hasWeb = sourceValues.some(
    (s) => s === 'WEB' || s.includes('PWA') || s.includes('REMOTE'),
  )
  const hasUsb = sourceValues.some((s) => s === 'USB')
  const hasImport = sourceValues.some((s) => s.includes('IMPORT'))

  if (hasBiometricSignal) {
    labels.push(methodLabels.length ? methodLabels.join(' / ') : 'Biométrico')
  }

  if (hasWeb) labels.push('Web')
  if (hasUsb) labels.push('USB')
  if (hasImport) labels.push('Importación')

  if (!labels.length && sourceSet.size) {
    labels.push(
      Array.from(sourceSet)
        .map((v) => {
          if (v.includes('BIO')) return 'Biométrico'
          if (v === 'WEB') return 'Web'
          return v
        })
        .join(' / '),
    )
  }

  return labels.length ? labels.join(' • ') : '—'
}

function normalizeReportColumns(raw: Record<string, StoredColumnConfig> | null | undefined): ReportColumn[] {
  const columns = REPORT_COLUMNS.map((col) => ({ ...col }))
  const byKey = new Map(columns.map((col) => [col.key, col]))

  for (const [rawKey, value] of Object.entries(raw ?? {})) {
    const mappedKey = (LEGACY_KEY_MAP[rawKey] ?? rawKey) as ColumnKey
    const target = byKey.get(mappedKey)
    if (!target) continue

    if (typeof value === 'boolean') {
      target.visible = value
      continue
    }

    if (typeof value === 'object' && value) {
      target.visible = value.visible ?? target.visible
      target.label = value.label ?? target.label
      target.order = Number(value.order ?? target.order)
      target.required = value.required ?? target.required
    }
  }

  return columns
    .map((col) => ({ ...col, visible: col.required ? true : col.visible }))
    .sort((a, b) => a.order - b.order)
}

function buildCellText(column: ReportColumn, row: NormalizedDailyRow, source?: SourceRow | null) {
  switch (column.key) {
    case 'work_date':
      return fmtDate(row.work_date)
    case 'employee_name':
      return row.employee_name
    case 'department_name':
      return row.department_name || 'Sin departamento'
    case 'turn_name':
      return row.turn_name || '—'
    case 'schedule_name':
      return row.schedule_name || '—'
    case 'entry_at':
      return `${fmtTime(row.displayEntryAt)}${row.displayEntryStatus ? ` (${row.displayEntryStatus})` : ''}`
    case 'lunch_out_at':
      return `${fmtTime(row.lunch_out_at)}${row.lunch_out_status ?? row.lunch_status ? ` (${row.lunch_out_status ?? row.lunch_status})` : ''}`
    case 'lunch_in_at':
      return `${fmtTime(row.lunch_in_at)}${row.lunch_in_status ? ` (${row.lunch_in_status})` : ''}`
    case 'exit_at':
      return `${fmtTime(row.displayExitAt)}${row.displayExitStatus ? ` (${row.displayExitStatus})` : ''}`
    case 'source':
      return sourceLabel(source)
    case 'day_status':
      return row.day_status || '—'
    case 'novelty':
      return row.novelty || '—'
    case 'employee_code':
      return row.employee_code || '—'
    default:
      return '—'
  }
}

function renderHeaderLabel(column: ReportColumn) {
  switch (column.key) {
    case 'lunch_out_at':
      return (
        <span className="inline-flex flex-col leading-4">
          <span>Salida a</span>
          <span>comer</span>
        </span>
      )

    case 'lunch_in_at':
      return (
        <span className="inline-flex flex-col leading-4">
          <span>Regreso de</span>
          <span>comer</span>
        </span>
      )

    case 'source':
      return (
        <span className="inline-flex flex-col leading-4">
          <span>Fuente de</span>
          <span>marcación</span>
        </span>
      )

    default:
      return column.label
  }
}

function TimingStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge tone="neutral">—</Badge>
  if (isNoveltyStatus(status)) {
    return (
      <span
        title={String(status)}
        className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white/70"
      >
        {labelForTimingStatus(status)}
      </span>
    )
  }
  return <Badge tone={toneForStatus(status)}>{labelForTimingStatus(status)}</Badge>
}

function NoveltyPopover({ data, onClose }: { data: NoveltyPopoverState | null; onClose: () => void }) {
  if (!data) return null
  const width = 360
  const top = Math.min(window.innerHeight - 220, data.rect.top + data.rect.height + 10)
  const left = Math.min(window.innerWidth - width - 16, Math.max(16, data.rect.left - 24))

  return (
    <>
      <button type="button" aria-label="Cerrar detalle de novedad" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={onClose} />
      <div
        className="fixed z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/12 bg-slate-950/95 shadow-2xl backdrop-blur-xl"
        style={{ top, left }}
        role="dialog"
        aria-modal="false"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Info size={15} className="text-rose-300" />
              Detalle de novedad
            </div>
            <div className="mt-1 text-xs text-white/60">{data.employeeName}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white">
            <X size={14} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <Badge tone={toneForStatus(data.dayStatus)}>{data.dayStatus || 'NOVEDAD'}</Badge>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-white/85">
            {data.novelty}
          </div>
        </div>
      </div>
    </>
  )
}

function renderCell(
  column: ReportColumn,
  row: NormalizedDailyRow,
  source?: SourceRow | null,
  onOpenNovelty?: (event: React.MouseEvent<HTMLElement>, row: NormalizedDailyRow) => void,
) {
  switch (column.key) {
    case 'employee_name':
      return (
        <>
          <div className="font-semibold">{row.employee_name}</div>
          <div className="text-white/60 text-xs">{row.employee_code}</div>
        </>
      )
    case 'entry_at':
      return <div className="flex items-center gap-2"><span className="font-mono">{fmtTime(row.displayEntryAt)}</span><TimingStatusBadge status={row.displayEntryStatus} /></div>
    case 'lunch_out_at':
      return <div className="flex items-center gap-2"><span className="font-mono">{fmtTime(row.lunch_out_at)}</span><TimingStatusBadge status={row.lunch_out_status ?? row.lunch_status} /></div>
    case 'lunch_in_at':
      return <div className="flex items-center gap-2"><span className="font-mono">{fmtTime(row.lunch_in_at)}</span><TimingStatusBadge status={row.lunch_in_status} /></div>
    case 'exit_at':
      return <div className="flex items-center gap-2"><span className="font-mono">{fmtTime(row.displayExitAt)}</span><TimingStatusBadge status={row.displayExitStatus} /></div>
    case 'day_status':
      return row.novelty ? (
        <button
          type="button"
          onClick={(event) => onOpenNovelty?.(event, row)}
          className="inline-flex rounded-full focus:outline-none focus:ring-2 focus:ring-rose-300/50"
          title="Ver detalle de novedad"
        >
          <Badge tone={toneForStatus(row.day_status)}>{row.day_status || '—'}</Badge>
        </button>
      ) : <Badge tone={toneForStatus(row.day_status)}>{row.day_status || '—'}</Badge>
    case 'department_name':
      return <span className="text-white/70">{row.department_name || 'Sin departamento'}</span>
    case 'source':
      return (
        <div className="max-w-[160px] whitespace-normal break-words leading-5 text-white/70">
          {sourceLabel(source)}
        </div>
      )
    case 'novelty':
      return <span className="block max-w-[280px] truncate text-white/70" title={row.novelty || '—'}>{row.novelty || '—'}</span>
    case 'turn_name':
      return <span className="text-white/70">{row.turn_name || '—'}</span>
    case 'schedule_name':
      return <span className="text-white/70">{row.schedule_name || '—'}</span>
    case 'employee_code':
      return <span className="font-mono text-white/70">{row.employee_code || '—'}</span>
    case 'work_date':
    default:
      return fmtDate(row.work_date)
  }
}

function drawPdfTable(pdf: jsPDF, columns: ReportColumn[], data: Array<Record<string, string>>, title: string, subtitle: string) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 24
  const usableWidth = pageWidth - marginX * 2
  const headerBg = [9, 18, 32] as const
  const border = [62, 76, 99] as const

  const scale = usableWidth / columns.reduce((acc, col) => acc + col.width, 0)
  const colWidths = columns.map((col) => col.width * scale)

  let y = 26
  const rowBaseHeight = 24

  const drawHeader = () => {
    pdf.setFillColor(...headerBg)
    pdf.roundedRect(marginX, y - 10, usableWidth, 34, 6, 6, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(245, 247, 250)
    pdf.setFontSize(14)
    pdf.text(title, marginX + 8, y + 3)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(180, 190, 205)
    pdf.text(subtitle, marginX + 8, y + 17)
    y += 36

    let x = marginX
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(236, 239, 244)
    pdf.setDrawColor(...border)
    pdf.setFillColor(15, 23, 42)
    for (let i = 0; i < columns.length; i += 1) {
      pdf.rect(x, y, colWidths[i], rowBaseHeight, 'FD')
      const lines = pdf.splitTextToSize(columns[i].label, colWidths[i] - 8)
      pdf.text(lines, x + 4, y + 10)
      x += colWidths[i]
    }
    y += rowBaseHeight
  }

  drawHeader()

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.2)
  pdf.setTextColor(230, 236, 244)

  data.forEach((row, rowIndex) => {
    const cellLines = columns.map((col, index) => pdf.splitTextToSize(row[col.key] || '—', colWidths[index] - 8))
    const rowHeight = Math.max(rowBaseHeight, Math.max(...cellLines.map((lines) => lines.length)) * 9 + 8)

    if (y + rowHeight > pageHeight - 24) {
      pdf.addPage('a4', 'landscape')
      y = 26
      drawHeader()
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.2)
      pdf.setTextColor(230, 236, 244)
    }

    let x = marginX
    const fill = rowIndex % 2 === 0 ? [11, 18, 32] : [16, 24, 38]
    for (let i = 0; i < columns.length; i += 1) {
      pdf.setDrawColor(...border)
      pdf.setFillColor(fill[0], fill[1], fill[2])
      pdf.rect(x, y, colWidths[i], rowHeight, 'FD')
      pdf.text(cellLines[i], x + 4, y + 10)
      x += colWidths[i]
    }
    y += rowHeight
  })
}

export default function DailyAttendanceReportPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const today = React.useMemo(() => iso(new Date()), [])
  const [filters, setFilters] = React.useState<Filters>({
    q: '',
    dateFrom: today,
    dateTo: today,
    department: '',
    dayStatus: '',
  })
  const [appliedRange, setAppliedRange] = React.useState({ dateFrom: today, dateTo: today })
  const [noveltyPopover, setNoveltyPopover] = React.useState<NoveltyPopoverState | null>(null)

  const daily = useQuery({
    queryKey: ['attendance-daily-report-v2', tenantId, appliedRange.dateFrom, appliedRange.dateTo],
    enabled: !!tenantId,
    queryFn: () => fetchDaily(tenantId!, appliedRange.dateFrom, appliedRange.dateTo),
    refetchOnWindowFocus: false,
  })

  const sources = useQuery({
    queryKey: ['attendance-daily-sources', tenantId, appliedRange.dateFrom, appliedRange.dateTo],
    enabled: !!tenantId,
    queryFn: () => fetchSources(tenantId!, appliedRange.dateFrom, appliedRange.dateTo),
    retry: 0,
    refetchOnWindowFocus: false,
  })

  const reportConfig = useQuery({
    queryKey: ['attendance-report-config', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchReportConfig(tenantId!),
    refetchOnWindowFocus: false,
    retry: 0,
  })

  const sourcesMap = React.useMemo(() => {
    const map = new Map<string, SourceRow>()
    for (const row of sources.data ?? []) map.set(`${row.work_date}::${row.employee_id}`, row)
    return map
  }, [sources.data])

  const departments = React.useMemo(() => {
    const set = new Set<string>()
    for (const row of daily.data ?? []) if (row.department_name) set.add(String(row.department_name))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [daily.data])

  const rows = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const status = filters.dayStatus.trim().toUpperCase()
    return (daily.data ?? [])
      .map(normalizeAttendanceRow)
      .filter((row) => {
        if (!q) return true
        const haystack = `${row.employee_code} ${row.employee_name} ${row.department_name ?? ''} ${row.day_status ?? ''} ${row.novelty ?? ''}`.toLowerCase()
        return haystack.includes(q)
      })
      .filter((row) => (filters.department ? (row.department_name ?? '') === filters.department : true))
      .filter((row) => (filters.dayStatus ? String(row.day_status ?? '').toUpperCase() === status : true))
  }, [daily.data, filters])

  const stats = React.useMemo(() => rows.reduce((acc, row) => {
    acc.total += 1
    const status = String(row.day_status ?? '').toUpperCase()
    if (status === 'A_TIEMPO') acc.onTime += 1
    else if (status === 'ANTICIPADA') acc.early += 1
    else if (status === 'ATRASADO') acc.late += 1
    else if (status === 'NOVEDAD') acc.novelty += 1
    return acc
  }, { total: 0, onTime: 0, early: 0, late: 0, novelty: 0 }), [rows])

  const visibleColumns = React.useMemo(() => normalizeReportColumns(reportConfig.data).filter((col) => col.visible), [reportConfig.data])

  React.useEffect(() => {
    if (!noveltyPopover) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNoveltyPopover(null)
    }
    const onScroll = () => setNoveltyPopover(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [noveltyPopover])

  const exportRows = React.useMemo(
    () => rows.map((row) => {
      const source = sourcesMap.get(`${row.work_date}::${row.employee_id}`)
      return Object.fromEntries(visibleColumns.map((column) => [column.key, buildCellText(column, row, source)]))
    }),
    [rows, sourcesMap, visibleColumns],
  )

  const openNoveltyPopover = (event: React.MouseEvent<HTMLElement>, row: NormalizedDailyRow) => {
    if (!row.novelty) return
    const rect = event.currentTarget.getBoundingClientRect()
    setNoveltyPopover({
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      employeeName: row.employee_name,
      dayStatus: row.day_status,
      novelty: row.novelty,
    })
  }

  const applyFilters = () => {
    if (!filters.dateFrom || !filters.dateTo) return toast.error('Selecciona el rango de fechas.')
    if (filters.dateFrom > filters.dateTo) return toast.error('La fecha desde no puede ser mayor que la fecha hasta.')
    setAppliedRange({ dateFrom: filters.dateFrom, dateTo: filters.dateTo })
    void daily.refetch(); void sources.refetch()
  }

  const exportExcel = () => {
    if (!rows.length) return toast.error('No hay filas para exportar.')
    const data = exportRows.map((item) => Object.fromEntries(visibleColumns.map((column) => [column.label, item[column.key] || '—'])))
    const sheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Asistencia')
    const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    saveAs(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `reporte_diario_asistencia_${appliedRange.dateFrom}_${appliedRange.dateTo}.xlsx`)
  }

  const exportPDF = () => {
    if (!rows.length) return toast.error('No hay filas para exportar.')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    drawPdfTable(
      pdf,
      visibleColumns,
      exportRows,
      'Reporte diario de asistencia',
      `Rango: ${appliedRange.dateFrom} → ${appliedRange.dateTo} · Filas: ${rows.length}`,
    )
    pdf.save(`reporte_diario_asistencia_${appliedRange.dateFrom}_${appliedRange.dateTo}.pdf`)
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Asistencia &amp; RRHH</h1>
          <p className="mt-1 text-sm text-white/60">Reporte operativo diario de entrada, comida, salida, estado del día y tipo de marcación.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="py-3" title="Total"><div className="text-2xl font-bold">{stats.total}</div></Card>
          <Card className="py-3" title="A tiempo"><div className="text-2xl font-bold text-emerald-300">{stats.onTime}</div></Card>
          <Card className="py-3" title="Anticipada"><div className="text-2xl font-bold text-sky-300">{stats.early}</div></Card>
          <Card className="py-3" title="Atrasado"><div className="text-2xl font-bold text-amber-300">{stats.late}</div></Card>
          <Card className="py-3" title="Novedad"><div className="text-2xl font-bold text-rose-300">{stats.novelty}</div></Card>
        </div>

        <Card title="Filtros del reporte" subtitle="Aplica el rango de fechas y luego ajusta búsqueda, departamento y estado del día.">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input label="Buscar" value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Empleado, departamento, novedad" right={<Search size={16} className="text-white/40" />} />
            <Input label="Desde" type="date" value={filters.dateFrom} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} />
            <Input label="Hasta" type="date" value={filters.dateTo} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))} />
            <Select label="Departamento / jefatura" value={filters.department} onChange={(value) => setFilters((prev) => ({ ...prev, department: value }))} options={departments.map((value) => ({ value, label: value }))} placeholder="Todos" />
            <Select label="Estado del día" value={filters.dayStatus} onChange={(value) => setFilters((prev) => ({ ...prev, dayStatus: value }))} options={[{ value: 'A_TIEMPO', label: 'A tiempo' }, { value: 'ANTICIPADA', label: 'Anticipada' }, { value: 'ATRASADO', label: 'Atrasado' }, { value: 'NOVEDAD', label: 'Novedad' }]} placeholder="Todos" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <Button leftIcon={<Filter size={16} />} onClick={applyFilters}>Aplicar</Button>
            <Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={() => { void daily.refetch(); void sources.refetch(); void reportConfig.refetch() }}>Refrescar</Button>
            <Button variant="secondary" leftIcon={<Download size={16} />} onClick={exportExcel}>Excel</Button>
            <Button variant="secondary" leftIcon={<Download size={16} />} onClick={exportPDF}>PDF</Button>
            <div className="ml-auto flex items-center gap-2 text-xs text-white/50"><CalendarDays size={14} />Rango aplicado: {appliedRange.dateFrom} → {appliedRange.dateTo} · Filas: {rows.length} · Columnas: {visibleColumns.length}</div>
          </div>

          {sources.isError ? <div className="mt-3 text-xs text-amber-200">La RPC get_punch_sources_summary no está disponible. El reporte sigue funcionando, pero la columna de tipo de marcación puede salir vacía.</div> : null}
          {reportConfig.isError ? <div className="mt-3 text-xs text-amber-200">No se pudo leer la configuración de columnas del tenant. Se usarán columnas por defecto.</div> : null}
        </Card>

        <Card title="Detalle operativo de asistencia" subtitle="Haz clic en el estado del día cuando exista una novedad para ver el detalle.">
          <div id="daily-attendance-table" className="overflow-auto">
            <table className="min-w-[1220px] w-full text-sm">
              <thead className="text-white/60">
                <tr>
                  {visibleColumns.map((column) => {
                    const isCompactHeader =
                      column.key === 'lunch_out_at' ||
                      column.key === 'lunch_in_at' ||
                      column.key === 'source'

                    return (
                      <th
                        key={column.key}
                        className={[
                          'py-3 text-left align-bottom',
                          isCompactHeader ? 'whitespace-normal leading-4 min-w-[96px]' : 'whitespace-nowrap',
                        ].join(' ')}
                      >
                        {renderHeaderLabel(column)}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const source = sourcesMap.get(`${row.work_date}::${row.employee_id}`)
                  return (
                    <tr key={`${row.work_date}-${row.employee_code}-${index}`} className="border-t border-white/10 align-top">
                      {visibleColumns.map((column) => (
                        <td key={`${column.key}-${index}`} className="py-3 pr-3 align-top">
                          {renderCell(column, row, source, openNoveltyPopover)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {rows.length === 0 ? <tr><td className="py-8 text-center text-white/55" colSpan={visibleColumns.length || 1}>{daily.isLoading ? 'Cargando reporte…' : 'No hay datos para los filtros seleccionados.'}</td></tr> : null}
              </tbody>
            </table>
          </div>

          {tctx.isLoading ? <div className="mt-3 text-sm text-white/55">Resolviendo tenant…</div> : null}
          {daily.isError ? <div className="mt-3 text-sm text-rose-200">{(daily.error as any)?.message || 'No se pudo cargar el reporte diario.'}</div> : null}
        </Card>
      </div>

      <NoveltyPopover data={noveltyPopover} onClose={() => setNoveltyPopover(null)} />
    </>
  )
}