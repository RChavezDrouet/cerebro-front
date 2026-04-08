/**
 * MarkingParamsPage.tsx — Base PWA v4.4.0
 *
 * Configuración de parámetros de marcación:
 *  - Tolerancia de entrada/salida general (minutos)
 *  - Tolerancia de entrada/salida de comida (minutos)
 *  - Ventana para ignorar marcaciones duplicadas
 * Tabla: attendance.marking_parameters
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, SlidersHorizontal, Info } from 'lucide-react'

interface Params {
  id: string | null
  tenant_id: string
  tolerance_entry_min: number
  tolerance_exit_min: number
  tolerance_lunch_entry_min: number
  tolerance_lunch_exit_min: number
  duplicate_window_min: number

  // Ventanas “hasta X minutos antes”
  entry_early_window_min: number
  exit_early_window_min: number
  lunch_start_early_window_min: number
  lunch_end_early_window_min: number

  // Corte por turno (cualquier marcación posterior se considera NOVEDAD)
  cutoff_diurno_time: string
  cutoff_vespertino_time: string
  cutoff_nocturno_time: string
}

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

function NumberField({
  label, hint, value, onChange, min = 0, max = 120,
}: {
  label: string; hint: string; value: number
  onChange: (v: number) => void; min?: number; max?: number
}) {
  const inputS: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)', color: 'var(--color-text)',
  }
  return (
    <div className="border rounded-xl p-4" style={{ borderColor: 'var(--color-border)' }}>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>{label}</label>
      <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>{hint}</p>
      <div className="flex items-center gap-3">
        <input type="number" min={min} max={max} value={value}
          onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
          className="w-24 border rounded-xl px-3 py-2 text-sm text-center outline-none transition"
          style={inputS} />
        <span className="text-sm" style={{ color: 'var(--color-muted)' }}>minutos</span>
        {/* Slider */}
        <input type="range" min={min} max={max} value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="flex-1 accent-blue-500 h-1 rounded-full" />
      </div>
    </div>
  )
}

function TimeField({
  label, hint, value, onChange,
}: {
  label: string; hint: string; value: string
  onChange: (v: string) => void
}) {
  const inputS: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)', color: 'var(--color-text)',
  }
  return (
    <div className="border rounded-xl p-4" style={{ borderColor: 'var(--color-border)' }}>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>{label}</label>
      <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>{hint}</p>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        style={inputS}
      />
    </div>
  )
}

export default function MarkingParamsPage() {
  const nav = useNavigate()
  const [params, setParams] = useState<Params | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init = async () => {
      const tenantId = await getTenantId()
      if (!tenantId) { setLoading(false); return }
      const { data } = await supabase.schema('attendance').from('marking_parameters')
        .select('*').eq('tenant_id', tenantId).maybeSingle()
      const defaults: Params = {
        id: null,
        tenant_id: tenantId,
        tolerance_entry_min: 5,
        tolerance_exit_min: 5,
        tolerance_lunch_entry_min: 5,
        tolerance_lunch_exit_min: 5,
        duplicate_window_min: 3,
        entry_early_window_min: 60,
        exit_early_window_min: 180,
        lunch_start_early_window_min: 30,
        lunch_end_early_window_min: 30,
        cutoff_diurno_time: '23:50',
        cutoff_vespertino_time: '08:00',
        cutoff_nocturno_time: '15:00',
      }
      setParams({ ...defaults, ...(data as any) })
      setLoading(false)
    }
    init()
  }, [])

  const set = (k: keyof Params) => (v: number) =>
    setParams(p => p ? { ...p, [k]: v } : p)

  const setText = (k: keyof Params) => (v: string) =>
    setParams(p => p ? { ...p, [k]: v } : p)

  const save = async () => {
    if (!params) return
    setSaving(true)
    const payload = { ...params }
    delete (payload as any).id
    const { error } = params.id
      ? await supabase.schema('attendance').from('marking_parameters').update(payload).eq('id', params.id)
      : await supabase.schema('attendance').from('marking_parameters').insert({ ...payload, tenant_id: params.tenant_id })
    if (error) toast.error('Error: ' + error.message)
    else toast.success('Parámetros guardados')
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )
  if (!params) return null

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('/config')} className="p-2 rounded-xl hover:opacity-70 transition"
          style={{ color: 'var(--color-muted)' }}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Parámetros de Marcación</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Define las tolerancias que aplica el sistema al interpretar las marcaciones.
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-4 mb-6 flex gap-3"
        style={{ background: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.3)' }}>
        <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          La <strong>tolerancia</strong> define el margen (minutos) <strong>DESPUÉS</strong> de la hora oficial
          para considerar “a tiempo” (evita atraso). La <strong>ventana antes</strong> define
          cuántos minutos <strong>ANTES</strong> de la hora oficial se acepta una marcación para ese evento.
          La <strong>ventana duplicada</strong> ignora marcaciones repetidas.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          <SlidersHorizontal size={14} className="inline mr-1" />
          Entrada / Salida General
        </p>

        <NumberField label="Ventana antes de Entrada" value={params.entry_early_window_min}
          onChange={set('entry_early_window_min')} max={240}
          hint="Minutos ANTES de la hora de entrada en que una marcación puede considerarse como entrada (anticipada aceptada)." />
        <NumberField label="Tolerancia de Entrada" value={params.tolerance_entry_min}
          onChange={set('tolerance_entry_min')}
          hint="Minutos DESPUÉS de la hora de entrada que aún se considera 'a tiempo' (antes de marcar atraso)." />

        <NumberField label="Ventana antes de Salida" value={params.exit_early_window_min}
          onChange={set('exit_early_window_min')} max={600}
          hint="Minutos ANTES de la hora de salida en que una marcación puede considerarse como salida (anticipada aceptada)." />
        <NumberField label="Tolerancia de Salida" value={params.tolerance_exit_min}
          onChange={set('tolerance_exit_min')}
          hint="Minutos DESPUÉS de la hora de salida que aún se considera 'a tiempo' (para cubrir retrasos al marcar salida)." />

        <p className="text-sm font-semibold pt-2" style={{ color: 'var(--color-text)' }}>
          🍽 Hora de Comida
        </p>

        <NumberField label="Ventana antes de Inicio de Comida" value={params.lunch_start_early_window_min}
          onChange={set('lunch_start_early_window_min')} max={240}
          hint="Minutos ANTES de la hora de inicio de comida para considerar 'salida a comida'." />
        <NumberField label="Tolerancia Inicio de Comida" value={params.tolerance_lunch_exit_min}
          onChange={set('tolerance_lunch_exit_min')}
          hint="Minutos DESPUÉS de la hora de inicio de comida que aún se considera 'a tiempo'." />

        <NumberField label="Ventana antes de Fin de Comida" value={params.lunch_end_early_window_min}
          onChange={set('lunch_end_early_window_min')} max={240}
          hint="Minutos ANTES de la hora de fin de comida para considerar 'regreso de comida'." />
        <NumberField label="Tolerancia Fin de Comida" value={params.tolerance_lunch_entry_min}
          onChange={set('tolerance_lunch_entry_min')}
          hint="Minutos DESPUÉS de la hora de fin de comida que aún se considera 'a tiempo' (antes de marcar atraso)." />

        <p className="text-sm font-semibold pt-2" style={{ color: 'var(--color-text)' }}>
          🔁 Duplicados
        </p>
        <NumberField label="Ventana de marcaciones duplicadas" value={params.duplicate_window_min}
          onChange={set('duplicate_window_min')} max={30}
          hint="Si hay 2 marcaciones del mismo empleado en este rango de minutos, la segunda se ignora automáticamente." />
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal size={16} style={{ color: 'var(--color-primary)' }} />
          <div className="font-semibold" style={{ color: 'var(--color-text)' }}>Cortes por turno</div>
          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}>
            fuera de corte =&gt; NOVEDAD
          </span>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
          Reglas: Diurno corta el mismo día; Vespertino/Nocturno cortan al día siguiente. Cualquier marcación posterior se registra como novedad.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TimeField
            label="Corte Diurno"
            hint="Hora límite del mismo día (default: 23:50)."
            value={params.cutoff_diurno_time}
            onChange={setText('cutoff_diurno_time')}
          />
          <TimeField
            label="Corte Vespertino"
            hint="Hora límite del día siguiente (default: 08:00)."
            value={params.cutoff_vespertino_time}
            onChange={setText('cutoff_vespertino_time')}
          />
          <TimeField
            label="Corte Nocturno"
            hint="Hora límite del día siguiente (default: 15:00)."
            value={params.cutoff_nocturno_time}
            onChange={setText('cutoff_nocturno_time')}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Guardando...' : 'Guardar parámetros'}
        </button>
      </div>
    </div>
  )
}