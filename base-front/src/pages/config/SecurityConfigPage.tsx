/**
 * SecurityConfigPage.tsx — Base PWA v4.4.0
 *
 * Configuración de seguridad de contraseñas:
 *  - Complejidad: Baja / Media / Fuerte
 *  - Periodicidad: Perenne o cada X días
 * Tabla: attendance.tenant_security_config
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, Shield, RefreshCw, Lock } from 'lucide-react'

type Complexity = 'low' | 'medium' | 'strong'

interface Cfg {
  id: string | null
  tenant_id: string
  password_complexity: Complexity
  password_expiry_days: number | null
}

const COMPLEXITIES: { key: Complexity; label: string; color: string; reqs: string[] }[] = [
  { key: 'low',    label: 'Baja',   color: '#F59E0B',
    reqs: ['Mínimo 6 caracteres'] },
  { key: 'medium', label: 'Media',  color: '#2563EB',
    reqs: ['Mínimo 8 caracteres', 'Al menos 1 letra y 1 número'] },
  { key: 'strong', label: 'Fuerte', color: '#16A34A',
    reqs: ['Mínimo 10 caracteres', 'Mayúsculas y minúsculas', 'Al menos 1 número', 'Al menos 1 símbolo (!, @, #…)'] },
]

const EXPIRY_PRESETS = [
  { label: 'Perenne (nunca expira)', value: null },
  { label: 'Cada 30 días',          value: 30   },
  { label: 'Cada 60 días',          value: 60   },
  { label: 'Cada 90 días',          value: 90   },
  { label: 'Personalizado…',        value: -1   },
]

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

export default function SecurityConfigPage() {
  const nav = useNavigate()
  const [cfg,        setCfg]       = useState<Cfg | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [saving,     setSaving]    = useState(false)
  const [customDays, setCustomDays] = useState('')

  useEffect(() => {
    const init = async () => {
      const tenantId = await getTenantId()
      if (!tenantId) { setLoading(false); return }
      const { data } = await supabase.schema('attendance').from('tenant_security_config')
        .select('*').eq('tenant_id', tenantId).maybeSingle()
      setCfg(data ?? { id: null, tenant_id: tenantId, password_complexity: 'medium', password_expiry_days: null })
      setLoading(false)
    }
    init()
  }, [])

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    let days = cfg.password_expiry_days
    if (days === -1) { const n = parseInt(customDays); days = isNaN(n) || n < 1 ? null : n }
    const payload = { tenant_id: cfg.tenant_id, password_complexity: cfg.password_complexity, password_expiry_days: days }
    const { error } = cfg.id
      ? await supabase.schema('attendance').from('tenant_security_config').update(payload).eq('id', cfg.id)
      : await supabase.schema('attendance').from('tenant_security_config').insert(payload)
    if (error) toast.error('Error: ' + error.message)
    else toast.success('Configuración de seguridad guardada')
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )
  if (!cfg) return null

  const presetActive = (v: number | null) => cfg.password_expiry_days === v
  const isCustom = cfg.password_expiry_days !== null && !EXPIRY_PRESETS.slice(0, -1).some(p => p.value === cfg.password_expiry_days)

  const inputS: React.CSSProperties = { background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('/config')} className="p-2 rounded-xl hover:opacity-70 transition"
          style={{ color: 'var(--color-muted)' }}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Seguridad</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Requisitos de contraseña para los empleados.</p>
        </div>
      </div>

      {/* Complejidad */}
      <div className="border rounded-2xl p-5 mb-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={15} style={{ color: 'var(--color-primary)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Complejidad de contraseña</p>
        </div>
        <div className="grid gap-3">
          {COMPLEXITIES.map(opt => {
            const active = cfg.password_complexity === opt.key
            return (
              <button key={opt.key} type="button"
                onClick={() => setCfg(c => c ? { ...c, password_complexity: opt.key } : c)}
                className="text-left rounded-xl border-2 p-4 transition"
                style={{ borderColor: active ? opt.color : 'var(--color-border)', background: active ? `${opt.color}10` : 'transparent' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Shield size={15} style={{ color: opt.color }} />
                  <span className="font-semibold text-sm" style={{ color: active ? opt.color : 'var(--color-text)' }}>{opt.label}</span>
                  {active && <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: opt.color, color: 'white' }}>Activo</span>}
                </div>
                <ul className="space-y-1">
                  {opt.reqs.map(r => (
                    <li key={r} className="text-xs flex items-center gap-2" style={{ color: 'var(--color-muted)' }}>
                      <span style={{ color: opt.color }}>✓</span> {r}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </div>

      {/* Periodicidad */}
      <div className="border rounded-2xl p-5 mb-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={15} style={{ color: 'var(--color-primary)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Periodicidad de cambio</p>
        </div>
        <div className="grid gap-2">
          {EXPIRY_PRESETS.map(preset => {
            const isCustomOption = preset.value === -1
            const active = isCustomOption ? isCustom : presetActive(preset.value as number | null)
            return (
              <label key={String(preset.value)}
                className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition"
                style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-border)', background: active ? 'rgba(37,99,235,0.06)' : 'transparent' }}>
                <input type="radio" name="expiry" checked={active} className="accent-blue-500"
                  onChange={() => setCfg(c => c ? { ...c, password_expiry_days: isCustomOption ? -1 : preset.value as number | null } : c)} />
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{preset.label}</span>
                {isCustomOption && active && (
                  <div className="flex items-center gap-2 ml-auto">
                    <input type="number" min={1} max={365} value={customDays}
                      onChange={e => setCustomDays(e.target.value)} placeholder="días"
                      className="w-20 border rounded-lg px-3 py-1 text-sm outline-none" style={inputS} />
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>días</span>
                  </div>
                )}
              </label>
            )
          })}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
