import React, { useEffect, useState } from 'react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import { useExportMinisterio } from '@/hooks/useExportMinisterio'

type ReportTab = 'summary' | 'fines' | 'accruals'

type PunchRow = {
  id: string
  employee_id: string
  punched_at: string
  marking_type: string | null
  source: string
  employee: { first_name: string; last_name: string } | null
}

type FineLedgerRow = {
  id: string
  incident_date: string
  incident_type: string
  employee_id: string
  calculated_amount: number
  applied_amount: number
  was_capped: boolean
  cap_excess: number
  month_year: string
}

type OvertimeLedgerRow = {
  id: string
  employee_id: string
  period_date: string
  month_year: string
  normal_hours: number
  suplem_hours: number
  extra_hours: number
  total_amount: number
  is_paid: boolean
}

type PunchApiRow = Omit<PunchRow, 'employee'> & {
  employee?: { first_name: string; last_name: string } | Array<{ first_name: string; last_name: string }> | null
}

const TABS: Array<{ value: ReportTab; label: string }> = [
  { value: 'summary', label: 'Resumen del Día' },
  { value: 'fines', label: 'Multas' },
  { value: 'accruals', label: 'Acumulados Legales' },
]

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  ATRASO_ENTRADA: 'Atraso en Entrada',
  ATRASO_ALMUERZO: 'Atraso Retorno de Almuerzo',
  SALIDA_TEMPRANA: 'Salida Temprana',
  AUSENCIA_INJUSTIFICADA: 'Ausencia Injustificada',
}

const SOURCE_LABELS: Record<string, string> = {
  web: 'Web',
  biometric: 'Biométrico',
  import: 'Importado',
}

const todayIso = new Date().toISOString().slice(0, 10)

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

function employeeName(row: PunchRow): string {
  if (row.employee) return `${row.employee.first_name} ${row.employee.last_name}`
  return `${row.employee_id.slice(0, 8)}…`
}

function toUtcStart(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00-05:00`).toISOString()
}

function toUtcEnd(dateIso: string): string {
  return new Date(`${dateIso}T23:59:59-05:00`).toISOString()
}

function normalizeRange(from: string, to: string): { from: string; to: string } {
  if (from <= to) return { from, to }
  return { from: to, to: from }
}

const AttendanceReportCiraPage: React.FC = () => {
  const { tenantId } = useTenantStore()
  const { exportDate, exporting } = useExportMinisterio()

  const [activeTab, setActiveTab] = useState<ReportTab>('summary')
  const [showHelp, setShowHelp] = useState(false)

  const [dateFrom, setDateFrom] = useState(todayIso)
  const [dateTo, setDateTo] = useState(todayIso)
  const [appliedRange, setAppliedRange] = useState({ from: todayIso, to: todayIso })

  const [punches, setPunches] = useState<PunchRow[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)

  const [fines, setFines] = useState<FineLedgerRow[]>([])
  const [loadingFines, setLoadingFines] = useState(false)
  const [finesPending, setFinesPending] = useState(false)

  const [overtime, setOvertime] = useState<OvertimeLedgerRow[]>([])
  const [loadingOvertime, setLoadingOvertime] = useState(false)
  const [overtimePending, setOvertimePending] = useState(false)

  const loadSummary = async (from: string, to: string) => {
    if (!tenantId) {
      setPunches([])
      return
    }

    setLoadingSummary(true)
    try {
      const dayStart = toUtcStart(from)
      const dayEnd = toUtcEnd(to)

      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('punches')
        .select('id, employee_id, punched_at, marking_type, source, employee:employees(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .gte('punched_at', dayStart)
        .lte('punched_at', dayEnd)
        .order('punched_at', { ascending: true })

      if (error) throw error

      const normalized: PunchRow[] = ((data as PunchApiRow[] | null | undefined) ?? []).map((row) => {
        const employeeRaw = row.employee
        const employee = Array.isArray(employeeRaw) ? employeeRaw[0] ?? null : employeeRaw ?? null

        return {
          id: row.id,
          employee_id: row.employee_id,
          punched_at: row.punched_at,
          marking_type: row.marking_type,
          source: row.source,
          employee,
        }
      })

      setPunches(normalized)
      setAppliedRange({ from, to })
    } catch (err) {
      console.error(err)
      setPunches([])
    } finally {
      setLoadingSummary(false)
    }
  }

  const loadFines = async (from: string, to: string) => {
    if (!tenantId) {
      setFines([])
      setFinesPending(true)
      return
    }

    setLoadingFines(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('fine_ledger')
        .select('id, incident_date, incident_type, employee_id, calculated_amount, applied_amount, was_capped, cap_excess, month_year')
        .eq('tenant_id', tenantId)
        .gte('incident_date', from)
        .lte('incident_date', to)
        .order('incident_date', { ascending: false })

      if (error) throw error
      setFines(data ?? [])
      setFinesPending(false)
      setAppliedRange({ from, to })
    } catch {
      setFinesPending(true)
    } finally {
      setLoadingFines(false)
    }
  }

  const loadOvertime = async (from: string, to: string) => {
    if (!tenantId) {
      setOvertime([])
      setOvertimePending(true)
      return
    }

    setLoadingOvertime(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('overtime_ledger')
        .select('id, employee_id, period_date, month_year, normal_hours, suplem_hours, extra_hours, total_amount, is_paid')
        .eq('tenant_id', tenantId)
        .gte('period_date', from)
        .lte('period_date', to)
        .order('period_date', { ascending: false })

      if (error) throw error
      setOvertime(data ?? [])
      setOvertimePending(false)
      setAppliedRange({ from, to })
    } catch {
      setOvertimePending(true)
    } finally {
      setLoadingOvertime(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'summary') {
      void loadSummary(appliedRange.from, appliedRange.to)
      return
    }

    if (activeTab === 'fines') {
      void loadFines(appliedRange.from, appliedRange.to)
      return
    }

    void loadOvertime(appliedRange.from, appliedRange.to)
  }, [activeTab, tenantId])

  const applyRange = () => {
    const normalized = normalizeRange(dateFrom || todayIso, dateTo || dateFrom || todayIso)

    setAppliedRange(normalized)

    if (activeTab === 'summary') {
      void loadSummary(normalized.from, normalized.to)
      return
    }

    if (activeTab === 'fines') {
      void loadFines(normalized.from, normalized.to)
      return
    }

    void loadOvertime(normalized.from, normalized.to)
  }

  const helpModal = showHelp ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-hidden="true"
        className="absolute inset-0 cursor-default bg-black/60"
        onClick={() => setShowHelp(false)}
      />

      <div className="relative w-[min(720px,92vw)] rounded-xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-semibold">¿Qué muestra este reporte?</h2>
            <p className="mt-1 text-sm text-white/60">Guía rápida para el equipo de RR. HH.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-4 pt-4 text-sm leading-6 text-white/80">
          <p>
            <strong>CIRA = Control de Incumplimientos, Retrasos y Asistencia.</strong>
          </p>
          <p>
            <strong>Reporte de Asistencia CIRA</strong> consolida información operativa y
            legal relacionada con marcaciones, multas y acumulados. Está pensado para análisis
            de RR. HH. y control normativo.
          </p>
          <p>
            <strong>Se diferencia de Marcaciones</strong> porque no se enfoca en el detalle
            diario de la lectura de entradas y salidas, sino en la revisión de resultados,
            incidencias y acumulados legales.
          </p>

          <div className="space-y-2">
            <p>
              <strong>Resumen del Día:</strong> muestra las marcaciones y el detalle del periodo
              seleccionado.
            </p>
            <p>
              <strong>Multas:</strong> muestra las multas registradas dentro del rango consultado.
            </p>
            <p>
              <strong>Acumulados Legales:</strong> muestra los acumulados de horas y pagos asociados
              al rango consultado.
            </p>
          </div>
        </div>
      </div>
    </div>
  ) : null

  const rangeLabel = appliedRange.from === appliedRange.to
    ? appliedRange.from
    : `${appliedRange.from} → ${appliedRange.to}`

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6">
      {helpModal}

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-white">Reporte de Asistencia CIRA</h1>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Ayuda"
            title="Ayuda"
          >
            ?
          </button>
        </div>
        <p className="text-sm text-white/55">
          Resumen diario, registro de multas y acumulados legales por colaborador.
        </p>
      </div>

      <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-white/10 bg-white/5 p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white shadow-sm' : 'text-white/55 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/50">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={applyRange}
          className="h-9 rounded-lg border border-blue-500/30 bg-blue-500/15 px-4 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-500/20"
        >
          Consultar
        </button>

        <div className="ml-auto text-xs text-white/45">
          Rango activo: {rangeLabel}
        </div>
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm font-medium text-white/60">Periodo consultado</span>
            {loadingSummary && <span className="text-xs text-white/45 animate-pulse">Cargando…</span>}

            <button
              type="button"
              onClick={() => exportDate(appliedRange.from)}
              disabled={exporting || loadingSummary}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Exportar formato Ministerio de Trabajo (FR-10)"
            >
              {exporting ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Exportando…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4 4m0 0l4-4m-4 4V4"
                    />
                  </svg>
                  Excel MT
                </>
              )}
            </button>
          </div>

          {!loadingSummary && punches.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-white/45">
              No hay marcaciones para el rango seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left">
                    <th className="px-4 py-3 font-medium text-white/45">Empleado</th>
                    <th className="px-4 py-3 font-medium text-white/45">Hora</th>
                    <th className="px-4 py-3 font-medium text-white/45">Tipo</th>
                    <th className="px-4 py-3 font-medium text-white/45">Fuente</th>
                    <th className="px-4 py-3 text-right font-medium text-white/45">
                      Horas calc. <span className="font-normal text-white/40">(C-3)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {punches.map((row) => (
                    <tr key={row.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-white/85">{employeeName(row)}</td>
                      <td className="px-4 py-3 font-mono text-white/70">{fmtTime(row.punched_at)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
                          {row.marking_type ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/55">{SOURCE_LABELS[row.source] ?? row.source}</td>
                      <td className="px-4 py-3 text-right text-xs text-white/45">— pendiente C-3</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'fines' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm font-medium text-white/60">Periodo consultado</span>
            {loadingFines && <span className="text-xs text-white/45 animate-pulse">Cargando…</span>}
          </div>

          {finesPending ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-5 text-sm text-amber-300">
              La tabla{' '}
              <code className="rounded bg-amber-500/20 px-1 font-mono text-xs">attendance.fine_ledger</code>{' '}
              aún no existe. Se creará en la Sesión C-4 del roadmap CIRA V2.0.
            </div>
          ) : !loadingFines && fines.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-white/45">
              No hay multas registradas para el rango seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left">
                    <th className="px-4 py-3 font-medium text-white/45">Fecha</th>
                    <th className="px-4 py-3 font-medium text-white/45">Empleado</th>
                    <th className="px-4 py-3 font-medium text-white/45">Tipo</th>
                    <th className="px-4 py-3 text-right font-medium text-white/45">Calculado</th>
                    <th className="px-4 py-3 text-right font-medium text-white/45">Aplicado</th>
                    <th className="px-4 py-3 text-center font-medium text-white/45">Capado</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((row) => (
                    <tr key={row.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3 text-white/70">{row.incident_date}</td>
                      <td className="px-4 py-3 font-mono text-xs text-white/55">{row.employee_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-white/80">{INCIDENT_TYPE_LABELS[row.incident_type] ?? row.incident_type}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/75">${row.calculated_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/75">${row.applied_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.was_capped ? (
                          <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                            Sí +${row.cap_excess.toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/55">
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

      {activeTab === 'accruals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm font-medium text-white/60">Periodo consultado</span>
            {loadingOvertime && <span className="text-xs text-white/45 animate-pulse">Cargando…</span>}
          </div>

          {overtimePending ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-5 text-sm text-amber-300">
              La tabla{' '}
              <code className="rounded bg-amber-500/20 px-1 font-mono text-xs">attendance.overtime_ledger</code>{' '}
              aún no existe. Se creará en la Sesión C-7 del roadmap CIRA V2.0.
            </div>
          ) : !loadingOvertime && overtime.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-white/45">
              No hay acumulados registrados para el rango seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left">
                    <th className="px-4 py-3 font-medium text-white/45">Fecha</th>
                    <th className="px-4 py-3 font-medium text-white/45">Empleado</th>
                    <th className="px-4 py-3 text-right font-medium text-white/45">H. Normal</th>
                    <th className="px-4 py-3 text-right font-medium text-white/45">H. Suplem.</th>
                    <th className="px-4 py-3 text-right font-medium text-white/45">H. Extra</th>
                    <th className="px-4 py-3 text-right font-medium text-white/45">Total USD</th>
                    <th className="px-4 py-3 text-center font-medium text-white/45">Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {overtime.map((row) => (
                    <tr key={row.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3 text-white/70">{row.period_date}</td>
                      <td className="px-4 py-3 font-mono text-xs text-white/55">{row.employee_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-right font-mono text-white/75">{row.normal_hours}h</td>
                      <td className="px-4 py-3 text-right font-mono text-white/75">{row.suplem_hours}h</td>
                      <td className="px-4 py-3 text-right font-mono text-white/75">{row.extra_hours}h</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-white/85">
                        ${row.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_paid ? (
                          <span className="inline-block rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-300">
                            Sí
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/55">
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
