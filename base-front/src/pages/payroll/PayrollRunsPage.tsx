import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { resolveTenantId } from '@/lib/tenant'
import toast from 'react-hot-toast'
import {
  Play, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Plus, ArrowLeft, RefreshCw, Lock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type RunStatus = 'DRAFT' | 'CALCULATING' | 'CALCULATED' | 'CLOSED' | 'CANCELLED'

interface PayrollRun {
  id:                       string
  tenant_id:                string
  payroll_period_id:        string
  run_no:                   number
  run_type:                 string
  status:                   RunStatus
  calculation_started_at:   string | null
  calculation_finished_at:  string | null
  approved_by:              string | null
  approved_at:              string | null
  closed_by:                string | null
  closed_at:                string | null
  notes:                    string | null
  created_at:               string
  updated_at:               string
}

interface RunCollaborator {
  id:                         string
  employee_id:                string
  employee_code:              string | null
  collaborator_name:          string | null
  base_salary:                number
  total_earnings:             number
  total_deductions:           number
  total_employer_contributions: number
  total_provisions:           number
  net_pay:                    number
  validation_status:          string
}

interface PayrollPeriodSummary {
  id:           string
  code:         string
  period_year:  number
  period_month: number
  status:       string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const STATUS_STYLES: Record<RunStatus, { label: string; cls: string; dot: string }> = {
  DRAFT:       { label: 'Borrador',    cls: 'bg-white/10 text-gray-300',           dot: 'bg-gray-400'    },
  CALCULATING: { label: 'Calculando', cls: 'bg-yellow-500/20 text-yellow-300',    dot: 'bg-yellow-400'  },
  CALCULATED:  { label: 'Calculado',  cls: 'bg-blue-500/20 text-blue-300',        dot: 'bg-blue-400'    },
  CLOSED:      { label: 'Cerrado',    cls: 'bg-emerald-500/20 text-emerald-300',  dot: 'bg-emerald-400' },
  CANCELLED:   { label: 'Cancelado',  cls: 'bg-red-500/20 text-red-300',          dot: 'bg-red-400'     },
}

const INPUT = [
  'w-full px-3 py-2 rounded-lg text-sm',
  'bg-white/5 border border-white/10 text-white placeholder-white/30',
  'focus:outline-none focus:ring-2 focus:ring-blue-500/60',
].join(' ')

const fmt = (n: number) =>
  n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── RunRow ───────────────────────────────────────────────────────────────────

interface RunRowProps {
  run:       PayrollRun
  tenantId:  string
  onRefresh: () => void
}

function RunRow({ run, tenantId, onRefresh }: RunRowProps) {
  const [expanded,      setExpanded]      = useState(false)
  const [collaborators, setCollaborators] = useState<RunCollaborator[]>([])
  const [loadingColabs, setLoadingColabs] = useState(false)
  const [acting,        setActing]        = useState(false)

  const st = STATUS_STYLES[run.status] ?? STATUS_STYLES.DRAFT

  const loadCollaborators = useCallback(async () => {
    if (!expanded) return
    setLoadingColabs(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('payroll_run_collaborators')
        .select(
          'id,employee_id,employee_code,collaborator_name,' +
          'base_salary,total_earnings,total_deductions,' +
          'total_employer_contributions,total_provisions,net_pay,validation_status'
        )
        .eq('payroll_run_id', run.id)
        .eq('tenant_id', tenantId)
        .order('collaborator_name')
      if (error) throw error
      setCollaborators((data ?? []) as unknown as RunCollaborator[])
    } catch (err) {
      toast.error('Error al cargar colaboradores')
      console.error(err)
    } finally {
      setLoadingColabs(false)
    }
  }, [expanded, run.id, tenantId])

  useEffect(() => { loadCollaborators() }, [loadCollaborators])

  const handleCalculate = async () => {
    if (!confirm(`¿Calcular la ejecución #${run.run_no}? Se borrarán los cálculos previos.`)) return
    setActing(true)
    try {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .rpc('rpc_calculate_payroll_run', { p_payroll_run_id: run.id })
      if (error) throw error
      toast.success('Nómina calculada correctamente')
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al calcular')
    } finally {
      setActing(false)
    }
  }

  const handleClose = async () => {
    if (!confirm(`¿Cerrar la ejecución #${run.run_no}? Esta acción es irreversible.`)) return
    setActing(true)
    try {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .rpc('rpc_close_payroll_run', { p_payroll_run_id: run.id })
      if (error) throw error
      toast.success('Ejecución cerrada')
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar')
    } finally {
      setActing(false)
    }
  }

  const totals = collaborators.reduce(
    (acc, c) => ({
      earnings:      acc.earnings      + c.total_earnings,
      deductions:    acc.deductions    + c.total_deductions,
      employer:      acc.employer      + c.total_employer_contributions,
      provisions:    acc.provisions    + c.total_provisions,
      net:           acc.net           + c.net_pay,
    }),
    { earnings: 0, deductions: 0, employer: 0, provisions: 0, net: 0 }
  )

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">

      {/* Run header */}
      <div className="flex items-center gap-4 px-5 py-4 bg-white/[0.03] hover:bg-white/5 transition-colors">

        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />

        {/* Run info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white font-medium text-sm">
              Ejecución #{run.run_no}
            </span>
            <span className="text-white/30 text-xs">{run.run_type}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
              {st.label}
            </span>
          </div>
          <div className="flex gap-4 mt-0.5 text-xs text-white/30">
            {run.calculation_started_at && (
              <span>Inicio cálculo: {new Date(run.calculation_started_at).toLocaleString('es-EC')}</span>
            )}
            {run.closed_at && (
              <span>Cerrado: {new Date(run.closed_at).toLocaleString('es-EC')}</span>
            )}
            {!run.calculation_started_at && !run.closed_at && (
              <span>Creado: {new Date(run.created_at).toLocaleString('es-EC')}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {run.status === 'DRAFT' && (
            <button
              onClick={handleCalculate}
              disabled={acting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/80 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors"
            >
              {acting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Calcular
            </button>
          )}
          {run.status === 'CALCULATED' && (
            <button
              onClick={handleClose}
              disabled={acting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors"
            >
              {acting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Cerrar
            </button>
          )}
          {run.status === 'CLOSED' && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/30">
              <Lock className="w-3.5 h-3.5" /> Cerrado
            </span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collaborators table */}
      {expanded && (
        <div className="border-t border-white/10">
          {loadingColabs ? (
            <div className="px-5 py-8 text-center text-white/30 text-sm">Cargando colaboradores…</div>
          ) : collaborators.length === 0 ? (
            <div className="px-5 py-8 text-center text-white/30 text-sm">
              {run.status === 'DRAFT'
                ? 'Ejecuta el cálculo para generar las líneas de nómina.'
                : 'Sin colaboradores en esta ejecución.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/5 text-white/30 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-medium">Colaborador</th>
                      <th className="text-left px-4 py-2.5 font-medium">Código</th>
                      <th className="text-right px-4 py-2.5 font-medium">Salario Base</th>
                      <th className="text-right px-4 py-2.5 font-medium">Ingresos</th>
                      <th className="text-right px-4 py-2.5 font-medium">Deducciones</th>
                      <th className="text-right px-4 py-2.5 font-medium">Aporte Patronal</th>
                      <th className="text-right px-4 py-2.5 font-medium">Provisiones</th>
                      <th className="text-right px-4 py-2.5 font-medium text-emerald-400">Neto a Pagar</th>
                      <th className="text-center px-4 py-2.5 font-medium">Validación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collaborators.map((c, i) => (
                      <tr
                        key={c.id}
                        className={[
                          'border-t border-white/5',
                          i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]',
                          'hover:bg-white/5 transition-colors',
                        ].join(' ')}
                      >
                        <td className="px-4 py-2.5 text-white/80">
                          {c.collaborator_name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-white/40">
                          {c.employee_code ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-white/60 font-mono">
                          $ {fmt(c.base_salary)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-white/60 font-mono">
                          $ {fmt(c.total_earnings)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-red-400/80 font-mono">
                          $ {fmt(c.total_deductions)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-yellow-400/80 font-mono">
                          $ {fmt(c.total_employer_contributions)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-blue-400/80 font-mono">
                          $ {fmt(c.total_provisions)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-400 font-mono font-semibold">
                          $ {fmt(c.net_pay)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {c.validation_status === 'OK'
                            ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                            : <XCircle    className="w-4 h-4 text-red-400 mx-auto"     />}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Totals row */}
                  <tfoot>
                    <tr className="border-t-2 border-white/20 bg-white/5 font-semibold">
                      <td colSpan={2} className="px-4 py-2.5 text-white/50 text-xs uppercase tracking-wide">
                        Totales ({collaborators.length} colaboradores)
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-mono text-xs">
                        $ {fmt(totals.earnings)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-mono text-xs">
                        $ {fmt(totals.earnings)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-400 font-mono text-xs">
                        $ {fmt(totals.deductions)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-yellow-400 font-mono text-xs">
                        $ {fmt(totals.employer)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-blue-400 font-mono text-xs">
                        $ {fmt(totals.provisions)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-mono text-xs">
                        $ {fmt(totals.net)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface LocationState {
  periodId?:   string
  periodCode?: string
}

export default function PayrollRunsPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuth()

  const stateIn = (location.state ?? {}) as LocationState

  const [tenantId,  setTenantId]  = useState<string | null>(null)
  const [period,    setPeriod]    = useState<PayrollPeriodSummary | null>(null)
  const [periods,   setPeriods]   = useState<PayrollPeriodSummary[]>([])
  const [runs,      setRuns]      = useState<PayrollRun[]>([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)
  const [runType,   setRunType]   = useState<'REGULAR' | 'ADJUSTMENT'>('REGULAR')
  const [showForm,  setShowForm]  = useState(false)

  // ── Resolve tenant ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    resolveTenantId(user.id).then(tid => {
      if (tid) setTenantId(tid)
    })
  }, [user])

  // ── Load periods list ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return
    supabase
      .schema(ATT_SCHEMA)
      .from('payroll_periods')
      .select('id,code,period_year,period_month,status')
      .eq('tenant_id', tenantId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .then(({ data }) => setPeriods(data ?? []))
  }, [tenantId])

  // ── Select period from state or first available ─────────────────────────────
  useEffect(() => {
    if (periods.length === 0) return
    if (stateIn.periodId) {
      const found = periods.find(p => p.id === stateIn.periodId)
      if (found) { setPeriod(found); return }
    }
    setPeriod(periods[0])
  }, [periods]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load runs for selected period ───────────────────────────────────────────
  const loadRuns = useCallback(async () => {
    if (!tenantId || !period) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('payroll_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('payroll_period_id', period.id)
        .order('run_no', { ascending: false })
      if (error) throw error
      setRuns(data ?? [])
    } catch (err) {
      toast.error('Error al cargar ejecuciones')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [tenantId, period])

  useEffect(() => { loadRuns() }, [loadRuns])

  // ── Create run ──────────────────────────────────────────────────────────────
  const handleCreateRun = async () => {
    if (!period) return
    if (!confirm(`¿Crear nueva ejecución (${runType}) para el período ${period.code}?`)) return
    setCreating(true)
    try {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .rpc('rpc_create_payroll_run', {
          p_payroll_period_id: period.id,
          p_run_type:          runType,
        })
      if (error) throw error
      toast.success('Ejecución creada')
      setShowForm(false)
      loadRuns()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear ejecución')
    } finally {
      setCreating(false)
    }
  }

  const periodClosed = period?.status === 'CLOSED'
  const canCreateRun = !!period && !periodClosed && !loading

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payroll/periods')}
            className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Ejecuciones de Nómina</h1>
            <p className="text-white/40 text-sm mt-0.5">
              Calcula, revisa y cierra corridas por período.
            </p>
          </div>
        </div>

        {canCreateRun && (
          <button
            onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva ejecución
          </button>
        )}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-white/40 text-sm flex-shrink-0">Período:</span>
        <select
          value={period?.id ?? ''}
          onChange={e => {
            const found = periods.find(p => p.id === e.target.value)
            if (found) setPeriod(found)
          }}
          className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60"
        >
          {periods.length === 0 && (
            <option value="" className="bg-[#1a1f2e]">Sin períodos</option>
          )}
          {periods.map(p => (
            <option key={p.id} value={p.id} className="bg-[#1a1f2e]">
              {MONTHS[p.period_month - 1]} {p.period_year} — {p.code}
              {p.status === 'CLOSED' ? ' (Cerrado)' : ''}
            </option>
          ))}
        </select>

        {period && (
          <span className={[
            'px-2.5 py-0.5 rounded-full text-xs font-medium',
            period.status === 'CLOSED'
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-white/10 text-gray-300',
          ].join(' ')}>
            {period.status === 'CLOSED' ? 'Cerrado' : 'Activo'}
          </span>
        )}
      </div>

      {/* New run form */}
      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Nueva ejecución</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-white/50 mb-1">Tipo de ejecución</label>
              <select
                value={runType}
                onChange={e => setRunType(e.target.value as typeof runType)}
                className={INPUT}
              >
                <option value="REGULAR"    className="bg-[#1a1f2e]">Regular</option>
                <option value="ADJUSTMENT" className="bg-[#1a1f2e]">Ajuste</option>
              </select>
            </div>
            <button
              onClick={handleCreateRun}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
            >
              {creating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creando…</>
                : <><Plus className="w-4 h-4" /> Crear ejecución</>}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Runs list */}
      {loading ? (
        <div className="py-16 text-center text-white/30 text-sm">Cargando ejecuciones…</div>
      ) : !period ? (
        <div className="py-16 text-center text-white/30 text-sm">
          No hay períodos disponibles.{' '}
          <button onClick={() => navigate('/payroll/periods')} className="text-blue-400 hover:text-blue-300">
            Crear uno
          </button>
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-white/30">
          <Play className="w-10 h-10 opacity-30" />
          <p className="text-sm">Sin ejecuciones para este período</p>
          {canCreateRun && (
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
            >
              Crear la primera ejecución
            </button>
          )}
          {periodClosed && (
            <p className="text-xs text-white/20">El período está cerrado — no se pueden crear nuevas ejecuciones.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tenantId && runs.map(run => (
            <RunRow
              key={run.id}
              run={run}
              tenantId={tenantId}
              onRefresh={loadRuns}
            />
          ))}
        </div>
      )}

      {/* Footer summary */}
      {!loading && runs.length > 0 && (
        <p className="text-xs text-white/25 text-right">
          {runs.length} ejecución{runs.length !== 1 ? 'es' : ''} ·{' '}
          {period?.code} ·{' '}
          Solo períodos activos permiten nuevas ejecuciones
        </p>
      )}
    </div>
  )
}
