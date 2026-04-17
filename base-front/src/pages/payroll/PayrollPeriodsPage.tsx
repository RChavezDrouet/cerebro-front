import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Play, CalendarDays, X, ChevronRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodStatus = 'DRAFT' | 'CALCULATING' | 'CALCULATED' | 'CLOSED'
type PeriodType   = 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY'

interface PayrollPeriod {
  id:           string
  tenant_id:    string
  code:         string
  period_year:  number
  period_month: number
  start_date:   string
  end_date:     string
  payment_date: string | null
  period_type:  PeriodType
  status:       PeriodStatus
  is_closed:    boolean
  created_at:   string
  updated_at:   string
}

interface PeriodForm {
  code:         string
  period_year:  number
  period_month: number
  start_date:   string
  end_date:     string
  payment_date: string
  period_type:  PeriodType
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const STATUS_STYLES: Record<PeriodStatus, { label: string; cls: string }> = {
  DRAFT:       { label: 'Borrador',    cls: 'bg-white/10 text-gray-300'          },
  CALCULATING: { label: 'Calculando', cls: 'bg-yellow-500/20 text-yellow-300'   },
  CALCULATED:  { label: 'Calculado',  cls: 'bg-blue-500/20 text-blue-300'       },
  CLOSED:      { label: 'Cerrado',    cls: 'bg-emerald-500/20 text-emerald-300' },
}

const PERIOD_TYPES: { value: PeriodType; label: string }[] = [
  { value: 'MONTHLY',   label: 'Mensual'    },
  { value: 'BIWEEKLY',  label: 'Quincenal'  },
  { value: 'WEEKLY',    label: 'Semanal'    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoCode(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function firstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function lastDay(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().slice(0, 10)
}

function defaultForm(): PeriodForm {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return {
    code:         autoCode(y, m),
    period_year:  y,
    period_month: m,
    start_date:   firstDay(y, m),
    end_date:     lastDay(y, m),
    payment_date: '',
    period_type:  'MONTHLY',
  }
}

// ─── Input shared style ───────────────────────────────────────────────────────

const INPUT = [
  'w-full px-3 py-2 rounded-lg text-sm',
  'bg-white/5 border border-white/10 text-white placeholder-white/30',
  'focus:outline-none focus:ring-2 focus:ring-blue-500/60',
].join(' ')

const LABEL = 'block text-xs font-medium text-white/50 mb-1'

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: PeriodForm | null          // null = crear, non-null = editar
  editId:  string | null
  onClose: () => void
  onSaved: () => void
  tenantId: string
}

function PeriodModal({ initial, editId, onClose, onSaved, tenantId }: ModalProps) {
  const [form, setForm] = useState<PeriodForm>(initial ?? defaultForm())
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof PeriodForm>(k: K, v: PeriodForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  // Auto-sync code when year/month change (solo en creación)
  const handleYearMonth = (year: number, month: number) => {
    setForm(prev => ({
      ...prev,
      period_year:  year,
      period_month: month,
      code:         !editId ? autoCode(year, month) : prev.code,
      start_date:   firstDay(year, month),
      end_date:     lastDay(year, month),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim()) { toast.error('Código requerido'); return }
    if (!form.start_date)  { toast.error('Fecha inicio requerida'); return }
    if (!form.end_date)    { toast.error('Fecha fin requerida'); return }
    if (form.end_date < form.start_date) { toast.error('Fecha fin debe ser ≥ inicio'); return }

    setSaving(true)
    try {
      if (editId) {
        // Edición directa (solo DRAFT)
        const { error } = await supabase
          .schema(ATT_SCHEMA)
          .from('payroll_periods')
          .update({
            code:         form.code,
            period_year:  form.period_year,
            period_month: form.period_month,
            start_date:   form.start_date,
            end_date:     form.end_date,
            payment_date: form.payment_date || null,
            period_type:  form.period_type,
            updated_at:   new Date().toISOString(),
          })
          .eq('id', editId)
          .eq('tenant_id', tenantId)
        if (error) throw error
        toast.success('Período actualizado')
      } else {
        // Creación via RPC (valida feature flag + inserta)
        const { error } = await supabase
          .schema(ATT_SCHEMA)
          .rpc('rpc_create_payroll_period', {
            p_code:         form.code,
            p_period_year:  form.period_year,
            p_period_month: form.period_month,
            p_start_date:   form.start_date,
            p_end_date:     form.end_date,
            p_payment_date: form.payment_date || null,
          })
        if (error) throw error
        toast.success('Período creado')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">
              {editId ? 'Editar Período' : 'Nuevo Período'}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Año + Mes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Año</label>
              <input
                type="number"
                min={2020} max={2099}
                value={form.period_year}
                onChange={e => handleYearMonth(Number(e.target.value), form.period_month)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Mes</label>
              <select
                value={form.period_month}
                onChange={e => handleYearMonth(form.period_year, Number(e.target.value))}
                className={INPUT}
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1} className="bg-[#1a1f2e]">{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Código + Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Código</label>
              <input
                type="text"
                value={form.code}
                onChange={e => set('code', e.target.value)}
                placeholder="ej. 2026-04"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Tipo</label>
              <select
                value={form.period_type}
                onChange={e => set('period_type', e.target.value as PeriodType)}
                className={INPUT}
              >
                {PERIOD_TYPES.map(pt => (
                  <option key={pt.value} value={pt.value} className="bg-[#1a1f2e]">{pt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Fecha Inicio</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Fecha Fin</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Fecha de pago */}
          <div>
            <label className={LABEL}>Fecha de Pago <span className="text-white/25">(opcional)</span></label>
            <input
              type="date"
              value={form.payment_date}
              onChange={e => set('payment_date', e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear período'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollPeriodsPage() {
  const navigate   = useNavigate()
  const tenantId   = useTenantStore(s => s.tenantId)
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<{ open: boolean; period: PayrollPeriod | null }>({
    open: false, period: null,
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('payroll_periods')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
      if (error) throw error
      setPeriods(data ?? [])
    } catch (err) {
      toast.error('Error al cargar períodos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const openCreate = () => setModal({ open: true, period: null })
  const openEdit   = (p: PayrollPeriod) => setModal({ open: true, period: p })
  const closeModal = () => setModal({ open: false, period: null })

  const editForm = modal.period
    ? {
        code:         modal.period.code,
        period_year:  modal.period.period_year,
        period_month: modal.period.period_month,
        start_date:   modal.period.start_date,
        end_date:     modal.period.end_date,
        payment_date: modal.period.payment_date ?? '',
        period_type:  modal.period.period_type,
      }
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Períodos de Nómina</h1>
          <p className="text-white/40 text-sm mt-1">
            Administra los períodos mensuales de liquidación.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo período
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-widest">
              <th className="text-left px-5 py-3 font-medium">Código</th>
              <th className="text-left px-5 py-3 font-medium">Período</th>
              <th className="text-left px-5 py-3 font-medium">Fechas</th>
              <th className="text-left px-5 py-3 font-medium">Pago</th>
              <th className="text-left px-5 py-3 font-medium">Tipo</th>
              <th className="text-left px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-white/30 text-sm">
                  Cargando…
                </td>
              </tr>
            )}

            {!loading && periods.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-white/30">
                    <CalendarDays className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No hay períodos creados</p>
                    <button
                      onClick={openCreate}
                      className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                    >
                      Crear el primero
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!loading && periods.map((p, i) => {
              const st = STATUS_STYLES[p.status] ?? STATUS_STYLES.DRAFT
              const canEdit = p.status === 'DRAFT'
              return (
                <tr
                  key={p.id}
                  className={[
                    'border-t border-white/5 transition-colors',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]',
                    'hover:bg-white/5',
                  ].join(' ')}
                >
                  <td className="px-5 py-3 font-mono text-white/80 text-xs">{p.code}</td>
                  <td className="px-5 py-3 text-white">
                    {MONTHS[p.period_month - 1]} {p.period_year}
                  </td>
                  <td className="px-5 py-3 text-white/50 text-xs">
                    {p.start_date} → {p.end_date}
                  </td>
                  <td className="px-5 py-3 text-white/50 text-xs">
                    {p.payment_date ?? <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-5 py-3 text-white/50 text-xs">
                    {PERIOD_TYPES.find(pt => pt.value === p.period_type)?.label ?? p.period_type}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <button
                          onClick={() => openEdit(p)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate('/payroll/runs', { state: { periodId: p.id, periodCode: p.code } })}
                        title="Ver ejecuciones"
                        className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 hover:bg-white/10 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => navigate('/payroll/runs', { state: { periodId: p.id, periodCode: p.code } })}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      {!loading && periods.length > 0 && (
        <p className="text-xs text-white/25 text-right">
          {periods.length} período{periods.length !== 1 ? 's' : ''} · Solo se pueden editar períodos en estado Borrador
        </p>
      )}

      {/* Modal */}
      {modal.open && tenantId && (
        <PeriodModal
          initial={editForm}
          editId={modal.period?.id ?? null}
          onClose={closeModal}
          onSaved={load}
          tenantId={tenantId}
        />
      )}
    </div>
  )
}
