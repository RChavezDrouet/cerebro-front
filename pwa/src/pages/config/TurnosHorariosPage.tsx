/**
 * TurnosHorariosPage.tsx — Base PWA v4.7.2
 *
 * Adaptado a estructura REAL de la BD:
 *
 * attendance.turns:
 *   id, tenant_id, name, type(enum: diurno|vespertino|nocturno),
 *   color, days(int[]), is_active, code, start_time, end_time
 *
 * attendance.schedules:
 *   id, tenant_id, turn_id, name, color, entry_time, exit_time,
 *   crosses_midnight, meal_enabled, meal_start, meal_end, is_active,
 *   grace_in_minutes, early_out_minutes, day_cutoff_time,
 *   entry_grace_minutes, exit_early_grace_minutes, workday_cutoff_time,
 *   meal_grace_minutes
 */
import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Clock, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  Loader2, Sun, Sunset, Moon, Calendar, Save, X
} from 'lucide-react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type TurnType = 'diurno' | 'vespertino' | 'nocturno'

type Turn = {
  id: string
  name: string
  type: TurnType
  color: string
  days: number[]
  is_active: boolean
  code: string | null
  start_time: string | null
  end_time: string | null
}

type Schedule = {
  id: string
  turn_id: string
  name: string
  color: string
  entry_time: string
  exit_time: string
  crosses_midnight: boolean
  meal_enabled: boolean
  meal_start: string | null
  meal_end: string | null
  is_active: boolean
  grace_in_minutes: number
  early_out_minutes: number
  entry_grace_minutes: number
  exit_early_grace_minutes: number
  meal_grace_minutes: number
  day_cutoff_time: string
  workday_cutoff_time: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TURN_TYPES = [
  { value: 'diurno'     as TurnType, label: 'Diurno',     Icon: Sun,    hint: '06:00–14:00', color: '#F59E0B' },
  { value: 'vespertino' as TurnType, label: 'Vespertino', Icon: Sunset, hint: '14:00–22:00', color: '#F97316' },
  { value: 'nocturno'   as TurnType, label: 'Nocturno',   Icon: Moon,   hint: '22:00–06:00', color: '#6366F1' },
]

const PALETTE = [
  '#3B82F6','#10B981','#F59E0B','#EF4444',
  '#8B5CF6','#EC4899','#06B6D4','#F97316',
  '#84CC16','#6366F1','#14B8A6','#E11D48',
]

const DAYS_MAP = [
  { n: 1, s: 'L' }, { n: 2, s: 'M' }, { n: 3, s: 'X' }, { n: 4, s: 'J' },
  { n: 5, s: 'V' }, { n: 6, s: 'S' }, { n: 0, s: 'D' },
]

// ─── Utils ────────────────────────────────────────────────────────────────────
const alpha = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}
const isLight = (hex: string) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return (r*299+g*587+b*114)/1000 > 128
}

// ─── Micro-components ─────────────────────────────────────────────────────────
const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between">
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>
        {label}
      </label>
      {hint && <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{hint}</span>}
    </div>
    {children}
  </div>
)

const TInput = ({ value, onChange, type = 'text', placeholder = '' }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) => (
  <input type={type} value={value} placeholder={placeholder}
    onChange={e => onChange(e.target.value)}
    className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none transition"
    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
)

const NInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="relative">
    <input type="number" value={value} min={0} max={120}
      onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      className="w-full rounded-xl px-3 py-2.5 pr-10 text-sm border outline-none transition"
      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
      style={{ color: 'var(--color-muted)' }}>min</span>
  </div>
)

const Toggle = ({ value, onChange, color = '#10B981' }: {
  value: boolean; onChange: (v: boolean) => void; color?: string
}) => (
  <button type="button" onClick={() => onChange(!value)}
    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200"
    style={{ background: value ? color : 'rgba(255,255,255,0.12)' }}>
    <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
      style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }} />
  </button>
)

const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
  <div className="flex flex-wrap gap-2 items-center">
    {PALETTE.map(c => (
      <button key={c} type="button" onClick={() => onChange(c)}
        className="w-7 h-7 rounded-full transition-all"
        style={{
          background: c,
          outline: value === c ? `3px solid ${c}` : '3px solid transparent',
          outlineOffset: '2px',
          transform: value === c ? 'scale(1.2)' : 'scale(1)',
        }} />
    ))}
    <label className="w-7 h-7 rounded-full cursor-pointer flex items-center justify-center relative border"
      style={{ borderColor: 'var(--color-border)', background: 'rgba(255,255,255,0.06)' }}>
      <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>+</span>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer" />
    </label>
  </div>
)

const DaySelector = ({ value, onChange, color }: { value: number[]; onChange: (d: number[]) => void; color: string }) => {
  const toggle = (n: number) => onChange(value.includes(n) ? value.filter(d => d !== n) : [...value, n])
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DAYS_MAP.map(({ n, s }) => (
        <button key={n} type="button" onClick={() => toggle(n)}
          className="w-9 h-9 rounded-xl text-xs font-bold transition-all"
          style={{
            background: value.includes(n) ? alpha(color, 0.22) : 'rgba(255,255,255,0.04)',
            color: value.includes(n) ? color : 'var(--color-muted)',
            border: `1.5px solid ${value.includes(n) ? color : 'var(--color-border)'}`,
          }}>
          {s}
        </button>
      ))}
    </div>
  )
}

// ─── Turn Modal ───────────────────────────────────────────────────────────────
function TurnModal({ turn, onSave, onClose, saving }: {
  turn: Partial<Turn> & { _isNew?: boolean }
  onSave: (d: Omit<Turn,'id'>) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<Omit<Turn,'id'>>({
    name: turn.name ?? '',
    type: turn.type ?? 'diurno',
    color: turn.color ?? '#F59E0B',
    days: turn.days ?? [1,2,3,4,5],
    is_active: turn.is_active ?? true,
    code: turn.code ?? null,
    start_time: turn.start_time ?? null,
    end_time: turn.end_time ?? null,
  })
  const s = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))
  const TI = TURN_TYPES.find(t => t.value === form.type)!

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--color-surface)', border: `1px solid ${alpha(form.color, 0.35)}` }}>

        <div className="px-6 pt-6 pb-5"
          style={{ background: `linear-gradient(145deg, ${alpha(form.color, 0.14)}, transparent)` }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: alpha(form.color, 0.2) }}>
                <TI.Icon size={20} style={{ color: form.color }} />
              </div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                {turn._isNew ? 'Nuevo Turno' : 'Editar Turno'}
              </h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-60 transition">
              <X size={18} style={{ color: 'var(--color-muted)' }} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre">
                <TInput value={form.name} onChange={v => s('name', v)} placeholder="Ej: Turno A" />
              </Field>
              <Field label="Código" hint="opcional">
                <TInput value={form.code ?? ''} onChange={v => s('code', v || null)} placeholder="Ej: T-A" />
              </Field>
            </div>

            <Field label="Tipo">
              <div className="grid grid-cols-3 gap-2">
                {TURN_TYPES.map(({ value, label, Icon, hint }) => (
                  <button key={value} type="button"
                    onClick={() => { s('type', value); s('color', TURN_TYPES.find(t => t.value === value)!.color) }}
                    className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border transition"
                    style={{
                      background: form.type === value ? alpha(form.color, 0.12) : 'rgba(255,255,255,0.03)',
                      borderColor: form.type === value ? form.color : 'var(--color-border)',
                    }}>
                    <Icon size={16} style={{ color: form.type === value ? form.color : 'var(--color-muted)' }} />
                    <span className="text-[11px] font-bold"
                      style={{ color: form.type === value ? form.color : 'var(--color-text)' }}>
                      {label}
                    </span>
                    <span className="text-[9px] opacity-60" style={{ color: 'var(--color-muted)' }}>{hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Color">
              <ColorPicker value={form.color} onChange={c => s('color', c)} />
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: alpha(form.color, 0.18), border: `1px solid ${alpha(form.color,0.35)}`, color: form.color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: form.color }} />
                {form.name || 'Vista previa'}
              </div>
            </Field>

            <Field label="Días de aplicación">
              <DaySelector value={form.days} onChange={v => s('days', v)} color={form.color} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora inicio" hint="referencial">
                <TInput type="time" value={form.start_time ?? ''} onChange={v => s('start_time', v || null)} />
              </Field>
              <Field label="Hora fin" hint="referencial">
                <TInput type="time" value={form.end_time ?? ''} onChange={v => s('end_time', v || null)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm border font-medium transition"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            Cancelar
          </button>
          <button onClick={() => onSave(form)}
            disabled={saving || form.name.trim().length < 2 || form.days.length === 0}
            className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-40"
            style={{ background: form.color, color: isLight(form.color) ? '#000' : '#fff' }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar turno
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({ sched, turnColor, turnName, onSave, onClose, saving }: {
  sched: Partial<Schedule> & { _isNew?: boolean; turn_id: string }
  turnColor: string; turnName: string
  onSave: (d: Omit<Schedule,'id'>) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<Omit<Schedule,'id'>>({
    turn_id: sched.turn_id,
    name: sched.name ?? '',
    color: sched.color ?? turnColor,
    entry_time: sched.entry_time ?? '08:00',
    exit_time: sched.exit_time ?? '17:00',
    crosses_midnight: sched.crosses_midnight ?? false,
    meal_enabled: sched.meal_enabled ?? false,
    meal_start: sched.meal_start ?? null,
    meal_end: sched.meal_end ?? null,
    is_active: sched.is_active ?? true,
    grace_in_minutes: sched.grace_in_minutes ?? 10,
    early_out_minutes: sched.early_out_minutes ?? 10,
    entry_grace_minutes: sched.entry_grace_minutes ?? 0,
    exit_early_grace_minutes: sched.exit_early_grace_minutes ?? 0,
    meal_grace_minutes: sched.meal_grace_minutes ?? 0,
    day_cutoff_time: sched.day_cutoff_time ?? '04:00',
    workday_cutoff_time: sched.workday_cutoff_time ?? '09:00',
  })
  const f = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }))

  const toggleMeal = () => {
    if (form.meal_enabled) { f('meal_enabled', false); f('meal_start', null); f('meal_end', null) }
    else { f('meal_enabled', true); f('meal_start', '12:00'); f('meal_end', '13:00') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl animate-slide-up flex flex-col"
        style={{
          background: 'var(--color-surface)',
          border: `1px solid ${alpha(turnColor, 0.35)}`,
          maxHeight: '92vh',
        }}>

        <div className="px-6 py-5 flex-shrink-0"
          style={{ background: `linear-gradient(145deg, ${alpha(turnColor, 0.14)}, var(--color-surface))` }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                {sched._isNew ? 'Nuevo Horario' : 'Editar Horario'}
              </h3>
              <p className="text-xs mt-0.5 font-medium" style={{ color: turnColor }}>
                Turno: {turnName}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-60 transition">
              <X size={18} style={{ color: 'var(--color-muted)' }} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del horario">
              <TInput value={form.name} onChange={v => f('name', v)} placeholder="Ej: Horario estándar" />
            </Field>
            <Field label="Color">
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => f('color', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border"
                  style={{ borderColor: 'var(--color-border)', background: 'transparent' }} />
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{form.color}</span>
              </div>
            </Field>
          </div>

          {/* Jornada */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                Jornada laboral
              </p>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-muted)' }}>
                Cruza medianoche
                <Toggle value={form.crosses_midnight} onChange={v => f('crosses_midnight', v)} color={turnColor} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora de entrada">
                <TInput type="time" value={form.entry_time} onChange={v => f('entry_time', v)} />
              </Field>
              <Field label="Hora de salida">
                <TInput type="time" value={form.exit_time} onChange={v => f('exit_time', v)} />
              </Field>
            </div>
          </div>

          {/* Almuerzo */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                Control de almuerzo
              </p>
              <Toggle value={form.meal_enabled} onChange={toggleMeal} color={turnColor} />
            </div>
            {form.meal_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Salida a comer">
                  <TInput type="time" value={form.meal_start ?? '12:00'} onChange={v => f('meal_start', v)} />
                </Field>
                <Field label="Regreso de comer">
                  <TInput type="time" value={form.meal_end ?? '13:00'} onChange={v => f('meal_end', v)} />
                </Field>
                <Field label="Tolerancia almuerzo">
                  <NInput value={form.meal_grace_minutes} onChange={v => f('meal_grace_minutes', v)} />
                </Field>
              </div>
            )}
          </div>

          {/* Tolerancias */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
              Tolerancias
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gracia entrada">
                <NInput value={form.grace_in_minutes} onChange={v => f('grace_in_minutes', v)} />
              </Field>
              <Field label="Gracia salida anticipada">
                <NInput value={form.early_out_minutes} onChange={v => f('early_out_minutes', v)} />
              </Field>
              <Field label="Gracia entrada extra">
                <NInput value={form.entry_grace_minutes} onChange={v => f('entry_grace_minutes', v)} />
              </Field>
              <Field label="Gracia salida extra">
                <NInput value={form.exit_early_grace_minutes} onChange={v => f('exit_early_grace_minutes', v)} />
              </Field>
            </div>
          </div>

          {/* Cortes de día */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
              Cortes de día
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Corte de día" hint="para turno nocturno">
                <TInput type="time" value={form.day_cutoff_time} onChange={v => f('day_cutoff_time', v)} />
              </Field>
              <Field label="Corte jornada laboral">
                <TInput type="time" value={form.workday_cutoff_time} onChange={v => f('workday_cutoff_time', v)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm border font-medium transition"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            Cancelar
          </button>
          <button onClick={() => onSave(form)}
            disabled={saving || form.name.trim().length < 2}
            className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-40"
            style={{ background: turnColor, color: isLight(turnColor) ? '#000' : '#fff' }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar horario
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TurnosHorariosPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId
  const qc = useQueryClient()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [turnModal, setTurnModal] = useState<null | (Partial<Turn> & { _isNew?: boolean })>(null)
  const [schedModal, setSchedModal] = useState<null | (Partial<Schedule> & { _isNew?: boolean; turn_id: string; _tc: string; _tn: string })>(null)

  const turnsQ = useQuery({
    queryKey: ['turns', tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.schema(ATT_SCHEMA).from('turns')
        .select('*').eq('tenant_id', tenantId!).order('created_at')
      if (error) throw error; return (data ?? []) as Turn[]
    },
  })

  const schedsQ = useQuery({
    queryKey: ['schedules', tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.schema(ATT_SCHEMA).from('schedules')
        .select('*').eq('tenant_id', tenantId!).order('name')
      if (error) throw error; return (data ?? []) as Schedule[]
    },
  })

  const saveTurnM = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Omit<Turn,'id'> }) => {
      if (id) {
        const { error } = await supabase.schema(ATT_SCHEMA).from('turns')
          .update({ ...data }).eq('id', id).eq('tenant_id', tenantId!)
        if (error) throw error
      } else {
        const { error } = await supabase.schema(ATT_SCHEMA).from('turns')
          .insert({ ...data, tenant_id: tenantId! })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['turns'] }); setTurnModal(null); toast.success('Turno guardado') },
    onError: (e: any) => toast.error(e.message ?? 'Error'),
  })

  const deleteTurnM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.schema(ATT_SCHEMA).from('turns')
        .delete().eq('id', id).eq('tenant_id', tenantId!)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['turns','schedules'] }); toast.success('Eliminado') },
    onError: (e: any) => toast.error(e.message ?? 'Error'),
  })

  const saveSchedM = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Omit<Schedule,'id'> }) => {
      if (id) {
        const { error } = await supabase.schema(ATT_SCHEMA).from('schedules')
          .update({ ...data }).eq('id', id).eq('tenant_id', tenantId!)
        if (error) throw error
      } else {
        const { error } = await supabase.schema(ATT_SCHEMA).from('schedules')
          .insert({ ...data, tenant_id: tenantId! })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); setSchedModal(null); toast.success('Horario guardado') },
    onError: (e: any) => toast.error(e.message ?? 'Error'),
  })

  const deleteSchedM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.schema(ATT_SCHEMA).from('schedules')
        .delete().eq('id', id).eq('tenant_id', tenantId!)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Eliminado') },
    onError: (e: any) => toast.error(e.message ?? 'Error'),
  })

  const toggle = useCallback((id: string) =>
    setExpanded(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s }), [])

  const turns = turnsQ.data ?? []
  const schedsFor = (tid: string) => (schedsQ.data ?? []).filter(s => s.turn_id === tid)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Turnos y Horarios</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            Configura los turnos de trabajo y sus horarios detallados.
          </p>
        </div>
        <button onClick={() => setTurnModal({ _isNew: true })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 shadow-lg"
          style={{ background: 'var(--color-primary)', color: 'white' }}>
          <Plus size={16} /> Nuevo turno
        </button>
      </div>

      {(turnsQ.isLoading || schedsQ.isLoading) && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      )}

      {turns.length === 0 && !turnsQ.isLoading && (
        <div className="rounded-2xl p-16 text-center"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Clock size={32} style={{ color: 'var(--color-muted)' }} />
          </div>
          <p className="font-bold" style={{ color: 'var(--color-text)' }}>Sin turnos configurados</p>
          <p className="text-sm mt-1 mb-5" style={{ color: 'var(--color-muted)' }}>
            Crea el primer turno para comenzar a definir horarios.
          </p>
          <button onClick={() => setTurnModal({ _isNew: true })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: 'white' }}>
            <Plus size={15} /> Crear primer turno
          </button>
        </div>
      )}

      <div className="space-y-3">
        {turns.map(turn => {
          const scheds = schedsFor(turn.id)
          const open = expanded.has(turn.id)
          const TI = TURN_TYPES.find(t => t.value === turn.type) ?? TURN_TYPES[0]

          return (
            <div key={turn.id} className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                border: `1px solid ${alpha(turn.color, open ? 0.4 : 0.18)}`,
                background: open ? alpha(turn.color, 0.04) : 'var(--color-surface)',
              }}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <button onClick={() => toggle(turn.id)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: alpha(turn.color, 0.18) }}>
                    <TI.Icon size={18} style={{ color: turn.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{turn.name}</span>
                      {turn.code && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>
                          {turn.code}
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: alpha(turn.color, 0.18), color: turn.color }}>
                        {TI.label}
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: turn.color, boxShadow: `0 0 6px ${alpha(turn.color, 0.7)}` }} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        {scheds.length} horario{scheds.length !== 1 ? 's' : ''}
                      </p>
                      {turn.days?.length > 0 && (
                        <div className="flex gap-0.5">
                          {DAYS_MAP.map(({ n, s }) => (
                            <span key={n} className="text-[9px] w-4 h-4 rounded flex items-center justify-center font-bold"
                              style={{
                                background: turn.days?.includes(n) ? alpha(turn.color, 0.2) : 'rgba(255,255,255,0.04)',
                                color: turn.days?.includes(n) ? turn.color : 'rgba(255,255,255,0.15)',
                              }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {open ? <ChevronDown size={15} style={{ color: 'var(--color-muted)' }} />
                        : <ChevronRight size={15} style={{ color: 'var(--color-muted)' }} />}
                </button>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setTurnModal({ ...turn })}
                    className="p-2 rounded-lg hover:opacity-70 transition">
                    <Edit2 size={14} style={{ color: 'var(--color-muted)' }} />
                  </button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${turn.name}" y sus horarios?`)) deleteTurnM.mutate(turn.id) }}
                    className="p-2 rounded-lg hover:opacity-70 transition">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                  <button
                    onClick={() => {
                      setExpanded(p => new Set([...p, turn.id]))
                      setSchedModal({ _isNew: true, turn_id: turn.id, _tc: turn.color, _tn: turn.name })
                    }}
                    className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-80"
                    style={{ background: alpha(turn.color, 0.18), color: turn.color }}>
                    <Plus size={12} /> Horario
                  </button>
                </div>
              </div>

              {open && (
                <div className="px-4 pb-4 pt-3 space-y-2"
                  style={{ borderTop: `1px solid ${alpha(turn.color, 0.15)}` }}>
                  {scheds.length === 0 && (
                    <p className="text-sm text-center py-3" style={{ color: 'var(--color-muted)' }}>
                      Sin horarios. Usa "+ Horario" para agregar uno.
                    </p>
                  )}
                  {scheds.map(sc => (
                    <div key={sc.id}
                      className="flex items-start gap-3 rounded-xl px-4 py-3 group transition hover:bg-white/[0.02]"
                      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--color-border)' }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                        style={{ background: sc.color, boxShadow: `0 0 6px ${alpha(sc.color, 0.6)}` }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                            {sc.name}
                          </span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--color-text)' }}>
                            {sc.entry_time} → {sc.exit_time}
                            {sc.crosses_midnight && ' +1d'}
                          </span>
                          {sc.meal_enabled && (
                            <span className="text-xs px-2 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-muted)' }}>
                              🍽 {sc.meal_start}–{sc.meal_end}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                          <span>±{sc.grace_in_minutes}′ entrada</span>
                          <span>·</span>
                          <span>±{sc.early_out_minutes}′ salida</span>
                          {sc.meal_enabled && <><span>·</span><span>±{sc.meal_grace_minutes}′ almuerzo</span></>}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setSchedModal({ ...sc, _tc: turn.color, _tn: turn.name })}
                          className="p-1.5 rounded-lg hover:opacity-70">
                          <Edit2 size={13} style={{ color: 'var(--color-muted)' }} />
                        </button>
                        <button onClick={() => { if (confirm(`¿Eliminar "${sc.name}"?`)) deleteSchedM.mutate(sc.id) }}
                          className="p-1.5 rounded-lg hover:opacity-70">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {turnModal && (
        <TurnModal turn={turnModal}
          onSave={data => saveTurnM.mutate({ id: turnModal.id, data })}
          onClose={() => setTurnModal(null)} saving={saveTurnM.isPending} />
      )}
      {schedModal && (
        <ScheduleModal sched={schedModal} turnColor={schedModal._tc} turnName={schedModal._tn}
          onSave={data => saveSchedM.mutate({ id: schedModal.id, data })}
          onClose={() => setSchedModal(null)} saving={saveSchedM.isPending} />
      )}
    </div>
  )
}
