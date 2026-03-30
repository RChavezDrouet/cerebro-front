import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/config/supabase'
import { useTenantContext } from '@/hooks/useTenantContext'
import toast from 'react-hot-toast'
import { Download, Filter, UploadCloud, X, CalendarDays, Search } from 'lucide-react'

import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx'
import jsPDF from 'jspdf'

type DayStatus = 'A_TIEMPO' | 'ANTICIPADA' | 'ATRASADO' | 'NOVEDAD' | string

type DailyRow = {
  tenant_id: string
  work_date: string
  employee_id: string
  employee_code: string
  employee_name: string
  department_name: string
  schedule_name: string
  turn_name: string
  employee_status: string
  employee_active: boolean
  entry_at: string | null
  lunch_out_at: string | null
  lunch_in_at: string | null
  exit_at: string | null
  entry_status: DayStatus
  lunch_out_status: DayStatus | null
  lunch_in_status: DayStatus | null
  exit_status: DayStatus
  day_status: DayStatus
  novelty: string | null
}

type FiltersState = {
  q: string
  dateFrom: string
  dateTo: string
  department: string
  dayStatus: '' | DayStatus
}

type ColumnsConfig = Record<string, boolean>

const DEFAULT_COLUMNS: ColumnsConfig = {
  date: true,
  employee: true,
  emp_code: false,
  department: true,
  schedule: false,
  turn: true,
  entry: true,
  lunch_out: true,
  lunch_in: true,
  exit: true,
  status: true,
  source: true,
  novelty: true,
}

function storageKey(tenantId: string) {
  return `attendance.reports.columns.${tenantId}`
}

function readLocalConfig(tenantId: string): ColumnsConfig | null {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    return raw ? (JSON.parse(raw) as ColumnsConfig) : null
  } catch {
    return null
  }
}

async function fetchColumnsConfig(tenantId: string): Promise<ColumnsConfig> {
  const local = readLocalConfig(tenantId)

  try {
    const { data, error } = await supabase
      .schema('attendance')
      .from('tenant_reports_config')
      .select('columns_config')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw error
    const remote = (data?.columns_config as ColumnsConfig | null) ?? null
    return { ...DEFAULT_COLUMNS, ...(local ?? {}), ...(remote ?? {}) }
  } catch {
    return { ...DEFAULT_COLUMNS, ...(local ?? {}) }
  }
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return String(iso).slice(11, 16)
  }
}

function badgeClass(s: DayStatus | null | undefined) {
  const v = String(s || '').toUpperCase()
  if (!v) return 'bg-slate-700/40 text-slate-200 border border-slate-600/40'
  if (v === 'A_TIEMPO' || v === 'ON-TIME') return 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
  if (v === 'ANTICIPADA' || v === 'EARLY') return 'bg-sky-500/15 text-sky-200 border border-sky-500/30'
  if (v === 'ATRASADO' || v === 'LATE') return 'bg-rose-500/15 text-rose-200 border border-rose-500/30'
  return 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
}

async function fetchDaily(tenantId: string, f: FiltersState): Promise<DailyRow[]> {
  const dateFrom = f.dateFrom || new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const dateTo = f.dateTo || new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .schema('attendance')
    .rpc('get_daily_attendance_report', {
      p_tenant_id: tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    })

  if (error) throw error
  return (data ?? []) as DailyRow[]
}

function containsText(r: DailyRow, q: string) {
  const s = `${r.employee_code} ${r.employee_name} ${r.department_name ?? ''} ${r.schedule_name ?? ''} ${r.turn_name ?? ''} ${r.day_status ?? ''} ${r.novelty ?? ''}`
  return s.toLowerCase().includes(q.toLowerCase())
}

export default function DetailedReportPage() {
  const { data: tctx } = useTenantContext()
  const tenantId = tctx?.tenantId

  const [filters, setFilters] = useState<FiltersState>({
    q: '',
    dateFrom: '',
    dateTo: '',
    department: '',
    dayStatus: '',
  })
  const [usbOpen, setUsbOpen] = useState(false)

  const reportQuery = useQuery({
    queryKey: ['daily-attendance', tenantId, filters.dateFrom, filters.dateTo],
    enabled: !!tenantId,
    queryFn: () => fetchDaily(tenantId!, filters),
  })

  const config = useQuery({
    queryKey: ['attendance-reports-config', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchColumnsConfig(tenantId!),
    staleTime: 60_000,
  })

  const cfg = config.data ?? DEFAULT_COLUMNS

  const rows = useMemo(() => {
    const base = reportQuery.data ?? []
    const q = filters.q.trim()
    const dept = filters.department.trim()
    const ds = String(filters.dayStatus || '').trim()
    return base
      .filter((r) => (q ? containsText(r, q) : true))
      .filter((r) => (dept ? (r.department_name || '').toLowerCase() === dept.toLowerCase() : true))
      .filter((r) => (ds ? String(r.day_status).toUpperCase() === ds.toUpperCase() : true))
  }, [reportQuery.data, filters])

  const kpis = useMemo(() => {
    const all = rows
    const total = all.length
    const by = (s: string) => all.filter((r) => String(r.day_status).toUpperCase() === s).length
    const active = all.filter((r) => r.employee_active).length
    return {
      total,
      aTiempo: by('A_TIEMPO'),
      anticipada: by('ANTICIPADA'),
      atrasado: by('ATRASADO'),
      novedad: by('NOVEDAD'),
      active,
    }
  }, [rows])

  function exportExcel() {
    try {
      const data = rows.map((r) => {
        const obj: Record<string, string> = {}
        if (cfg.date) obj['Fecha'] = r.work_date
        if (cfg.employee) obj['Empleado'] = r.employee_name
        if (cfg.emp_code) obj['Código empleado'] = r.employee_code
        if (cfg.department) obj['Departamento'] = r.department_name || ''
        if (cfg.schedule) obj['Horario'] = r.schedule_name || ''
        if (cfg.turn) obj['Turno'] = r.turn_name || ''
        if (cfg.entry) obj['Entrada'] = fmtTime(r.entry_at)
        if (cfg.lunch_out) obj['Inicio comida'] = r.lunch_out_at ? fmtTime(r.lunch_out_at) : ''
        if (cfg.lunch_in) obj['Fin comida'] = r.lunch_in_at ? fmtTime(r.lunch_in_at) : ''
        if (cfg.exit) obj['Salida'] = fmtTime(r.exit_at)
        if (cfg.status) obj['Estado día'] = r.day_status || ''
        if (cfg.novelty) obj['Novedad'] = r.novelty || ''
        return obj
      })
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      saveAs(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `reporte_diario_${Date.now()}.xlsx`)
      toast.success('Exportado a Excel')
    } catch (e: any) {
      toast.error(e?.message ?? 'Error exportando Excel')
    }
  }

  async function exportWord() {
    try {
      const header = [
        ...(cfg.date ? ['Fecha'] : []),
        ...(cfg.emp_code ? ['Código'] : []),
        ...(cfg.employee ? ['Empleado'] : []),
        ...(cfg.department ? ['Departamento'] : []),
        ...(cfg.entry ? ['Entrada'] : []),
        ...(cfg.exit ? ['Salida'] : []),
        ...(cfg.status ? ['Estado día'] : []),
        ...(cfg.novelty ? ['Novedad'] : []),
      ]
      const table = new Table({
        rows: [
          new TableRow({ children: header.map((h) => new TableCell({ children: [new Paragraph(h)] })) }),
          ...rows.map(
            (r) =>
              new TableRow({
                children: [
                  ...(cfg.date ? [r.work_date] : []),
                  ...(cfg.emp_code ? [r.employee_code] : []),
                  ...(cfg.employee ? [r.employee_name] : []),
                  ...(cfg.department ? [r.department_name || ''] : []),
                  ...(cfg.entry ? [fmtTime(r.entry_at)] : []),
                  ...(cfg.exit ? [fmtTime(r.exit_at)] : []),
                  ...(cfg.status ? [String(r.day_status || '')] : []),
                  ...(cfg.novelty ? [r.novelty || ''] : []),
                ].map((v) => new TableCell({ children: [new Paragraph(String(v))] })),
              })
          ),
        ],
      })
      const doc = new Document({
        sections: [{ children: [new Paragraph('Reporte Diario de Marcaciones'), table] }],
      })
      const blob = await Packer.toBlob(doc)
      saveAs(blob, `reporte_diario_${Date.now()}.docx`)
      toast.success('Exportado a Word')
    } catch (e: any) {
      toast.error(e?.message ?? 'Error exportando Word')
    }
  }

  function exportPDF() {
    try {
      const pdf = new jsPDF({ orientation: 'landscape' })
      pdf.setFontSize(12)
      pdf.text('Reporte Diario de Marcaciones', 10, 12)

      const cols = [
        ...(cfg.date ? ['Fecha'] : []),
        ...(cfg.emp_code ? ['Código'] : []),
        ...(cfg.employee ? ['Empleado'] : []),
        ...(cfg.department ? ['Depto'] : []),
        ...(cfg.entry ? ['Entrada'] : []),
        ...(cfg.exit ? ['Salida'] : []),
        ...(cfg.status ? ['Día'] : []),
        ...(cfg.novelty ? ['Novedad'] : []),
      ]
      let y = 20
      pdf.setFontSize(8)
      pdf.text(cols.join(' | '), 10, y)
      y += 6
      rows.slice(0, 200).forEach((r) => {
        const line = [
          ...(cfg.date ? [r.work_date] : []),
          ...(cfg.emp_code ? [r.employee_code] : []),
          ...(cfg.employee ? [r.employee_name] : []),
          ...(cfg.department ? [r.department_name || ''] : []),
          ...(cfg.entry ? [fmtTime(r.entry_at)] : []),
          ...(cfg.exit ? [fmtTime(r.exit_at)] : []),
          ...(cfg.status ? [String(r.day_status || '')] : []),
          ...(cfg.novelty ? [(r.novelty || '').replace(/\s+/g, ' ').slice(0, 60)] : []),
        ].join(' | ')
        pdf.text(line, 10, y)
        y += 5
        if (y > 190) {
          pdf.addPage()
          y = 20
        }
      })
      pdf.save(`reporte_diario_${Date.now()}.pdf`)
      toast.success('Exportado a PDF')
    } catch (e: any) {
      toast.error(e?.message ?? 'Error exportando PDF')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Reporte Detallado
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            Reporte diario consolidado (Entrada / Comida / Salida) + estados (Anticipada/A tiempo/Atrasado/Novedad).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setUsbOpen(true)}
            title="Carga USB"
          >
            <UploadCloud size={16} className="mr-2" />
            Cargar USB
          </button>

          <button type="button" className="btn btn-primary" onClick={exportExcel} title="Exportar a Excel">
            <Download size={16} className="mr-2" />
            Excel
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportWord} title="Exportar a Word">
            Word
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportPDF} title="Exportar a PDF">
            PDF
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl p-4 border border-white/10 bg-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} />
          <div className="font-semibold">Filtros</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
              placeholder="Buscar (empleado, depto, estado...)"
              className="input pl-9"
            />
          </div>

          <div className="relative">
            <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))}
              className="input pl-9"
            />
          </div>

          <div className="relative">
            <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))}
              className="input pl-9"
            />
          </div>

          <input
            value={filters.department}
            onChange={(e) => setFilters((s) => ({ ...s, department: e.target.value }))}
            placeholder="Departamento (exacto)"
            className="input"
          />
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {(['', 'A_TIEMPO', 'ANTICIPADA', 'ATRASADO', 'NOVEDAD'] as const).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilters((x) => ({ ...x, dayStatus: s }))}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                filters.dayStatus === s ? badgeClass(s || 'A_TIEMPO') : 'border-white/10 bg-white/5 hover:bg-white/10',
              ].join(' ')}
            >
              {s ? s.replace('_', ' ') : 'TODOS'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: kpis.total },
          { label: 'A tiempo', value: kpis.aTiempo },
          { label: 'Anticipada', value: kpis.anticipada },
          { label: 'Atrasado', value: kpis.atrasado },
          { label: 'Novedad', value: kpis.novedad },
          { label: 'Activos', value: kpis.active },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-3 border border-white/10 bg-white/5">
            <div className="text-xs opacity-70">{k.label}</div>
            <div className="text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="text-sm opacity-70 mb-2">
          Filas: <span className="font-semibold">{rows.length}</span> • Columnas activas: <span className="font-semibold">{Object.values(cfg).filter(Boolean).length}</span>
        </div>

        {reportQuery.isLoading && (
          <div className="rounded-2xl p-6 border border-white/10 bg-white/5">Cargando…</div>
        )}

        {reportQuery.error && (
          <div className="rounded-2xl p-6 border border-rose-500/30 bg-rose-500/10 text-rose-200">
            Error: {(reportQuery.error as any)?.message ?? 'No se pudo cargar el reporte'}
          </div>
        )}

        {!reportQuery.isLoading && !reportQuery.error && rows.length === 0 && (
          <div className="rounded-2xl p-6 border border-white/10 bg-white/5">Sin datos para el rango seleccionado.</div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {rows.map((r) => (
            <div key={`${r.employee_id}-${r.work_date}`} className="rounded-2xl p-4 border border-white/10 bg-white/5 hover:bg-white/7 transition">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">
                    {r.employee_name}{' '}
                    {cfg.emp_code ? <span className="opacity-70 text-sm">({r.employee_code})</span> : null}
                  </div>
                  <div className="text-sm opacity-70">
                    {cfg.department ? (r.department_name || '—') : 'Empleado'}
                    {cfg.schedule ? ` • ${r.schedule_name || '—'}` : ''}
                    {cfg.turn ? ` • ${r.turn_name || '—'}` : ''}
                    {cfg.date ? ` • ${r.work_date}` : ''}
                  </div>
                  <div className="text-xs mt-1 opacity-70">
                    Activo: <span className="font-semibold">{r.employee_active ? 'Sí' : 'No'}</span> • Status:{' '}
                    <span className="font-semibold">{r.employee_status}</span>
                  </div>
                </div>

                {cfg.status ? (
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${badgeClass(r.day_status)}`}>
                      {String(r.day_status).replace('_', ' ')}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {cfg.entry ? (
                  <div className="rounded-xl p-3 bg-black/20 border border-white/10">
                    <div className="text-xs opacity-70">Entrada</div>
                    <div className="text-lg font-bold">{fmtTime(r.entry_at)}</div>
                  </div>
                ) : null}

                {cfg.lunch_out ? (
                  <div className="rounded-xl p-3 bg-black/20 border border-white/10">
                    <div className="text-xs opacity-70">Inicio comida</div>
                    <div className="text-lg font-bold">{fmtTime(r.lunch_out_at)}</div>
                  </div>
                ) : null}

                {cfg.lunch_in ? (
                  <div className="rounded-xl p-3 bg-black/20 border border-white/10">
                    <div className="text-xs opacity-70">Fin comida</div>
                    <div className="text-lg font-bold">{fmtTime(r.lunch_in_at)}</div>
                  </div>
                ) : null}

                {cfg.exit ? (
                  <div className="rounded-xl p-3 bg-black/20 border border-white/10">
                    <div className="text-xs opacity-70">Salida</div>
                    <div className="text-lg font-bold">{fmtTime(r.exit_at)}</div>
                  </div>
                ) : null}
              </div>

              {cfg.novelty && r.novelty ? (
                <div className="mt-3 rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 text-amber-100 text-sm">
                  <div className="font-semibold mb-1">Novedad</div>
                  <div className="opacity-90">{r.novelty}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {usbOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[rgb(10,12,16)] p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Carga USB (UI)</div>
              <button type="button" className="btn btn-ghost" onClick={() => setUsbOpen(false)}>
                <X size={16} className="mr-2" />
                Cerrar
              </button>
            </div>
            <div className="mt-3 text-sm opacity-70">
              UI de carga USB (MVP). Aquí se integrará el importador de archivos cuando esté habilitado.
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn btn-primary" onClick={() => setUsbOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
