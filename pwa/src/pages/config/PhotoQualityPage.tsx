/**
 * PhotoQualityPage.tsx — Base PWA v4.4.0
 *
 * Parámetros de validación de foto carnet:
 *  - Dimensiones mínimas (ancho y alto en px)
 *  - Tamaño máximo en KB
 *  - Formatos permitidos
 * Tabla: attendance.photo_quality_config
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, Camera, Check } from 'lucide-react'

interface PhotoCfg {
  id: string | null
  tenant_id: string
  min_width_px:    number
  min_height_px:   number
  max_size_kb:     number
  allowed_formats: string
}

const FORMAT_OPTIONS = ['jpg', 'jpeg', 'png', 'webp']

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

export default function PhotoQualityPage() {
  const nav = useNavigate()
  const [cfg,     setCfg]    = useState<PhotoCfg | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    const init = async () => {
      const tenantId = await getTenantId()
      if (!tenantId) { setLoading(false); return }
      const { data } = await supabase.schema('attendance').from('photo_quality_config')
        .select('*').eq('tenant_id', tenantId).maybeSingle()
      setCfg(data ?? {
        id: null, tenant_id: tenantId,
        min_width_px: 200, min_height_px: 200, max_size_kb: 500,
        allowed_formats: 'jpg,jpeg,png',
      })
      setLoading(false)
    }
    init()
  }, [])

  const toggleFormat = (fmt: string) => {
    if (!cfg) return
    const current = cfg.allowed_formats.split(',').map(f => f.trim()).filter(Boolean)
    const next = current.includes(fmt) ? current.filter(f => f !== fmt) : [...current, fmt]
    if (next.length === 0) { toast.error('Debe permitir al menos un formato'); return }
    setCfg(c => c ? { ...c, allowed_formats: next.join(',') } : c)
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    const payload = {
      tenant_id:       cfg.tenant_id,
      min_width_px:    cfg.min_width_px,
      min_height_px:   cfg.min_height_px,
      max_size_kb:     cfg.max_size_kb,
      allowed_formats: cfg.allowed_formats,
    }
    const { error } = cfg.id
      ? await supabase.schema('attendance').from('photo_quality_config').update(payload).eq('id', cfg.id)
      : await supabase.schema('attendance').from('photo_quality_config').insert(payload)
    if (error) toast.error('Error: ' + error.message)
    else toast.success('Parámetros de foto guardados')
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )
  if (!cfg) return null

  const inputS: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)', color: 'var(--color-text)',
  }

  const fmtList = cfg.allowed_formats.split(',').map(f => f.trim()).filter(Boolean)

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('/config')} className="p-2 rounded-xl hover:opacity-70 transition"
          style={{ color: 'var(--color-muted)' }}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Calidad de Foto Carnet</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Parámetros de validación que se aplican al subir la foto de un empleado.
          </p>
        </div>
      </div>

      {/* Preview simulada */}
      <div className="border rounded-2xl p-5 mb-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Camera size={15} style={{ color: 'var(--color-primary)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Dimensiones mínimas</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-muted)' }}>Ancho mínimo (px)</label>
            <input type="number" min={50} max={2000} value={cfg.min_width_px}
              onChange={e => setCfg(c => c ? { ...c, min_width_px: parseInt(e.target.value) || 200 } : c)}
              className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" style={inputS} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-muted)' }}>Alto mínimo (px)</label>
            <input type="number" min={50} max={2000} value={cfg.min_height_px}
              onChange={e => setCfg(c => c ? { ...c, min_height_px: parseInt(e.target.value) || 200 } : c)}
              className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" style={inputS} />
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
          Recomendado: 300×300 px para una foto carnet de buena calidad.
        </p>
      </div>

      {/* Tamaño */}
      <div className="border rounded-2xl p-5 mb-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <p className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>Tamaño máximo</p>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-muted)' }}>Peso máximo (KB)</label>
          <div className="flex items-center gap-3">
            <input type="number" min={50} max={5000} value={cfg.max_size_kb}
              onChange={e => setCfg(c => c ? { ...c, max_size_kb: parseInt(e.target.value) || 500 } : c)}
              className="w-32 border rounded-xl px-4 py-2.5 text-sm outline-none" style={inputS} />
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
              ≈ {(cfg.max_size_kb / 1024).toFixed(1)} MB
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
            Recomendado: 500 KB. No exceder 2048 KB para evitar carga lenta.
          </p>
        </div>
      </div>

      {/* Formatos */}
      <div className="border rounded-2xl p-5 mb-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <p className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>Formatos permitidos</p>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map(fmt => {
            const active = fmtList.includes(fmt)
            return (
              <button key={fmt} type="button" onClick={() => toggleFormat(fmt)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition"
                style={{
                  borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                  background:  active ? 'rgba(37,99,235,0.1)' : 'transparent',
                  color:       active ? 'var(--color-primary)' : 'var(--color-muted)',
                }}>
                {active && <Check size={13} />}
                .{fmt.toUpperCase()}
              </button>
            )
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--color-muted)' }}>
          Activos: <span className="font-mono">{cfg.allowed_formats}</span>
        </p>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Guardando...' : 'Guardar parámetros'}
      </button>
    </div>
  )
}
