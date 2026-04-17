import React, { useState, useEffect, useMemo } from 'react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id:            string
  employee_code: string
  first_name:    string
  last_name:     string
}

type Jornada = {
  id:     string
  nombre: string
  color:  string
}

type Assignment = {
  employee_id: string
  jornada_id:  string
  fecha:       string  // 'YYYY-MM-DD'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const DAY_HEADERS = ['L','M','X','J','V','S','D']

/** Returns array of {day, isoDate, weekday(1=Mon)} for a given month */
function buildMonthDays(year: number, month: number): Array<{ day: number; iso: string; wd: number }> {
  const days: Array<{ day: number; iso: string; wd: number }> = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const iso  = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const wd   = date.getDay() === 0 ? 7 : date.getDay()  // 1=Mon … 7=Sun
    days.push({ day: d, iso, wd })
  }
  return days
}

/** Offset (0-based) for first day of month in Mon-first grid */
function monthOffset(year: number, month: number): number {
  const wd = new Date(year, month - 1, 1).getDay()
  return wd === 0 ? 6 : wd - 1
}

function toHex(color: string) { return color }

// ─── Component ────────────────────────────────────────────────────────────────

const JornadaAsignacionPage: React.FC = () => {
  const { tenantId } = useTenantStore()

  // ── Data state ──────────────────────────────────────────────────────────────
  const [employees,    setEmployees]   = useState<Employee[]>([])
  const [jornadas,     setJornadas]    = useState<Jornada[]>([])
  const [assignments,  setAssignments] = useState<Assignment[]>([])
  const [loading,      setLoading]     = useState(true)
  const [saving,       setSaving]      = useState(false)

  // ── Selection state ─────────────────────────────────────────────────────────
  const [search,           setSearch]         = useState('')
  const [selectedEmps,     setSelectedEmps]   = useState<Set<string>>(new Set())
  const [selectedDates,    setSelectedDates]  = useState<Set<string>>(new Set())
  const [selectedJornada,  setSelectedJornada] = useState<string>('')
  const [year,             setYear]           = useState(new Date().getFullYear())

  useEffect(() => { loadAll() }, [])

  // ── Tenant resolver ─────────────────────────────────────────────────────────

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

  // ── Load ─────────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true)
    try {
      const [empRes, jorRes, asgRes] = await Promise.all([
        supabase
          .schema(ATT_SCHEMA)
          .from('employees')
          .select('id, employee_code, first_name, last_name')
          .eq('status', 'active')
          .order('last_name'),

        supabase
          .schema(ATT_SCHEMA)
          .from('jornadas')
          .select('id, nombre, color')
          .eq('is_active', true)
          .order('nombre'),

        supabase
          .schema(ATT_SCHEMA)
          .from('jornada_asignaciones')
          .select('employee_id, jornada_id, fecha')
          .gte('fecha', `${year}-01-01`)
          .lte('fecha', `${year}-12-31`),
      ])

      if (empRes.error) throw empRes.error
      if (jorRes.error) throw jorRes.error
      // assignments table may not exist yet — treat gracefully
      setEmployees(empRes.data ?? [])
      setJornadas(jorRes.data ?? [])
      setAssignments(asgRes.data ?? [])
      if (jorRes.data && jorRes.data.length > 0 && !selectedJornada) {
        setSelectedJornada(jorRes.data[0].id)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Reload assignments when year changes
  useEffect(() => {
    if (loading) return
    supabase
      .schema(ATT_SCHEMA)
      .from('jornada_asignaciones')
      .select('employee_id, jornada_id, fecha')
      .gte('fecha', `${year}-01-01`)
      .lte('fecha', `${year}-12-31`)
      .then(({ data }) => setAssignments(data ?? []))
  }, [year])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredEmployees = useMemo(() =>
    employees.filter(e => {
      const q = search.toLowerCase()
      return (
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q)
      )
    }), [employees, search])

  const allFilteredSelected = filteredEmployees.length > 0 &&
    filteredEmployees.every(e => selectedEmps.has(e.id))

  // key: 'empId::fecha', value: jornada color
  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assignments) {
      const j = jornadas.find(j => j.id === a.jornada_id)
      if (j) map.set(`${a.employee_id}::${a.fecha}`, j.color)
    }
    return map
  }, [assignments, jornadas])

  // For calendar: set of dates that have at least one assignment
  const assignedDates = useMemo(() => {
    const s = new Set<string>()
    for (const a of assignments) s.add(a.fecha)
    return s
  }, [assignments])

  // Dates assigned for ALL selected employees (intersection — show as "fully covered")
  const fullyAssignedDates = useMemo(() => {
    if (selectedEmps.size === 0) return new Set<string>()
    const s = new Set<string>()
    for (const a of assignments) {
      if (selectedEmps.has(a.employee_id)) s.add(a.fecha)
    }
    return s
  }, [assignments, selectedEmps])

  // ── Employee selection ───────────────────────────────────────────────────────

  const toggleEmployee = (id: string) =>
    setSelectedEmps(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedEmps(prev => {
        const next = new Set(prev)
        filteredEmployees.forEach(e => next.delete(e.id))
        return next
      })
    } else {
      setSelectedEmps(prev => {
        const next = new Set(prev)
        filteredEmployees.forEach(e => next.add(e.id))
        return next
      })
    }
  }

  // ── Date selection ───────────────────────────────────────────────────────────

  const toggleDate = (iso: string) =>
    setSelectedDates(prev => {
      const next = new Set(prev)
      next.has(iso) ? next.delete(iso) : next.add(iso)
      return next
    })

  const clearDates = () => setSelectedDates(new Set())

  // ── Save assignments ─────────────────────────────────────────────────────────

  const handleAssign = async () => {
    if (selectedEmps.size === 0)  { toast.error('Selecciona al menos un colaborador'); return }
    if (selectedDates.size === 0) { toast.error('Selecciona al menos una fecha en el calendario'); return }
    if (!selectedJornada)         { toast.error('Selecciona una jornada'); return }

    setSaving(true)
    try {
      const tid = await resolveTenantId()
      if (!tid) { toast.error('Tenant no identificado'); return }

      const rows = Array.from(selectedEmps).flatMap(empId =>
        Array.from(selectedDates).map(fecha => ({
          tenant_id:   tid,
          employee_id: empId,
          jornada_id:  selectedJornada,
          fecha,
        }))
      )

      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('jornada_asignaciones')
        .upsert(rows, { onConflict: 'tenant_id,employee_id,fecha' })

      if (error) throw error

      const total = rows.length
      toast.success(`${total} asignación${total !== 1 ? 'es' : ''} guardada${total !== 1 ? 's' : ''}`)
      setSelectedDates(new Set())
      await loadAll()
    } catch (err) {
      toast.error('Error al guardar asignaciones')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ── Remove assignments ───────────────────────────────────────────────────────

  const handleRemove = async () => {
    if (selectedEmps.size === 0)  { toast.error('Selecciona al menos un colaborador'); return }
    if (selectedDates.size === 0) { toast.error('Selecciona al menos una fecha'); return }
    if (!confirm(`¿Quitar asignaciones de ${selectedDates.size} día(s) para ${selectedEmps.size} colaborador(es)?`)) return

    setSaving(true)
    try {
      const tid = await resolveTenantId()
      if (!tid) { toast.error('Tenant no identificado'); return }

      for (const empId of selectedEmps) {
        for (const fecha of selectedDates) {
          await supabase
            .schema(ATT_SCHEMA)
            .from('jornada_asignaciones')
            .delete()
            .eq('tenant_id', tid)
            .eq('employee_id', empId)
            .eq('fecha', fecha)
        }
      }

      toast.success('Asignaciones eliminadas')
      setSelectedDates(new Set())
      await loadAll()
    } catch (err) {
      toast.error('Error al eliminar asignaciones')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderMonth = (month: number) => {
    const days   = buildMonthDays(year, month)
    const offset = monthOffset(year, month)
    const cells: React.ReactNode[] = []

    // Empty cells before first day
    for (let i = 0; i < offset; i++) {
      cells.push(<div key={`e-${i}`} />)
    }

    for (const { day, iso, wd: _wd } of days) {
      const isSelected  = selectedDates.has(iso)
      const isAssigned  = assignedDates.has(iso)
      const isCovered   = fullyAssignedDates.has(iso)
      const jorColor    = selectedEmps.size === 1
        ? assignmentMap.get(`${Array.from(selectedEmps)[0]}::${iso}`)
        : undefined

      cells.push(
        <button
          key={iso}
          type="button"
          onClick={() => toggleDate(iso)}
          title={iso}
          className={[
            'w-full aspect-square rounded text-xs font-medium transition-all',
            isSelected
              ? 'ring-2 ring-blue-400 bg-blue-500/40 text-white'
              : isAssigned && isCovered
                ? 'text-white'
                : isAssigned
                  ? 'text-white/70'
                  : 'text-white/50 hover:bg-white/10',
          ].join(' ')}
          style={
            !isSelected && jorColor
              ? { backgroundColor: jorColor + '55' }
              : !isSelected && isAssigned
                ? { backgroundColor: '#ffffff18' }
                : undefined
          }
        >
          {day}
        </button>
      )
    }

    return (
      <div key={month} className="bg-white/5 border border-white/10 rounded-xl p-3">
        <p className="text-xs font-semibold text-white/70 text-center mb-2">
          {MONTH_NAMES[month - 1]}
        </p>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_HEADERS.map(h => (
            <div key={h} className="text-center text-[10px] text-white/30 font-medium">{h}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells}
        </div>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  const hasSelection = selectedEmps.size > 0 && selectedDates.size > 0

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-full mx-auto space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asignación de Jornadas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecciona colaboradores y días del calendario, luego asigna una jornada.
        </p>
      </div>

      <div className="flex gap-4 items-start">

        {/* ── Panel izquierdo: colaboradores (40%) ─────────────────────────── */}
        <div className="w-2/5 shrink-0 bg-white/5 border border-white/10 rounded-xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 200px)' }}>

          {/* Search */}
          <div className="p-3 border-b border-white/10">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código…"
              className="w-full p-2 text-sm border border-white/20 rounded-lg bg-white/5 text-white placeholder-white/30 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Select all */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
            <input
              type="checkbox"
              id="sel_all"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              className="w-4 h-4 rounded border-white/30 text-blue-500"
            />
            <label htmlFor="sel_all" className="text-xs text-white/60 select-none cursor-pointer">
              Seleccionar todos ({filteredEmployees.length})
            </label>
            {selectedEmps.size > 0 && (
              <span className="ml-auto text-xs font-medium text-blue-400">
                {selectedEmps.size} seleccionado{selectedEmps.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Employee list */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredEmployees.length === 0 ? (
              <p className="text-center text-sm text-white/40 py-8">Sin resultados</p>
            ) : (
              filteredEmployees.map(emp => (
                <label
                  key={emp.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEmps.has(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                    className="w-4 h-4 rounded border-white/30 text-blue-500 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">
                      {emp.last_name}, {emp.first_name}
                    </p>
                    <p className="text-xs text-white/40 font-mono">{emp.employee_code}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* ── Panel derecho: calendario anual (60%) ────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Year selector + legend */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setYear(y => y - 1)}
                className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm font-bold transition"
              >
                ‹
              </button>
              <span className="text-lg font-semibold text-white w-12 text-center">{year}</span>
              <button
                type="button"
                onClick={() => setYear(y => y + 1)}
                className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm font-bold transition"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-white/20 inline-block" />
                Con asignación
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-400 inline-block ring-2 ring-blue-400" />
                Seleccionado
              </span>
            </div>

            {selectedDates.size > 0 && (
              <button
                type="button"
                onClick={clearDates}
                className="ml-auto text-xs text-white/50 hover:text-white/80 transition"
              >
                Limpiar selección ({selectedDates.size})
              </button>
            )}
          </div>

          {/* 12-month grid */}
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => renderMonth(i + 1))}
          </div>
        </div>
      </div>

      {/* ── Floating action bar ─────────────────────────────────────────────── */}
      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40
          bg-[#0f1a2e] border border-white/20 rounded-2xl shadow-2xl
          px-6 py-4 flex items-center gap-4 min-w-[480px]">

          {/* Summary */}
          <div className="text-sm text-white/70 shrink-0">
            <span className="text-white font-semibold">{selectedEmps.size}</span> colaborador{selectedEmps.size !== 1 ? 'es' : ''}{' '}
            ×{' '}
            <span className="text-white font-semibold">{selectedDates.size}</span> día{selectedDates.size !== 1 ? 's' : ''}
          </div>

          <span className="w-px h-6 bg-white/10 shrink-0" />

          {/* Jornada selector */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedJornada && (
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: jornadas.find(j => j.id === selectedJornada)?.color ?? '#fff' }}
              />
            )}
            <select
              value={selectedJornada}
              onChange={e => setSelectedJornada(e.target.value)}
              className="flex-1 p-2 border border-white/20 rounded-lg text-sm bg-white/10 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="" disabled>Selecciona jornada…</option>
              {jornadas.map(j => (
                <option key={j.id} value={j.id}>{j.nombre}</option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <button
            type="button"
            onClick={handleAssign}
            disabled={saving || !selectedJornada}
            className="shrink-0 bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando…' : 'Asignar'}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="shrink-0 bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors"
          >
            Quitar
          </button>
          <button
            type="button"
            onClick={() => { setSelectedDates(new Set()); setSelectedEmps(new Set()) }}
            className="shrink-0 text-white/40 hover:text-white/70 text-xs transition"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  )
}

export default JornadaAsignacionPage
