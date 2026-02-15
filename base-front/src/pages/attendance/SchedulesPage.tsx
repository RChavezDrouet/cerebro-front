import React from 'react'
import { supabase } from '@/config/supabase'
import { resolveTenantId } from '@/lib/tenant'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Modal } from '@/components/Modal'
import { ScheduleSchema, type ScheduleForm } from './scheduleSchemas'

type ScheduleRow = {
  id: string
  tenant_id?: string
  name: string
  turn_id: string
  entry_time: any
  exit_time: any
  tolerance_minutes: any
  early_exit_minutes: any
  is_active: any
  created_at: string
}

type TurnOption = {
  id: string
  name: string
}

function toHHMM(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.length >= 5) return s.slice(0, 5)
  return ''
}

function toIntSafe(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// true si exit < entry (ej. 22:00 -> 06:00)
function crossesMidnight(entryHHMM: string, exitHHMM: string): boolean {
  const [eh, em] = entryHHMM.split(':').map(Number)
  const [xh, xm] = exitHHMM.split(':').map(Number)
  if (![eh, em, xh, xm].every((n) => Number.isFinite(n))) return false
  const entryMin = eh * 60 + em
  const exitMin = xh * 60 + xm
  return exitMin < entryMin
}

function buildCandidateForSchema(form: ScheduleForm): any {
  const entry = toHHMM((form as any).entry_time) || '08:00'
  const exit = toHHMM((form as any).exit_time) || '17:00'

  const tolerance = toIntSafe((form as any).tolerance_minutes, 0)
  const earlyExit = toIntSafe((form as any).early_exit_minutes, 0)

  const base: any = {
    ...form,
    entry_time: entry,
    exit_time: exit,
    tolerance_minutes: tolerance,
    early_exit_minutes: earlyExit,
    is_active: Boolean((form as any).is_active),
  }

  // ✅ Campo requerido por tu schema:
  base.crosses_midnight =
    (form as any).crosses_midnight ?? crossesMidnight(entry, exit)

  // Aliases comunes (por compatibilidad con schema moderno)
  base.grace_in_minutes = (form as any).grace_in_minutes ?? tolerance
  base.early_out_minutes = (form as any).early_out_minutes ?? earlyExit

  // Defaults típicos de campos “nuevos”
  base.day_cutoff_time = (form as any).day_cutoff_time ?? '23:59'
  base.color = (form as any).color ?? '#3b82f6'
  base.meal_enabled = (form as any).meal_enabled ?? false
  base.meal_start_time = (form as any).meal_start_time ?? '12:00'
  base.meal_end_time = (form as any).meal_end_time ?? '13:00'

  return base
}

export default function SchedulesPage() {
  const [rows, setRows] = React.useState<ScheduleRow[]>([])
  const [turns, setTurns] = React.useState<TurnOption[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ScheduleRow | null>(null)

  const [form, setForm] = React.useState<ScheduleForm>({
    name: '',
    turn_id: '',
    entry_time: '08:00',
    exit_time: '17:00',
    tolerance_minutes: 10,
    early_exit_minutes: 10,
    is_active: true
  } as any)

  const [err, setErr] = React.useState<string | null>(null)
  const tenantIdRef = React.useRef<string | null>(null)

  async function getTenantId(): Promise<string> {
    if (tenantIdRef.current) return tenantIdRef.current

    const { data: s, error: sErr } = await supabase.auth.getSession()
    const userId = s?.session?.user?.id
    if (sErr || !userId) throw new Error('No hay sesión activa.')

    const tenantId = await resolveTenantId(userId)
    if (!tenantId) throw new Error(`tenant_id no resuelto para user_id=${userId}`)

    tenantIdRef.current = tenantId
    return tenantId
  }

  async function loadSchedules() {
    const { data, error } = await supabase
      .schema('attendance')
      .from('schedules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return

    const normalized = ((data as any[]) ?? []).map((r) => ({
      ...r,
      entry_time: toHHMM(r.entry_time),
      exit_time: toHHMM(r.exit_time),
      tolerance_minutes: toIntSafe(r.tolerance_minutes, 0),
      early_exit_minutes: toIntSafe(r.early_exit_minutes, 0),
      is_active: Boolean(r.is_active),
    }))

    setRows(normalized as any)
  }

  async function loadTurns() {
    const { data, error } = await supabase
      .schema('attendance')
      .from('turns')
      .select('id,name')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (!error) setTurns((data as any) ?? [])
  }

  React.useEffect(() => {
    void loadSchedules()
    void loadTurns()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({
      name: '',
      turn_id: '',
      entry_time: '08:00',
      exit_time: '17:00',
      tolerance_minutes: 10,
      early_exit_minutes: 10,
      is_active: true
    } as any)
    setErr(null)
    setOpen(true)
  }

  function openEdit(r: ScheduleRow) {
    setEditing(r)

    const entry = toHHMM(r.entry_time) || '08:00'
    const exit = toHHMM(r.exit_time) || '17:00'

    setForm({
      name: r.name ?? '',
      turn_id: r.turn_id ?? '',
      entry_time: entry,
      exit_time: exit,
      tolerance_minutes: toIntSafe(r.tolerance_minutes, 0),
      early_exit_minutes: toIntSafe(r.early_exit_minutes, 0),
      is_active: Boolean(r.is_active),
      // opcional, pero ayuda si ya viene en DB en algún registro
      crosses_midnight: (r as any).crosses_midnight ?? crossesMidnight(entry, exit),
    } as any)

    setErr(null)
    setOpen(true)
  }

  async function save() {
    setErr(null)

    const candidate = buildCandidateForSchema(form)
    console.log('SUBMIT values =>', candidate)

    const parsed = ScheduleSchema.safeParse(candidate)
    if (!parsed.success) {
      console.table(
        parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
          code: i.code,
          received: (i as any).received
        }))
      )
      setErr(parsed.error.issues[0]?.message ?? 'Formulario inválido')
      return
    }

    try {
      const tenantId = await getTenantId()

      if (editing) {
        const { error } = await supabase
          .schema('attendance')
          .from('schedules')
          .update(parsed.data as any)
          .eq('id', editing.id)
          .eq('tenant_id', tenantId)

        if (error) throw error
      } else {
        const payload = { ...(parsed.data as any), tenant_id: tenantId }

        const { error } = await supabase
          .schema('attendance')
          .from('schedules')
          .insert(payload)

        if (error) throw error
      }

      setOpen(false)
      await loadSchedules()
    } catch (e: any) {
      console.error('Schedules save error:', e)
      setErr(e?.message ?? 'No se pudo completar la operación.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Horarios</h1>
          <p className="text-sm text-gray-400">
            Entrada / salida / comida (opcional). Cruce de medianoche soportado.
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
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const turnName = turns.find((t) => t.id === r.turn_id)?.name ?? '—'
              return (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 text-gray-300">{turnName}</td>
                  <td className="px-4 py-3">{toHHMM(r.entry_time) || '—'}</td>
                  <td className="px-4 py-3">{toHHMM(r.exit_time) || '—'}</td>
                  <td className="px-4 py-3">
                    {r.is_active ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">Activo</span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-gray-300">Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => openEdit(r)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              )
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Sin horarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={editing ? 'Editar horario' : 'Nuevo horario'} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={(form as any).name ?? ''}
            onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))}
          />

          <Select
            label="Turno"
            value={(form as any).turn_id ?? ''}
            onChange={(e) => setForm((s: any) => ({ ...s, turn_id: e.target.value }))}
          >
            <option value="">Seleccione turno</option>
            {turns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>

          <Input
            label="Entrada"
            type="time"
            value={(form as any).entry_time ?? ''}
            onChange={(e) => setForm((s: any) => ({ ...s, entry_time: e.target.value }))}
          />

          <Input
            label="Salida"
            type="time"
            value={(form as any).exit_time ?? ''}
            onChange={(e) => setForm((s: any) => ({ ...s, exit_time: e.target.value }))}
          />

          <Input
            label="Tolerancia (min)"
            type="number"
            value={String((form as any).tolerance_minutes ?? 0)}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, tolerance_minutes: e.target.value === '' ? 0 : Number(e.target.value) }))
            }
          />

          <Input
            label="Salida anticipada (min)"
            type="number"
            value={String((form as any).early_exit_minutes ?? 0)}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, early_exit_minutes: e.target.value === '' ? 0 : Number(e.target.value) }))
            }
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean((form as any).is_active)}
              onChange={(e) => setForm((s: any) => ({ ...s, is_active: e.target.checked }))}
            />
            Activo
          </label>

          {err && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm">
              {err}
            </div>
          )}

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

