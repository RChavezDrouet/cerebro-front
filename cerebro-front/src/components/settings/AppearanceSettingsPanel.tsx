
import React, { useEffect, useState } from 'react'
import { Palette, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { applyBranding } from '../../theme/appTheme'
import { loadAppearanceSettings, saveAppearanceSettings } from '../../services/cerebroEnhancements'

export default function AppearanceSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    primary_color: '#00e673',
    secondary_color: '#00b3ff',
    accent_color: '#7c3aed',
    button_radius: 18,
    button_style: 'gradient',
    button_text_transform: 'none',
    surface_style: 'glass',
    background_type: 'gradient',
    background_color: '#020617',
    background_image_url: '',
    background_overlay_opacity: 0.2,
  })

  const reload = async () => {
    setLoading(true)
    try {
      const data = await loadAppearanceSettings()
      setForm(data)
      applyBranding(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const onSave = async () => {
    setSaving(true)
    try {
      await saveAppearanceSettings(form)
      applyBranding(form)
      toast.success('Apariencia guardada')
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar apariencia')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Personalización visual</h2>
          <p className="text-sm text-slate-400">
            Controla colores, radios de botones, estilo de superficies y fondo general de CEREBRO.
          </p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2" onClick={onSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Cargando apariencia...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Color primario</label>
              <input className="input-field" value={form.primary_color} onChange={(e) => setForm((p: any) => ({ ...p, primary_color: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Color secundario</label>
              <input className="input-field" value={form.secondary_color} onChange={(e) => setForm((p: any) => ({ ...p, secondary_color: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Color acento</label>
              <input className="input-field" value={form.accent_color} onChange={(e) => setForm((p: any) => ({ ...p, accent_color: e.target.value }))} />
            </div>

            <div>
              <label className="input-label">Radio de botón</label>
              <input
                type="number"
                className="input-field"
                value={form.button_radius}
                onChange={(e) => setForm((p: any) => ({ ...p, button_radius: Number(e.target.value || 0) }))}
              />
            </div>
            <div>
              <label className="input-label">Estilo de botón</label>
              <select className="input-field" value={form.button_style} onChange={(e) => setForm((p: any) => ({ ...p, button_style: e.target.value }))}>
                <option value="gradient">Gradient</option>
                <option value="solid">Solid</option>
                <option value="outline">Outline</option>
                <option value="glass">Glass</option>
              </select>
            </div>
            <div>
              <label className="input-label">Transformación texto botón</label>
              <select className="input-field" value={form.button_text_transform} onChange={(e) => setForm((p: any) => ({ ...p, button_text_transform: e.target.value }))}>
                <option value="none">Normal</option>
                <option value="uppercase">Mayúsculas</option>
                <option value="capitalize">Capitalizar</option>
              </select>
            </div>

            <div>
              <label className="input-label">Estilo de panel</label>
              <select className="input-field" value={form.surface_style} onChange={(e) => setForm((p: any) => ({ ...p, surface_style: e.target.value }))}>
                <option value="glass">Glass</option>
                <option value="solid">Solid</option>
                <option value="outline">Outline</option>
              </select>
            </div>
            <div>
              <label className="input-label">Tipo de fondo</label>
              <select className="input-field" value={form.background_type} onChange={(e) => setForm((p: any) => ({ ...p, background_type: e.target.value }))}>
                <option value="gradient">Gradient</option>
                <option value="solid">Solid</option>
                <option value="image">Imagen</option>
              </select>
            </div>
            <div>
              <label className="input-label">Color base de fondo</label>
              <input className="input-field" value={form.background_color} onChange={(e) => setForm((p: any) => ({ ...p, background_color: e.target.value }))} />
            </div>
          </div>

          {form.background_type === 'image' && (
            <div>
              <label className="input-label">URL imagen de fondo</label>
              <input className="input-field" value={form.background_image_url || ''} onChange={(e) => setForm((p: any) => ({ ...p, background_image_url: e.target.value }))} placeholder="https://..." />
            </div>
          )}

          <div>
            <label className="input-label">Opacidad overlay</label>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={form.background_overlay_opacity}
              onChange={(e) => setForm((p: any) => ({ ...p, background_overlay_opacity: Number(e.target.value) }))}
              className="w-full"
            />
            <div className="mt-1 text-xs text-slate-400">{form.background_overlay_opacity}</div>
          </div>

          <div className="rounded-3xl border border-[rgba(148,163,184,0.12)] p-5 bg-[rgba(2,6,23,0.35)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Palette className="w-4 h-4" />
              Preview
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className="rounded-3xl p-5 border border-[rgba(148,163,184,0.12)]"
                style={{
                  background:
                    form.background_type === 'solid'
                      ? form.background_color
                      : form.background_type === 'image' && form.background_image_url
                        ? `linear-gradient(rgba(2,6,23,${form.background_overlay_opacity}), rgba(2,6,23,${form.background_overlay_opacity})), url(${form.background_image_url}) center/cover`
                        : `radial-gradient(circle at top left, ${form.secondary_color}55, transparent 40%), radial-gradient(circle at bottom right, ${form.accent_color}40, transparent 35%), linear-gradient(135deg, ${form.background_color}, #050b1a)`,
                }}
              >
                <div className="text-sm font-semibold text-white">Vista previa</div>
                <p className="mt-1 text-xs text-slate-300">Así se verán fondos y superficies.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-semibold"
                    style={{
                      borderRadius: `${form.button_radius}px`,
                      textTransform: form.button_text_transform,
                      background:
                        form.button_style === 'solid'
                          ? form.primary_color
                          : form.button_style === 'outline'
                            ? 'transparent'
                            : form.button_style === 'glass'
                              ? 'rgba(255,255,255,0.12)'
                              : `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
                      border: form.button_style === 'outline' ? `1px solid ${form.primary_color}` : '1px solid transparent',
                      color: form.button_style === 'outline' ? form.primary_color : '#03140d',
                    }}
                  >
                    Botón primario
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-semibold text-white border"
                    style={{ borderRadius: `${form.button_radius}px`, borderColor: 'rgba(148,163,184,0.25)', background: 'rgba(15,23,42,0.45)' }}
                  >
                    Secundario
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.45)] p-5">
                <div className="text-sm font-semibold text-slate-100">Variables configuradas</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl p-3 bg-white/5">
                    <div className="text-slate-400">Botón</div>
                    <div className="text-slate-100 mt-1">{form.button_style}</div>
                  </div>
                  <div className="rounded-2xl p-3 bg-white/5">
                    <div className="text-slate-400">Fondo</div>
                    <div className="text-slate-100 mt-1">{form.background_type}</div>
                  </div>
                  <div className="rounded-2xl p-3 bg-white/5">
                    <div className="text-slate-400">Panel</div>
                    <div className="text-slate-100 mt-1">{form.surface_style}</div>
                  </div>
                  <div className="rounded-2xl p-3 bg-white/5">
                    <div className="text-slate-400">Radio</div>
                    <div className="text-slate-100 mt-1">{form.button_radius}px</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
