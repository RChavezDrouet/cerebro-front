// src/pages/TenantDetailPage.tsx
// CEREBRO v4.12.1
// Ajustes aplicados:
//  - Carga robusta de public.tenants con columnas canónicas + legacy, eliminando columnas inexistentes en runtime.
//  - Modo explícito Editar / Guardar / Cancelar.
//  - Dropdown de planes cargado desde public.subscription_plans.
//  - Guardado sólo de columnas disponibles para evitar 400 por schema desalineado.
//  - Biométricos en attendance.biometric_devices usando serial_no.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import {
  Building2,
  Save,
  ArrowLeft,
  Pause,
  Play,
  XCircle,
  CheckCircle2,
  Receipt,
  Calendar,
  DollarSign,
  Info,
  Shield,
  Cpu,
  Phone,
  Mail,
  MapPin,
  User,
  Clock,
  Percent,
  Plus,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import {
  GlassCard,
  SectionCard,
  Badge,
  NeonButton,
  InputField,
  FullPageLoader,
  PageHeader,
} from '@/components/ui'
import type { Tenant, Invoice } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type SerialStatus = 'idle' | 'checking' | 'ok' | 'duplicate' | 'error'

interface BiometricDevice {
  id: string
  serial_no: string
  name: string | null
  is_active: boolean
  created_at: string
}

interface NewSerial {
  localId: string
  value: string
  status: SerialStatus
  message?: string
}

interface PlanOption {
  code: string
  name: string | null
}

interface TenantExtended extends Tenant {
  business_name?: string | null
  plan_type?: string | null
  billing_period?: string | null
  is_suspended?: boolean | null
  current_balance?: number | null
  grace_days?: number | null
  pause_after_grace?: boolean | null
  notes?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  legal_rep_name?: string | null
  legal_rep_email?: string | null
  legal_rep_phone?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_mobile?: string | null
  contact_phone_ext?: string | null
  courtesy_pct?: number | null
  courtesy_period?: string | null
  courtesy_times?: number | null
  courtesy_duration?: string | null
  bio_sold_by_us?: boolean | null
  bio_purchase_date?: string | null
  bio_warranty_months?: number | null
  admin_email?: string | null
  suspension_date?: string | null
  suspension_reason?: string | null
  updated_at?: string | null
}

const TENANT_COLUMNS_CANDIDATES = [
  'id',
  'name',
  'business_name',
  'ruc',
  'legal_rep_name',
  'legal_rep_email',
  'legal_rep_phone',
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_mobile',
  'contact_phone_ext',
  'plan_type',
  'plan',
  'status',
  'is_suspended',
  'current_balance',
  'grace_days',
  'pause_after_grace',
  'notes',
  'address',
  'province',
  'city',
  'billing_period',
  'courtesy_pct',
  'courtesy_period',
  'courtesy_times',
  'courtesy_duration',
  'bio_sold_by_us',
  'bio_purchase_date',
  'bio_warranty_months',
  'admin_email',
  'suspension_date',
  'suspension_reason',
  'created_at',
  'updated_at',
]

function effectiveStatus(t: TenantExtended | null): string {
  if (!t) return 'active'
  if (t.is_suspended === true) return 'suspended'
  return t.status ?? 'active'
}

const uid = () => Math.random().toString(36).slice(2, 10)

function getTenantLabel(t: Partial<TenantExtended> | null | undefined) {
  return t?.business_name || t?.name || '—'
}

function getPlanValue(t: Partial<TenantExtended> | null | undefined) {
  return t?.plan_type || t?.plan || ''
}

function toNumberOrNull(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function missingColumnFromError(error: any): string | null {
  const msg = String(error?.message || error?.details || '')
  const match =
    msg.match(/Could not find the '(.+?)' column of/i) ||
    msg.match(/column "(.+?)" does not exist/i)
  return match?.[1] || null
}

async function loadTenantById(id: string) {
  let cols = [...TENANT_COLUMNS_CANDIDATES]

  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase
      .from('tenants')
      .select(cols.join(','))
      .eq('id', id)
      .single()

    if (!error) return { data: (data || {}) as TenantExtended, availableCols: cols }

    const missing = missingColumnFromError(error)
    if (missing && cols.includes(missing)) {
      cols = cols.filter((c) => c !== missing)
      continue
    }

    throw error
  }

  throw new Error('No se pudo cargar el tenant: demasiadas incompatibilidades de esquema.')
}

async function loadPlansCatalog(): Promise<PlanOption[]> {
  let data: any[] | null = null
  let error: any = null

  ;({ data, error } = await supabase
    .from('subscription_plans')
    .select('code, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true }))

  if (error) {
    const missing = missingColumnFromError(error)
    if (missing !== 'is_active') throw error

    ;({ data, error } = await supabase
      .from('subscription_plans')
      .select('code, name')
      .order('name', { ascending: true }))
    if (error) throw error
  }

  return (data || [])
    .map((row: any) => ({
      code: String(row?.code || '').trim().toLowerCase(),
      name: row?.name ? String(row.name).trim() : null,
    }))
    .filter((row) => row.code)
}

function BiometricManager({ tenantId }: { tenantId: string }) {
  const [devices, setDevices] = useState<BiometricDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [newSerials, setNewSerials] = useState<NewSerial[]>([
    { localId: uid(), value: '', status: 'idle' },
  ])
  const [saving, setSaving] = useState(false)
  const lastInputRef = useRef<HTMLInputElement | null>(null)
  const debounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema('attendance')
        .from('biometric_devices')
        .select('id, serial_no, name, is_active, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setDevices((data || []) as BiometricDevice[])
    } catch {
      toast.error('No se pudieron cargar los biométricos')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  const checkSerial = useCallback(
    async (localId: string, value: string) => {
      const clean = value.trim()
      if (!clean) {
        setNewSerials((p) =>
          p.map((s) => (s.localId === localId ? { ...s, status: 'idle', message: undefined } : s))
        )
        return
      }

      setNewSerials((p) =>
        p.map((s) => (s.localId === localId ? { ...s, status: 'checking', message: undefined } : s))
      )

      try {
        const { data, error } = await supabase
          .schema('attendance')
          .from('biometric_devices')
          .select('serial_no, tenant_id')
          .eq('serial_no', clean)
          .limit(1)

        if (error) throw error

        if (data && data.length > 0) {
          const sameTenant = (data[0] as any).tenant_id === tenantId
          setNewSerials((p) =>
            p.map((s) =>
              s.localId === localId
                ? {
                    ...s,
                    status: 'duplicate',
                    message: sameTenant ? 'Ya registrado en esta empresa' : 'Registrado en otra empresa',
                  }
                : s
            )
          )
        } else {
          setNewSerials((p) =>
            p.map((s) => (s.localId === localId ? { ...s, status: 'ok', message: undefined } : s))
          )
        }
      } catch {
        setNewSerials((p) =>
          p.map((s) =>
            s.localId === localId
              ? { ...s, status: 'error', message: 'No se pudo verificar' }
              : s
          )
        )
      }
    },
    [tenantId]
  )

  const handleSerialChange = (localId: string, value: string) => {
    setNewSerials((p) => p.map((s) => (s.localId === localId ? { ...s, value, status: 'idle' } : s)))
    clearTimeout(debounce.current[localId])
    debounce.current[localId] = setTimeout(() => checkSerial(localId, value), 500)
  }

  const addRow = () => {
    setNewSerials((p) => [...p, { localId: uid(), value: '', status: 'idle' }])
    setTimeout(() => lastInputRef.current?.focus(), 60)
  }

  const removeRow = (localId: string) => {
    setNewSerials((p) => {
      const next = p.filter((s) => s.localId !== localId)
      return next.length > 0 ? next : [{ localId: uid(), value: '', status: 'idle' }]
    })
  }

  const saveNewSerials = async () => {
    const toSave = newSerials.filter((s) => s.value.trim() && s.status !== 'duplicate')
    if (!toSave.length) {
      toast.error('No hay seriales válidos para guardar')
      return
    }
    if (newSerials.some((s) => s.status === 'duplicate')) {
      toast.error('Corrige los seriales duplicados antes de guardar')
      return
    }
    if (newSerials.some((s) => s.status === 'checking')) {
      toast.error('Espera a que terminen las verificaciones')
      return
    }

    setSaving(true)
    try {
      const rows = toSave.map((s) => ({
        tenant_id: tenantId,
        serial_no: s.value.trim(),
        name: `Biométrico ${s.value.trim()}`,
        is_active: true,
      }))

      const { error } = await supabase
        .schema('attendance')
        .from('biometric_devices')
        .insert(rows)

      if (error) throw error

      toast.success(`${rows.length} biométrico${rows.length > 1 ? 's' : ''} agregado${rows.length > 1 ? 's' : ''}`)
      setNewSerials([{ localId: uid(), value: '', status: 'idle' }])
      await loadDevices()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (device: BiometricDevice) => {
    const { error } = await supabase
      .schema('attendance')
      .from('biometric_devices')
      .update({ is_active: !device.is_active })
      .eq('id', device.id)

    if (error) {
      toast.error('Error al actualizar')
      return
    }

    setDevices((p) => p.map((d) => (d.id === device.id ? { ...d, is_active: !d.is_active } : d)))
    toast.success(device.is_active ? 'Biométrico desactivado' : 'Biométrico activado')
  }

  const deleteDevice = async (device: BiometricDevice) => {
    if (!confirm(`¿Eliminar el biométrico ${device.serial_no}? Esta acción no se puede deshacer.`)) return

    const { error } = await supabase
      .schema('attendance')
      .from('biometric_devices')
      .delete()
      .eq('id', device.id)

    if (error) {
      toast.error('Error al eliminar')
      return
    }

    setDevices((p) => p.filter((d) => d.id !== device.id))
    toast.success('Biométrico eliminado')
  }

  const hasDuplicates = newSerials.some((s) => s.status === 'duplicate')
  const hasChecking = newSerials.some((s) => s.status === 'checking')
  const hasValid = newSerials.some((s) => s.value.trim() && s.status !== 'duplicate')

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-400 mb-2 font-body">
          Dispositivos registrados ({devices.length})
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-slate-600 font-body py-3">Sin biométricos registrados aún.</p>
        ) : (
          <div className="space-y-2">
            {devices.map((dev) => (
              <div
                key={dev.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-cosmos-850"
              >
                <span className="font-mono text-sm text-white flex-1">{dev.serial_no}</span>
                <span className="text-xs text-slate-500 font-body hidden sm:block flex-1">
                  {dev.name || '—'}
                </span>
                <span
                  className={`text-xs font-body px-2 py-0.5 rounded-full border ${
                    dev.is_active
                      ? 'bg-neon-green/10 border-neon-green/30 text-neon-green'
                      : 'bg-slate-700/30 border-white/10 text-slate-500'
                  }`}
                >
                  {dev.is_active ? 'Activo' : 'Inactivo'}
                </span>
                <button
                  onClick={() => toggleActive(dev)}
                  className="text-slate-500 hover:text-neon-cyan transition-colors"
                  title={dev.is_active ? 'Desactivar' : 'Activar'}
                >
                  {dev.is_active ? (
                    <ToggleRight className="w-5 h-5 text-neon-cyan" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => deleteDevice(dev)}
                  className="text-slate-600 hover:text-neon-red transition-colors"
                  title="Eliminar biométrico"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 pt-4">
        <p className="text-sm font-medium text-slate-400 mb-3 font-body">Agregar biométricos</p>

        <div className="space-y-2">
          {newSerials.map((s, idx) => {
            const isLast = idx === newSerials.length - 1
            return (
              <div key={s.localId}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-5 text-right shrink-0">{idx + 1}.</span>
                  <div className="relative flex-1">
                    <input
                      ref={isLast ? lastInputRef : undefined}
                      className={[
                        'input-cosmos font-mono text-sm pr-9',
                        s.status === 'duplicate' ? 'border-neon-red/50' : '',
                        s.status === 'ok' ? 'border-neon-green/40' : '',
                      ].join(' ')}
                      value={s.value}
                      placeholder={`Serial biométrico ${idx + 1}`}
                      onChange={(e) => handleSerialChange(s.localId, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addRow()
                        }
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {s.status === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                      {s.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-neon-green" />}
                      {s.status === 'duplicate' && <XCircle className="w-4 h-4 text-neon-red" />}
                    </span>
                  </div>
                  <button
                    onClick={() => removeRow(s.localId)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-neon-red hover:bg-neon-red/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {s.status === 'duplicate' && s.message && (
                  <p className="text-xs text-neon-red mt-1 ml-7 font-body">{s.message}</p>
                )}
                {s.status === 'ok' && (
                  <p className="text-xs text-neon-green mt-1 ml-7 font-body">Serial disponible</p>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-neon-cyan hover:opacity-75 transition-opacity font-body"
        >
          <Plus className="w-4 h-4" /> Agregar otro serial
        </button>

        {hasValid && (
          <div className="mt-4 flex justify-end">
            <NeonButton onClick={saveNewSerials} loading={saving} disabled={hasDuplicates || hasChecking}>
              <Save className="w-4 h-4" />
              {saving
                ? 'Guardando...'
                : `Guardar ${newSerials.filter((s) => s.value.trim() && s.status !== 'duplicate').length} serial${newSerials.filter((s) => s.value.trim()).length !== 1 ? 'es' : ''}`}
            </NeonButton>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TenantDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()

  const [tenant, setTenant] = useState<TenantExtended | null>(null)
  const [form, setForm] = useState<Partial<TenantExtended>>({})
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [availableCols, setAvailableCols] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'info' | 'biometrics' | 'invoices' | 'access'>('info')

  const canEditBillingPeriod = availableCols.includes('billing_period')
  const canEditAddress = availableCols.includes('address') || availableCols.includes('province') || availableCols.includes('city')
  const canEditCourtesy =
    availableCols.includes('courtesy_pct') ||
    availableCols.includes('courtesy_period') ||
    availableCols.includes('courtesy_times') ||
    availableCols.includes('courtesy_duration')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    try {
      const [tenantResult, invoiceResult, planResult] = await Promise.allSettled([
        loadTenantById(id),
        supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
        loadPlansCatalog(),
      ])

      if (tenantResult.status === 'fulfilled') {
        setTenant(tenantResult.value.data)
        setForm(tenantResult.value.data)
        setAvailableCols(tenantResult.value.availableCols)
      } else {
        throw tenantResult.reason
      }

      if (invoiceResult.status === 'fulfilled') {
        setInvoices(((invoiceResult.value.data as any) || []) as Invoice[])
      } else {
        setInvoices([])
      }

      if (planResult.status === 'fulfilled') {
        setPlans(planResult.value)
      } else {
        setPlans([])
      }
    } catch (e: any) {
      toast.error('Error al cargar empresa: ' + (e?.message || 'desconocido'))
      setTenant(null)
      setForm({})
      setAvailableCols([])
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const set =
    (k: keyof TenantExtended) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const setCheck =
    (k: keyof TenantExtended) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.checked }))

  const planValue = useMemo(() => getPlanValue(form), [form])

  const save = async () => {
    if (!id) return

    setSaving(true)
    try {
      const payload: Record<string, any> = {}
      const businessName = String(form.business_name || form.name || '').trim()
      const selectedPlan = String(form.plan_type || form.plan || '').trim().toLowerCase()

      if (availableCols.includes('business_name')) payload.business_name = businessName || null
      if (availableCols.includes('name')) payload.name = businessName || null
      if (availableCols.includes('plan_type')) payload.plan_type = selectedPlan || null
      if (availableCols.includes('plan')) payload.plan = selectedPlan || null
      if (availableCols.includes('notes')) payload.notes = String(form.notes || '').trim() || null
      if (availableCols.includes('legal_rep_name')) payload.legal_rep_name = String(form.legal_rep_name || '').trim() || null
      if (availableCols.includes('legal_rep_email')) payload.legal_rep_email = String(form.legal_rep_email || '').trim() || null
      if (availableCols.includes('legal_rep_phone')) payload.legal_rep_phone = String(form.legal_rep_phone || '').trim() || null
      if (availableCols.includes('contact_name')) payload.contact_name = String(form.contact_name || '').trim() || null
      if (availableCols.includes('contact_email')) payload.contact_email = String(form.contact_email || '').trim() || null
      if (availableCols.includes('contact_phone')) payload.contact_phone = String(form.contact_phone || '').trim() || null
      if (availableCols.includes('contact_mobile')) payload.contact_mobile = String(form.contact_mobile || '').trim() || null
      if (availableCols.includes('contact_phone_ext')) payload.contact_phone_ext = String(form.contact_phone_ext || '').trim() || null
      if (availableCols.includes('grace_days')) payload.grace_days = toNumberOrNull(form.grace_days, 0)
      if (availableCols.includes('pause_after_grace')) payload.pause_after_grace = !!form.pause_after_grace
      if (availableCols.includes('address')) payload.address = String(form.address || '').trim() || null
      if (availableCols.includes('province')) payload.province = String(form.province || '').trim() || null
      if (availableCols.includes('city')) payload.city = String(form.city || '').trim() || null
      if (availableCols.includes('billing_period')) payload.billing_period = String(form.billing_period || '').trim() || null
      if (availableCols.includes('courtesy_pct')) payload.courtesy_pct = toNumberOrNull(form.courtesy_pct, 0)
      if (availableCols.includes('courtesy_period')) payload.courtesy_period = String(form.courtesy_period || '').trim() || 'monthly'
      if (availableCols.includes('courtesy_times')) payload.courtesy_times = toNumberOrNull(form.courtesy_times, 1)
      if (availableCols.includes('courtesy_duration')) payload.courtesy_duration = String(form.courtesy_duration || '').trim() || 'one_time'
      if (availableCols.includes('bio_sold_by_us')) payload.bio_sold_by_us = !!form.bio_sold_by_us
      if (availableCols.includes('bio_purchase_date')) payload.bio_purchase_date = form.bio_purchase_date || null
      if (availableCols.includes('bio_warranty_months')) payload.bio_warranty_months = toNumberOrNull(form.bio_warranty_months, 0)
      if (availableCols.includes('updated_at')) payload.updated_at = new Date().toISOString()

      const { error } = await supabase.from('tenants').update(payload).eq('id', id)
      if (error) throw error

      toast.success('Cambios guardados')
      setEditing(false)
      await load()
    } catch (e: any) {
      toast.error('Error al guardar: ' + (e?.message || 'desconocido'))
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setForm(tenant || {})
    setEditing(false)
  }

  const togglePause = async () => {
    if (!id || !tenant) return
    const current = effectiveStatus(tenant)
    if (current === 'suspended') return
    const newStatus = current === 'active' ? 'paused' : 'active'
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus, is_suspended: false })
      .eq('id', id)

    if (error) {
      toast.error('Error: ' + error.message)
      return
    }

    setTenant((t) => (t ? { ...t, status: newStatus, is_suspended: false } : t))
    toast.success(current === 'active' ? 'Empresa pausada' : 'Empresa reactivada')
  }

  const toggleSuspend = async () => {
    if (!id || !tenant) return
    const suspended = effectiveStatus(tenant) === 'suspended'
    const newSuspended = !suspended
    const newStatus = newSuspended ? 'suspended' : 'active'

    const updatePayload: Record<string, any> = {
      status: newStatus,
      is_suspended: newSuspended,
    }
    if (availableCols.includes('suspension_date')) {
      updatePayload.suspension_date = newSuspended ? new Date().toISOString() : null
    }
    if (availableCols.includes('suspension_reason')) {
      updatePayload.suspension_reason = newSuspended
        ? 'Suspendido manualmente desde CEREBRO'
        : null
    }

    const { error } = await supabase.from('tenants').update(updatePayload).eq('id', id)

    if (error) {
      toast.error('Error: ' + error.message)
      return
    }

    setTenant((t) =>
      t
        ? {
            ...t,
            status: newStatus,
            is_suspended: newSuspended,
            suspension_date: updatePayload.suspension_date ?? t.suspension_date,
            suspension_reason: updatePayload.suspension_reason ?? t.suspension_reason,
          }
        : t
    )
    toast.success(suspended ? 'Suspensión levantada' : 'Empresa suspendida')
  }

  if (loading) return <FullPageLoader />

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-slate-400 font-body">Empresa no encontrada</p>
        <NeonButton variant="secondary" onClick={() => nav('/tenants')}>
          <ArrowLeft size={15} /> Volver
        </NeonButton>
      </div>
    )
  }

  const currentStatus = effectiveStatus(tenant)
  const suspended = currentStatus === 'suspended'
  const paused = currentStatus === 'paused'
  const label = getTenantLabel(tenant)
  const hasCourtesy = toNumberOrNull(form.courtesy_pct, 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={label}
        subtitle={`RUC: ${tenant.ruc || '—'}`}
        icon={<Building2 size={18} />}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge status={currentStatus} />
            {!editing ? (
              <NeonButton variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Editar
              </NeonButton>
            ) : (
              <>
                <NeonButton variant="secondary" size="sm" onClick={cancelEdit}>
                  <RotateCcw size={14} /> Cancelar
                </NeonButton>
                <NeonButton size="sm" onClick={save} loading={saving}>
                  <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                </NeonButton>
              </>
            )}
            <NeonButton variant="secondary" size="sm" onClick={() => nav('/tenants')}>
              <ArrowLeft size={14} /> Volver
            </NeonButton>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Saldo',
            value: `$${(tenant.current_balance || 0).toFixed(2)}`,
            icon: <DollarSign size={15} />,
            color: (tenant.current_balance || 0) > 0 ? 'text-neon-amber' : 'text-neon-green',
          },
          { label: 'Facturas', value: invoices.length, icon: <Receipt size={15} />, color: 'text-neon-blue' },
          {
            label: 'Vencidas',
            value: invoices.filter((i) => i.status === 'overdue').length,
            icon: <Calendar size={15} />,
            color: 'text-neon-red',
          },
          {
            label: 'Registro',
            value: format(new Date(tenant.created_at), 'dd MMM yy', { locale: es }),
            icon: <Info size={15} />,
            color: 'text-slate-400',
          },
        ].map((s) => (
          <GlassCard key={s.label} className="p-4 flex items-center gap-3">
            <span className={s.color + ' flex-shrink-0'}>{s.icon}</span>
            <div>
              <p className={`text-lg font-bold font-sans ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600 font-body">{s.label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl border border-white/5 bg-cosmos-850 font-body text-sm w-fit flex-wrap">
        {(['info', 'biometrics', 'invoices', 'access'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              tab === key
                ? 'bg-neon-blue/15 text-white border border-neon-blue/25'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {{ info: 'Datos', biometrics: 'Biométricos', invoices: 'Facturas', access: 'Acceso' }[key]}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-4">
          <SectionCard title="Datos de la Empresa" icon={<Building2 size={15} />} accent="blue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Razón Social"
                value={String(form.business_name || form.name || '')}
                onChange={set('business_name')}
                disabled={!editing}
              />
              <InputField label="RUC" value={tenant.ruc || ''} onChange={() => {}} disabled hint="No editable" />

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Plan</label>
                {plans.length > 0 ? (
                  <select className="input-cosmos" value={planValue} onChange={set('plan_type')} disabled={!editing}>
                    <option value="">Seleccione</option>
                    {plans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.name ? `${plan.name} (${plan.code})` : plan.code}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="input-cosmos" value={planValue} onChange={set('plan_type')} disabled={!editing} />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Período facturación</label>
                {canEditBillingPeriod ? (
                  <select className="input-cosmos" value={String(form.billing_period || 'monthly')} onChange={set('billing_period')} disabled={!editing}>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                    <option value="semiannual">Semestral</option>
                  </select>
                ) : (
                  <input className="input-cosmos" value={String(form.billing_period || tenant.billing_period || 'monthly')} disabled readOnly />
                )}
              </div>
            </div>
          </SectionCard>

          {canEditAddress && (
            <SectionCard title="Ubicación" icon={<MapPin size={15} />} accent="violet">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField label="Provincia" value={String(form.province || '')} onChange={set('province')} disabled={!editing} placeholder="Pichincha" />
                <InputField label="Ciudad" value={String(form.city || '')} onChange={set('city')} disabled={!editing} placeholder="Quito" />
                <div className="md:col-span-3">
                  <InputField label="Dirección" value={String(form.address || '')} onChange={set('address')} disabled={!editing} placeholder="Av. Principal 123" />
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Representante Legal" icon={<User size={15} />} accent="cyan">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="Nombre" value={String(form.legal_rep_name || '')} onChange={set('legal_rep_name')} disabled={!editing} />
              <InputField label="Email" value={String(form.legal_rep_email || '')} onChange={set('legal_rep_email')} disabled={!editing} type="email" />
              <InputField label="Teléfono" value={String(form.legal_rep_phone || '')} onChange={set('legal_rep_phone')} disabled={!editing} type="tel" placeholder="+593 99 000 0000" />
            </div>
          </SectionCard>

          <SectionCard title="Contacto Principal" icon={<Phone size={15} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Nombre" value={String(form.contact_name || '')} onChange={set('contact_name')} disabled={!editing} />
              <InputField label="Email" value={String(form.contact_email || '')} onChange={set('contact_email')} disabled={!editing} type="email" />
              <InputField label="Teléfono convencional" value={String(form.contact_phone || '')} onChange={set('contact_phone')} disabled={!editing} type="tel" />
              <InputField label="Celular" value={String(form.contact_mobile || '')} onChange={set('contact_mobile')} disabled={!editing} type="tel" />
              <InputField label="Extensión" value={String(form.contact_phone_ext || '')} onChange={set('contact_phone_ext')} disabled={!editing} placeholder="ext. 101" />
            </div>
          </SectionCard>

          <SectionCard title="Suspensión Automática" icon={<Clock size={15} />} accent="amber">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Días de gracia</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  className="input-cosmos"
                  value={String(form.grace_days ?? 0)}
                  onChange={set('grace_days')}
                  disabled={!editing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Acción al vencer</label>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    disabled={!editing}
                    onClick={() => setForm((f) => ({ ...f, pause_after_grace: true }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-body border transition-all ${(form.pause_after_grace ?? true)
                      ? 'bg-neon-amber/15 border-neon-amber/40 text-neon-amber'
                      : 'bg-white/2 border-white/10 text-slate-500'} disabled:opacity-60`}
                  >
                    Pausar
                  </button>
                  <button
                    type="button"
                    disabled={!editing}
                    onClick={() => setForm((f) => ({ ...f, pause_after_grace: false }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-body border transition-all ${!(form.pause_after_grace ?? true)
                      ? 'bg-neon-red/15 border-neon-red/40 text-neon-red'
                      : 'bg-white/2 border-white/10 text-slate-500'} disabled:opacity-60`}
                  >
                    Suspender
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          {canEditCourtesy && (
            <SectionCard title="Cortesía Comercial" icon={<Percent size={15} />} accent="cyan">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Descuento %</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="input-cosmos pr-10"
                      value={String(form.courtesy_pct ?? 0)}
                      onChange={set('courtesy_pct')}
                      disabled={!editing}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">N° de veces</label>
                  <input
                    type="number"
                    min="1"
                    className="input-cosmos"
                    value={String(form.courtesy_times ?? 1)}
                    onChange={set('courtesy_times')}
                    disabled={!editing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Período</label>
                  <select className="input-cosmos" value={String(form.courtesy_period || 'monthly')} onChange={set('courtesy_period')} disabled={!editing}>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Duración</label>
                  <select className="input-cosmos" value={String(form.courtesy_duration || 'one_time')} onChange={set('courtesy_duration')} disabled={!editing}>
                    <option value="one_time">Una sola vez</option>
                    <option value="recurring">Recurrente</option>
                    <option value="contract">Todo el contrato</option>
                  </select>
                </div>
                {hasCourtesy && (
                  <div className="md:col-span-2 p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20">
                    <p className="text-xs text-neon-cyan font-body">
                      ✓ <strong>{form.courtesy_pct}%</strong> de descuento —{' '}
                      <strong>{form.courtesy_times} {toNumberOrNull(form.courtesy_times, 1) === 1 ? 'vez' : 'veces'}</strong>{' '}
                      con período{' '}
                      <strong>{{ monthly: 'mensual', quarterly: 'trimestral', semiannual: 'semestral', annual: 'anual' }[String(form.courtesy_period || 'monthly') as 'monthly' | 'quarterly' | 'semiannual' | 'annual']}</strong>{' '}
                      —{' '}
                      <strong>{{ one_time: 'una sola vez', recurring: 'recurrente', contract: 'todo el contrato' }[String(form.courtesy_duration || 'one_time') as 'one_time' | 'recurring' | 'contract']}</strong>
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Notas internas" icon={<Info size={15} />}>
            <textarea
              value={String(form.notes || '')}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="input-cosmos resize-none"
              placeholder="Observaciones internas..."
              disabled={!editing}
            />
          </SectionCard>

          {tenant.admin_email && (
            <SectionCard title="Administrador de la Empresa" icon={<Mail size={15} />} accent="violet">
              <InputField label="Email admin" value={tenant.admin_email} onChange={() => {}} disabled />
              <p className="text-xs text-slate-600 mt-2 font-body">Para cambiar credenciales usa la función de reset de contraseña.</p>
            </SectionCard>
          )}
        </div>
      )}

      {tab === 'biometrics' && id && (
        <SectionCard title="Gestión de Biométricos" icon={<Cpu size={15} />} accent="cyan">
          <BiometricManager tenantId={id} />
        </SectionCard>
      )}

      {tab === 'invoices' && (
        <SectionCard title="Historial de Facturas" icon={<Receipt size={15} />}>
          {invoices.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8 font-body">Sin facturas registradas</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3 px-1 border-b border-white/4 last:border-0">
                  <div>
                    <p className="text-sm font-body text-white">{(inv as any).invoice_number || inv.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-600 font-body">
                      {(inv as any).billing_period_start
                        ? format(new Date((inv as any).billing_period_start), 'MMM yyyy', { locale: es })
                        : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-neon-cyan">${(inv.total || 0).toFixed(2)}</p>
                    <Badge status={inv.status || 'draft'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'access' && (
        <SectionCard title="Control de Acceso" icon={<Shield size={15} />} accent="violet">
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-white/5 bg-cosmos-850">
              <p className="text-sm text-slate-300 font-body mb-2">Estado actual</p>
              <Badge status={currentStatus} />
              {suspended && tenant.suspension_reason && (
                <p className="text-xs text-neon-red mt-2 font-body">{tenant.suspension_reason}</p>
              )}
              {suspended && tenant.suspension_date && (
                <p className="text-xs text-slate-600 mt-1 font-body">
                  Desde: {format(new Date(tenant.suspension_date), 'dd/MM/yyyy HH:mm')}
                </p>
              )}
            </div>

            <NeonButton variant={paused ? 'primary' : 'secondary'} onClick={togglePause} disabled={suspended} className="w-full">
              {paused ? (
                <>
                  <Play size={15} /> Reactivar empresa
                </>
              ) : (
                <>
                  <Pause size={15} /> Pausar empresa
                </>
              )}
            </NeonButton>

            {suspended && (
              <p className="text-xs text-slate-600 font-body text-center">
                Levanta la suspensión antes de poder pausar/reactivar
              </p>
            )}

            <NeonButton variant={suspended ? 'primary' : 'danger'} onClick={toggleSuspend} className="w-full">
              {suspended ? (
                <>
                  <CheckCircle2 size={15} /> Levantar suspensión
                </>
              ) : (
                <>
                  <XCircle size={15} /> Suspender empresa
                </>
              )}
            </NeonButton>

            <p className="text-xs text-slate-600 font-body mt-2">
              <b className="text-slate-500">Pausar:</b> empleados ven mensaje configurado en Settings.
              <br />
              <b className="text-slate-500">Suspender:</b> bloqueo total de acceso a Base PWA.
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
