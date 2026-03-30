/**
 * CompanyConfigPage.tsx — versión simplificada sin pestaña de Departamentos.
 * La fuente única de verdad para ubicar al empleado es Estructura Organizacional.
 */
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/config/supabase'
import { useBranding } from '@/components/branding/BrandingProvider'
import toast from 'react-hot-toast'
import {
  Building2, Palette, Mail,
  Save, Upload, CheckCircle2, XCircle,
} from 'lucide-react'
import type { BaseTenantConfig } from '@/types'
import { getContrastText } from '@/lib/branding'

type Tab = 'company' | 'branding' | 'smtp'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'company',  label: 'Empresa',     icon: Building2 },
  { id: 'branding', label: 'Identidad',   icon: Palette },
  { id: 'smtp',     label: 'Correo SMTP', icon: Mail },
]

export default function CompanyConfigPage() {
  const { refresh: refreshBranding } = useBranding()
  const [tab, setTab] = useState<Tab>('company')
  const [cfg, setCfg] = useState<BaseTenantConfig | null>(null)
  const [tid, setTid] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [smtpPassword, setSmtpPassword] = useState('')

  const PALETTES = [
    { name: 'Azul',    colors: { color_primary:'#2563EB', color_secondary:'#0EA5E9', color_accent:'#22C55E', color_sidebar:'#0B1220', color_header:'#0F172A' } },
    { name: 'Verde',   colors: { color_primary:'#16A34A', color_secondary:'#22C55E', color_accent:'#0EA5E9', color_sidebar:'#071A10', color_header:'#0B2A16' } },
    { name: 'Morado',  colors: { color_primary:'#7C3AED', color_secondary:'#A78BFA', color_accent:'#22C55E', color_sidebar:'#140B2D', color_header:'#1F1140' } },
    { name: 'Naranja', colors: { color_primary:'#F97316', color_secondary:'#FB7185', color_accent:'#0EA5E9', color_sidebar:'#1A0E06', color_header:'#241306' } },
    { name: 'Gris',    colors: { color_primary:'#334155', color_secondary:'#64748B', color_accent:'#22C55E', color_sidebar:'#0B0F15', color_header:'#0F172A' } },
  ] as const

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let tenantId: string | null = (user.user_metadata as any)?.tenant_id ?? null

    if (!tenantId) {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      tenantId = (profile as any)?.tenant_id ?? null
    }

    if (!tenantId) {
      const { data: emp } = await supabase.schema('attendance').from('employees').select('tenant_id').eq('user_id', user.id).maybeSingle()
      tenantId = (emp as any)?.tenant_id ?? null
    }

    if (!tenantId) {
      setLoading(false)
      return
    }

    setTid(tenantId)

    const { data } = await supabase.schema('attendance').from('base_tenant_config').select('*').eq('tenant_id', tenantId).maybeSingle()

    setCfg(data || {
      id: '', tenant_id: tenantId,
      color_primary: '#0056E6', color_secondary: '#00B3FF', color_accent: '#7C3AED',
      color_sidebar: '#0F2744', color_header: '#0D1B2A', theme: 'dark', smtp_verified: false, smtp_port: 587,
    } as BaseTenantConfig)

    setLoading(false)
  }

  const saveCfg = async () => {
    if (!cfg || !tid) return
    setSaving(true)

    const payload: any = { ...cfg, tenant_id: tid }
    if (smtpPassword.trim()) payload.smtp_password = smtpPassword.trim()
    else delete payload.smtp_password

    const { error } = await supabase.schema('attendance').from('base_tenant_config').upsert(payload)
    if (error) toast.error('Error al guardar: ' + error.message)
    else {
      toast.success('Configuración guardada')
      setSmtpPassword('')
      await refreshBranding()
    }

    setSaving(false)
  }

  const set = (k: keyof BaseTenantConfig) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setCfg(c => c ? { ...c, [k]: e.target.value } : c)

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)', color: 'var(--color-text)',
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!cfg) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No se pudo cargar la configuración de la empresa.</p>
      <button onClick={loadData} className="px-5 py-2.5 rounded-xl text-sm font-medium transition" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
        Reintentar
      </button>
    </div>
  )

  return (
    <div>
      <div className="mb-2 rounded-xl border p-3 text-sm" style={{ borderColor: 'rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.06)', color: 'var(--color-muted)' }}>
        La asignación organizacional de empleados se administra únicamente desde <strong>Estructura Organizacional</strong>. La pestaña de Departamentos fue retirada para evitar duplicidad.
      </div>

      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>Configuración de Empresa</h1>

      <div className="flex gap-0 mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px"
            style={{ borderColor: tab === t.id ? 'var(--color-primary)' : 'transparent', color: tab === t.id ? 'var(--color-primary)' : 'var(--color-muted)' }}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div className="space-y-4 max-w-lg">
          <Fld label="Nombre de la empresa" field="company_name" cfg={cfg} set={set} is={inputStyle} />
          <Fld label="RUC" field="ruc" cfg={cfg} set={set} is={inputStyle} />
          <Fld label="Representante Legal" field="legal_rep_name" cfg={cfg} set={set} is={inputStyle} />
          <LogoUploader tenantId={tid!} cfg={cfg} setCfg={setCfg} />
          <SaveBtn saving={saving} onClick={saveCfg} />
        </div>
      )}

      {tab === 'branding' && (
        <div className="space-y-6 max-w-xl">
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Tema de interfaz</p>
            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as const).map(t => (
                <button key={t} type="button" onClick={() => setCfg(c => c ? { ...c, theme: t } : c)} className="py-4 rounded-xl border-2 text-sm font-medium transition" style={{ borderColor: cfg.theme === t ? 'var(--color-primary)' : 'var(--color-border)', background: t === 'dark' ? '#0D1B2A' : '#F8FAFC', color: t === 'dark' ? '#F1F5F9' : '#0D1B2A', opacity: cfg.theme === t ? 1 : 0.6 }}>
                  {t === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Colores corporativos</p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PALETTES.map(p => (
                <button key={p.name} type="button" onClick={() => setCfg(c => c ? { ...c, ...p.colors } : c)} className="rounded-xl border px-3 py-2 text-xs font-semibold hover:opacity-90" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)' }}>
                  {p.name}
                </button>
              ))}
            </div>

            <div className="space-y-3 mt-3">
              {[
                { field: 'color_primary', label: 'Color Principal', desc: 'Botones, menú activo, CTAs' },
                { field: 'color_secondary', label: 'Color Secundario', desc: 'Badges, acentos, links' },
                { field: 'color_accent', label: 'Color de Acento', desc: 'Highlights, alertas' },
                { field: 'color_sidebar', label: 'Color Sidebar', desc: 'Fondo del panel lateral' },
                { field: 'color_header', label: 'Color Header', desc: 'Barra superior de navegación' },
              ].map(({ field, label, desc }) => (
                <ColorPicker key={field} label={label} desc={desc} value={String(cfg[field as keyof BaseTenantConfig] || '#000000')} onChange={v => setCfg(c => c ? { ...c, [field]: v } : c)} />
              ))}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>Vista previa</p>
            <button className="px-5 py-2.5 rounded-xl font-medium text-sm" style={{ background: cfg.color_primary, color: getContrastText(cfg.color_primary) }}>
              Botón primario
            </button>
          </div>

          <SaveBtn saving={saving} onClick={saveCfg} />
        </div>
      )}

      {tab === 'smtp' && (
        <div className="space-y-4 max-w-lg">
          <div className="rounded-xl border p-4" style={{ background: 'rgba(0,86,230,0.08)', borderColor: 'rgba(0,86,230,0.2)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Configure el servidor SMTP de su empresa para enviar correos a empleados. Si no configura uno, se usará el SMTP global del sistema.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Host SMTP" field="smtp_host" cfg={cfg} set={set} is={inputStyle} />
            <Fld label="Puerto (587 TLS / 465 SSL)" field="smtp_port" cfg={cfg} set={set} is={inputStyle} />
            <Fld label="Usuario (email de envío)" field="smtp_user" cfg={cfg} set={set} is={inputStyle} />
            <Fld label="Nombre del remitente" field="smtp_from_name" cfg={cfg} set={set} is={inputStyle} />
          </div>
          <Fld label="Email del remitente" field="smtp_from_email" cfg={cfg} set={set} is={inputStyle} />

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--color-muted)' }}>Contraseña SMTP</label>
            <input type="password" autoComplete="new-password" placeholder="Contraseña del buzón SMTP" onChange={e => setSmtpPassword(e.target.value)} className="w-full border rounded-xl px-4 py-3 outline-none transition" style={inputStyle} />
          </div>

          <div className="flex items-center gap-3">
            {cfg.smtp_verified
              ? <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20"><CheckCircle2 size={12} /> SMTP verificado</span>
              : <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-700 px-3 py-1.5 rounded-full border border-slate-600"><XCircle size={12} /> Sin verificar</span>}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={saveCfg} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              <Save size={15} /> {saving ? 'Guardando...' : 'Guardar SMTP'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Fld({ label, field, cfg, set, is }: { label: string; field: keyof BaseTenantConfig; cfg: BaseTenantConfig; set: (k: keyof BaseTenantConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; is: React.CSSProperties }) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input value={String(cfg[field] ?? '')} onChange={set(field)} className="w-full border rounded-xl px-4 py-3 outline-none transition" style={is} />
    </div>
  )
}

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
      <Save size={15} /> {saving ? 'Guardando...' : 'Guardar cambios'}
    </button>
  )
}

function ColorPicker({ label, desc, value, onChange }: { label: string; desc: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm mb-1" style={{ color: 'var(--color-text)' }}>{label}</label>
      <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>{desc}</p>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-14 h-10 rounded-xl border cursor-pointer" style={{ borderColor: 'var(--color-border)', background: 'transparent' }} />
        <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 border rounded-xl px-4 py-2.5 outline-none transition" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
      </div>
    </div>
  )
}

function LogoUploader({ tenantId, cfg, setCfg }: { tenantId: string; cfg: BaseTenantConfig; setCfg: React.Dispatch<React.SetStateAction<BaseTenantConfig | null>> }) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const upload = async (file: File) => {
    const ext = file.name.split('.').pop() || 'png'
    const path = `${tenantId}/logo.${ext}`
    const { error } = await supabase.storage.from('tenant-branding').upload(path, file, { upsert: true })
    if (error) {
      toast.error('Error al subir logo: ' + error.message)
      return
    }
    const { data } = supabase.storage.from('tenant-branding').getPublicUrl(path)
    setCfg(prev => prev ? { ...prev, logo_url: data.publicUrl } as any : prev)
    toast.success('Logo actualizado')
  }

  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: 'var(--color-muted)' }}>Logo</label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <Upload size={14} /> Subir logo
        </button>
        {cfg.logo_url ? <img src={cfg.logo_url as any} alt="Logo" className="h-10 w-10 rounded-lg object-cover border" style={{ borderColor: 'var(--color-border)' }} /> : null}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file) }} />
    </div>
  )
}
