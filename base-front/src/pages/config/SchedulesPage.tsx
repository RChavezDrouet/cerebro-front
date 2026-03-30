import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { Plus, Edit3, X, CalendarClock, UtensilsCrossed, Clock, Moon } from 'lucide-react'
import { useTenantContext } from '@/hooks/useTenantContext'
import { useAuth } from '@/contexts/AuthContext'
import type { TurnRow } from '@/pages/config/TurnsPage'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ScheduleRow = {
  id: string
  tenant_id: string
  turn_id: string
  name: string
  color: string
  entry_time: string                   // HH:MM  entrada al trabajo
  exit_time: string                    // HH:MM  salida del trabajo
  crosses_midnight: boolean
  meal_enabled: boolean
  meal_start?: string | null           // HH:MM  sale a comer
  meal_end?: string | null             // HH:MM  regresa de comer
  meal_grace_minutes?: number | null   // tolerancia llegada de comida
  is_active: boolean
  entry_grace_minutes: number          // tolerancia entrada trabajo
  exit_early_grace_minutes: number     // tolerancia salida anticipada
  grace_in_minutes: number             // legacy — igual que entry_grace_minutes
  early_out_minutes: number            // legacy — igual que exit_early_grace_minutes
  day_cutoff_time: string              // legacy corte jornada
  workday_cutoff_time: string          // corte jornada
  created_at?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#0f172a']
const DEFAULT_CUTOFF = '00:00'

// ─── Supabase ─────────────────────────────────────────────────────────────────

async function listSchedules(tenantId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .schema('attendance')
    .from('schedules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) throw error
  return (data ?? []) as ScheduleRow[]
}

async function listTurns(tenantId: string): Promise<TurnRow[]> {
  const { data, error } = await supabase
    .schema('attendance')
    .from('turns')
    .select('id, name, color, type, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as TurnRow[]
}

async function upsertSchedule(
  tenantId: string,
  payload: Partial<ScheduleRow> & { id?: string },
): Promise<void> {
  const entryGrace = Number(payload.entry_grace_minutes ?? 0)
  const exitGrace  = Number(payload.exit_early_grace_minutes ?? 0)
  const mealGrace  = Number(payload.meal_grace_minutes ?? 0)
  const cutoff     = payload.workday_cutoff_time || DEFAULT_CUTOFF

  const base: Record<string, unknown> = {
    tenant_id:                tenantId,
    turn_id:                  payload.turn_id,
    name:                     payload.name?.trim(),
    color:                    payload.color || '#2563eb',
    entry_time:               payload.entry_time,
    exit_time:                payload.exit_time,
    crosses_midnight:         payload.crosses_midnight ?? false,
    meal_enabled:             payload.meal_enabled ?? false,
    meal_start:               payload.meal_enabled ? (payload.meal_start || null) : null,
    meal_end:                 payload.meal_enabled ? (payload.meal_end   || null) : null,
    // La columna meal_grace_minutes es NOT NULL en la BD.
    // Cuando no hay almuerzo configurado, enviamos 0 en lugar de null.
    meal_grace_minutes:       payload.meal_enabled ? mealGrace : 0,
    is_active:                payload.is_active ?? true,
    // columnas duplicadas legacy — mantenemos sincronizadas
    grace_in_minutes:         entryGrace,
    entry_grace_minutes:      entryGrace,
    early_out_minutes:        exitGrace,
    exit_early_grace_minutes: exitGrace,
    day_cutoff_time:          cutoff,
    workday_cutoff_time:      cutoff,
  }

  if (payload.id) {
    const { error } = await supabase.schema('attendance').from('schedules').update(base).eq('id', payload.id)
    if (error) throw error
    return
  }
  const { error } = await supabase.schema('attendance').from('schedules').insert(base)
  if (error) throw error
}

async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.schema('attendance').from('schedules').delete().eq('id', id)
  if (error) throw error
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PALETTE.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onChange(c)}
          className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            background:  c,
            borderColor: value === c ? 'white' : 'transparent',
            boxShadow:   value === c ? `0 0 0 2px ${c}` : 'none',
          }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 p-0.5 border rounded-lg cursor-pointer"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      />
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs mt-1 opacity-70" style={{ color: 'var(--color-muted)' }}>{hint}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs font-bold uppercase tracking-wider pt-1 pb-2 border-b"
      style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
    >
      {children}
    </div>
  )
}

const inputCls   = 'w-full border rounded-xl px-3 py-2.5 outline-none text-sm'
const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }

// ─── Modal ────────────────────────────────────────────────────────────────────

function ScheduleModal({
  initial, turns, onClose, onSave, saving,
}: {
  initial:  ScheduleRow | null
  turns:    TurnRow[]
  onClose:  () => void
  onSave:   (payload: Partial<ScheduleRow> & { id?: string }) => void
  saving:   boolean
}) {
  const [name,            setName]            = useState(initial?.name ?? '')
  const [turnId,          setTurnId]          = useState(initial?.turn_id ?? '')
  const [color,           setColor]           = useState(initial?.color ?? '#2563eb')

  // Jornada
  const [entryTime,       setEntryTime]       = useState(initial?.entry_time ?? '')
  const [exitTime,        setExitTime]        = useState(initial?.exit_time ?? '')
  const [crossesMidnight, setCrossesMidnight] = useState(initial?.crosses_midnight ?? false)
  const [entryGrace,      setEntryGrace]      = useState(initial?.entry_grace_minutes ?? initial?.grace_in_minutes ?? 0)
  const [exitGrace,       setExitGrace]       = useState(initial?.exit_early_grace_minutes ?? initial?.early_out_minutes ?? 0)
  const [cutoff,          setCutoff]          = useState(initial?.workday_cutoff_time ?? initial?.day_cutoff_time ?? DEFAULT_CUTOFF)

  // Comida
  const [mealEnabled,     setMealEnabled]     = useState(initial?.meal_enabled ?? false)
  const [mealStart,       setMealStart]       = useState(initial?.meal_start ?? '')
  const [mealEnd,         setMealEnd]         = useState(initial?.meal_end ?? '')
  const [mealGrace,       setMealGrace]       = useState(initial?.meal_grace_minutes ?? 0)

  const [active,          setActive]          = useState(initial?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim())  { toast.error('El nombre es requerido'); return }
    if (!turnId)       { toast.error('Selecciona el turno al que pertenece este horario'); return }
    if (!entryTime)    { toast.error('La hora de entrada es requerida'); return }
    if (!exitTime)     { toast.error('La hora de salida es requerida'); return }
    if (mealEnabled && (!mealStart || !mealEnd)) {
      toast.error('Define la hora de salida y regreso de comida')
      return
    }
    onSave({
      id: initial?.id,
      name, turn_id: turnId, color,
      entry_time: entryTime, exit_time: exitTime,
      crosses_midnight: crossesMidnight,
      entry_grace_minutes: Number(entryGrace ?? 0),
      exit_early_grace_minutes: Number(exitGrace ?? 0),
      workday_cutoff_time: cutoff,
      meal_enabled: mealEnabled,
      meal_start: mealStart || null,
      meal_end: mealEnd || null,
      meal_grace_minutes: mealEnabled ? Number(mealGrace ?? 0) : 0,
      is_active: active,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="w-full max-w-2xl border rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(20,30,48,0.98) 0%, rgba(8,18,32,0.98) 100%)',
          borderColor: 'rgba(255,255,255,0.16)',
        }}
      >
        {/* Header fijo */}
        <div
          className="p-5 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <p className="font-bold" style={{ color: 'var(--color-text)' }}>
              {initial ? 'Editar horario' : 'Nuevo horario'}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Define la jornada completa: horas, tolerancias y comida.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'var(--color-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <form
          className="overflow-y-auto flex-1 p-5 space-y-5"
          onSubmit={handleSubmit}
          style={{ background: 'rgba(7, 17, 31, 0.96)' }}
        >

          {/* ── Identificación ── */}
          <SectionTitle>Identificación</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls} style={inputStyle}
                placeholder="Horario Normal 8h-17h"
                autoFocus
              />
            </Field>
            <Field label="Turno al que pertenece *">
              <select
                value={turnId}
                onChange={(e) => setTurnId(e.target.value)}
                className={inputCls} style={inputStyle}
              >
                <option value="">— Selecciona un turno —</option>
                {turns.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── Jornada ── */}
          <SectionTitle>Jornada laboral</SectionTitle>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Hora de entrada *">
              <input
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                className={inputCls} style={inputStyle}
              />
            </Field>
            <Field label="Hora de salida *">
              <input
                type="time"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
                className={inputCls} style={inputStyle}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" checked={crossesMidnight} onChange={(e) => setCrossesMidnight(e.target.checked)} />
            <Moon size={14} />
            Este horario cruza medianoche (ej: 22:00 → 06:00)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Tolerancia entrada (min)" hint="Minutos de gracia para llegar tarde">
              <input
                type="number" min={0}
                value={entryGrace}
                onChange={(e) => setEntryGrace(Number(e.target.value || 0))}
                className={inputCls} style={inputStyle}
              />
            </Field>
            <Field label="Tolerancia salida anticipada (min)" hint="Minutos permitidos para salir antes">
              <input
                type="number" min={0}
                value={exitGrace}
                onChange={(e) => setExitGrace(Number(e.target.value || 0))}
                className={inputCls} style={inputStyle}
              />
            </Field>
            <Field label="Corte de jornada" hint="Hora límite para asignar marcación al día actual">
              <input
                type="time"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
                className={inputCls} style={inputStyle}
              />
            </Field>
          </div>

          {/* ── Comida ── */}
          <SectionTitle>Comida / Almuerzo</SectionTitle>

          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" checked={mealEnabled} onChange={(e) => setMealEnabled(e.target.checked)} />
            <UtensilsCrossed size={14} />
            Este horario tiene tiempo de comida controlado
          </label>

          {mealEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-4 border-l-2" style={{ borderColor: 'var(--color-border)' }}>
              <Field label="Sale a comer *">
                <input
                  type="time"
                  value={mealStart}
                  onChange={(e) => setMealStart(e.target.value)}
                  className={inputCls} style={inputStyle}
                />
              </Field>
              <Field label="Regresa de comer *">
                <input
                  type="time"
                  value={mealEnd}
                  onChange={(e) => setMealEnd(e.target.value)}
                  className={inputCls} style={inputStyle}
                />
              </Field>
              <Field label="Tolerancia regreso comida (min)" hint="Minutos de gracia al regresar tarde de comer">
                <input
                  type="number" min={0}
                  value={mealGrace}
                  onChange={(e) => setMealGrace(Number(e.target.value || 0))}
                  className={inputCls} style={inputStyle}
                />
              </Field>
            </div>
          )}

          {/* ── Apariencia + estado ── */}
          <SectionTitle>Apariencia</SectionTitle>

          <Field label="Color del horario" hint="Este color se usará en dashboardes, reportes y visualizaciones relacionadas con el horario">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Horario activo
          </label>

          {/* Acciones fijas abajo */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { data: tctx } = useTenantContext(user?.id)
  const tenantId = tctx?.tenantId

  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<ScheduleRow | null>(null)

  const schedulesQuery = useQuery({
    queryKey: ['schedules', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => listSchedules(tenantId!),
  })

  const turnsQuery = useQuery({
    queryKey: ['turns-for-schedules', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => listTurns(tenantId!),
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: (p: Partial<ScheduleRow> & { id?: string }) => upsertSchedule(tenantId!, p),
    onSuccess: async () => {
      toast.success('Horario guardado')
      setModalOpen(false)
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['schedules', tenantId] })
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo guardar el horario'),
  })

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: async () => {
      toast.success('Horario eliminado')
      await qc.invalidateQueries({ queryKey: ['schedules', tenantId] })
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo eliminar'),
  })

  const rows  = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data])
  const turns = useMemo(() => turnsQuery.data    ?? [], [turnsQuery.data])

  const turnsIndex = useMemo(
    () => Object.fromEntries(turns.map((t) => [t.id, t])),
    [turns],
  )

  // Agrupar horarios por turno para el drilldown visual
  const grouped = useMemo(() => {
    const map: Record<string, { turn: TurnRow | null; schedules: ScheduleRow[] }> = {}
    for (const s of rows) {
      const key = s.turn_id ?? '__none__'
      if (!map[key]) map[key] = { turn: turnsIndex[s.turn_id] ?? null, schedules: [] }
      map[key].schedules.push(s)
    }
    return Object.values(map).sort((a, b) => {
      if (!a.turn) return 1
      if (!b.turn) return -1
      return (a.turn.name ?? '').localeCompare(b.turn.name ?? '')
    })
  }, [rows, turnsIndex])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Horarios</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Define hora entrada/salida, tolerancias y comida. Cada horario pertenece a un turno.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
        >
          <Plus size={16} /> Nuevo horario
        </button>
      </div>

      {schedulesQuery.isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        </div>
      )}

      {schedulesQuery.isError && (
        <div className="border rounded-xl p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>No se pudo cargar los horarios</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {(schedulesQuery.error as any)?.message ?? 'Error desconocido'}
          </p>
        </div>
      )}

      {!schedulesQuery.isLoading && !schedulesQuery.isError && (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.turn?.id ?? '__none__'}>
              {/* Cabecera turno */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: group.turn?.color || 'var(--color-muted)' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                  {group.turn?.name ?? 'Sin turno asignado'}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  {group.schedules.length}
                </span>
              </div>

              <div className="space-y-2 pl-4 border-l-2"
                style={{ borderColor: group.turn?.color || 'var(--color-border)' }}>
                {group.schedules.map((s) => (
                  <div key={s.id} className="border rounded-xl p-4 flex items-center gap-4"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                      style={{ background: s.color || group.turn?.color || 'var(--color-primary)' }}>
                      <CalendarClock size={18} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{s.name}</span>
                        {s.crosses_midnight && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <Moon size={10} /> Cruza medianoche
                          </span>
                        )}
                        {s.meal_enabled && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <UtensilsCrossed size={10} /> Comida
                          </span>
                        )}
                        {!s.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
                            Inactivo
                          </span>
                        )}
                      </div>

                      <div className="text-xs mt-1 flex items-center gap-3 flex-wrap" style={{ color: 'var(--color-muted)' }}>
                        {/* Jornada */}
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {s.entry_time || '--:--'} → {s.exit_time || '--:--'}
                        </span>
                        {/* Tolerancias jornada */}
                        <span>Tol. entrada: {s.entry_grace_minutes ?? s.grace_in_minutes ?? 0}min</span>
                        <span>Tol. salida: {s.exit_early_grace_minutes ?? s.early_out_minutes ?? 0}min</span>
                        {/* Comida */}
                        {s.meal_enabled && s.meal_start && (
                          <span className="flex items-center gap-1">
                            <UtensilsCrossed size={10} />
                            {s.meal_start} → {s.meal_end}
                            {(s.meal_grace_minutes ?? 0) > 0 && ` (+${s.meal_grace_minutes}min)`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditing(s); setModalOpen(true) }}
                        className="p-2 rounded-lg transition hover:bg-white/5"
                        style={{ color: 'var(--color-muted)' }} title="Editar">
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`¿Eliminar "${s.name}"?`)) delMutation.mutate(s.id) }}
                        className="p-2 rounded-lg transition hover:bg-rose-500/10"
                        style={{ color: 'var(--color-muted)' }} title="Eliminar">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="text-center py-14 border rounded-xl"
              style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <CalendarClock size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay horarios configurados</p>
              <p className="text-sm mt-1">Crea los turnos primero y luego añade los horarios</p>
            </div>
          )}
        </div>
      )}

      {modalOpen && tenantId && (
        <ScheduleModal
          initial={editing}
          turns={turns}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={(p) => saveMutation.mutate(p)}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  )
}
