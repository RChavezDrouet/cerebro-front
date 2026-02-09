/**
 * ==============================================
 * HRCloud - CEREBRO | Configuración
 * ==============================================
 * Secciones implementadas (según PDF "completar y mejorar"):
 * - Brand (empresa/RUC/logo/paleta neón parametrizable + mensaje login)
 * - SMTP (Vault/Secrets vía Edge Function, y tabla smtp_settings)
 * - Facturación (billing_settings + footer de factura editable)
 * - KPI Targets (tabla kpi_targets editable)
 * - Seguridad (security_settings)
 * - Roles/Permisos (role_permissions.permissions jsonb)
 * - Planes (plans)
 * - Usuarios (user_roles + Edge Function admin-create-user)
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Palette,
  Mail,
  CreditCard,
  BarChart3,
  Shield,
  Users,
  FileText,
  MessageSquare,
  UserPlus,
  Save,
  Upload,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../App'
import { supabase } from '../config/supabase'
import { applyBranding } from '../theme/appTheme'
import { getSingletonRow, upsertSingletonRow } from '../services/singleton'
import { formatSupabaseError } from '../utils/supabaseErrors'
import { validateRUC } from '../utils/validators'

type SectionKey =
  | 'brand'
  | 'smtp'
  | 'billing'
  | 'kpi'
  | 'security'
  | 'roles'
  | 'plans'
  | 'users'
  | 'messages'

const SECTIONS: Array<{ key: SectionKey; label: string; icon: any }> = [
  { key: 'brand', label: 'Brand', icon: Palette },
  { key: 'users', label: 'Usuarios', icon: UserPlus },
  { key: 'roles', label: 'Roles / Permisos', icon: Users },
  { key: 'smtp', label: 'Correo SMTP', icon: Mail },
  { key: 'billing', label: 'Facturación', icon: CreditCard },
  { key: 'kpi', label: 'KPI Targets', icon: BarChart3 },
  { key: 'security', label: 'Seguridad', icon: Shield },
  { key: 'plans', label: 'Planes', icon: FileText },
  { key: 'messages', label: 'Mensajes', icon: MessageSquare },
]

const ROLES = ['admin', 'assistant', 'maintenance'] as const
type RoleKey = (typeof ROLES)[number]

const PERMISSIONS_CATALOG = [
  { key: 'clients.view', label: 'Ver clientes' },
  { key: 'clients.create', label: 'Crear clientes' },
  { key: 'clients.edit', label: 'Editar clientes' },
  { key: 'clients.delete', label: 'Eliminar clientes' },
  { key: 'clients.pause_manual', label: 'Pausar/Activar clientes (manual)' },

  { key: 'invoices.view', label: 'Ver facturación' },
  { key: 'invoices.create', label: 'Crear facturas' },
  { key: 'invoices.edit', label: 'Editar facturas' },
  { key: 'invoices.delete', label: 'Eliminar facturas' },

  { key: 'payments.create', label: 'Registrar pagos' },
  { key: 'collections.manage', label: 'Gestión de cobranzas' },

  { key: 'settings.view', label: 'Ver configuración' },
  { key: 'settings.edit', label: 'Editar configuración' },
  { key: 'settings.roles_permissions.edit', label: 'Editar Roles/Permisos' },
  { key: 'settings.paused_message.edit', label: 'Editar mensaje de pausa (Base)' },
  { key: 'users.create', label: 'Crear usuarios' },
  { key: 'messages.send', label: 'Enviar mensajes (broadcast)' },
  { key: 'plans.edit', label: 'Editar planes' },

  { key: 'audit.view', label: 'Ver auditoría' },
] as const

type PermissionsMatrix = Record<RoleKey, Record<string, boolean>>

const defaultPerms = (): PermissionsMatrix => ({
  admin: Object.fromEntries(PERMISSIONS_CATALOG.map((p) => [p.key, true])),
  assistant: Object.fromEntries(
    PERMISSIONS_CATALOG.map((p) => [
      p.key,
      ['clients.view', 'clients.create', 'clients.edit', 'invoices.view', 'invoices.create', 'payments.create', 'collections.manage'].includes(p.key),
    ]),
  ),
  maintenance: Object.fromEntries(
    PERMISSIONS_CATALOG.map((p) => [p.key, ['clients.view', 'invoices.view', 'settings.view', 'audit.view'].includes(p.key)]),
  ),
})

const safeHex = (v: string) => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v.trim())

async function uploadBrandLogo(file: File) {
  // Bucket recomendado: brand (public)
  const ext = file.name.split('.').pop() || 'png'
  const path = `logo.${ext}`
  const { error } = await supabase.storage.from('brand').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || undefined,
  })
  if (error) throw error
  const { data } = supabase.storage.from('brand').getPublicUrl(path)
  return data.publicUrl
}

const normalizeStorageUrl = (url?: string | null) => {
  if (!url) return ''
  const s = String(url)

  // Older builds stored download URLs (non-public) that break in <img src=...>
  // Expected for a public bucket: /storage/v1/object/public/<bucket>/<path>
  if (s.includes('/storage/v1/object/') && !s.includes('/storage/v1/object/public/') && !s.includes('/storage/v1/object/sign/')) {
    return s.replace('/storage/v1/object/', '/storage/v1/object/public/')
  }
  return s
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const active = (params.get('tab') as SectionKey) || 'brand'

  const { can } = useAuth()
  const canSettingsEdit = can('settings.edit')
  const canEditRoles = can('settings.roles_permissions.edit') || can('settings.edit')
  const canEditPausedMessage = can('settings.paused_message.edit') || can('settings.edit')
  const canCreateUsers = can('users.create') || can('settings.edit')
  const canSendBroadcast = can('messages.send') || can('settings.edit')
  const canEditPlans = can('plans.edit') || can('settings.edit')

  // Brand
  const [brand, setBrand] = useState<any>({
    company_name: 'HRCloud • Cerebro',
    company_ruc: '',
    company_logo: '',
    primary_color: '#00e673',
    secondary_color: '#00b3ff',
    accent_color: '#7c3aed',
    login_message_title: 'Sistema inteligente de gestión',
    login_message_body: 'Cerebro es parte de HRCloud. Administra clientes, facturación y cobranzas con seguridad.',
    paused_message_title: 'Servicio pausado',
    paused_message_body: 'Tu empresa está temporalmente pausada por falta de pago. Contacta al administrador para reactivar el servicio.',
  })
  const [brandSaving, setBrandSaving] = useState(false)

  // SMTP
  const [smtp, setSmtp] = useState<any>({
    host: '',
    port: 587,
    username: '',
    from_email: '',
    from_name: '',
    secure: true,
    has_secret: false,
  })
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpSaving, setSmtpSaving] = useState(false)

  const [smtpTestEmail, setSmtpTestEmail] = useState('')
  const [smtpTesting, setSmtpTesting] = useState(false)

  // Billing
  const [billing, setBilling] = useState<any>({
    currency: 'USD',
    invoice_footer: '',
    tax_percent: 0,
  })
  const [billingSaving, setBillingSaving] = useState(false)

  // KPI targets
  const [kpi, setKpi] = useState<any>({
    expected_revenue_monthly: 0,
    expected_new_clients_monthly: 0,
    green_change_pct: 0,
    yellow_change_pct: -5,
  })
  const [kpiSaving, setKpiSaving] = useState(false)

  // Security
  const [security, setSecurity] = useState<any>({
    password_level: 'medium',
    min_length: 10,
    require_upper: true,
    require_number: true,
    require_special: true,
    rotation_days_default: 90,
    rotation_enabled: false,
  })
  const [securitySaving, setSecuritySaving] = useState(false)

  // Roles
  const [perms, setPerms] = useState<PermissionsMatrix>(defaultPerms())
  const [permsSavingKey, setPermsSavingKey] = useState<string | null>(null)

  // Plans
  const [plans, setPlans] = useState<any[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [planForm, setPlanForm] = useState<any>({
    code: '',
    name: '',
    description: '',
    billing_model: 'flat',
    price_model: 'fixed',
    price: 0,
    unit_price: 0,
  })

  // Users
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userCreate, setUserCreate] = useState<any>({
    email: '',
    full_name: '',
    role: 'assistant',
    temp_password: '',
    rotation_days: 90,
    force_password_change: true,
  })
  const [userCreating, setUserCreating] = useState(false)

  // Messages (admin broadcast)
  const [messageDraft, setMessageDraft] = useState<any>({
    title: '',
    body: '',
    priority: 'normal',
    target_roles: ['assistant'],
  })
  const [messageSending, setMessageSending] = useState(false)

  const setTab = (t: SectionKey) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }

  const refreshAll = async () => {
    // Brand (siempre)
    const b = await getSingletonRow('app_settings')
    if (b) {
      const merged: any = {
        ...brand,
        ...b,
      }
      // Compatibilidad (si tu tabla antigua usaba otros nombres)
      if (!merged.company_ruc && (b as any).ruc) merged.company_ruc = (b as any).ruc
      if (!merged.company_logo && (b as any).logo_url) merged.company_logo = (b as any).logo_url
      merged.company_logo = normalizeStorageUrl(merged.company_logo)
      setBrand(merged)
      applyBranding(merged)
    }

    // Roles
    const rp = await supabase.from('role_permissions').select('*')
    if (!rp.error && Array.isArray(rp.data) && rp.data.length) {
      const next: PermissionsMatrix = defaultPerms()
      for (const row of rp.data as any[]) {
        const role = row.role as RoleKey
        if (!ROLES.includes(role)) continue
        if (row.permissions && typeof row.permissions === 'object') {
          next[role] = { ...next[role], ...row.permissions }
        }
      }
      setPerms(next)
    }

    // Plans
    await loadPlans()

    // Users
    await loadUsers()
  }

  const loadTabSingleton = async (tab: SectionKey) => {
    // Carga bajo demanda para evitar spam de errores cuando las tablas no están migradas.
    if (tab === 'smtp') {
      const s = await getSingletonRow('smtp_settings')
      if (s) setSmtp((prev: any) => ({ ...prev, ...s }))
    }
    if (tab === 'billing') {
      const bl = await getSingletonRow('billing_settings')
      if (bl) setBilling((prev: any) => ({ ...prev, ...bl }))
    }
    if (tab === 'kpi') {
      const k = await getSingletonRow('kpi_targets')
      if (k) setKpi((prev: any) => ({ ...prev, ...k }))
    }
    if (tab === 'security') {
      const sec = await getSingletonRow('security_settings')
      if (sec) setSecurity((prev: any) => ({ ...prev, ...sec }))
    }
  }

  const loadPlans = async () => {
    setPlansLoading(true)
    try {
      const { data, error } = await supabase.from('plans').select('*').order('created_at', { ascending: false })
      if (error) {
        if ((error as any).message?.includes('does not exist')) {
          setPlans([])
          return
        }
        throw error
      }
      setPlans(data || [])
    } finally {
      setPlansLoading(false)
    }
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const { data, error } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false })
      if (error) {
        setUsers([])
        return
      }
      setUsers(data || [])
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadTabSingleton(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const brandValidation = useMemo(() => {
    const issues: string[] = []
    if (!brand.company_name?.trim()) issues.push('Empresa: requerido')
    if (brand.company_ruc) {
      if (!/^[0-9]{13}$/.test(String(brand.company_ruc))) issues.push('RUC: debe tener 13 dígitos')
      else if (!validateRUC(String(brand.company_ruc))) issues.push('RUC: inválido (validación Ecuador)')
    }
    for (const k of ['primary_color', 'secondary_color', 'accent_color'] as const) {
      const v = String(brand[k] || '').trim()
      if (v && !safeHex(v)) issues.push(`Color inválido: ${k}`)
    }
    return issues
  }, [brand])

  const saveBrand = async () => {
    if (brandValidation.length) {
      toast.error(brandValidation[0])
      return
    }
    setBrandSaving(true)
    try {
      const { data, removedColumns, reason, error } = await upsertSingletonRow('app_settings', {
        company_name: brand.company_name,
        company_ruc: brand.company_ruc,
        company_logo: brand.company_logo,
        primary_color: brand.primary_color,
        secondary_color: brand.secondary_color,
        accent_color: brand.accent_color,
        login_message_title: brand.login_message_title,
        login_message_body: brand.login_message_body,
      })

      if (!data) {
        const f = formatSupabaseError(error)
        toast.error(`Brand: ${f.title}. ${f.hint}`)
        return
      }

      applyBranding(data)
      toast.success('Brand guardado')

      if (removedColumns?.length) {
        toast(
          'Advertencia: faltan columnas en app_settings. Ejecuta las migraciones para guardar todos los campos.',
          { icon: '⚠️' },
        )
      }
    } finally {
      setBrandSaving(false)
    }
  }

  const saveSmtp = async () => {
    setSmtpSaving(true)
    try {
      const { data } = await upsertSingletonRow('smtp_settings', {
        host: smtp.host,
        port: Number(smtp.port || 0),
        username: smtp.username,
        from_email: smtp.from_email,
        from_name: smtp.from_name,
        secure: Boolean(smtp.secure),
      })

      if (!data) {
        toast.error('No se pudo guardar SMTP (tabla smtp_settings).')
        return
      }

      // Secret en Vault/Secrets vía Edge Function (opción A)
      if (smtpPassword?.trim()) {
        const { error } = await supabase.functions.invoke('smtp-settings', {
          body: {
            host: smtp.host,
            port: Number(smtp.port || 0),
            username: smtp.username,
            from_email: smtp.from_email,
            from_name: smtp.from_name,
            secure: Boolean(smtp.secure),
            password: smtpPassword,
          },
        })

        if (error) {
          toast(
            'SMTP guardado, pero NO se pudo guardar el secreto (Edge Function smtp-settings no desplegada o sin permisos).',
            { icon: '⚠️' },
          )
        } else {
          toast.success('SMTP guardado (secreto en Vault/Secrets)')
          setSmtpPassword('')
          setSmtp((prev: any) => ({ ...prev, has_secret: true }))
        }
      } else {
        toast.success('SMTP guardado')
      }
    } finally {
      setSmtpSaving(false)
    }
  }

  const testSmtp = async () => {
    const email = String(smtpTestEmail || '').trim()
    if (!email) return toast.error('Ingrese un email destino para el Test SMTP')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error('Email destino inválido')

    setSmtpTesting(true)
    try {
      const { data, error } = await supabase.functions.invoke('smtp-test', {
        body: { to_email: email },
      })

      if (error) {
        toast.error('No se pudo enviar Test SMTP. Verifica Edge Function smtp-test y configuración SMTP.')
        console.warn('smtp-test error', error)
        return
      }

      const sent = (data as any)?.sent ?? null
      toast.success(sent ? `Test SMTP enviado (${sent})` : `Test SMTP enviado a ${email}`)
    } finally {
      setSmtpTesting(false)
    }
  }

  const saveBilling = async () => {
    setBillingSaving(true)
    try {
      const { data } = await upsertSingletonRow('billing_settings', {
        currency: billing.currency,
        invoice_footer: billing.invoice_footer,
        tax_percent: Number(billing.tax_percent || 0),
      })

      if (!data) {
        toast.error('No se pudo guardar Facturación.')
        return
      }

      toast.success('Facturación guardada')
    } finally {
      setBillingSaving(false)
    }
  }

  const saveKpi = async () => {
    setKpiSaving(true)
    try {
      const { data } = await upsertSingletonRow('kpi_targets', {
        expected_revenue_monthly: Number(kpi.expected_revenue_monthly || 0),
        expected_new_clients_monthly: Number(kpi.expected_new_clients_monthly || 0),
        green_change_pct: Number(kpi.green_change_pct || 0),
        yellow_change_pct: Number(kpi.yellow_change_pct || 0),
      })

      if (!data) {
        toast.error('No se pudo guardar KPI Targets.')
        return
      }

      toast.success('KPI Targets guardados')
    } finally {
      setKpiSaving(false)
    }
  }

  const saveSecurity = async () => {
    setSecuritySaving(true)
    try {
      const { data } = await upsertSingletonRow('security_settings', {
        password_level: security.password_level,
        min_length: Number(security.min_length || 0),
        require_upper: Boolean(security.require_upper),
        require_number: Boolean(security.require_number),
        require_special: Boolean(security.require_special),
        rotation_enabled: Boolean(security.rotation_enabled),
        rotation_days_default: Number(security.rotation_days_default || 0),
      })

      if (!data) {
        toast.error('No se pudo guardar Seguridad.')
        return
      }

      toast.success('Seguridad guardada')
    } finally {
      setSecuritySaving(false)
    }
  }

  const togglePerm = async (role: RoleKey, permKey: string) => {
    if (role === 'admin') return
    if (!canEditRoles) {
      toast.error('Sin permiso para editar Roles/Permisos')
      return
    }

    const nextRolePerms = { ...(perms[role] || {}) }
    nextRolePerms[permKey] = !nextRolePerms[permKey]

    setPerms((prev) => ({ ...prev, [role]: nextRolePerms }))

    setPermsSavingKey(`${role}:${permKey}`)
    try {
      const { error } = await supabase
        .from('role_permissions')
        .upsert({ role, permissions: nextRolePerms }, { onConflict: 'role' })

      if (error) {
        toast.error('No se pudo guardar permisos (role_permissions).')
        // revert
        setPerms((prev) => ({ ...prev, [role]: perms[role] }))
      }
    } finally {
      setPermsSavingKey(null)
    }
  }

  const savePlan = async () => {
    if (!canEditPlans) {
      toast.error('Sin permiso para editar planes')
      return
    }

    try {
      if (!planForm.code?.trim()) return toast.error('Código de plan requerido')
      if (!planForm.name?.trim()) return toast.error('Nombre de plan requerido')

      const payload: any = {
        code: String(planForm.code).trim(),
        name: String(planForm.name).trim(),
        description: planForm.description || '',
        billing_model: planForm.billing_model || 'flat',
        price_model: planForm.price_model,
        price: Number(planForm.price || 0),
        unit_price: Number(planForm.unit_price || 0),
      }

      const { error } = await supabase.from('plans').upsert(payload, { onConflict: 'code' })
      if (error) throw error

      toast.success('Plan guardado')
      setPlanForm({ code: '', name: '', description: '', billing_model: 'flat',
    price_model: 'fixed', price: 0, unit_price: 0 })
      await loadPlans()
    } catch (e: any) {
      toast.error(e?.message || 'Error guardando plan')
    }
  }

  const createUser = async () => {
    if (!canCreateUsers) {
      toast.error('Sin permiso para crear usuarios')
      return
    }

    setUserCreating(true)
    try {
      if (!userCreate.email?.trim()) return toast.error('Email requerido')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(userCreate.email)) return toast.error('Email inválido')
      if (!userCreate.temp_password || String(userCreate.temp_password).length < 8) return toast.error('Password temporal (>=8) requerido')

      // Opción segura: Edge Function con Service Role (no exponer service key en front)
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: userCreate.email,
          password: userCreate.temp_password,
          full_name: userCreate.full_name,
          role: userCreate.role,
          rotation_days: Number(userCreate.rotation_days || 0),
          force_password_change: Boolean(userCreate.force_password_change),
        },
      })

      if (error) {
        const f = formatSupabaseError(error)
        toast.error(`Usuario: ${f.title}. ${f.hint}`)
        console.error('admin-create-user error:', error)
        return
      }

      toast.success('Usuario creado')
      setUserCreate({ email: '', full_name: '', role: 'assistant', temp_password: '', rotation_days: 90, force_password_change: true })
      await loadUsers()
      return data
    } finally {
      setUserCreating(false)
    }
  }

  const sendMessage = async () => {
    if (!canSendBroadcast) {
      toast.error('Sin permiso para enviar mensajes')
      return
    }

    setMessageSending(true)
    try {
      if (!messageDraft.title?.trim()) return toast.error('Título requerido')
      if (!messageDraft.body?.trim()) return toast.error('Mensaje requerido')
      if (!Array.isArray(messageDraft.target_roles) || !messageDraft.target_roles.length) return toast.error('Seleccione roles destino')

      const { error } = await supabase.from('messages').insert({
        title: messageDraft.title,
        body: messageDraft.body,
        priority: messageDraft.priority,
        target_roles: messageDraft.target_roles,
      })

      if (error) {
        const f = formatSupabaseError(error)
        toast.error(`Mensajes: ${f.title}. ${f.hint}`)
        console.error('messages insert error:', error)
        return
      }

      toast.success('Mensaje enviado')
      setMessageDraft({ title: '', body: '', priority: 'normal', target_roles: ['assistant'] })
    } finally {
      setMessageSending(false)
    }
  }

  const renderHeader = () => (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-slate-400 mt-1">Admin (ISO/IEC 25000 + OWASP10): settings + seguridad + roles.</p>
      </div>
      <button onClick={refreshAll} className="btn-secondary inline-flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Recargar
      </button>
    </div>
  )

  const renderSidebar = () => (
    <div className="card p-3">
      <nav className="space-y-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const isActive = active === s.key
          return (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                isActive ? 'bg-[rgba(0,230,115,0.12)] text-slate-100' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{s.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )

  return (
    <div className="space-y-6">
      {renderHeader()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">{renderSidebar()}</div>

        <div className="lg:col-span-9">
          {/* BRAND */}
          {active === 'brand' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Brand</h2>
                <p className="text-sm text-slate-400">Empresa, RUC, logo y paleta corporativa (3 colores). Login usa degradé.</p>
              </div>

              {brandValidation.length > 0 && (
                <div className="rounded-2xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] p-4 text-sm text-slate-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning-400 mt-0.5" />
                  <div>
                    <div className="font-semibold">Validación</div>
                    <ul className="list-disc ml-5 mt-1 text-slate-300">
                      {brandValidation.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Mensaje global para Base cuando el tenant está pausado */}
<div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.35)] p-4 space-y-3">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h3 className="font-semibold">Mensaje global de pausa (Base)</h3>
      <p className="text-sm text-slate-400">Este mensaje lo consume Base cuando detecta que el tenant está <b>paused</b>. Es global (único).</p>
    </div>
    <button
      className="btn-primary inline-flex items-center gap-2"
      onClick={async () => {
        try {
          if (!canEditPausedMessage) return toast.error('Sin permiso para editar este mensaje.')
          await upsertSingletonRow('app_settings', {
            paused_message_title: (brand as any).paused_message_title || '',
            paused_message_body: (brand as any).paused_message_body || '',
          })
          toast.success('Mensaje de pausa guardado')
        } catch (e: any) {
          toast.error(e?.message || 'Error guardando mensaje de pausa')
        }
      }}
      disabled={!canEditPausedMessage}
      title={!canEditPausedMessage ? 'No tiene permiso' : 'Guardar'}
    >
      <Save className="w-4 h-4" /> Guardar
    </button>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="input-label">Título</label>
      <input
        className="input-field"
        value={(brand as any).paused_message_title || ''}
        onChange={(e) => setBrand((p: any) => ({ ...p, paused_message_title: e.target.value }))}
        disabled={!canEditPausedMessage}
      />
    </div>
    <div className="md:col-span-2">
      <label className="input-label">Mensaje</label>
      <textarea
        className="input-field min-h-[110px]"
        value={(brand as any).paused_message_body || ''}
        onChange={(e) => setBrand((p: any) => ({ ...p, paused_message_body: e.target.value }))}
        disabled={!canEditPausedMessage}
      />
    </div>
  </div>
</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Nombre de la empresa</label>
                  <input className="input-field" value={brand.company_name || ''} onChange={(e) => setBrand((p: any) => ({ ...p, company_name: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">RUC (Ecuador)</label>
                  <input className="input-field" value={brand.company_ruc || ''} onChange={(e) => setBrand((p: any) => ({ ...p, company_ruc: e.target.value.replace(/\D/g, '').slice(0, 13) }))} placeholder="0999999999001" />
                  <p className="mt-1 text-xs text-slate-400">Validación: 13 dígitos + checksum. (Opcional)</p>
                </div>

                <div className="md:col-span-2">
                  <label className="input-label">Logo (jpg/png/gif)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        try {
                          const url = await uploadBrandLogo(f)
                          setBrand((p: any) => ({ ...p, company_logo: url }))
                          toast.success('Logo cargado (Storage)')
                        } catch (err: any) {
                          toast('No se pudo subir logo. Crea el bucket "brand" y políticas (ver docs).', { icon: '⚠️' })
                        }
                      }}
                      className="input-field"
                    />
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-slate-400" />
                      {brand.company_logo ? <span className="text-xs text-slate-300">OK</span> : <span className="text-xs text-slate-500">Sin logo</span>}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="input-label">Color primario</label>
                  <input className="input-field" value={brand.primary_color || ''} onChange={(e) => setBrand((p: any) => ({ ...p, primary_color: e.target.value }))} placeholder="#00e673" />
                </div>
                <div>
                  <label className="input-label">Color secundario</label>
                  <input className="input-field" value={brand.secondary_color || ''} onChange={(e) => setBrand((p: any) => ({ ...p, secondary_color: e.target.value }))} placeholder="#00b3ff" />
                </div>
                <div>
                  <label className="input-label">Color acento</label>
                  <input className="input-field" value={brand.accent_color || ''} onChange={(e) => setBrand((p: any) => ({ ...p, accent_color: e.target.value }))} placeholder="#7c3aed" />
                </div>
                <div className="flex items-end">
                  <div className="w-full rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 p-3">
                    <div className="text-xs text-slate-400">Preview degradé</div>
                    <div
                      className="mt-2 h-8 rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${brand.primary_color || '#00e673'}, ${brand.secondary_color || '#00b3ff'})` }}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Mensaje login (título)</label>
                  <input className="input-field" value={brand.login_message_title || ''} onChange={(e) => setBrand((p: any) => ({ ...p, login_message_title: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Mensaje login (cuerpo)</label>
                  <input className="input-field" value={brand.login_message_body || ''} onChange={(e) => setBrand((p: any) => ({ ...p, login_message_body: e.target.value }))} />
                </div>
              </div>

              <div className="flex justify-end">
                <button disabled={brandSaving} onClick={saveBrand} className="btn-primary inline-flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {brandSaving ? 'Guardando...' : 'Guardar Brand'}
                </button>
              </div>
            </div>
          )}

          {/* USERS */}
          {active === 'users' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Usuarios</h2>
                <p className="text-sm text-slate-400">Creación segura vía Edge Function (no exponer Service Role en front).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Email</label>
                  <input className="input-field" value={userCreate.email} onChange={(e) => setUserCreate((p: any) => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Nombre completo</label>
                  <input className="input-field" value={userCreate.full_name} onChange={(e) => setUserCreate((p: any) => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Rol</label>
                  <select className="input-field" value={userCreate.role} onChange={(e) => setUserCreate((p: any) => ({ ...p, role: e.target.value }))}>
                    <option value="assistant">assistant</option>
                    <option value="maintenance">maintenance</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Password temporal</label>
                  <input className="input-field" value={userCreate.temp_password} onChange={(e) => setUserCreate((p: any) => ({ ...p, temp_password: e.target.value }))} placeholder="Genera uno fuerte" />
                </div>
                <div>
                  <label className="input-label">Rotación (días) (0 = nunca)</label>
                  <input type="number" className="input-field" value={userCreate.rotation_days} onChange={(e) => setUserCreate((p: any) => ({ ...p, rotation_days: Number(e.target.value) }))} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={!!userCreate.force_password_change} onChange={(e) => setUserCreate((p: any) => ({ ...p, force_password_change: e.target.checked }))} />
                    Forzar cambio de clave en primer login
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button disabled={userCreating || !canCreateUsers} onClick={createUser} className="btn-primary inline-flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  {userCreating ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>

              <div className="border-t border-[rgba(148,163,184,0.12)] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Listado (user_roles)</h3>
                  <button className="btn-secondary" onClick={loadUsers}>
                    Recargar
                  </button>
                </div>
                <div className="mt-3">
                  {usersLoading ? (
                    <div className="text-sm text-slate-400">Cargando...</div>
                  ) : users.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-400">
                            <th className="py-2">Email</th>
                            <th>Rol</th>
                            <th>Creado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id} className="border-t border-[rgba(148,163,184,0.10)]">
                              <td className="py-2 text-slate-100">{u.email}</td>
                              <td className="text-slate-200">{u.role}</td>
                              <td className="text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">Sin datos. (Ejecuta migraciones/RLS)</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ROLES */}
          {active === 'roles' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Roles / Permisos</h2>
                <p className="text-sm text-slate-400">Matriz editable. Admin se mantiene full por seguridad.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="py-2">Permiso</th>
                      <th className="px-3">Admin</th>
                      <th className="px-3">Assistant</th>
                      <th className="px-3">Maintenance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS_CATALOG.map((p) => (
                      <tr key={p.key} className="border-t border-[rgba(148,163,184,0.10)]">
                        <td className="py-2">
                          <div className="text-slate-100 font-medium">{p.label}</div>
                          <div className="text-xs text-slate-500">{p.key}</div>
                        </td>
                        <td className="px-3">
                          <input type="checkbox" checked disabled />
                        </td>
                        {(['assistant', 'maintenance'] as const).map((r) => (
                          <td key={r} className="px-3">
                            <input
                              type="checkbox"
                              checked={!!perms[r]?.[p.key]}
                              onChange={() => togglePerm(r, p.key)}
                              disabled={!canEditRoles || permsSavingKey === `${r}:${p.key}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 p-4 text-sm text-slate-300">
                <div className="font-semibold text-slate-100">Nota (OWASP)</div>
                <ul className="list-disc ml-5 mt-2">
                  <li>No elevar permisos desde el cliente sin validar en backend/RLS.</li>
                  <li>role_permissions debe estar protegida por RLS (solo admin).</li>
                </ul>
              </div>
            </div>
          )}

          {/* SMTP */}
          {active === 'smtp' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Correo SMTP</h2>
                <p className="text-sm text-slate-400">Opción A: Password en Vault/Secrets (Edge Function). Campos no deben “sacar” al escribir.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Host</label>
                  <input className="input-field" value={smtp.host || ''} onChange={(e) => setSmtp((p: any) => ({ ...p, host: e.target.value }))} placeholder="smtp.office365.com" />
                </div>
                <div>
                  <label className="input-label">Port</label>
                  <input type="number" className="input-field" value={smtp.port ?? 587} onChange={(e) => setSmtp((p: any) => ({ ...p, port: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="input-label">Usuario</label>
                  <input className="input-field" value={smtp.username || ''} onChange={(e) => setSmtp((p: any) => ({ ...p, username: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Password (Vault/Secrets)</label>
                  <input className="input-field" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder={smtp.has_secret ? '*** (configurado)' : 'Escriba para actualizar'} />
                  <p className="mt-1 text-xs text-slate-500">No se lee de vuelta. Solo se escribe (Edge Function).</p>
                </div>
                <div>
                  <label className="input-label">From email</label>
                  <input className="input-field" value={smtp.from_email || ''} onChange={(e) => setSmtp((p: any) => ({ ...p, from_email: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">From name</label>
                  <input className="input-field" value={smtp.from_name || ''} onChange={(e) => setSmtp((p: any) => ({ ...p, from_name: e.target.value }))} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={!!smtp.secure} onChange={(e) => setSmtp((p: any) => ({ ...p, secure: e.target.checked }))} />
                    TLS / Secure
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button disabled={smtpSaving} onClick={saveSmtp} className="btn-primary inline-flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {smtpSaving ? 'Guardando...' : 'Guardar SMTP'}
                </button>
              </div>

              <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 p-4">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-100">Test SMTP</div>
                    <div className="text-xs text-slate-400">Envía un correo de prueba usando el SMTP global configurado.</div>
                    <div className="mt-3">
                      <label className="input-label">Email destino</label>
                      <input
                        className="input-field"
                        value={smtpTestEmail}
                        onChange={(e) => setSmtpTestEmail(e.target.value)}
                        placeholder="tu-correo@dominio.com"
                      />
                    </div>
                  </div>
                  <button
                    disabled={smtpTesting}
                    onClick={testSmtp}
                    className="btn-secondary inline-flex items-center gap-2 justify-center md:w-[180px]"
                  >
                    <Mail className="w-4 h-4" />
                    {smtpTesting ? 'Probando…' : 'Test SMTP'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 p-4 text-sm text-slate-300">
                <div className="font-semibold text-slate-100">Requisito</div>
                <p className="mt-1">
                  Para almacenar el password en Vault/Secrets, despliega la Edge Function <code>smtp-settings</code> y configura
                  el Service Role como secreto del proyecto (ver <b>docs/SUPABASE_SETUP.md</b>).
                </p>
              </div>
            </div>
          )}

          {/* BILLING */}
          {active === 'billing' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Facturación</h2>
                <p className="text-sm text-slate-400">Incluye footer editable (corregido el bug de edición).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Moneda</label>
                  <input className="input-field" value={billing.currency || 'USD'} onChange={(e) => setBilling((p: any) => ({ ...p, currency: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">IVA / Impuesto (%)</label>
                  <input type="number" className="input-field" value={billing.tax_percent ?? 0} onChange={(e) => setBilling((p: any) => ({ ...p, tax_percent: Number(e.target.value) }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="input-label">Footer de factura</label>
                  <textarea
                    className="input-field min-h-[120px]"
                    value={billing.invoice_footer || ''}
                    onChange={(e) => setBilling((p: any) => ({ ...p, invoice_footer: e.target.value }))}
                    placeholder="Ej: Gracias por su preferencia. Pagos a la cuenta..."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button disabled={billingSaving} onClick={saveBilling} className="btn-primary inline-flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {billingSaving ? 'Guardando...' : 'Guardar Facturación'}
                </button>
              </div>
            </div>
          )}

          {/* KPI */}
          {active === 'kpi' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">KPI Targets</h2>
                <p className="text-sm text-slate-400">Tabla editable kpi_targets. Usado por Dashboard (semáforo por % cambio).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Ingreso esperado mensual</label>
                  <input type="number" className="input-field" value={kpi.expected_revenue_monthly ?? 0} onChange={(e) => setKpi((p: any) => ({ ...p, expected_revenue_monthly: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="input-label">Clientes nuevos esperados (mes)</label>
                  <input type="number" className="input-field" value={kpi.expected_new_clients_monthly ?? 0} onChange={(e) => setKpi((p: any) => ({ ...p, expected_new_clients_monthly: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="input-label">Umbral verde (% cambio vs mes anterior)</label>
                  <input type="number" className="input-field" value={kpi.green_change_pct ?? 0} onChange={(e) => setKpi((p: any) => ({ ...p, green_change_pct: Number(e.target.value) }))} />
                  <p className="mt-1 text-xs text-slate-500">Ej: 0 = si no cae, es verde. 2 = requiere crecer 2%.</p>
                </div>
                <div>
                  <label className="input-label">Umbral amarillo (% cambio mínimo)</label>
                  <input type="number" className="input-field" value={kpi.yellow_change_pct ?? -5} onChange={(e) => setKpi((p: any) => ({ ...p, yellow_change_pct: Number(e.target.value) }))} />
                  <p className="mt-1 text-xs text-slate-500">Por debajo de este valor =&gt; rojo.</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button disabled={kpiSaving} onClick={saveKpi} className="btn-primary inline-flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {kpiSaving ? 'Guardando...' : 'Guardar KPI Targets'}
                </button>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {active === 'security' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Seguridad</h2>
                <p className="text-sm text-slate-400">OWASP: no almacenar secretos en front. Politicas de password configurables.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Nivel password</label>
                  <select className="input-field" value={security.password_level} onChange={(e) => setSecurity((p: any) => ({ ...p, password_level: e.target.value }))}>
                    <option value="low">Bajo</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Mínimo caracteres</label>
                  <input type="number" className="input-field" value={security.min_length ?? 10} onChange={(e) => setSecurity((p: any) => ({ ...p, min_length: Number(e.target.value) }))} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={!!security.require_upper} onChange={(e) => setSecurity((p: any) => ({ ...p, require_upper: e.target.checked }))} />
                    Requiere mayúscula
                  </label>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={!!security.require_number} onChange={(e) => setSecurity((p: any) => ({ ...p, require_number: e.target.checked }))} />
                    Requiere número
                  </label>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={!!security.require_special} onChange={(e) => setSecurity((p: any) => ({ ...p, require_special: e.target.checked }))} />
                    Requiere carácter especial
                  </label>
                </div>

                <div className="md:col-span-2 rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 p-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={!!security.rotation_enabled} onChange={(e) => setSecurity((p: any) => ({ ...p, rotation_enabled: e.target.checked }))} />
                    Habilitar rotación de clave
                  </label>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">Rotación por defecto (días)</label>
                      <input type="number" className="input-field" value={security.rotation_days_default ?? 90} onChange={(e) => setSecurity((p: any) => ({ ...p, rotation_days_default: Number(e.target.value) }))} />
                      <p className="mt-1 text-xs text-slate-500">Si el usuario tiene rotation_days = 0, no rota.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button disabled={securitySaving} onClick={saveSecurity} className="btn-primary inline-flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {securitySaving ? 'Guardando...' : 'Guardar Seguridad'}
                </button>
              </div>
            </div>
          )}

          {/* PLANS */}
          {active === 'plans' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Planes</h2>
                <p className="text-sm text-slate-400">Fixed vs Destajo (uso). Se relaciona a tenants.plan -&gt; plans.code.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Código</label>
                  <input className="input-field" value={planForm.code} onChange={(e) => setPlanForm((p: any) => ({ ...p, code: e.target.value }))} placeholder="BASIC" />
                </div>
                <div>
                  <label className="input-label">Nombre</label>
                  <input className="input-field" value={planForm.name} onChange={(e) => setPlanForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="Plan Básico" />
                </div>
                <div className="md:col-span-2">
                  <label className="input-label">Descripción</label>
                  <input className="input-field" value={planForm.description} onChange={(e) => setPlanForm((p: any) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  
<div>
  <label className="input-label">Billing model</label>
  <select
    className="input-field"
    value={planForm.billing_model}
    onChange={(e) => setPlanForm((p: any) => ({ ...p, billing_model: e.target.value }))}
    disabled={!canEditPlans}
  >
    <option value="flat">Flat (fijo)</option>
    <option value="per_user_active">Por usuario activo</option>
    <option value="usage">Por uso</option>
  </select>
</div>

<label className="input-label">Modelo de precio</label>
                  <select className="input-field" value={planForm.price_model} onChange={(e) => setPlanForm((p: any) => ({ ...p, price_model: e.target.value }))}>
                    <option value="fixed">Fijo</option>
                    <option value="usage">Destajo (por usuario)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Precio base (USD)</label>
                  <input type="number" className="input-field" value={planForm.price} onChange={(e) => setPlanForm((p: any) => ({ ...p, price: Number(e.target.value) }))} />
                </div>
                {planForm.price_model === 'usage' && (
                  <div>
                    <label className="input-label">Unit price (por usuario, USD)</label>
                    <input type="number" className="input-field" value={planForm.unit_price} onChange={(e) => setPlanForm((p: any) => ({ ...p, unit_price: Number(e.target.value) }))} />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button onClick={savePlan}
                    disabled={!canEditPlans} className="btn-primary inline-flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Guardar plan
                </button>
              </div>

              <div className="border-t border-[rgba(148,163,184,0.12)] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Listado</h3>
                  <button className="btn-secondary" onClick={loadPlans}>
                    Recargar
                  </button>
                </div>
                <div className="mt-3">
                  {plansLoading ? (
                    <div className="text-sm text-slate-400">Cargando...</div>
                  ) : plans.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-400">
                            <th className="py-2">Código</th>
                            <th>Nombre</th>
                            <th>Modelo</th>
                            <th className="text-right">Base</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plans.map((pl) => (
                            <tr key={pl.code} className="border-t border-[rgba(148,163,184,0.10)]">
                              <td className="py-2 text-slate-100 font-mono">{pl.code}</td>
                              <td className="text-slate-200">{pl.name}</td>
                              <td className="text-slate-400">{pl.price_model}</td>
                              <td className="text-right text-slate-200">${Number(pl.price || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">Sin planes. Ejecuta migraciones.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {active === 'messages' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Mensajes (Broadcast)</h2>
                <p className="text-sm text-slate-400">No es parte de la Config general: se consume en Dashboard (botón junto a campana).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Título</label>
                  <input className="input-field" disabled={!canSendBroadcast} value={messageDraft.title} onChange={(e) => setMessageDraft((p: any) => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Prioridad</label>
                  <select className="input-field" disabled={!canSendBroadcast} value={messageDraft.priority} onChange={(e) => setMessageDraft((p: any) => ({ ...p, priority: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="input-label">Mensaje</label>
                  <textarea className="input-field min-h-[140px]" disabled={!canSendBroadcast} value={messageDraft.body} onChange={(e) => setMessageDraft((p: any) => ({ ...p, body: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="input-label">Roles destino</label>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((r) => (
                      <label key={r} className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={messageDraft.target_roles.includes(r)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setMessageDraft((p: any) => {
                              const set = new Set(p.target_roles)
                              if (checked) set.add(r)
                              else set.delete(r)
                              return { ...p, target_roles: Array.from(set) }
                            })
                          }}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button disabled={messageSending || !canSendBroadcast} onClick={sendMessage} className="btn-primary inline-flex items-center gap-2">
                  {messageSending ? 'Enviando...' : 'Enviar mensaje'}
                </button>
              </div>

              <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 p-4 text-sm text-slate-300">
                <div className="font-semibold text-slate-100">Nota</div>
                <p className="mt-1">
                  Recomendado: tabla <code>message_reads</code> para control de leídos por usuario. Incluida en migraciones.
                </p>
              </div>
            </div>
          )}

          {/* Fallback */}
          {!SECTIONS.some((s) => s.key === active) && (
            <div className="card p-6">
              <div className="text-sm text-slate-400">Sección no encontrada.</div>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Si ves errores de "tabla no existe" o "schema cache": ejecuta <b>supabase/migrations</b> y revisa RLS.
      </div>
    </div>
  )
}
