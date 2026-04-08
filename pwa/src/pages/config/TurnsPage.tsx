import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { Plus, Edit3, X, Sun, Sunset, Moon, HelpCircle, CalendarClock } from 'lucide-react'
import { useTenantContext } from '@/hooks/useTenantContext'
import { useAuth } from '@/contexts/AuthContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ShiftType = 'diurno' | 'vespertino' | 'nocturno' | string

export type TurnRow = {
  id: string
  tenant_id: string
  name: string
  code?: string | null
  type?: ShiftType | null
  color?: string | null
  days?: number[] | null
  is_active?: boolean | null
  created_at?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#f97316',
  '#0f172a',
]

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: 'diurno',     label: 'Diurno'     },
  { value: 'vespertino', label: 'Vespertino' },
  { value: 'nocturno',   label: 'Nocturno'   },
]

const DAYS = [
  { i: 1, label: 'Lun' },
  { i: 2, label: 'Mar' },
  { i: 3, label: 'Mié' },
  { i: 4, label: 'Jue' },
  { i: 5, label: 'Vie' },
  { i: 6, label: 'Sáb' },
  { i: 7, label: 'Dom' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shiftTypeLabel(type?: ShiftType | null) {
  return SHIFT_TYPES.find((s) => s.value === type)?.label ?? type ?? '—'
}

function ShiftIcon({ type, size = 16 }: { type?: ShiftType | null; size?: number }) {
  if (type === 'diurno')     return <Sun size={size} />
  if (type === 'vespertino') return <Sunset size={size} />
  if (type === 'nocturno')   return <Moon size={size} />
  return <HelpCircle size={size} />
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

async function listTurns(tenantId: string): Promise<TurnRow[]> {
  const { data, error } = await supabase
    .schema('attendance')
    .from('turns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) throw error
  return (data ?? []) as TurnRow[]
}

async function upsertTurn(
  tenantId: string,
  payload: Partial<TurnRow> & { id?: string },
): Promise<void> {
  const base = {
    tenant_id: tenantId,
    name:      payload.name?.trim(),
    code:      payload.code?.trim() || null,
    type:      payload.type  || null,
    color:     payload.color || null,
    days:      Array.isArray(payload.days) && payload.days.length > 0 ? payload.days : [1, 2, 3, 4, 5],
    is_active: payload.is_active ?? true,
  }
  if (payload.id) {
    const { error } = await supabase.schema('attendance').from('turns').update(base).eq('id', payload.id)
    if (error) throw error
    return
  }
  const { error } = await supabase.schema('attendance').from('turns').insert(base)
  if (error) throw error
}

async function deleteTurn(id: string): Promise<void> {
  const { error } = await supabase.schema('attendance').from('turns').delete().eq('id', id)
  if (error) throw error
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

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
          aria-label={`Color ${c}`}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 p-0.5 border rounded-lg cursor-pointer"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        title="Color personalizado"
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

// ─── Modal ────────────────────────────────────────────────────────────────────

function TurnModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial:  TurnRow | null
  onClose:  () => void
  onSave:   (payload: Partial<TurnRow> & { id?: string }) => void
  saving:   boolean
}) {
  const [name,   setName]   = useState(initial?.name   ?? '')
  const [code,   setCode]   = useState(initial?.code   ?? '')
  const [type,   setType]   = useState<ShiftType>(initial?.type ?? 'diurno')
  const [color,  setColor]  = useState(initial?.color  ?? '#2563eb')
  const [days,   setDays]   = useState<number[]>(initial?.days ?? [1, 2, 3, 4, 5])
  const [active, setActive] = useState(initial?.is_active ?? true)

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
        className="w-full max-w-md border rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(20,30,48,0.98) 0%, rgba(8,18,32,0.98) 100%)',
          borderColor: 'rgba(255,255,255,0.16)',
        }}
      >
        {/* Header */}
        <div
          className="p-5 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <p className="font-bold" style={{ color: 'var(--color-text)' }}>
              {initial ? 'Editar turno' : 'Nuevo turno'}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              El turno requiere al menos un día activo para poder guardarse correctamente.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'var(--color-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form
          className="p-5 space-y-4"
          style={{ background: 'rgba(7, 17, 31, 0.96)' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) { toast.error('El nombre es requerido'); return }
            if (!days.length) { toast.error('Selecciona al menos un día'); return }
            onSave({ id: initial?.id, name, code, type, color, days, is_active: active })
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 outline-none text-sm"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                placeholder="Matutino"
                autoFocus
              />
            </Field>
            <Field label="Código (opcional)">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 outline-none text-sm"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                placeholder="MAT"
                maxLength={10}
              />
            </Field>
          </div>

          {/* Tipo */}
          <Field label="Tipo de turno">
            <div className="flex gap-2">
              {SHIFT_TYPES.map((s) => {
                const sel = type === s.value
                return (
                  <button
                    type="button"
                    key={s.value}
                    onClick={() => setType(s.value)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition"
                    style={{
                      background:  sel ? 'var(--color-primary)' : 'var(--color-bg)',
                      borderColor: sel ? 'var(--color-primary)' : 'var(--color-border)',
                      color:       sel ? 'var(--color-on-primary)' : 'var(--color-muted)',
                    }}
                  >
                    <ShiftIcon type={s.value} size={14} />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Color */}
          <Field label="Color del turno" hint="Este color se usará en dashboardes, reportes y visualizaciones relacionadas con el turno">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          {/* Días */}
          <Field label="Días del turno *" hint="La tabla attendance.turns exige la columna days; no puede ir nula">
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((d) => {
                const checked = days.includes(d.i)
                return (
                  <label
                    key={d.i}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 cursor-pointer text-xs font-medium transition"
                    style={{
                      background: checked ? `${color}22` : 'var(--color-bg)',
                      borderColor: checked ? color : 'var(--color-border)',
                      color: checked ? 'var(--color-text)' : 'var(--color-muted)',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => {
                        setDays((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(d.i)
                          else next.delete(d.i)
                          return Array.from(next).sort((a, b) => a - b)
                        })
                      }}
                    />
                    <span>{d.label}</span>
                  </label>
                )
              })}
            </div>
          </Field>

          {/* Activo */}
          <label
            className="flex items-center gap-2 text-sm cursor-pointer"
            style={{ color: 'var(--color-text)' }}
          >
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Turno activo
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
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

export default function TurnsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { data: tctx } = useTenantContext(user?.id)
  const tenantId = tctx?.tenantId

  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<TurnRow | null>(null)

  const turnsQuery = useQuery({
    queryKey: ['turns', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => listTurns(tenantId!),
  })

  const saveMutation = useMutation({
    mutationFn: (p: Partial<TurnRow> & { id?: string }) => upsertTurn(tenantId!, p),
    onSuccess: async () => {
      toast.success('Turno guardado')
      setModalOpen(false)
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['turns', tenantId] })
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo guardar el turno'),
  })

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteTurn(id),
    onSuccess: async () => {
      toast.success('Turno eliminado')
      await qc.invalidateQueries({ queryKey: ['turns', tenantId] })
    },
    onError: (e: any) => toast.error(e?.message || 'No se pudo eliminar'),
  })

  const rows = useMemo(() => turnsQuery.data ?? [], [turnsQuery.data])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Turnos</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Agrupa horarios bajo un mismo turno. Las horas, días y tolerancias se configuran en{' '}
            <strong style={{ color: 'var(--color-text)' }}>Horarios</strong>.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
        >
          <Plus size={16} /> Nuevo turno
        </button>
      </div>

      {/* Loading */}
      {turnsQuery.isLoading && (
        <div className="flex justify-center py-16">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {/* Error */}
      {turnsQuery.isError && (
        <div
          className="border rounded-xl p-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>No se pudo cargar los turnos</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {(turnsQuery.error as any)?.message ?? 'Error desconocido'}
          </p>
        </div>
      )}

      {/* Lista */}
      {!turnsQuery.isLoading && !turnsQuery.isError && (
        <div className="space-y-2">
          {rows.map((t) => (
            <div
              key={t.id}
              className="border rounded-xl p-4 flex items-center gap-4"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {/* Ícono coloreado */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                style={{ background: t.color || 'var(--color-primary)' }}
              >
                <ShiftIcon type={t.type} size={20} />
              </div>

              {/* Datos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{t.name}</span>
                  {t.code && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border font-mono"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                    >
                      {t.code}
                    </span>
                  )}
                  {t.type && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${t.color || '#2563eb'}22`,
                        color:      t.color || 'var(--color-primary)',
                      }}
                    >
                      {shiftTypeLabel(t.type)}
                    </span>
                  )}
                  {t.is_active === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
                      Inactivo
                    </span>
                  )}
                </div>
                <div
                  className="flex items-center gap-1 mt-1 text-xs"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <CalendarClock size={11} />
                  <span>Los horarios de este turno se gestionan en la sección <em>Horarios</em></span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditing(t); setModalOpen(true) }}
                  className="p-2 rounded-lg transition hover:bg-white/5"
                  style={{ color: 'var(--color-muted)' }}
                  title="Editar"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar el turno "${t.name}"?\nSus horarios asociados quedarán sin turno.`))
                      delMutation.mutate(t.id)
                  }}
                  className="p-2 rounded-lg transition hover:bg-rose-500/10"
                  style={{ color: 'var(--color-muted)' }}
                  title="Eliminar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div
              className="text-center py-14 border rounded-xl"
              style={{
                color:       'var(--color-muted)',
                borderColor: 'var(--color-border)',
                background:  'var(--color-surface)',
              }}
            >
              <Sun size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay turnos configurados</p>
              <p className="text-sm mt-1">
                Crea un turno (ej: Matutino) y luego asígnale horarios desde la sección Horarios
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && tenantId && (
        <TurnModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={(p) => saveMutation.mutate(p)}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  )
}


