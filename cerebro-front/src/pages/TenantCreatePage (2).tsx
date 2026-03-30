/**
 * TenantCreatePage.tsx
 * CEREBRO v4.12.1
 * Ajustes aplicados:
 *  - Invocación nativa de admin-create-tenant con Authorization + apikey explícitos.
 *  - Token leído primero desde localStorage(cerebro_auth), con fallback a getSession().
 *  - Carga robusta de planes desde public.subscription_plans con fallback si no existe is_active.
 *  - Mantiene status en payload.
 *  - Mejor manejo de errores HTTP/JSON/texto.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  KeyRound,
  Mail,
  Save,
  ShieldCheck,
  User,
  Phone,
  FileText,
  Cpu,
  Eye,
  EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, logAuditEvent } from '../config/supabase'
import { validateRUC } from '../utils/validators'

type BillingPeriod = 'weekly' | 'biweekly' | 'monthly' | 'semiannual'
type TenantStatus = 'active' | 'trial' | 'paused'
type CourtesyDuration = 'one_time' | 'periods' | 'contract'

type PlanOption = {
  code: string
  name?: string | null
}

type TenantDraft = {
  business_name: string
  ruc: string
  admin_email: string
  temp_password: string
  plan_type: string
  status: TenantStatus
  contact_name: string
  contact_email: string
  contact_phone: string
  legal_rep_name: string
  legal_rep_email: string
  notes: string
  serial_numbers_text: string
  bio_location: string
  billing_period: BillingPeriod
  grace_days: number
  auto_suspend: boolean
  pause_after_grace: boolean
  courtesy_discount_pct: number
  courtesy_duration: CourtesyDuration
  courtesy_periods: number
}

const periodLabel = (p: BillingPeriod) =>
  ({
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
    semiannual: 'Semestral',
  } as const)[p]

const normalizeEmail = (value: string) => value.trim().toLowerCase()
const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeEmail(value))

const parseSerialNumbers = (value: string) => {
  const items = value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set(items))
}

function getAccessTokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem('cerebro_auth')
    if (raw) {
      const parsed = JSON.parse(raw)
      const token = parsed?.access_token
      if (typeof token === 'string' && token.trim()) return token.trim()
    }
  } catch {
    // no-op
  }
  return null
}

async function getAccessToken(): Promise<string | null> {
  const fromStorage = getAccessTokenFromStorage()
  if (fromStorage) return fromStorage

  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (typeof token === 'string' && token.trim()) return token.trim()
  } catch {
    // no-op
  }

  return null
}

async function invokeAdminCreateTenant(body: Record<string, unknown>) {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  const token = await getAccessToken()

  if (!supabaseUrl || !anonKey) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.')
  }
  if (!token) {
    throw new Error('No se encontró sesión válida de CEREBRO. Cierra sesión y vuelve a ingresar.')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-create-tenant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => '')

  if (!response.ok) {
    const message =
      (typeof payload === 'object' && payload
        ? (payload as any)?.error_description ||
          (payload as any)?.error ||
          (payload as any)?.message ||
          (payload as any)?.details ||
          (payload as any)?.msg
        : null) ||
      (typeof payload === 'string' ? payload : null) ||
      `Edge Function retornó ${response.status}`

    throw new Error(String(message).trim())
  }

  return payload
}

export default function TenantCreatePage() {
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [showPassword, setShowPassword] = useState(false)

  const [draft, setDraft] = useState<TenantDraft>({
    business_name: '',
    ruc: '',
    admin_email: '',
    temp_password: '',
    plan_type: '',
    status: 'active',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    legal_rep_name: '',
    legal_rep_email: '',
    notes: '',
    serial_numbers_text: '',
    bio_location: '',
    billing_period: 'monthly',
    grace_days: 5,
    auto_suspend: true,
    pause_after_grace: true,
    courtesy_discount_pct: 0,
    courtesy_duration: 'one_time',
    courtesy_periods: 1,
  })

  useEffect(() => {
    let active = true

    const loadPlans = async () => {
      setLoadingPlans(true)
      setPlansError(null)

      try {
        let data: any[] | null = null
        let error: any = null

        ;({ data, error } = await supabase
          .from('subscription_plans')
          .select('code, name, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }))

        if (error) {
          const msg = String(error?.message || error?.details || '')
          const missingIsActive =
            msg.includes('is_active') ||
            msg.toLowerCase().includes('column') ||
            msg.toLowerCase().includes('does not exist')

          if (!missingIsActive) throw error

          ;({ data, error } = await supabase
            .from('subscription_plans')
            .select('code, name')
            .order('name', { ascending: true }))
          if (error) throw error
        }

        const mapped = (data || [])
          .map((row: any) => ({
            code: String(row?.code || '').trim().toLowerCase(),
            name: row?.name ? String(row.name).trim() : null,
          }))
          .filter((row) => row.code)

        if (!active) return

        if (!mapped.length) {
          setPlans([])
          setPlansError('No existen planes disponibles en public.subscription_plans.')
          setDraft((prev) => ({ ...prev, plan_type: '' }))
          return
        }

        setPlans(mapped)
        setDraft((prev) => {
          const normalizedCurrent = String(prev.plan_type || '').trim().toLowerCase()
          const exists = mapped.some((p) => p.code === normalizedCurrent)
          return exists
            ? { ...prev, plan_type: normalizedCurrent }
            : { ...prev, plan_type: mapped[0].code }
        })
      } catch (e) {
        console.error('No se pudieron cargar los planes desde public.subscription_plans:', e)
        if (!active) return
        setPlans([])
        setPlansError('No se pudieron cargar los planes activos.')
        setDraft((prev) => ({ ...prev, plan_type: '' }))
      } finally {
        if (active) setLoadingPlans(false)
      }
    }

    loadPlans()
    return () => {
      active = false
    }
  }, [])

  const serialNumbers = useMemo(
    () => parseSerialNumbers(draft.serial_numbers_text),
    [draft.serial_numbers_text]
  )

  const validation = useMemo(() => {
    const issues: string[] = []

    if (!draft.business_name.trim()) issues.push('Nombre de empresa requerido')

    const cleanRuc = draft.ruc.replace(/\D/g, '')
    const r = validateRUC(cleanRuc)
    if (!r.valid) issues.push(r.error || 'RUC inválido')

    if (!draft.admin_email.trim()) issues.push('Email admin requerido')
    else if (!isValidEmail(draft.admin_email)) issues.push('Email admin inválido')

    if (draft.contact_email.trim() && !isValidEmail(draft.contact_email)) {
      issues.push('Email de contacto inválido')
    }

    if (draft.legal_rep_email.trim() && !isValidEmail(draft.legal_rep_email)) {
      issues.push('Email del representante legal inválido')
    }

    if (!draft.temp_password.trim()) issues.push('Password temporal requerida')
    else if (draft.temp_password.trim().length < 8) {
      issues.push('La password temporal debe tener al menos 8 caracteres')
    }

    if (loadingPlans) issues.push('Cargando catálogo de planes...')
    if (plansError) issues.push(plansError)

    const selectedPlan = String(draft.plan_type || '').trim().toLowerCase()
    if (!selectedPlan) {
      issues.push('Plan requerido')
    } else if (plans.length && !plans.some((p) => p.code === selectedPlan)) {
      issues.push('El plan seleccionado no existe en subscription_plans')
    }

    if (draft.grace_days < 0 || draft.grace_days > 365) issues.push('Tolerancia (días) inválida')
    if (draft.courtesy_discount_pct < 0 || draft.courtesy_discount_pct > 100) {
      issues.push('% descuento inválido')
    }
    if (
      draft.courtesy_duration === 'periods' &&
      (draft.courtesy_periods < 1 || draft.courtesy_periods > 120)
    ) {
      issues.push('Periodos de cortesía inválidos')
    }

    return issues
  }, [draft, loadingPlans, plans, plansError])

  const setField = (patch: Partial<TenantDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }))

  const submit = async () => {
    if (validation.length) {
      toast.error(validation[0])
      return
    }

    const selectedPlan = String(draft.plan_type || '').trim().toLowerCase()
    if (!plans.some((p) => p.code === selectedPlan)) {
      toast.error('El plan seleccionado no existe en subscription_plans')
      return
    }

    setSaving(true)
    try {
      const payload = {
        business_name: draft.business_name.trim(),
        ruc: draft.ruc.replace(/\D/g, ''),
        admin_email: normalizeEmail(draft.admin_email),
        temp_password: draft.temp_password.trim(),
        plan_type: selectedPlan,
        status: draft.status,
        contact_name: draft.contact_name.trim() || null,
        contact_email: draft.contact_email.trim()
          ? normalizeEmail(draft.contact_email)
          : normalizeEmail(draft.admin_email),
        contact_phone: draft.contact_phone.trim() || null,
        legal_rep_name: draft.legal_rep_name.trim() || null,
        legal_rep_email: draft.legal_rep_email.trim()
          ? normalizeEmail(draft.legal_rep_email)
          : null,
        notes: draft.notes.trim() || null,
        serial_numbers: serialNumbers,
        bio_location: draft.bio_location.trim() || null,
        billing_period: draft.billing_period,
        grace_days: Number(draft.grace_days || 0),
        auto_suspend: Boolean(draft.auto_suspend),
        pause_after_grace: Boolean(draft.pause_after_grace),
        courtesy_discount_pct: Number(draft.courtesy_discount_pct || 0),
        courtesy_duration: draft.courtesy_duration,
        courtesy_periods: Number(draft.courtesy_periods || 1),
      }

      const data = await invokeAdminCreateTenant(payload)

      await logAuditEvent('TENANT_CREATED', {
        tenant_id: (data as any)?.tenant_id ?? null,
        ruc: payload.ruc,
        business_name: payload.business_name,
        admin_email: payload.admin_email,
        plan_type: payload.plan_type,
      })

      toast.success(
        'Cliente creado correctamente. El administrador deberá cambiar su contraseña en el primer ingreso a Base.'
      )
      navigate('/tenants')
    } catch (e) {
      console.error('Error inesperado al crear tenant:', e)
      const message =
        e instanceof Error && e.message ? e.message : 'No se pudo crear el cliente.'
      toast.error(message)
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
          <p className="text-sm text-slate-400 mt-2">
            Crea la empresa y el administrador usando la Edge Function{' '}
            <code className="mx-1">admin-create-tenant</code>. Los planes se cargan desde{' '}
            <code className="mx-1">public.subscription_plans</code>.
          </p>
        </div>
        <button
          disabled={saving || loadingPlans || !!plansError}
          onClick={submit}
          className="btn-primary inline-flex items-center gap-2"
        >
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
                <label className="label">Razón social / nombre de la empresa</label>
                <input
                  className="input"
                  value={draft.business_name}
                  onChange={(e) => setField({ business_name: e.target.value })}
                  placeholder="Banco / Empresa / Inquilino"
                />
              </div>

              <div>
                <label className="label">RUC (Ecuador)</label>
                <input
                  className="input"
                  value={draft.ruc}
                  onChange={(e) => setField({ ruc: e.target.value })}
                  placeholder="13 dígitos"
                  inputMode="numeric"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Validación automática de RUC y dígito verificador.
                </p>
              </div>

              <div>
                <label className="label">Plan</label>
                <select
                  className="input"
                  value={draft.plan_type}
                  onChange={(e) => setField({ plan_type: e.target.value })}
                  disabled={loadingPlans || !!plansError || !plans.length}
                >
                  {loadingPlans && <option value="">Cargando planes...</option>}
                  {!loadingPlans && !plans.length && (
                    <option value="">No hay planes disponibles</option>
                  )}
                  {!loadingPlans &&
                    plans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.name ? `${plan.name} (${plan.code})` : plan.code}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Cargados desde <code>public.subscription_plans</code>.
                </p>
              </div>

              <div>
                <label className="label">Estado inicial</label>
                <select
                  className="input"
                  value={draft.status}
                  onChange={(e) => setField({ status: e.target.value as TenantStatus })}
                >
                  <option value="active">Activo</option>
                  <option value="trial">Trial</option>
                  <option value="paused">Pausado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-[var(--brand-primary)]" />
              <h2 className="font-semibold">Administrador de la empresa</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Correo del administrador</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="input pl-10"
                    value={draft.admin_email}
                    onChange={(e) => setField({ admin_email: e.target.value })}
                    placeholder="admin@empresa.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="label">Clave temporal</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="input pl-10 pr-10"
                    type={showPassword ? 'text' : 'password'}
                    value={draft.temp_password}
                    onChange={(e) => setField({ temp_password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Esta clave solo se usa para el primer acceso. Base obligará el cambio de
                  contraseña.
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-[var(--brand-primary)]" />
              <h2 className="font-semibold">Contacto y representante legal</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre de contacto</label>
                <input
                  className="input"
                  value={draft.contact_name}
                  onChange={(e) => setField({ contact_name: e.target.value })}
                  placeholder="Persona de contacto"
                />
              </div>

              <div>
                <label className="label">Correo de contacto</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="input pl-10"
                    value={draft.contact_email}
                    onChange={(e) => setField({ contact_email: e.target.value })}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>

              <div>
                <label className="label">Teléfono de contacto</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="input pl-10"
                    value={draft.contact_phone}
                    onChange={(e) => setField({ contact_phone: e.target.value })}
                    placeholder="0999999999"
                  />
                </div>
              </div>

              <div>
                <label className="label">Representante legal</label>
                <input
                  className="input"
                  value={draft.legal_rep_name}
                  onChange={(e) => setField({ legal_rep_name: e.target.value })}
                  placeholder="Nombre del representante legal"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Correo del representante legal</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="input pl-10"
                    value={draft.legal_rep_email}
                    onChange={(e) => setField({ legal_rep_email: e.target.value })}
                    placeholder="legal@empresa.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-[var(--brand-primary)]" />
              <h2 className="font-semibold">Biométricos y política comercial</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Seriales de biométricos</label>
                <textarea
                  className="input min-h-[110px]"
                  value={draft.serial_numbers_text}
                  onChange={(e) => setField({ serial_numbers_text: e.target.value })}
                  placeholder="Uno por línea, o separados por coma/;"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Se registrarán en attendance.biometric_devices. Detectados:{' '}
                  {serialNumbers.length}
                </p>
              </div>

              <div>
                <label className="label">Ubicación biométrico</label>
                <input
                  className="input"
                  value={draft.bio_location}
                  onChange={(e) => setField({ bio_location: e.target.value })}
                  placeholder="Matriz / Sucursal / Recepción"
                />
              </div>

              <div>
                <label className="label">Periodo de cobro</label>
                <select
                  className="input"
                  value={draft.billing_period}
                  onChange={(e) =>
                    setField({ billing_period: e.target.value as BillingPeriod })
                  }
                >
                  <option value="weekly">{periodLabel('weekly')}</option>
                  <option value="biweekly">{periodLabel('biweekly')}</option>
                  <option value="monthly">{periodLabel('monthly')}</option>
                  <option value="semiannual">{periodLabel('semiannual')}</option>
                </select>
              </div>

              <div>
                <label className="label">Días de tolerancia</label>
                <input
                  className="input"
                  type="number"
                  value={draft.grace_days}
                  onChange={(e) => setField({ grace_days: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="label">% descuento cortesía</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.courtesy_discount_pct}
                  onChange={(e) =>
                    setField({ courtesy_discount_pct: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="label">Duración cortesía</label>
                <select
                  className="input"
                  value={draft.courtesy_duration}
                  onChange={(e) =>
                    setField({ courtesy_duration: e.target.value as CourtesyDuration })
                  }
                >
                  <option value="one_time">Una vez</option>
                  <option value="periods">Por períodos</option>
                  <option value="contract">Todo el contrato</option>
                </select>
              </div>

              {draft.courtesy_duration === 'periods' && (
                <div>
                  <label className="label">Períodos de cortesía</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={120}
                    value={draft.courtesy_periods}
                    onChange={(e) =>
                      setField({ courtesy_periods: Number(e.target.value) })
                    }
                  />
                </div>
              )}

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={draft.auto_suspend}
                    onChange={(e) => setField({ auto_suspend: e.target.checked })}
                  />
                  Activar autopausa por mora
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={draft.pause_after_grace}
                    onChange={(e) => setField({ pause_after_grace: e.target.checked })}
                  />
                  Pausar al finalizar la tolerancia
                </label>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[var(--brand-primary)]" />
              <h2 className="font-semibold">Observaciones</h2>
            </div>
            <textarea
              className="input min-h-[140px]"
              value={draft.notes}
              onChange={(e) => setField({ notes: e.target.value })}
              placeholder="Notas internas o detalles comerciales"
            />
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-3">Resumen</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div>
                <span className="text-slate-400">Empresa:</span> {draft.business_name || '—'}
              </div>
              <div>
                <span className="text-slate-400">RUC:</span> {draft.ruc || '—'}
              </div>
              <div>
                <span className="text-slate-400">Plan:</span> {draft.plan_type || '—'}
              </div>
              <div>
                <span className="text-slate-400">Admin:</span> {draft.admin_email || '—'}
              </div>
              <div>
                <span className="text-slate-400">Biométricos:</span> {serialNumbers.length}
              </div>
            </div>
          </div>

          {validation.length > 0 && (
            <div className="card p-6 border border-amber-500/40">
              <h3 className="font-semibold text-amber-300 mb-3">Validaciones pendientes</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                {validation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
