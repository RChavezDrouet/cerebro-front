import { useMemo, useState } from 'react'
import type { AttendanceRuleV2 } from '../types/attendance'
import { defaultAttendanceRules } from '../config/attendanceDefaults'

interface Props {
  initialValue?: AttendanceRuleV2 | null
  onSave: (data: AttendanceRuleV2) => Promise<void>
}

export function AttendanceRulesForm({ initialValue, onSave }: Props) {
  const [form, setForm] = useState<AttendanceRuleV2>(initialValue ?? defaultAttendanceRules)
  const [saving, setSaving] = useState(false)
  const canUseAI = useMemo(() => form.ai_enabled, [form.ai_enabled])

  const setField = <K extends keyof AttendanceRuleV2>(key: K, value: AttendanceRuleV2[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          await onSave(form)
        } finally {
          setSaving(false)
        }
      }}
    >
      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Timezone</span>
          <input className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.timezone} onChange={(e) => setField('timezone', e.target.value)} />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Rounding policy</span>
          <select className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.rounding_policy} onChange={(e) => setField('rounding_policy', e.target.value as AttendanceRuleV2['rounding_policy'])}>
            <option value="none">Sin redondeo</option>
            <option value="5m">5 minutos</option>
            <option value="10m">10 minutos</option>
            <option value="15m">15 minutos</option>
            <option value="nearest_schedule">Horario más cercano</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Tolerancia entrada</span>
          <input type="number" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.grace_entry_minutes} onChange={(e) => setField('grace_entry_minutes', Number(e.target.value))} />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Tolerancia salida</span>
          <input type="number" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.grace_exit_minutes} onChange={(e) => setField('grace_exit_minutes', Number(e.target.value))} />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Máximo marcaciones por día</span>
          <input type="number" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.max_punches_per_day} onChange={(e) => setField('max_punches_per_day', Number(e.target.value))} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <span>Permitir duplicados</span>
          <input type="checkbox" checked={form.allow_duplicates} onChange={(e) => setField('allow_duplicates', e.target.checked)} />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <span>Geocerca habilitada</span>
          <input type="checkbox" checked={form.geo_enabled} onChange={(e) => setField('geo_enabled', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <span>Face required</span>
          <input type="checkbox" checked={form.face_required} onChange={(e) => setField('face_required', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <span>Device required</span>
          <input type="checkbox" checked={form.device_required} onChange={(e) => setField('device_required', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <span>Permitir remoto</span>
          <input type="checkbox" checked={form.allow_remote} onChange={(e) => setField('allow_remote', e.target.checked)} />
        </label>
        {form.geo_enabled && (
          <>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Radio geocerca (m)</span>
              <input type="number" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.geo_radius_m ?? 0} onChange={(e) => setField('geo_radius_m', Number(e.target.value))} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Latitud</span>
                <input type="number" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.geo_point_lat ?? ''} onChange={(e) => setField('geo_point_lat', Number(e.target.value))} />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Longitud</span>
                <input type="number" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.geo_point_lng ?? ''} onChange={(e) => setField('geo_point_lng', Number(e.target.value))} />
              </label>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white">
          <span>IA habilitada</span>
          <input type="checkbox" checked={form.ai_enabled} onChange={(e) => setField('ai_enabled', e.target.checked)} />
        </label>
        {canUseAI && (
          <>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Proveedor IA</span>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.ai_provider ?? 'openai'} onChange={(e) => setField('ai_provider', e.target.value)}>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Modelo IA</span>
              <input className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.ai_model ?? ''} onChange={(e) => setField('ai_model', e.target.value)} />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Sensibilidad IA</span>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={form.ai_sensitivity_level} onChange={(e) => setField('ai_sensitivity_level', e.target.value as AttendanceRuleV2['ai_sensitivity_level'])}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
          </>
        )}
      </section>

      <button disabled={saving} className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </form>
  )
}
