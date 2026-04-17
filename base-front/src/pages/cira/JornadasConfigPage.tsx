import React, { useState, useEffect } from 'react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import toast from 'react-hot-toast'
import { Calendar } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Bloque = { entrada: string; salida: string }

type Jornada = {
  id:                       string
  tenant_id:                string
  nombre:                   string
  alias:                    string | null
  color:                    string
  dias_semana:              number[]
  bloques:                  Bloque[]
  break_habilitado:         boolean
  break_inicio:             string | null
  break_fin:                string | null
  tolerancia_entrada_min:   number
  tolerancia_break_entrada_min: number
  tolerancia_break_salida_min:  number
  tolerancia_salida_min:    number
  is_active:                boolean
}

type FormState = Omit<Jornada, 'id' | 'tenant_id'>

// ─── Constants ────────────────────────────────────────────────────────────────

const DIAS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 7, label: 'D' },
]

const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
]

const EMPTY_FORM: FormState = {
  nombre:                   '',
  alias:                    '',
  color:                    '#3B82F6',
  dias_semana:              [1, 2, 3, 4, 5],
  bloques:                  [{ entrada: '08:00', salida: '17:00' }],
  break_habilitado:         true,
  break_inicio:             '12:00',
  break_fin:                '13:00',
  tolerancia_entrada_min:   5,
  tolerancia_break_entrada_min: 5,
  tolerancia_break_salida_min:  5,
  tolerancia_salida_min:    5,
  is_active:                true,
}

// ─── Component ────────────────────────────────────────────────────────────────

const JornadasConfigPage: React.FC = () => {
  const { tenantId } = useTenantStore()

  const [jornadas, setJornadas]   = useState<Jornada[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [tablePending, setTablePending] = useState(false)

  // editing: null = new, string = id being edited
  const [editing, setEditing]     = useState<string | null | 'new'>(null)
  const [form, setForm]           = useState<FormState>({ ...EMPTY_FORM })

  useEffect(() => { loadData() }, [])

  const resolveTenantId = async (): Promise<string | null> => {
    if (tenantId) return tenantId
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()
    return profile?.tenant_id ?? null
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('jornadas')
        .select('id, tenant_id, nombre, alias, color, dias_semana, bloques, break_habilitado, break_inicio, break_fin, tolerancia_entrada_min, tolerancia_break_entrada_min, tolerancia_break_salida_min, tolerancia_salida_min, is_active')
        .order('nombre')

      if (error) throw error
      setJornadas(data ?? [])
      setTablePending(false)
    } catch {
      setTablePending(true)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setForm({ ...EMPTY_FORM })
    setEditing('new')
  }

  const openEdit = (j: Jornada) => {
    setForm({
      nombre:                   j.nombre,
      alias:                    j.alias ?? '',
      color:                    j.color,
      dias_semana:              [...j.dias_semana],
      bloques:                  j.bloques.map(b => ({ ...b })),
      break_habilitado:         j.break_habilitado,
      break_inicio:             j.break_inicio ?? '12:00',
      break_fin:                j.break_fin    ?? '13:00',
      tolerancia_entrada_min:   j.tolerancia_entrada_min,
      tolerancia_break_entrada_min: j.tolerancia_break_entrada_min,
      tolerancia_break_salida_min:  j.tolerancia_break_salida_min,
      tolerancia_salida_min:    j.tolerancia_salida_min,
      is_active:                j.is_active,
    })
    setEditing(j.id)
  }

  const closeForm = () => setEditing(null)

  // ── Bloque helpers ──────────────────────────────────────────────────────────

  const addBloque = () =>
    setForm(prev => ({
      ...prev,
      bloques: [...prev.bloques, { entrada: '08:00', salida: '17:00' }],
    }))

  const removeBloque = (idx: number) =>
    setForm(prev => ({ ...prev, bloques: prev.bloques.filter((_, i) => i !== idx) }))

  const updateBloque = (idx: number, field: keyof Bloque, value: string) =>
    setForm(prev => ({
      ...prev,
      bloques: prev.bloques.map((b, i) => i === idx ? { ...b, [field]: value } : b),
    }))

  // ── Día helpers ─────────────────────────────────────────────────────────────

  const toggleDia = (d: number) =>
    setForm(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(d)
        ? prev.dias_semana.filter(x => x !== d)
        : [...prev.dias_semana, d].sort((a, b) => a - b),
    }))

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    if (form.bloques.length === 0) { toast.error('Agrega al menos un bloque horario'); return }
    if (form.dias_semana.length === 0) { toast.error('Selecciona al menos un día'); return }

    setSaving(true)
    try {
      const resolvedTenantId = await resolveTenantId()
      if (!resolvedTenantId) { toast.error('Tenant no identificado'); return }

      const payload = {
        tenant_id:                resolvedTenantId,
        nombre:                   form.nombre.trim(),
        alias:                    form.alias?.trim() || null,
        color:                    form.color,
        dias_semana:              form.dias_semana,
        bloques:                  form.bloques,
        break_habilitado:         form.break_habilitado,
        break_inicio:             form.break_habilitado ? (form.break_inicio || null) : null,
        break_fin:                form.break_habilitado ? (form.break_fin    || null) : null,
        tolerancia_entrada_min:   form.tolerancia_entrada_min,
        tolerancia_break_entrada_min: form.tolerancia_break_entrada_min,
        tolerancia_break_salida_min:  form.tolerancia_break_salida_min,
        tolerancia_salida_min:    form.tolerancia_salida_min,
        is_active:                form.is_active,
        ...(editing !== 'new' ? { id: editing } : {}),
      }

      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('jornadas')
        .upsert(payload, { onConflict: 'tenant_id,nombre' })

      if (error) throw error
      toast.success(editing === 'new' ? 'Jornada creada' : 'Jornada actualizada')
      closeForm()
      await loadData()
    } catch (err) {
      toast.error('Error al guardar')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta jornada? Se quitarán también todas sus asignaciones.')) return
    setDeleting(id)
    try {
      const resolvedTenantId = await resolveTenantId()
      if (!resolvedTenantId) { toast.error('Tenant no identificado'); setDeleting(null); return }

      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('jornadas')
        .delete()
        .eq('id', id)
        .eq('tenant_id', resolvedTenantId)

      if (error) throw error
      toast.success('Jornada eliminada')
      if (editing === id) closeForm()
      await loadData()
    } catch (err) {
      toast.error('Error al eliminar')
      console.error(err)
    } finally {
      setDeleting(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (tablePending) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Jornadas Laborales</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5 text-sm text-amber-700">
          La tabla{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 rounded">
            attendance.jornadas
          </code>{' '}
          aún no existe. Ejecuta{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 rounded">
            022_jornadas.sql
          </code>{' '}
          en el SQL Editor de Supabase.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jornadas Laborales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define los horarios y tolerancias de cada jornada del tenant.
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Nueva jornada
        </button>
      </div>

      {/* Grid de jornadas */}
      {jornadas.length === 0 && !editing ? (
        <div className="bg-white/5 border border-gray-200 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
          No hay jornadas configuradas. Crea la primera.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jornadas.map((j) => (
            <div
              key={j.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 hover:border-white/20 transition"
            >
              {/* Color + nombre */}
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: j.color }}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{j.nombre}</p>
                  {j.alias && <p className="text-xs text-white/50">{j.alias}</p>}
                </div>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  j.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                }`}>
                  {j.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Días */}
              <div className="flex gap-1">
                {DIAS.map(d => (
                  <span
                    key={d.value}
                    className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full ${
                      j.dias_semana.includes(d.value)
                        ? 'bg-blue-500/30 text-blue-300'
                        : 'bg-white/5 text-white/20'
                    }`}
                  >
                    {d.label}
                  </span>
                ))}
              </div>

              {/* Bloques */}
              <div className="space-y-1">
                {j.bloques.map((b, i) => (
                  <p key={i} className="text-xs text-white/60 font-mono">
                    {b.entrada} – {b.salida}
                    {j.break_habilitado && j.break_inicio && j.break_fin && i === 0 && (
                      <span className="ml-2 text-white/30">
                        (break {j.break_inicio}–{j.break_fin})
                      </span>
                    )}
                  </p>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => openEdit(j)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(j.id)}
                  disabled={deleting === j.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                >
                  {deleting === j.id ? '…' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Form panel ──────────────────────────────────────────────────────── */}
      {editing !== null && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
          <h2 className="text-base font-semibold text-white">
            {editing === 'new' ? 'Nueva jornada' : 'Editar jornada'}
          </h2>

          {/* Nombre + Alias + Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs text-white/60 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Jornada Diurna"
                className="w-full p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white placeholder-white/30 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Alias (opcional)</label>
              <input
                type="text"
                value={form.alias ?? ''}
                onChange={e => setForm(prev => ({ ...prev, alias: e.target.value }))}
                placeholder="Ej. 8-17"
                className="w-full p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white placeholder-white/30 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Color</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      form.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Días */}
          <div>
            <label className="block text-xs text-white/60 mb-2">Días activos *</label>
            <div className="flex gap-2">
              {DIAS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDia(d.value)}
                  className={`w-9 h-9 rounded-full text-xs font-bold transition ${
                    form.dias_semana.includes(d.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-white/50 hover:bg-white/20'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bloques horarios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/60">Bloques horarios *</label>
              <button
                type="button"
                onClick={addBloque}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Agregar bloque
              </button>
            </div>
            <div className="space-y-2">
              {form.bloques.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-white/40 w-4">{i + 1}.</span>
                  <input
                    type="time"
                    value={b.entrada}
                    onChange={e => updateBloque(i, 'entrada', e.target.value)}
                    className="p-1.5 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-white/40 text-xs">→</span>
                  <input
                    type="time"
                    value={b.salida}
                    onChange={e => updateBloque(i, 'salida', e.target.value)}
                    className="p-1.5 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {form.bloques.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBloque(i)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Break */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="break_hab"
                checked={form.break_habilitado}
                onChange={e => setForm(prev => ({ ...prev, break_habilitado: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="break_hab" className="text-sm text-white/80">Break / Almuerzo habilitado</label>
            </div>
            {form.break_habilitado && (
              <div className="flex items-center gap-3 ml-7">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Inicio</label>
                  <input
                    type="time"
                    value={form.break_inicio ?? '12:00'}
                    onChange={e => setForm(prev => ({ ...prev, break_inicio: e.target.value }))}
                    className="p-1.5 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <span className="text-white/40 text-xs mt-4">→</span>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Fin</label>
                  <input
                    type="time"
                    value={form.break_fin ?? '13:00'}
                    onChange={e => setForm(prev => ({ ...prev, break_fin: e.target.value }))}
                    className="p-1.5 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tolerancias (grid 2×2) */}
          <div>
            <label className="block text-xs text-white/60 mb-2">Tolerancias (minutos)</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Entrada tardía (min)</label>
                <input
                  type="number" min={0} max={120} step={1}
                  value={form.tolerancia_entrada_min}
                  onChange={e => setForm(prev => ({ ...prev, tolerancia_entrada_min: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Retorno de break (min)</label>
                <input
                  type="number" min={0} max={120} step={1}
                  value={form.tolerancia_break_entrada_min}
                  onChange={e => setForm(prev => ({ ...prev, tolerancia_break_entrada_min: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Salida anticipada (min)</label>
                <input
                  type="number" min={0} max={120} step={1}
                  value={form.tolerancia_salida_min}
                  onChange={e => setForm(prev => ({ ...prev, tolerancia_salida_min: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Salida tardía de break (min)</label>
                <input
                  type="number" min={0} max={120} step={1}
                  value={form.tolerancia_break_salida_min}
                  onChange={e => setForm(prev => ({ ...prev, tolerancia_break_salida_min: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Activo */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="is_active" className="text-sm text-white/80">Jornada activa</label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 bg-white/10 hover:bg-white/20 transition-colors"
            >
              Cancelar
            </button>
            {editing !== 'new' && (
              <button
                type="button"
                onClick={() => handleDelete(editing as string)}
                disabled={deleting === editing}
                className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                {deleting === editing ? 'Eliminando…' : 'Eliminar jornada'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default JornadasConfigPage
