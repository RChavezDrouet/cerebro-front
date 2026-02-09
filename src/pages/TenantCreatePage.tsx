/**
 * ==============================================
 * CEREBRO SaaS - Crear Inquilino
 * ==============================================
 * Requisitos (completar y mejorar.pdf):
 * - Validación RUC (13 dígitos + dígito verificador)
 * - Periodo de cobro (semanal/quincenal/mensual/semestre)
 * - Cortesía (usuarios + % descuento + duración)
 * - Tolerancia (grace_days) y pausa automática
 * - Enviar credenciales al correo de contacto (Edge Function recomendada)
 */

import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, KeyRound, Mail, Save, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, logAuditEvent } from '../config/supabase'
import { validateRUC } from '../utils/validators'

type BillingPeriod = 'weekly' | 'biweekly' | 'monthly' | 'semiannual'

type TenantDraft = {
  name: string
  ruc: string
  contact_email: string
  plan: string
  status: 'active' | 'trial' | 'paused'
  bio_serial: string
  bio_location: string
  billing_period: BillingPeriod
  grace_days: number
  pause_after_grace: boolean
  courtesy_users: number
  courtesy_discount_pct: number
  courtesy_duration: 'one_time' | 'periods' | 'contract'
  courtesy_periods: number
}

const periodLabel = (p: BillingPeriod) =>
  ({ weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual', semiannual: 'Semestral' } as const)[p]

export default function TenantCreatePage() {
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<TenantDraft>({
    name: '',
    ruc: '',
    contact_email: '',
    plan: 'basic',
    status: 'active',
    bio_serial: '',
    bio_location: '',
    billing_period: 'monthly',
    grace_days: 5,
    pause_after_grace: true,
    courtesy_users: 0,
    courtesy_discount_pct: 0,
    courtesy_duration: 'one_time',
    courtesy_periods: 1,
  })

  const validation = useMemo(() => {
    const issues: string[] = []
    if (!draft.name.trim()) issues.push('Nombre de empresa requerido')
    if (!draft.contact_email.trim()) issues.push('Email de contacto requerido')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.contact_email.trim())) issues.push('Email de contacto inválido')

    const r = validateRUC(draft.ruc)
    if (!r.valid) issues.push(r.error || 'RUC inválido')

    if (!draft.plan.trim()) issues.push('Plan requerido')
    if (draft.grace_days < 0 || draft.grace_days > 365) issues.push('Tolerancia (días) inválida')
    if (draft.courtesy_users < 0) issues.push('Cortesía (usuarios) inválida')
    if (draft.courtesy_discount_pct < 0 || draft.courtesy_discount_pct > 100) issues.push('% descuento inválido')
    if (draft.courtesy_duration === 'periods' && (draft.courtesy_periods < 1 || draft.courtesy_periods > 120)) issues.push('Periodos de cortesía inválidos')

    return issues
  }, [draft])

  const set = (patch: Partial<TenantDraft>) => setDraft((p) => ({ ...p, ...patch }))

  const submit = async () => {
    if (validation.length) return toast.error(validation[0])

    setSaving(true)
    try {
      // 1) Recomendado: Edge Function (service role) para:
      // - insertar tenant
      // - crear usuario auth del contacto
      // - enviar credenciales por SMTP
      
      // CORRECCIÓN: Enviamos el objeto "plano" (sin envolver en 'tenant') para evitar errores 400 en el backend
      const payload = {
        name: draft.name.trim(),
        ruc: draft.ruc.replace(/\D/g, ''),
        contact_email: draft.contact_email.trim(),
        plan: draft.plan.trim(),
        status: draft.status,
        bio_serial: draft.bio_serial.trim() || null,
        bio_location: draft.bio_location.trim() || null,
        billing_period: draft.billing_period,
        grace_days: Number(draft.grace_days || 0),
        pause_after_grace: Boolean(draft.pause_after_grace),
        courtesy_users: Number(draft.courtesy_users || 0),
        courtesy_discount_pct: Number(draft.courtesy_discount_pct || 0),
        courtesy_duration: draft.courtesy_duration,
        courtesy_periods: Number(draft.courtesy_periods || 1),
      }

      const { data, error } = await supabase.functions.invoke('admin-create-tenant', {
        body: payload,
      })

      if (error) {
        console.error("Error en Edge Function, intentando fallback directo:", error)
        
        // Fallback: insertar solo tenant (sin crear usuario ni email)
        // Usamos exactamente los mismos datos del payload
        const { data: inserted, error: e2 } = await supabase
          .from('tenants')
          .insert(payload)
          .select('*')
          .maybeSingle()

        if (e2) {
          console.error("Error en Fallback SQL:", e2)
          toast.error('No se pudo crear el cliente. Revisa consola para detalles (RLS/Columnas).')
          return
        }

        await logAuditEvent('TENANT_CREATED_FALLBACK', { tenant_id: inserted?.id, ruc: inserted?.ruc })
        toast('Cliente creado, pero falta enviar credenciales (Edge Function falló).', { icon: '⚠️' })
        navigate('/tenants')
        return
      }

      await logAuditEvent('TENANT_CREATED', { tenant_id: data?.tenant_id, ruc: draft.ruc })
      toast.success('Cliente creado. Credenciales enviadas al contacto.')
      navigate('/tenants')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/tenants" className="btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver
            </Link>
            <h1 className="text-2xl font-bold">Nuevo cliente (Inquilino)</h1>
          </div>
          <p className="text-sm text-slate-400 mt-2">Crea la empresa inquilino y envía credenciales al correo de contacto.</p>
        </div>
        <button disabled={saving} onClick={submit} className="btn-primary inline-flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-[var(--brand-primary)]" />
              <h2 className="font-semibold">Datos del cliente</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre de la empresa</label>
                <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Banco / Empresa / Inquilino" />
              </div>

              <div>
                <label className="label">RUC (Ecuador)</label>
                <input className="input" value={draft.ruc} onChange={(e) => set({ ruc: e.target.value })} placeholder="13 dígitos" inputMode="numeric" />
                <p className="text-xs text-slate-400 mt-1">Validación automática (dígito verificador).</p>
              </div>

              <div>
                <label className="label">Email de contacto (Admin inquilino)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input className="input pl-10" value={draft.contact_email} onChange={(e) => set({ contact_email: e.target.value })} placeholder="admin@cliente.com" />
                </div>
              </div>

              <div>
                <label className="label">Plan</label>
                <input className="input" value={draft.plan} onChange={(e) => set({ plan: e.target.value })} placeholder="basic / pro / enterprise" />
              </div>

              <div>
                <label className="label">Estado</label>
                <select className="input" value={draft.status} onChange={(e) => set({ status: e.target.value as any })}>
                  <option value="active">Activo</option>
                  <option value="trial">Trial</option>
                  <option value="paused">Pausado</option>
                </select>
              </div>

              <div>
                <label className="label">Periodo de cobro</label>
                <select className="input" value={draft.billing_period} onChange={(e) => set({ billing_period: e.target.value as BillingPeriod })}>
                  <option value="weekly">{periodLabel('weekly')}</option>
                  <option value="biweekly">{periodLabel('biweekly')}</option>
                  <option value="monthly">{periodLabel('monthly')}</option>
                  <option value="semiannual">{periodLabel('semiannual')}</option>
                </select>
              </div>

              <div>
                <label className="label">Biometría - Serial</label>
                <input className="input" value={draft.bio_serial} onChange={(e) => set({ bio_serial: e.target.value })} placeholder="SN-XXXX" />
              </div>

              <div>
                <label className="label">Biometría - Ubicación</label>
                <input className="input" value={draft.bio_location} onChange={(e) => set({ bio_location: e.target.value })} placeholder="Sede / Ciudad" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-[var(--brand-accent)]" />
              <h2 className="font-semibold">Tolerancia y cortesía</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Días de tolerancia (grace)</label>
                <input className="input" type="number" value={draft.grace_days} onChange={(e) => set({ grace_days: Number(e.target.value || 0) })} min={0} max={365} />
                <p className="text-xs text-slate-400 mt-1">Si no paga luego de estos días, puede pausarse automáticamente.</p>
              </div>

              <div className="flex items-center gap-3 pt-7">
                <input id="pause" type="checkbox" checked={draft.pause_after_grace} onChange={(e) => set({ pause_after_grace: e.target.checked })} />
                <label htmlFor="pause" className="text-sm text-slate-200">Pausar automáticamente si excede tolerancia</label>
              </div>

              <div>
                <label className="label">Cortesía: # usuarios con descuento</label>
                <input className="input" type="number" value={draft.courtesy_users} onChange={(e) => set({ courtesy_users: Number(e.target.value || 0) })} min={0} />
              </div>

              <div>
                <label className="label">Cortesía: % descuento</label>
                <input className="input" type="number" value={draft.courtesy_discount_pct} onChange={(e) => set({ courtesy_discount_pct: Number(e.target.value || 0) })} min={0} max={100} />
              </div>

              <div>
                <label className="label">Duración de cortesía</label>
                <select className="input" value={draft.courtesy_duration} onChange={(e) => set({ courtesy_duration: e.target.value as any })}>
                  <option value="one_time">Una única vez</option>
                  <option value="periods">Por # periodos</option>
                  <option value="contract">Por duración de contrato</option>
                </select>
              </div>

              <div>
                <label className="label"># periodos (si aplica)</label>
                <input
                  className="input"
                  type="number"
                  value={draft.courtesy_periods}
                  onChange={(e) => set({ courtesy_periods: Number(e.target.value || 1) })}
                  min={1}
                  disabled={draft.courtesy_duration !== 'periods'}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-5 h-5 text-[var(--brand-secondary)]" />
              <h2 className="font-semibold">Credenciales</h2>
            </div>
            <p className="text-sm text-slate-300">
              Al guardar, el sistema intentará crear un usuario para el correo de contacto y enviarle una clave temporal.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Implementación recomendada: Edge Function <code>admin-create-tenant</code> (service role) + SMTP global.
            </p>
            {validation.length ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {validation[0]}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                Listo para guardar.
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold">Buenas prácticas (ISO/IEC 25000 + OWASP)</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc list-inside">
              <li>Validación fuerte (RUC, email) del lado del cliente y servidor.</li>
              <li>No exponer Service Role key en el Front: use Edge Functions.</li>
              <li>Audit trail: registrar creación y cambios críticos.</li>
              <li>RLS: admin/assistant; separar permisos por roles.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
