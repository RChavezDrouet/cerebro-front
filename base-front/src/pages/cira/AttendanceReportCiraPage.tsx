import React, { useState, useEffect } from 'react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import { useExportMinisterio } from '@/hooks/useExportMinisterio'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportTab = 'summary' | 'fines' | 'accruals'

type PunchRow = {
  id:           string
  employee_id:  string
  punched_at:   string
  marking_type: string | null
  source:       string
  employee:     { first_name: string; last_name: string } | null
}

type FineLedgerRow = {
  id:                string
  incident_date:     string
  incident_type:     string
  employee_id:       string
  calculated_amount: number
  applied_amount:    number
  was_capped:        boolean
  cap_excess:        number
  month_year:        string
}

type OvertimeLedgerRow = {
  id:               string
  employee_id:      string
  period_date:      string
  month_year:       string
  normal_hours:     number
  suplem_hours:     number
  extra_hours:      number
  total_amount:     number
  is_paid:          boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: Array<{ value: ReportTab; label: string }> = [
  { value: 'summary',  label: 'Resumen del Día' },
  { value: 'fines',    label: 'Multas' },
  { value: 'accruals', label: 'Acumulados Legales' },
]

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  ATRASO_ENTRADA:         'Atraso en Entrada',
  ATRASO_ALMUERZO:        'Atraso Retorno de Almuerzo',
  SALIDA_TEMPRANA:        'Salida Temprana',
  AUSENCIA_INJUSTIFICADA: 'Ausencia Injustificada',
}

const SOURCE_LABELS: Record<string, string> = {
  web:        'Web',
  biometric:  'Biométrico',
  import:     'Importado',
}

const todayIso = new Date().toISOString().slice(0, 10)
const currentMonthIso = new Date().toISOString().slice(0, 7)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-EC', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch {
    return iso
  }
}

function employeeName(row: PunchRow): string {
  if (row.employee) return `${row.employee.first_name} ${row.employee.last_name}`
  return `${row.employee_id.slice(0, 8)}…`
}

// ─── Component ────────────────────────────────────────────────────────────────

const AttendanceReportCiraPage: React.FC = () => {
  const { tenantId } = useTenantStore()
  const { exportDate, exporting } = useExportMinisterio()

  const [activeTab, setActiveTab] = useState<ReportTab>('summary')

  // Tab 1 — Resumen del Día
  const [selectedDate, setSelectedDate]   = useState(todayIso)
  const [punches, setPunches]             = useState<PunchRow[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Tab 2 — Multas
  const [selectedMonth, setSelectedMonth]   = useState(currentMonthIso)
  const [fines, setFines]                   = useState<FineLedgerRow[]>([])
  const [loadingFines, setLoadingFines]     = useState(false)
  const [finesPending, setFinesPending]     = useState(false)

  // Tab 3 — Acumulados
  const [overtime, setOvertime]             = useState<OvertimeLedgerRow[]>([])
  const [loadingOvertime, setLoadingOvertime] = useState(false)
  const [overtimePending, setOvertimePending] = useState(false)

  useEffect(() => {
    if (activeTab === 'summary')  loadSummary()
    if (activeTab === 'fines')    loadFines()
    if (activeTab === 'accruals') loadOvertime()
  }, [activeTab, selectedDate, selectedMonth])

  // ── Tab 1: Resumen ──────────────────────────────────────────────────────────

  const loadSummary = async () => {
    setLoadingSummary(true)
    try {
      const dayStart = `${selectedDate}T00:00:00.000Z`
      const dayEnd   = `${selectedDate}T23:59:59.999Z`

      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('punches')
        .select('id, employee_id, punched_at, marking_type, source, employee:employees(first_name, last_name)')
        .gte('punched_at', dayStart)
        .lte('punched_at', dayEnd)
        .order('punched_at', { ascending: true })

      if (error) throw error

      const normalized: PunchRow[] = (data ?? []).map(row => ({
        ...row,
        employee: Array.isArray(row.employee)
          ? (row.employee[0] ?? null)
          : (row.employee ?? null),
      }))
      setPunches(normalized)
    } catch (err) {
      console.error(err)
      setPunches([])
    } finally {
      setLoadingSummary(false)
    }
  }

  // ── Tab 2: Multas ───────────────────────────────────────────────────────────

  const loadFines = async () => {
    setLoadingFines(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('fine_ledger')
        .select('id, incident_date, incident_type, employee_id, calculated_amount, applied_amount, was_capped, cap_excess, month_year')
        .eq('month_year', selectedMonth)
        .order('incident_date', { ascending: false })

      if (error) throw error
      setFines(data ?? [])
      setFinesPending(false)
    } catch {
      setFinesPending(true)
    } finally {
      setLoadingFines(false)
    }
  }

  // ── Tab 3: Acumulados ───────────────────────────────────────────────────────

  const loadOvertime = async () => {
    setLoadingOvertime(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('overtime_ledger')
        .select('id, employee_id, period_date, month_year, normal_hours, suplem_hours, extra_hours, total_amount, is_paid')
        .eq('month_year', selectedMonth)
        .order('period_date', { ascending: false })

      if (error) throw error
      setOvertime(data ?? [])
      setOvertimePending(false)
    } catch {
      setOvertimePending(true)
    } finally {
      setLoadingOvertime(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reporte de Asistencia CIRA</h1>
        <p className="text-sm text-gray-400 mt-1">
          Resumen diario, registro de multas y acumulados legales por empleado.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/10 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Resumen del Día ───────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-gray-300">Fecha</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="p-1.5 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {loadingSummary && (
              <span className="text-xs text-gray-400 animate-pulse">Cargando…</span>
            )}
            <button
              onClick={() => exportDate(selectedDate)}
              disabled={exporting || loadingSummary}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Exportar formato Ministerio de Trabajo (FR-10)"
            >
              {exporting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Exportando…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4 4m0 0l4-4m-4 4V4" />
                  </svg>
                  Excel MT
                </>
              )}
            </button>
          </div>

          {!loadingSummary && punches.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
              No hay marcaciones para el {selectedDate}.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-left border-b border-white/10">
                    <th className="px-4 py-3 font-medium text-gray-400">Empleado</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Hora</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Tipo</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Fuente</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">
                      Horas calc. <span className="text-gray-400 font-normal">(C-3)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {punches.map(row => (
                    <tr key={row.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3 font-medium text-gray-200 whitespace-nowrap">
                        {employeeName(row)}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300">
                        {fmtTime(row.punched_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-400">
                          {row.marking_type ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {SOURCE_LABELS[row.source] ?? row.source}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 text-xs">
                        — pendiente C-3
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Multas ────────────────────────────────────────────────── */}
      {activeTab === 'fines' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-300">Mes</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="p-1.5 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {loadingFines && (
              <span className="text-xs text-gray-400 animate-pulse">Cargando…</span>
            )}
          </div>

          {finesPending ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-6 py-5 text-sm text-amber-300">
              La tabla{' '}
              <code className="font-mono text-xs bg-amber-500/20 px-1 rounded">
                attendance.fine_ledger
              </code>{' '}
              aún no existe. Se creará en la Sesión C-4 del roadmap CIRA V2.0.
            </div>
          ) : !loadingFines && fines.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
              No hay multas registradas para {selectedMonth}.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-left border-b border-white/10">
                    <th className="px-4 py-3 font-medium text-gray-400">Fecha</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Empleado</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Tipo</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">Calculado</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">Aplicado</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-center">Capado</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map(row => (
                    <tr key={row.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-300">{row.incident_date}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {row.employee_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3">
                        {INCIDENT_TYPE_LABELS[row.incident_type] ?? row.incident_type}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ${row.calculated_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ${row.applied_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.was_capped ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
                            Sí +${row.cap_excess.toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-400">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Acumulados Legales ─────────────────────────────────────── */}
      {activeTab === 'accruals' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-300">Mes</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="p-1.5 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {loadingOvertime && (
              <span className="text-xs text-gray-400 animate-pulse">Cargando…</span>
            )}
          </div>

          {overtimePending ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-6 py-5 text-sm text-amber-300">
              La tabla{' '}
              <code className="font-mono text-xs bg-amber-500/20 px-1 rounded">
                attendance.overtime_ledger
              </code>{' '}
              aún no existe. Se creará en la Sesión C-7 del roadmap CIRA V2.0.
            </div>
          ) : !loadingOvertime && overtime.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
              No hay acumulados registrados para {selectedMonth}.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-left border-b border-white/10">
                    <th className="px-4 py-3 font-medium text-gray-400">Fecha</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Empleado</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">H. Normal</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">H. Suplem.</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">H. Extra</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">Total USD</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-center">Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {overtime.map(row => (
                    <tr key={row.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-300">{row.period_date}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {row.employee_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{row.normal_hours}h</td>
                      <td className="px-4 py-3 text-right font-mono">{row.suplem_hours}h</td>
                      <td className="px-4 py-3 text-right font-mono">{row.extra_hours}h</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-200">
                        ${row.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_paid ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300">
                            Sí
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-400">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default AttendanceReportCiraPage
