/**
 * EmailConfigPage.tsx — Base PWA v4.8.5
 * Configuración SMTP corporativo para notificaciones y envío de credenciales.
 * Tabla: attendance.tenant_email_config (upsert por tenant_id)
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, Mail, Eye, EyeOff, TestTube2 } from 'lucide-react'

interface EmailCfg {
  tenant_id:   string
  smtp_host:   string
  smtp_port:   number
  smtp_user:   string
  smtp_pass:   string
  from_name:   string
  from_email:  string
  use_tls:     boolean
}

const BLANK = (tid: string): EmailCfg => ({
  tenant_id: tid, smtp_host: '', smtp_port: 587,
  smtp_user: '', smtp_pass: '', from_name: '', from_email: '', use_tls: true,
})

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

export default function EmailConfigPage() {
  const nav = useNavigate()
  const [cfg,       setCfg]       = useState<EmailCfg | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [testing,   setTesting]   = useState(false)
  const [showPass,  setShowPass]  = useState(false)
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    const init = async () => {
      const tid = await getTenantId()
      if (!tid) { setLoading(false); return }
      const { data } = await supabase.schema('attendance')
        .from('tenant_email_config')
        .select('*')
        .eq('tenant_id', tid)
        .maybeSingle()
      setCfg(data ?? BLANK(tid))
      setLoading(false)
    }
    init()
  }, [])

  const set = (k: keyof EmailCfg, v: any) =>
    setCfg(prev => prev ? { ...prev, [k]: v } : prev)

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    const { error } = await supabase.schema('attendance')
      .from('tenant_email_config')
      .upsert(cfg, { onConflict: 'tenant_id' })
    if (error) toast.error('Error: ' + error.message)
    else toast.success('Configuración SMTP guardada')
    setSaving(false)
  }

  const testSend = async () => {
    if (!testEmail) { toast.error('Ingresa un correo de prueba'); return }
    setTesting(true)
    // Placeholder — conectar con Edge Function cuando esté lista
    await new Promise(r => setTimeout(r, 1500))
    toast.success('Prueba enviada a ' + testEmail + ' (pendiente Edge Function)')
    setTesting(false)
  }

  const field = (label: string, k: keyof EmailCfg, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
        {label}
      </label>
      <input
        type={type}
        value={(cfg as any)?.[k] ?? ''}
        onChange={e => set(k, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ background: 'var(--color-background)', color: 'var(--color-text)',
          border: '1px solid var(--color-border)' }}
      />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => nav('/config')}
        className="flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--color-muted)' }}>
        <ArrowLeft size={16} /> Volver a Configuración
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--color-accent)', color: 'var(--color-on-primary)' }}>
          <Mail size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Correo (SMTP)
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Servidor de correo corporativo para notificaciones y credenciales.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Servidor */}
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Servidor SMTP</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">{field('Host', 'smtp_host', 'text', 'smtp.office365.com')}</div>
              <div>{field('Puerto', 'smtp_port', 'number', '587')}</div>
            </div>
            {field('Usuario', 'smtp_user', 'text', 'correo@empresa.com')}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={cfg?.smtp_pass ?? ''}
                  onChange={e => set('smtp_pass', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-background)', color: 'var(--color-text)',
                    border: '1px solid var(--color-border)' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-2.5" style={{ color: 'var(--color-muted)' }}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="tls" checked={cfg?.use_tls ?? true}
                onChange={e => set('use_tls', e.target.checked)}
                className="w-4 h-4 rounded" />
              <label htmlFor="tls" className="text-sm" style={{ color: 'var(--color-text)' }}>
                Usar TLS/STARTTLS
              </label>
            </div>
          </div>

          {/* Remitente */}
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Remitente</p>
            {field('Nombre del remitente', 'from_name', 'text', 'HRCloud Notificaciones')}
            {field('Correo del remitente', 'from_email', 'text', 'noreply@empresa.com')}
          </div>

          {/* Prueba */}
          <div className="rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Enviar correo de prueba
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="destino@correo.com"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-background)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)' }}
              />
              <button onClick={testSend} disabled={testing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--color-secondary)', color: 'var(--color-on-primary)' }}>
                {testing ? <Loader2 size={16} className="animate-spin"/> : <TestTube2 size={16}/>}
                Probar
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              ⚠ El envío real requiere configurar la Edge Function <code>send-email</code>.
            </p>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
            {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
            Guardar configuración
          </button>
        </div>
      )}
    </div>
  )
}
