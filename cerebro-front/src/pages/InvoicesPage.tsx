/**
 * InvoicesPage.tsx
 * CEREBRO v5.0.0 — Facturación con registro de pagos detallado
 *
 * Funcionalidades:
 *  - Listado de facturas con filtros por estado y búsqueda
 *  - Al hacer clic en una factura → modal de detalle con historial de pagos
 *  - Botón "Registrar pago" abre formulario con:
 *      · Fecha de pago
 *      · Efectivo (monto)
 *      · Cheque (monto + banco + número de cheque + fecha)
 *      · Tarjeta de crédito (monto + marca + últimos 4 dígitos + autorización)
 *      · Transferencia (monto)
 *      · Saldo automático (total factura − pagos anteriores − pago actual)
 *  - Validaciones: suma de formas de pago ≤ saldo pendiente
 *  - Actualización de estado de la factura (paid cuando saldo = 0)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../config/supabase'
import { useAuth } from '../App'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled'

interface Invoice {
  id: string
  invoice_number: string | null
  tenant_id: string
  tenant_name: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  subtotal: number
  tax: number
  total: number
  status: InvoiceStatus
  due_date: string | null
  paid_date: string | null
  notes: string | null
  created_at: string
  paid_amount: number  // suma de pagos registrados
}

interface Payment {
  id: string
  invoice_id: string
  payment_date: string | null
  payment_date_registered: string | null
  amount: number
  cash_amount: number
  check_amount: number
  check_bank: string | null
  check_number: string | null
  check_date: string | null
  card_amount: number
  card_brand: string | null
  card_last_four: string | null
  card_authorization: string | null
  transfer_amount: number
  notes: string | null
  created_at: string
}

interface PaymentForm {
  payment_date: string
  cash_amount: string
  check_amount: string
  check_bank: string
  check_number: string
  check_date: string
  card_amount: string
  card_brand: string
  card_last_four: string
  card_authorization: string
  transfer_amount: string
  notes: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes y helpers
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

const DEFAULT_FORM: PaymentForm = {
  payment_date: TODAY,
  cash_amount: '',
  check_amount: '',
  check_bank: '',
  check_number: '',
  check_date: '',
  card_amount: '',
  card_brand: '',
  card_last_four: '',
  card_authorization: '',
  transfer_amount: '',
  notes: '',
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; dot: string }> = {
  draft:     { label: 'Borrador',   color: 'bg-slate-500/10 border-slate-500/30 text-slate-300',   dot: 'bg-slate-400' },
  pending:   { label: 'Pendiente',  color: 'bg-amber-500/10 border-amber-500/30 text-amber-200',   dot: 'bg-amber-400' },
  sent:      { label: 'Enviada',    color: 'bg-blue-500/10 border-blue-500/30 text-blue-200',       dot: 'bg-blue-400' },
  paid:      { label: 'Pagada',     color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200', dot: 'bg-emerald-400' },
  overdue:   { label: 'Vencida',    color: 'bg-red-500/10 border-red-500/30 text-red-200',         dot: 'bg-red-400' },
  cancelled: { label: 'Cancelada',  color: 'bg-slate-700/30 border-slate-600/30 text-slate-400',   dot: 'bg-slate-500' },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n)

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const num = (v: string) => {
  // Acepta tanto punto como coma como separador decimal
  const clean = v.replace(/[^0-9.,]/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de detalle + registro de pago
// ─────────────────────────────────────────────────────────────────────────────

interface InvoiceModalProps {
  invoice: Invoice
  onClose: () => void
  onPaymentSaved: () => void
}

function InvoiceModal({ invoice, onClose, onPaymentSaved }: InvoiceModalProps) {
  const { user } = useAuth()
  const [payments,      setPayments]      = useState<Payment[]>([])
  const [loadingPay,    setLoadingPay]    = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [form,          setForm]          = useState<PaymentForm>(DEFAULT_FORM)

  // Carga pagos de esta factura
  const loadPayments = useCallback(async () => {
    setLoadingPay(true)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setPayments((data || []) as Payment[])
    } catch {
      toast.error('No se pudieron cargar los pagos')
    } finally {
      setLoadingPay(false)
    }
  }, [invoice.id])

  useEffect(() => { loadPayments() }, [loadPayments])

  // Cálculos de saldo
  const totalPaid    = useMemo(() => payments.reduce((s, p) => s + (p.amount || 0), 0), [payments])
  const pending      = Math.max(0, invoice.total - totalPaid)
  const formTotal    = num(form.cash_amount) + num(form.check_amount) + num(form.card_amount) + num(form.transfer_amount)
  const afterPayment = Math.max(0, pending - formTotal)
  const overPaying   = formTotal > pending + 0.001

  const setF = (patch: Partial<PaymentForm>) => setForm((p) => ({ ...p, ...patch }))

  const handleSave = async () => {
    if (formTotal <= 0) { toast.error('Ingrese al menos un monto de pago'); return }
    if (overPaying)     { toast.error(`El pago excede el saldo pendiente de ${fmt(pending)}`); return }

    const checkAmt = num(form.check_amount)
    if (checkAmt > 0 && !form.check_bank.trim()) { toast.error('Indique el banco del cheque'); return }
    if (checkAmt > 0 && !form.check_number.trim()) { toast.error('Indique el número de cheque'); return }

    const cardAmt = num(form.card_amount)
    if (cardAmt > 0 && !form.card_brand.trim()) { toast.error('Indique la marca de la tarjeta'); return }

    setSaving(true)
    try {
      const payload = {
        invoice_id:           invoice.id,
        tenant_id:            invoice.tenant_id,
        payment_date:         form.payment_date || TODAY,
        payment_date_registered: TODAY,
        amount:               formTotal,
        cash_amount:          num(form.cash_amount),
        check_amount:         checkAmt,
        check_bank:           checkAmt > 0 ? form.check_bank.trim() : null,
        check_number:         checkAmt > 0 ? form.check_number.trim() : null,
        check_date:           checkAmt > 0 && form.check_date ? form.check_date : null,
        card_amount:          cardAmt,
        card_brand:           cardAmt > 0 ? form.card_brand.trim() : null,
        card_last_four:       cardAmt > 0 && form.card_last_four.trim() ? form.card_last_four.trim().slice(-4) : null,
        card_authorization:   cardAmt > 0 && form.card_authorization.trim() ? form.card_authorization.trim() : null,
        transfer_amount:      num(form.transfer_amount),
        payment_method:       buildMethodLabel(form),
        notes:                form.notes.trim() || null,
        registered_by:        user?.id ?? null,
      }

      const { error: payErr } = await supabase.from('payments').insert(payload)
      if (payErr) throw payErr

      // Actualizar estado de la factura
      const newStatus: InvoiceStatus = afterPayment <= 0.001 ? 'paid' : 'pending'
      const updateData: any = { status: newStatus }
      if (newStatus === 'paid') updateData.paid_date = TODAY

      const { error: invErr } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id)
      if (invErr) console.warn('No se pudo actualizar estado de factura:', invErr.message)

      toast.success(
        afterPayment <= 0.001
          ? '¡Pago registrado! Factura marcada como PAGADA.'
          : `Pago registrado. Saldo pendiente: ${fmt(afterPayment)}`
      )

      setForm(DEFAULT_FORM)
      setShowForm(false)
      await loadPayments()
      onPaymentSaved()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo registrar el pago')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[rgba(15,23,42,0.97)] border border-[rgba(148,163,184,0.12)] rounded-3xl shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[rgba(148,163,184,0.10)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-[var(--brand-primary)]" />
              <h2 className="text-lg font-bold text-slate-100">
                Factura {invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()}
              </h2>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-sm text-slate-400">{invoice.tenant_name || 'Empresa'}</p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Resumen de montos */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total factura', value: fmt(invoice.total), color: 'text-slate-100' },
              { label: 'Pagado',        value: fmt(totalPaid),     color: 'text-emerald-400' },
              { label: 'Saldo pendiente', value: fmt(pending),     color: pending > 0 ? 'text-amber-400' : 'text-emerald-400' },
            ].map((item) => (
              <div key={item.label}
                className="rounded-2xl bg-white/5 border border-[rgba(148,163,184,0.08)] p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Info de la factura */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Vencimiento: <span className="text-slate-200">{fmtDate(invoice.due_date)}</span></span>
            </div>
            {invoice.billing_period_start && (
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Período: <span className="text-slate-200">
                  {fmtDate(invoice.billing_period_start)} – {fmtDate(invoice.billing_period_end)}
                </span></span>
              </div>
            )}
          </div>

          {/* Historial de pagos */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Pagos registrados</h3>
            {loadingPay ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando pagos...
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Sin pagos registrados aún.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {payments.map((pay) => (
                  <div key={pay.id}
                    className="rounded-xl bg-white/[0.03] border border-[rgba(148,163,184,0.08)] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">
                        {fmtDate(pay.payment_date || pay.payment_date_registered)}
                      </span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{fmt(pay.amount)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {pay.cash_amount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          <Banknote className="w-3 h-3" /> Efectivo {fmt(pay.cash_amount)}
                        </span>
                      )}
                      {pay.check_amount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          <FileText className="w-3 h-3" />
                          Cheque {fmt(pay.check_amount)}
                          {pay.check_bank ? ` · ${pay.check_bank}` : ''}
                          {pay.check_number ? ` #${pay.check_number}` : ''}
                        </span>
                      )}
                      {pay.card_amount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          <CreditCard className="w-3 h-3" />
                          {pay.card_brand || 'Tarjeta'} {fmt(pay.card_amount)}
                          {pay.card_last_four ? ` ···${pay.card_last_four}` : ''}
                        </span>
                      )}
                      {pay.transfer_amount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          <Building2 className="w-3 h-3" /> Transferencia {fmt(pay.transfer_amount)}
                        </span>
                      )}
                    </div>
                    {pay.notes && <p className="text-xs text-slate-500 mt-1.5 italic">{pay.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón abrir formulario o formulario */}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && pending > 0.001 && (
            <>
              {!showForm ? (
                <button onClick={() => setShowForm(true)}
                  className="w-full btn-primary inline-flex items-center justify-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Registrar pago
                </button>
              ) : (
                <PaymentFormPanel
                  form={form}
                  setF={setF}
                  pending={pending}
                  formTotal={formTotal}
                  afterPayment={afterPayment}
                  overPaying={overPaying}
                  saving={saving}
                  onSave={handleSave}
                  onCancel={() => { setShowForm(false); setForm(DEFAULT_FORM) }}
                />
              )}
            </>
          )}

          {invoice.status === 'paid' && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Factura pagada en su totalidad el {fmtDate(invoice.paid_date)}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulario de pago
// ─────────────────────────────────────────────────────────────────────────────

interface PaymentFormPanelProps {
  form: PaymentForm
  setF: (patch: Partial<PaymentForm>) => void
  pending: number
  formTotal: number
  afterPayment: number
  overPaying: boolean
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

function PaymentFormPanel({
  form, setF, pending, formTotal, afterPayment, overPaying, saving, onSave, onCancel
}: PaymentFormPanelProps) {
  const checkAmt = num(form.check_amount)
  const cardAmt  = num(form.card_amount)

  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/30 bg-[rgba(0,86,230,0.04)] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-[var(--brand-primary)]" />
          Registro de pago
        </h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fecha del pago */}
      <div>
        <label className="label">Fecha del pago</label>
        <input type="date" className="input" value={form.payment_date}
          onChange={(e) => setF({ payment_date: e.target.value })} max={TODAY} />
      </div>

      {/* ── Efectivo ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Banknote className="w-4 h-4 text-emerald-400" />
          Efectivo
        </div>
        <div>
          <label className="label">Monto en efectivo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="text" inputMode="decimal" className="input pl-7"
              placeholder="0.00" autoComplete="off"
              value={form.cash_amount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setF({ cash_amount: e.target.value.replace(/[^0-9.,]/g, '') })} />
          </div>
        </div>
      </div>

      {/* ── Cheque ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <FileText className="w-4 h-4 text-blue-400" />
          Cheque
        </div>
        <div>
          <label className="label">Valor del cheque</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="text" inputMode="decimal" className="input pl-7"
              placeholder="0.00" autoComplete="off"
              value={form.check_amount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setF({ check_amount: e.target.value.replace(/[^0-9.,]/g, '') })} />
          </div>
        </div>
        {checkAmt > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-2 border-l-2 border-blue-500/30">
            <div>
              <label className="label">Banco <span className="text-red-400">*</span></label>
              <input className="input" placeholder="Pichincha / Pacífico..."
                value={form.check_bank}
                onChange={(e) => setF({ check_bank: e.target.value })} />
            </div>
            <div>
              <label className="label">Número de cheque <span className="text-red-400">*</span></label>
              <input className="input font-mono" placeholder="000123456"
                value={form.check_number}
                onChange={(e) => setF({ check_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Fecha del cheque</label>
              <input type="date" className="input"
                value={form.check_date}
                onChange={(e) => setF({ check_date: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {/* ── Tarjeta de crédito ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <CreditCard className="w-4 h-4 text-purple-400" />
          Tarjeta de crédito / débito
        </div>
        <div>
          <label className="label">Monto con tarjeta</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="text" inputMode="decimal" className="input pl-7"
              placeholder="0.00" autoComplete="off"
              value={form.card_amount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setF({ card_amount: e.target.value.replace(/[^0-9.,]/g, '') })} />
          </div>
        </div>
        {cardAmt > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-2 border-l-2 border-purple-500/30">
            <div>
              <label className="label">Marca <span className="text-red-400">*</span></label>
              <select className="input"
                value={form.card_brand}
                onChange={(e) => setF({ card_brand: e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="VISA">VISA</option>
                <option value="Mastercard">Mastercard</option>
                <option value="American Express">American Express</option>
                <option value="Diners Club">Diners Club</option>
                <option value="Discover">Discover</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">Últimos 4 dígitos</label>
              <input className="input font-mono" placeholder="1234" maxLength={4}
                value={form.card_last_four}
                onChange={(e) => setF({ card_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            </div>
            <div>
              <label className="label">Código de autorización</label>
              <input className="input font-mono" placeholder="ABC123"
                value={form.card_authorization}
                onChange={(e) => setF({ card_authorization: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {/* ── Transferencia ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Building2 className="w-4 h-4 text-amber-400" />
          Transferencia bancaria
        </div>
        <div>
          <label className="label">Monto por transferencia</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="text" inputMode="decimal" className="input pl-7"
              placeholder="0.00" autoComplete="off"
              value={form.transfer_amount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setF({ transfer_amount: e.target.value.replace(/[^0-9.,]/g, '') })} />
          </div>
        </div>
      </div>

      {/* ── Observaciones ───────────────────────────────────────────────────── */}
      <div>
        <label className="label">Observaciones del pago</label>
        <textarea className="input min-h-[70px] resize-none" placeholder="Notas internas del pago..."
          value={form.notes}
          onChange={(e) => setF({ notes: e.target.value })} />
      </div>

      {/* ── Resumen de saldo ─────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 space-y-2 border ${
        overPaying
          ? 'bg-red-500/10 border-red-500/30'
          : formTotal > 0
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-white/5 border-[rgba(148,163,184,0.10)]'
      }`}>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Saldo pendiente</span>
          <span className="font-mono text-slate-200">{fmt(pending)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Total este pago</span>
          <span className={`font-mono font-semibold ${overPaying ? 'text-red-400' : 'text-slate-100'}`}>
            {fmt(formTotal)}
          </span>
        </div>
        <div className="border-t border-[rgba(148,163,184,0.10)] pt-2 flex justify-between">
          <span className="font-semibold text-slate-300">Saldo tras el pago</span>
          <span className={`font-mono font-bold text-lg ${
            overPaying ? 'text-red-400' : afterPayment <= 0.001 ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {overPaying ? '— Excede saldo —' : fmt(afterPayment)}
          </span>
        </div>
        {overPaying && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            El pago ingresado supera el saldo pendiente de {fmt(pending)}.
          </p>
        )}
        {!overPaying && afterPayment <= 0.001 && formTotal > 0 && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            La factura quedará marcada como PAGADA.
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={saving}
          className="flex-1 btn-secondary">
          Cancelar
        </button>
        <button onClick={onSave}
          disabled={saving || formTotal <= 0 || overPaying}
          className="flex-1 btn-primary inline-flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Guardando...' : 'Guardar pago'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: construir label de método de pago
// ─────────────────────────────────────────────────────────────────────────────

function buildMethodLabel(form: PaymentForm): string {
  const parts: string[] = []
  if (num(form.cash_amount) > 0)     parts.push('Efectivo')
  if (num(form.check_amount) > 0)    parts.push('Cheque')
  if (num(form.card_amount) > 0)     parts.push(form.card_brand || 'Tarjeta')
  if (num(form.transfer_amount) > 0) parts.push('Transferencia')
  return parts.join(' + ') || 'Mixto'
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices,       setInvoices]       = useState<Invoice[]>([])
  const [loading,        setLoading]        = useState(true)
  const [q,              setQ]              = useState('')
  const [statusFilter,   setStatusFilter]   = useState<InvoiceStatus | 'all'>('all')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Columnas opcionales que pueden no existir aún en la BD
      // Se degradan progresivamente si PostgREST devuelve 42703
      let optionalCols = [
        'invoice_number', 'billing_period_start', 'billing_period_end',
        'subtotal', 'tax', 'due_date', 'paid_date', 'notes',
      ]
      const baseCols = 'id, tenant_id, total, status, created_at, tenants:tenant_id(name)'

      let data: any[] | null = null

      for (let attempt = 0; attempt <= optionalCols.length; attempt++) {
        const selectCols = optionalCols.length > 0
          ? `${baseCols}, ${optionalCols.join(', ')}`
          : baseCols

        const { data: d, error } = await supabase
          .from('invoices')
          .select(selectCols)
          .order('created_at', { ascending: false })

        if (!error) { data = d || []; break }

        // Detectar columna faltante y quitarla del siguiente intento
        const msg = String((error as any)?.message || '')
        const m = msg.match(/column invoices\.(\w+) does not exist/) ||
                  msg.match(/Could not find the '(\w+)' column/)
        const missing = m?.[1]
        if (missing && optionalCols.includes(missing)) {
          optionalCols = optionalCols.filter(c => c !== missing)
          continue
        }
        // Error no recuperable
        throw error
      }

      // Para cada factura, obtener la suma de pagos
      const rows = (data || []) as any[]
      const withPaid: Invoice[] = await Promise.all(
        rows.map(async (inv) => {
          const { data: pd } = await supabase
            .from('payments')
            .select('amount')
            .eq('invoice_id', inv.id)
          const paid_amount = (pd || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
          return {
            ...inv,
            tenant_name: inv.tenants?.name ?? null,
            paid_amount,
          }
        })
      )
      setInvoices(withPaid)
    } catch (e: any) {
      toast.error('No se pudieron cargar las facturas')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false
      if (!qq) return true
      return (
        String(inv.invoice_number || '').toLowerCase().includes(qq) ||
        String(inv.tenant_name || '').toLowerCase().includes(qq)
      )
    })
  }, [invoices, q, statusFilter])

  // KPIs rápidos
  const kpis = useMemo(() => ({
    total:   invoices.length,
    pending: invoices.filter((i) => ['pending', 'sent', 'overdue'].includes(i.status)).length,
    overdue: invoices.filter((i) => i.status === 'overdue').length,
    totalPendingAmount: invoices
      .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + Math.max(0, i.total - i.paid_amount), 0),
  }), [invoices])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Facturación</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestión de facturas y registro de pagos. Haz clic en una factura para ver el detalle o registrar un pago.
          </p>
        </div>
        <button onClick={load} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total facturas',   value: kpis.total,                     color: 'text-slate-100' },
          { label: 'Pendientes',       value: kpis.pending,                   color: 'text-amber-400' },
          { label: 'Vencidas',         value: kpis.overdue,                   color: 'text-red-400' },
          { label: 'Saldo por cobrar', value: fmt(kpis.totalPendingAmount),   color: 'text-amber-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-slate-400 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Buscar por factura o empresa..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">Todos los estados</option>
          {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(148,163,184,0.10)] flex items-center justify-between">
          <span className="text-sm text-slate-300">{filtered.length} factura{filtered.length !== 1 ? 's' : ''}</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-[rgba(148,163,184,0.10)]">
              <tr>
                <th className="px-4 py-3 font-medium">Factura</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Pagado</th>
                <th className="px-4 py-3 font-medium text-right">Saldo</th>
                <th className="px-4 py-3 font-medium">Vencimiento</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    No hay facturas que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {filtered.map((inv) => {
                const saldo = Math.max(0, inv.total - inv.paid_amount)
                const isOverdue = inv.status === 'overdue'
                return (
                  <tr key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className="border-b border-[rgba(148,163,184,0.06)] hover:bg-white/[0.025] cursor-pointer transition-colors group">
                    <td className="px-4 py-4">
                      <span className="font-mono text-slate-200 text-xs">
                        {inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-200 max-w-[160px] truncate">
                      {inv.tenant_name || '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-400 text-xs whitespace-nowrap">
                      {fmtDate(inv.billing_period_start)}
                      {inv.billing_period_end ? ` – ${fmtDate(inv.billing_period_end)}` : ''}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-slate-200">{fmt(inv.total)}</td>
                    <td className="px-4 py-4 text-right font-mono text-emerald-400">
                      {inv.paid_amount > 0 ? fmt(inv.paid_amount) : '—'}
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      <span className={saldo > 0 ? (isOverdue ? 'text-red-400' : 'text-amber-400') : 'text-slate-500'}>
                        {saldo > 0 ? fmt(saldo) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-300 text-xs whitespace-nowrap">
                      {fmtDate(inv.due_date)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-4">
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de detalle */}
      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPaymentSaved={() => {
            load()
            // Actualizar la factura seleccionada con los nuevos datos
            setSelectedInvoice((prev) => prev ? { ...prev } : null)
          }}
        />
      )}
    </div>
  )
}
