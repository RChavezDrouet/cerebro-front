import React from 'react'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Modal } from '@/components/Modal'
import { ScheduleSchema, type ScheduleForm } from './scheduleSchemas'

type Turn = { id: string; name: string; type: string }

type ScheduleRow = {
  id: string
  name: string
  color: string
  entry_time: string
  exit_time: string
  meal_enabled: boolean
  meal_start: string | null
  meal_end: string | null
  crosses_midnight: boolean
  is_active: boolean
  turn_id: string
  turns?: { name: string; type: string } | null
  created_at: string

  // ✅ NUEVO
  grace_in_minutes: number
  early_out_minutes: number
  day_cutoff_time: string
}

function toHHMM(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  return s.length >= 5 ? s.slice(0, 5) : s
}

function timeLess(a: string, b: string): boolean {
  // Comparación lexicográfica funciona en HH:mm
  return a < b
}

function toInt(v: any, fallback = 0) {
  const n = Number.parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

export default function SchedulesPage() {
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [rows, setRows] = React.useState<ScheduleRow[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ScheduleRow | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  const [form, setForm] = React.useState<ScheduleForm>({
    turn_id: '00000000-0000-0000-0000-000000000000',
    name: '',
    color: '#22C55E',
    entry_time: '08:00',
    exit_time: '17:00',
    crosses_midnight: false,
    meal_enabled: true,
    meal_start: '13:00',
    meal_end: '14:00',
    is_active: true,

    // ✅ defaults recomendados
    grace_in_minutes: 10,
    early_out_minutes: 10,
    day_cutoff_time: '04:00'
  })

  const load = React.useCallback(async () => {
    const { data: turnsData } = await supabase
      .schema('attendance')
      .from('turns')
      .select('id,name,type')
      .eq('is_active', true)
      .order('name')

    setTurns((turnsData as any) ?? [])

    const { data } = await supabase
      .schema('attendance')
      .from('schedules')
      .select(
        'id,name,color,entry_time,exit_time,meal_enabled,meal_start,meal_end,crosses_midnight,is_active,turn_id,created_at,turns(name,type),grace_in_minutes,early_out_minutes,day_cutoff_time'
      )
      .order('created_at', { ascending: false })

    setRows((data as any) ?? [])
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setErr(null)
    const firstTurn = turns[0]?.id ?? '00000000-0000-0000-0000-000000000000'
    setForm({
      turn_id: firstTurn,
      name: '',
      color: '#22C55E',
      entry_time: '08:00',
      exit_time: '17:00',
      crosses_midnight: false,
      meal_enabled: true,
      meal_start: '13:00',
      meal_end: '14:00',
      is_active: true,

      grace_in_minutes: 10,
      early_out_minutes: 10,
      day_cutoff_time: '04:00'
    })
    setOpen(true)
  }

  function openEdit(r: ScheduleRow) {
    setEditing(r)
    setErr(null)
    setForm({
      turn_id: r.turn_id,
      name: r.name,
      color: r.color,
      entry_time: toHHMM(r.entry_time),
      exit_time: toHHMM(r.exit_time),
      crosses_midnight: r.crosses_midnight,
      meal_enabled: r.meal_enabled,
      meal_start: r.meal_start ? toHHMM(r.meal_start) : null,
      meal_end: r.meal_end ? toHHMM(r.meal_end) : null,
      is_active: r.is_active,

      grace_in_minutes: toInt(r.grace_in_minutes, 10),
      early_out_minutes: toInt(r.early_out_minutes, 10),
      day_cutoff_time: toHHMM(r.day_cutoff_time) || '04:00'
    })
    setOpen(true)
  }

  async function save() {
    setErr(null)

    const normalized: ScheduleForm = {
      ...form,
      entry_time: toHHMM(form.entry_time),
      exit_time: toHHMM(form.exit_time),
      meal_start: form.meal_start ? toHHMM(form.meal_start) : null,
      meal_end: form.meal_end ? toHHMM(form.meal_end) : null,
      day_cutoff_time: toHHMM(form.day_cutoff_time) || '04:00',
      grace_in_minutes: toInt(form.grace_in_minutes, 10),
      early_out_minutes: toInt(form.early_out_minutes, 10),
      crosses_midnight: false
    }

    // auto compute cross midnight
    const computedCross = timeLess(normalized.exit_time, normalized.entry_time)
    normalized.crosses_midnight = computedCross

    if (!normalized.meal_enabled) {
      normalized.meal_start = null
      normalized.meal_end = null
    }

    const parsed = ScheduleSchema.safeParse(normalized)
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? 'Formulario inválido')
      return
    }

    if (parsed.data.meal_enabled) {
      if (!parsed.data.meal_start || !parsed.data.meal_end) {
        setErr('Debes ingresar horas de comida.')
        return
      }
      if (!timeLess(parsed.data.meal_start, parsed.data.meal_end)) {
        setErr('Comida: la hora inicio debe ser menor a la hora fin.')
        return
      }
    }

    if (editing) {
      const { error } = await supabase.schema('attendance').from('schedules').update(parsed.data).eq('id', editing.id)
      if (error) {
        setErr(`No se pudo guardar: ${error.message} (${error.code})`)
        return
      }
    } else {
      const { error } = await supabase.schema('attendance').from('schedules').insert(parsed.data)
      if (error) {
        setErr(`No se pudo crear: ${error.message} (${error.code})`)
        return
      }
    }

    setOpen(false)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Horarios</h1>
          <p className="text-sm text-gray-400">
            Entrada / salida / comida (opcional). Cruce de medianoche soportado. Incluye tolerancias y corte del día.
          </p>
        </div>
        <Button onClick={openCreate}>Nuevo horario</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-300">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Turno</th>
              <th className="px-4 py-3 text-left">Entrada</th>
              <th className="px-4 py-3 text-left">Salida</th>
              <th className="px-4 py-3 text-left">Reglas</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-4 py-3 font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{(r.turns?.name ?? '—') + (r.turns?.type ? ` (${r.turns.type})` : '')}</td>
                <td className="px-4 py-3">
                  {toHHMM(r.entry_time)}
                  <div className="text-xs text-gray-400">Tolerancia: +{toInt(r.grace_in_minutes, 0)}m</div>
                </td>
                <td className="px-4 py-3">
                  {toHHMM(r.exit_time)}
                  {r.crosses_midnight ? (
                    <span className="ml-2 rounded-full bg-indigo-500/15 px-2 py-1 text-xs text-indigo-200">+1 día</span>
                  ) : null}
                  <div className="text-xs text-gray-400">Anticipada: -{toInt(r.early_out_minutes, 0)}m</div>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  <div className="text-sm">Corte: {toHHMM(r.day_cutoff_time) || '04:00'}</div>
                  <div className="text-xs text-gray-400">{r.meal_enabled ? `Comida: ${toHHMM(r.meal_start)}–${toHHMM(r.meal_end)}` : 'Sin comida'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${r.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'}`}>
                    {r.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="secondary" onClick={() => openEdit(r)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={7}>
                  Sin horarios.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={editing ? 'Editar horario' : 'Nuevo horario'} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Select label="Turno" value={form.turn_id} onChange={(e) => setForm((s) => ({ ...s, turn_id: e.target.value }))}>
            {turns.length === 0 ? <option value="">(Crea un turno primero)</option> : null}
            {turns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.type})
              </option>
            ))}
          </Select>

          <Input label="Nombre" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          <Input label="Color" type="color" value={form.color} onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Entrada" type="time" step={60} value={form.entry_time} onChange={(e) => setForm((s) => ({ ...s, entry_time: e.target.value }))} />
            <Input label="Salida" type="time" step={60} value={form.exit_time} onChange={(e) => setForm((s) => ({ ...s, exit_time: e.target.value }))} />
          </div>

          {/* ✅ NUEVO: reglas */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Tolerancia entrada (min)"
              type="number"
              value={String(form.grace_in_minutes ?? 10)}
              onChange={(e) => setForm((s) => ({ ...s, grace_in_minutes: toInt(e.target.value, 0) }))}
            />
            <Input
              label="Salida anticipada (min)"
              type="number"
              value={String(form.early_out_minutes ?? 10)}
              onChange={(e) => setForm((s) => ({ ...s, early_out_minutes: toInt(e.target.value, 0) }))}
            />
            <Input
              label="Corte del día"
              type="time"
              step={60}
              value={form.day_cutoff_time ?? '04:00'}
              onChange={(e) => setForm((s) => ({ ...s, day_cutoff_time: e.target.value }))}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
            <div className="font-semibold text-gray-200">Nota (corte del día)</div>
            <div>
              Marcaciones antes del corte (ej. 02:30 con corte 04:00) se consideran del día anterior. Recomendado: 04:00.
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.meal_enabled} onChange={(e) => setForm((s) => ({ ...s, meal_enabled: e.target.checked }))} />
            Incluye comida
          </label>

          {form.meal_enabled ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Inicio comida" type="time" step={60} value={form.meal_start ?? '13:00'} onChange={(e) => setForm((s) => ({ ...s, meal_start: e.target.value }))} />
              <Input label="Fin comida" type="time" step={60} value={form.meal_end ?? '14:00'} onChange={(e) => setForm((s) => ({ ...s, meal_end: e.target.value }))} />
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))} />
            Activo
          </label>

          {err ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm">{err}</div> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

