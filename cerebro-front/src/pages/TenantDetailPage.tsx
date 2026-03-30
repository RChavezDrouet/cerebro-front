// src/pages/TenantDetailPage.tsx  ·  CEREBRO v4.11.0
// Cambios v4.11:
//  - Sección Biométricos: gestión completa de attendance.biometric_devices
//    · Lista los seriales del tenant con estado activo/inactivo
//    · Agregar nuevos seriales con validación de duplicados en tiempo real
//    · Activar / desactivar dispositivos existentes
//    · Eliminar dispositivos (con confirmación)
//  - Resto del comportamiento sin cambios

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import {
  Building2, Save, ArrowLeft, Pause, Play, XCircle, CheckCircle2,
  Receipt, Calendar, DollarSign, Info, Shield, Cpu, Phone, Mail,
  MapPin, User, Clock, Percent, Plus, Trash2, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import {
  GlassCard, SectionCard, Badge, NeonButton, InputField, FullPageLoader, PageHeader
} from '@/components/ui'
import type { Tenant, Invoice } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Tipos ────────────────────────────────────────────────────────────────────

type SerialStatus = 'idle' | 'checking' | 'ok' | 'duplicate' | 'error'

interface BiometricDevice {
  id: string
  serial_no: string
  name: string | null
  is_active: boolean
  location_alias: string | null
  created_at: string
}

interface NewSerial {
  localId: string
  value: string
  status: SerialStatus
  message?: string
}

interface TenantExtended extends Tenant {
  address?:             string
  province?:            string
  city?:                string
  legal_rep_phone?:     string
  contact_mobile?:      string
  contact_phone_ext?:   string
  bio_sold_by_us?:      boolean
  bio_purchase_date?:   string
  bio_warranty_months?: number
  grace_days?:          number
  pause_after_grace?:   boolean
  courtesy_pct?:        number
  courtesy_period?:     string
  courtesy_times?:      number
  courtesy_duration?:   string
  admin_email?:         string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function effectiveStatus(t: Tenant | null): string {
  if (!t) return 'active'
  if (t.is_suspended === true) return 'suspended'
  return t.status ?? 'active'
}

const uid = () => Math.random().toString(36).slice(2, 10)

// ── Componente de gestión de biométricos ─────────────────────────────────────

function BiometricManager({ tenantId }: { tenantId: string }) {
  const [devices,   setDevices]   = useState<BiometricDevice[]>([])
  const [loading,   setLoading]   = useState(true)
  const [newSerials, setNewSerials] = useState<NewSerial[]>([
    { localId: uid(), value: '', status: 'idle' }
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
        .select('id, serial_no, name, is_active, location_alias, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setDevices((data || []) as BiometricDevice[])
    } catch (e: any) {
      toast.error('No se pudieron cargar los biométricos')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { loadDevices() }, [loadDevices])

  // ── Validación de serial ────────────────────────────────────────────────
  const checkSerial = useCallback(async (localId: string, value: string) => {
    const clean = value.trim()
    if (!clean) {
      setNewSerials(p => p.map(s => s.localId === localId ? { ...s, status: 'idle', message: undefined } : s))
      return
    }
    setNewSerials(p => p.map(s => s.localId === localId ? { ...s, status: 'checking', message: undefined } : s))
    try {
      const { data } = await supabase
        .schema('attendance')
        .from('biometric_devices')
        .select('serial_no, tenant_id')
        .eq('serial_no', clean)
        .limit(1)

      if (data && data.length > 0) {
        const isSameTenant = (data[0] as any).tenant_id === tenantId
        const msg = isSameTenant ? 'Ya registrado en esta empresa' : 'Registrado en otra empresa'
        setNewSerials(p => p.map(s => s.localId === localId ? { ...s, status: 'duplicate', message: msg } : s))
      } else {
        setNewSerials(p => p.map(s => s.localId === localId ? { ...s, status: 'ok', message: undefined } : s))
      }
    } catch {
      setNewSerials(p => p.map(s => s.localId === localId ? { ...s, status: 'error', message: 'No se pudo verificar' } : s))
    }
  }, [tenantId])

  const handleSerialChange = (localId: string, value: string) => {
    setNewSerials(p => p.map(s => s.localId === localId ? { ...s, value, status: 'idle' } : s))
    clearTimeout(debounce.current[localId])
    debounce.current[localId] = setTimeout(() => checkSerial(localId, value), 500)
  }

  const addRow = () => {
    setNewSerials(p => [...p, { localId: uid(), value: '', status: 'idle' }])
    setTimeout(() => lastInputRef.current?.focus(), 60)
  }

  const removeRow = (localId: string) => {
    setNewSerials(p => {
      const next = p.filter(s => s.localId !== localId)
      return next.length > 0 ? next : [{ localId: uid(), value: '', status: 'idle' }]
    })
  }

  // ── Guardar nuevos seriales ─────────────────────────────────────────────
  const saveNewSerials = async () => {
    const toSave = newSerials.filter(s => s.value.trim() && s.status !== 'duplicate')
    if (!toSave.length) { toast.error('No hay seriales válidos para guardar'); return }
    if (newSerials.some(s => s.status === 'duplicate')) {
      toast.error('Corrige los seriales duplicados antes de guardar'); return
    }
    if (newSerials.some(s => s.status === 'checking')) {
      toast.error('Espera a que terminen las verificaciones'); return
    }
    setSaving(true)
    try {
      const rows = toSave.map(s => ({
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

  // ── Activar / desactivar ────────────────────────────────────────────────
  const toggleActive = async (device: BiometricDevice) => {
    const { error } = await supabase
      .schema('attendance')
      .from('biometric_devices')
      .update({ is_active: !device.is_active })
      .eq('id', device.id)
    if (error) { toast.error('Error al actualizar'); return }
    setDevices(p => p.map(d => d.id === device.id ? { ...d, is_active: !d.is_active } : d))
    toast.success(device.is_active ? 'Biométrico desactivado' : 'Biométrico activado')
  }

  // ── Eliminar ────────────────────────────────────────────────────────────
  const deleteDevice = async (device: BiometricDevice) => {
    if (!confirm(`¿Eliminar el biométrico ${device.serial_no}? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase
      .schema('attendance')
      .from('biometric_devices')
      .delete()
      .eq('id', device.id)
    if (error) { toast.error('Error al eliminar'); return }
    setDevices(p => p.filter(d => d.id !== device.id))
    toast.success('Biométrico eliminado')
  }

  const hasDuplicates = newSerials.some(s => s.status === 'duplicate')
  const hasChecking   = newSerials.some(s => s.status === 'checking')
  const hasValid      = newSerials.some(s => s.value.trim() && s.status !== 'duplicate')

  return (
    <div className="space-y-4">

      {/* Lista de dispositivos registrados */}
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
            {devices.map(dev => (
              <div key={dev.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-cosmos-850">
                {/* Serial */}
                <span className="font-mono text-sm text-white flex-1">{dev.serial_no}</span>

                {/* Nombre / alias */}
                <span className="text-xs text-slate-500 font-body hidden sm:block flex-1">
                  {dev.name || '—'}
                  {dev.location_alias ? ` · ${dev.location_alias}` : ''}
                </span>

                {/* Estado */}
                <span className={`text-xs font-body px-2 py-0.5 rounded-full border ${
                  dev.is_active
                    ? 'bg-neon-green/10 border-neon-green/30 text-neon-green'
                    : 'bg-slate-700/30 border-white/10 text-slate-500'
                }`}>
                  {dev.is_active ? 'Activo' : 'Inactivo'}
                </span>

                {/* Toggle activo */}
                <button
                  onClick={() => toggleActive(dev)}
                  className="text-slate-500 hover:text-neon-cyan transition-colors"
                  title={dev.is_active ? 'Desactivar' : 'Activar'}
                >
                  {dev.is_active
                    ? <ToggleRight className="w-5 h-5 text-neon-cyan" />
                    : <ToggleLeft  className="w-5 h-5" />
                  }
                </button>

                {/* Eliminar */}
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

      {/* Agregar nuevos seriales */}
      <div className="border-t border-white/5 pt-4">
        <p className="text-sm font-medium text-slate-400 mb-3 font-body">
          Agregar biométricos
        </p>

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
                        s.status === 'ok'        ? 'border-neon-green/40' : '',
                      ].join(' ')}
                      value={s.value}
                      placeholder={`Serial biométrico ${idx + 1}`}
                      onChange={e => handleSerialChange(s.localId, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRow() } }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {s.status === 'checking'  && <Loader2     className="w-4 h-4 animate-spin text-slate-400" />}
                      {s.status === 'ok'        && <CheckCircle2 className="w-4 h-4 text-neon-green" />}
                      {s.status === 'duplicate' && <XCircle      className="w-4 h-4 text-neon-red" />}
                    </span>
                  </div>
                  <button onClick={() => removeRow(s.localId)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-neon-red hover:bg-neon-red/10 transition-colors">
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

        <button onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-neon-cyan hover:opacity-75 transition-opacity font-body">
          <Plus className="w-4 h-4" /> Agregar otro serial
        </button>

        {hasValid && (
          <div className="mt-4 flex justify-end">
            <NeonButton
              onClick={saveNewSerials}
              loading={saving}
              disabled={hasDuplicates || hasChecking}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : `Guardar ${newSerials.filter(s => s.value.trim() && s.status !== 'duplicate').length} serial${newSerials.filter(s => s.value.trim()).length !== 1 ? 'es' : ''}`}
            </NeonButton>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { id }  = useParams()
  const nav     = useNavigate()
  const [tenant,   setTenant]   = useState<TenantExtended | null>(null)
  const [form,     setForm]     = useState<Partial<TenantExtended>>({})
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [tab,      setTab]      = useState<'info' | 'biometrics' | 'invoices' | 'access'>('info')

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('tenants').select('*').eq('id', id).single(),
      supabase.from('invoices').select('*').eq('tenant_id', id)
        .order('created_at', { ascending: false }).limit(20),
    ]).then(([{ data: t, error: tErr }, { data: inv }]) => {
      if (tErr) toast.error('Error al cargar empresa: ' + tErr.message)
      if (t) { setTenant(t as any); setForm(t as any) }
      setInvoices((inv as any) || [])
      setLoading(false)
    })
  }, [id])

  const set = (k: keyof TenantExtended) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const setCheck = (k: keyof TenantExtended) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.checked }))

  const save = async () => {
    if (!id) return
    setSaving(true)
    const { error } = await supabase.from('tenants').update({
      business_name:       form.business_name,
      name:                form.business_name,
      plan_type:           form.plan_type,
      plan:                form.plan_type,
      notes:               form.notes,
      address:             form.address,
      province:            form.province,
      city:                form.city,
      legal_rep_name:      form.legal_rep_name,
      legal_rep_email:     form.legal_rep_email,
      legal_rep_phone:     form.legal_rep_phone,
      contact_name:        form.contact_name,
      contact_email:       form.contact_email,
      contact_phone:       form.contact_phone,
      contact_mobile:      form.contact_mobile,
      contact_phone_ext:   form.contact_phone_ext,
      grace_days:          form.grace_days       ?? 0,
      pause_after_grace:   form.pause_after_grace ?? true,
      courtesy_pct:        form.courtesy_pct      ?? 0,
      courtesy_period:     form.courtesy_period   || 'monthly',
      courtesy_times:      form.courtesy_times    ?? 1,
      courtesy_duration:   form.courtesy_duration || 'one_time',
      bio_sold_by_us:      form.bio_sold_by_us    ?? false,
      bio_purchase_date:   form.bio_purchase_date  || null,
      bio_warranty_months: form.bio_warranty_months || null,
      updated_at:          new Date().toISOString(),
    }).eq('id', id)

    if (error) toast.error('Error al guardar: ' + error.message)
    else { toast.success('Cambios guardados'); setTenant(t => t ? { ...t, ...form } : t) }
    setSaving(false)
  }

  const togglePause = async () => {
    if (!id || !tenant) return
    const current  = effectiveStatus(tenant)
    if (current === 'suspended') return
    const newStatus = current === 'active' ? 'paused' : 'active'
    const { error } = await supabase.from('tenants')
      .update({ status: newStatus, is_suspended: false }).eq('id', id)
    if (error) { toast.error('Error: ' + error.message); return }
    setTenant(t => t ? { ...t, status: newStatus, is_suspended: false } : t)
    toast.success(current === 'active' ? 'Empresa pausada' : 'Empresa reactivada')
  }

  const toggleSuspend = async () => {
    if (!id || !tenant) return
    const suspended    = effectiveStatus(tenant) === 'suspended'
    const newSuspended = !suspended
    const newStatus    = newSuspended ? 'suspended' : 'active'
    const { error } = await supabase.from('tenants').update({
      status:            newStatus,
      is_suspended:      newSuspended,
      suspension_date:   newSuspended ? new Date().toISOString() : null,
      suspension_reason: newSuspended ? 'Suspendido manualmente desde CEREBRO' : null,
    }).eq('id', id)
    if (error) { toast.error('Error: ' + error.message); return }
    setTenant(t => t ? { ...t, status: newStatus, is_suspended: newSuspended } : t)
    toast.success(suspended ? 'Suspensión levantada' : 'Empresa suspendida')
  }

  if (loading) return <FullPageLoader />
  if (!tenant) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-slate-400 font-body">Empresa no encontrada</p>
      <NeonButton variant="secondary" onClick={() => nav('/tenants')}>
        <ArrowLeft size={15} /> Volver
      </NeonButton>
    </div>
  )

  const currentStatus = effectiveStatus(tenant)
  const suspended     = currentStatus === 'suspended'
  const paused        = currentStatus === 'paused'
  const label         = tenant.business_name || tenant.name || '—'
  const hasCourtesy   = (form.courtesy_pct ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={label}
        subtitle={`RUC: ${tenant.ruc || '—'}`}
        icon={<Building2 size={18} />}
        actions={
          <div className="flex items-center gap-2">
            <Badge status={currentStatus} />
            <NeonButton variant="secondary" size="sm" onClick={() => nav('/tenants')}>
              <ArrowLeft size={14} /> Volver
            </NeonButton>
          </div>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Saldo',    value: `$${(tenant.current_balance || 0).toFixed(2)}`, icon: <DollarSign size={15} />, color: (tenant.current_balance || 0) > 0 ? 'text-neon-amber' : 'text-neon-green' },
          { label: 'Facturas', value: invoices.length, icon: <Receipt size={15} />, color: 'text-neon-blue' },
          { label: 'Vencidas', value: invoices.filter(i => i.status === 'overdue').length, icon: <Calendar size={15} />, color: 'text-neon-red' },
          { label: 'Registro', value: format(new Date(tenant.created_at), 'dd MMM yy', { locale: es }), icon: <Info size={15} />, color: 'text-slate-400' },
        ].map(s => (
          <GlassCard key={s.label} className="p-4 flex items-center gap-3">
            <span className={s.color + ' flex-shrink-0'}>{s.icon}</span>
            <div>
              <p className={`text-lg font-bold font-sans ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600 font-body">{s.label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Tabs — ahora incluye Biométricos */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-white/5 bg-cosmos-850 font-body text-sm w-fit flex-wrap">
        {(['info', 'biometrics', 'invoices', 'access'] as const).map(key => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg transition-all ${tab === key ? 'bg-neon-blue/15 text-white border border-neon-blue/25' : 'text-slate-500 hover:text-slate-300'}`}>
            {{ info: 'Datos', biometrics: 'Biométricos', invoices: 'Facturas', access: 'Acceso' }[key]}
          </button>
        ))}
      </div>

      {/* ══ Tab: Info ══════════════════════════════════════════════════════ */}
      {tab === 'info' && (
        <div className="space-y-4">
          <SectionCard title="Datos de la Empresa" icon={<Building2 size={15} />} accent="blue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Razón Social" value={form.business_name || form.name || ''} onChange={set('business_name')} />
              <InputField label="RUC" value={tenant.ruc || ''} onChange={() => {}} disabled hint="No editable" />
              <InputField label="Plan" value={form.plan_type || form.plan || ''} onChange={set('plan_type')} />
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Período facturación</label>
                <input className="input-cosmos" value={tenant.billing_period || 'monthly'} disabled readOnly />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Ubicación" icon={<MapPin size={15} />} accent="violet">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="Provincia" value={form.province || ''} onChange={set('province')} placeholder="Pichincha" />
              <InputField label="Ciudad"    value={form.city     || ''} onChange={set('city')}     placeholder="Quito" />
              <div className="md:col-span-3">
                <InputField label="Dirección" value={form.address || ''} onChange={set('address')} placeholder="Av. Principal 123" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Representante Legal" icon={<User size={15} />} accent="cyan">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="Nombre"   value={form.legal_rep_name  || ''} onChange={set('legal_rep_name')} />
              <InputField label="Email"    value={form.legal_rep_email || ''} onChange={set('legal_rep_email')} type="email" />
              <InputField label="Teléfono" value={form.legal_rep_phone || ''} onChange={set('legal_rep_phone')} type="tel" placeholder="+593 99 000 0000" />
            </div>
          </SectionCard>

          <SectionCard title="Contacto Principal" icon={<Phone size={15} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Nombre"               value={form.contact_name      || ''} onChange={set('contact_name')} />
              <InputField label="Email"                value={form.contact_email     || ''} onChange={set('contact_email')} type="email" />
              <InputField label="Teléfono convencional" value={form.contact_phone   || ''} onChange={set('contact_phone')} type="tel" />
              <InputField label="Celular"              value={form.contact_mobile    || ''} onChange={set('contact_mobile')} type="tel" />
              <InputField label="Extensión"            value={form.contact_phone_ext || ''} onChange={set('contact_phone_ext')} placeholder="ext. 101" />
            </div>
          </SectionCard>

          <SectionCard title="Suspensión Automática" icon={<Clock size={15} />} accent="amber">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Días de gracia</label>
                <input type="number" min="0" max="90" className="input-cosmos"
                  value={form.grace_days ?? 0} onChange={set('grace_days')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Acción al vencer</label>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, pause_after_grace: true }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-body border transition-all ${(form.pause_after_grace ?? true) ? 'bg-neon-amber/15 border-neon-amber/40 text-neon-amber' : 'bg-white/2 border-white/10 text-slate-500'}`}>
                    Pausar
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, pause_after_grace: false }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-body border transition-all ${!(form.pause_after_grace ?? true) ? 'bg-neon-red/15 border-neon-red/40 text-neon-red' : 'bg-white/2 border-white/10 text-slate-500'}`}>
                    Suspender
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Cortesía Comercial" icon={<Percent size={15} />} accent="cyan">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Descuento %</label>
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.01" className="input-cosmos pr-10"
                    value={form.courtesy_pct ?? 0} onChange={set('courtesy_pct')} />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">N° de veces</label>
                <input type="number" min="1" className="input-cosmos"
                  value={form.courtesy_times ?? 1} onChange={set('courtesy_times')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Período</label>
                <select className="input-cosmos" value={form.courtesy_period || 'monthly'} onChange={set('courtesy_period')}>
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semiannual">Semestral</option>
                  <option value="annual">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">Duración</label>
                <select className="input-cosmos" value={form.courtesy_duration || 'one_time'} onChange={set('courtesy_duration')}>
                  <option value="one_time">Una sola vez</option>
                  <option value="recurring">Recurrente</option>
                  <option value="contract">Todo el contrato</option>
                </select>
              </div>
              {hasCourtesy && (
                <div className="md:col-span-2 p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20">
                  <p className="text-xs text-neon-cyan font-body">
                    ✓ <strong>{form.courtesy_pct}%</strong> de descuento —{' '}
                    <strong>{form.courtesy_times} {form.courtesy_times === 1 ? 'vez' : 'veces'}</strong>{' '}
                    con período <strong>{{ monthly:'mensual', quarterly:'trimestral', semiannual:'semestral', annual:'anual' }[form.courtesy_period || 'monthly']}</strong>{' '}
                    — <strong>{{ one_time:'una sola vez', recurring:'recurrente', contract:'todo el contrato' }[form.courtesy_duration || 'one_time']}</strong>
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Notas internas" icon={<Info size={15} />}>
            <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className="input-cosmos resize-none" placeholder="Observaciones internas..." />
          </SectionCard>

          {tenant.admin_email && (
            <SectionCard title="Administrador de la Empresa" icon={<Mail size={15} />} accent="violet">
              <InputField label="Email admin" value={tenant.admin_email} onChange={() => {}} disabled />
              <p className="text-xs text-slate-600 mt-2 font-body">Para cambiar credenciales usa la función de reset de contraseña.</p>
            </SectionCard>
          )}

          <div className="flex justify-end pt-2">
            <NeonButton onClick={save} loading={saving}>
              <Save size={15} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </NeonButton>
          </div>
        </div>
      )}

      {/* ══ Tab: Biométricos ═══════════════════════════════════════════════ */}
      {tab === 'biometrics' && id && (
        <SectionCard title="Gestión de Biométricos" icon={<Cpu size={15} />} accent="cyan">
          <BiometricManager tenantId={id} />
        </SectionCard>
      )}

      {/* ══ Tab: Facturas ══════════════════════════════════════════════════ */}
      {tab === 'invoices' && (
        <SectionCard title="Historial de Facturas" icon={<Receipt size={15} />}>
          {invoices.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8 font-body">Sin facturas registradas</p>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-3 px-1 border-b border-white/4 last:border-0">
                  <div>
                    <p className="text-sm font-body text-white">{(inv as any).invoice_number || inv.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-600 font-body">
                      {(inv as any).billing_period_start
                        ? format(new Date((inv as any).billing_period_start), 'MMM yyyy')
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

      {/* ══ Tab: Acceso ════════════════════════════════════════════════════ */}
      {tab === 'access' && (
        <SectionCard title="Control de Acceso" icon={<Shield size={15} />} accent="violet">
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-white/5 bg-cosmos-850">
              <p className="text-sm text-slate-300 font-body mb-2">Estado actual</p>
              <Badge status={currentStatus} />
              {suspended && (tenant as any).suspension_reason && (
                <p className="text-xs text-neon-red mt-2 font-body">{(tenant as any).suspension_reason}</p>
              )}
              {suspended && (tenant as any).suspension_date && (
                <p className="text-xs text-slate-600 mt-1 font-body">
                  Desde: {format(new Date((tenant as any).suspension_date), 'dd/MM/yyyy HH:mm')}
                </p>
              )}
            </div>

            <NeonButton variant={paused ? 'primary' : 'secondary'} onClick={togglePause}
              disabled={suspended} className="w-full">
              {paused ? <><Play size={15} /> Reactivar empresa</> : <><Pause size={15} /> Pausar empresa</>}
            </NeonButton>
            {suspended && (
              <p className="text-xs text-slate-600 font-body text-center">
                Levanta la suspensión antes de poder pausar/reactivar
              </p>
            )}

            <NeonButton variant={suspended ? 'primary' : 'danger'} onClick={toggleSuspend} className="w-full">
              {suspended ? <><CheckCircle2 size={15} /> Levantar suspensión</> : <><XCircle size={15} /> Suspender empresa</>}
            </NeonButton>

            <p className="text-xs text-slate-600 font-body mt-2">
              <b className="text-slate-500">Pausar:</b> empleados ven mensaje configurado en Settings.<br />
              <b className="text-slate-500">Suspender:</b> bloqueo total de acceso a Base PWA.
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  )
}


