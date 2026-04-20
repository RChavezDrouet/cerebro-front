import React, { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import {
  buildOrgPath,
  fetchOrgUnits,
  isMissingOrgSchemaError,
  type EmployeeOrgAssignment,
  type OrgUnit,
} from '@/lib/orgStructure'

type Employee = {
  id: string
  employee_code: string
  first_name: string
  last_name: string
}

type Jornada = {
  id: string
  nombre: string
  color: string
}

type Holiday = {
  id: string
  holiday_date: string
  name: string
  is_mandatory: boolean
}

type OrgGroup = {
  key: string
  label: string
  unitId: string | null
  employeeIds: string[]
  employees: Employee[]
}

type Assignment = {
  employee_id: string
  jornada_id: string
  fecha: string
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const DAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function buildMonthDays(year: number, month: number): Array<{ day: number; iso: string; wd: number }> {
  const days: Array<{ day: number; iso: string; wd: number }> = []
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month - 1, d)
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const wd = date.getDay() === 0 ? 7 : date.getDay()
    days.push({ day: d, iso, wd })
  }

  return days
}

function monthOffset(year: number, month: number): number {
  const wd = new Date(year, month - 1, 1).getDay()
  return wd === 0 ? 6 : wd - 1
}

function hexToRgba(color: string, alpha: number): string {
  const normalized = String(color || '').trim()
  if (!normalized) return `rgba(255,255,255,${alpha})`
  if (normalized.startsWith('rgb')) return normalized

  const hex = normalized.replace('#', '')
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return `rgba(255,255,255,${alpha})`
}

const MONTH_CONTAINER_CLASSES = [
  'border-white/10 bg-[#0f1a2e]',
  'border-slate-700/80 bg-[#101b31]',
  'border-indigo-950/80 bg-[#0d182b]',
]

function formatRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0')
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`,
  }
}

function isOrgSchemaMissing(error: unknown): boolean {
  if (isMissingOrgSchemaError(error)) return true
  const message = String((error as { message?: string } | null)?.message ?? error ?? '')
  return (
    message.includes('employee_org_assignments') ||
    message.includes('org_units') ||
    message.includes('does not exist') ||
    message.includes('Could not find the table')
  )
}

type GroupCheckboxProps = {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}

function GroupCheckbox({ checked, indeterminate, onChange }: GroupCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-white/30 text-blue-500"
    />
  )
}

const JornadaAsignacionPage: React.FC = () => {
  const { tenantId } = useTenantStore()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [orgAssignments, setOrgAssignments] = useState<EmployeeOrgAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHolidays, setLoadingHolidays] = useState(false)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set())
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [selectedJornada, setSelectedJornada] = useState<string>('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [isDragging, setIsDragging] = useState(false)
  const [dragPreview, setDragPreview] = useState<string | null>(null)
  const dragOriginRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)
  const skipNextClickRef = useRef(false)

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

  const loadHolidays = async () => {
    setLoadingHolidays(true)
    try {
      const tid = await resolveTenantId()
      if (!tid) {
        setHolidays([])
        return
      }

      const range = formatRange(year, 1)
      const endRange = formatRange(year, 12)

      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('holidays')
        .select('id, holiday_date, name, is_mandatory')
        .eq('tenant_id', tid)
        .gte('holiday_date', range.from)
        .lte('holiday_date', endRange.to)
        .order('holiday_date', { ascending: true })

      if (error) throw error
      setHolidays((data ?? []) as Holiday[])
    } catch (err) {
      console.error(err)
      setHolidays([])
    } finally {
      setLoadingHolidays(false)
    }
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const tid = await resolveTenantId()

      const [empRes, jorRes, asgRes, unitsRes, orgAsgRes] = await Promise.all([
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
        tid ? fetchOrgUnits(tid) : Promise.resolve([] as OrgUnit[]),
        tid
          ? supabase
              .schema(ATT_SCHEMA)
              .from('employee_org_assignments')
              .select('employee_id, org_unit_id, supervisor_employee_id, is_unit_leader, lead_org_unit_id')
              .eq('tenant_id', tid)
              .is('effective_to', null)
          : Promise.resolve({
              data: [] as EmployeeOrgAssignment[],
              error: null,
            }),
      ])

      if (empRes.error) throw empRes.error
      if (jorRes.error) throw jorRes.error
      if ('error' in orgAsgRes && orgAsgRes.error && !isOrgSchemaMissing(orgAsgRes.error)) {
        throw orgAsgRes.error
      }

      setEmployees(empRes.data ?? [])
      setJornadas(jorRes.data ?? [])
      setAssignments(asgRes.data ?? [])
      setOrgUnits(unitsRes ?? [])
      setOrgAssignments(('data' in orgAsgRes ? orgAsgRes.data : []) ?? [])

      if (jorRes.data && jorRes.data.length > 0 && !selectedJornada) {
        setSelectedJornada(jorRes.data[0].id)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar datos')
      setOrgUnits([])
      setOrgAssignments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    void loadHolidays()
  }, [year, tenantId])

  useEffect(() => {
    if (loading) return

    supabase
      .schema(ATT_SCHEMA)
      .from('jornada_asignaciones')
      .select('employee_id, jornada_id, fecha')
      .gte('fecha', `${year}-01-01`)
      .lte('fecha', `${year}-12-31`)
      .then(({ data }) => setAssignments(data ?? []))
  }, [year, loading])

  const filteredEmployees = useMemo(
    () =>
      employees.filter((e) => {
        const q = search.toLowerCase()
        return (
          `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
          e.employee_code.toLowerCase().includes(q)
        )
      }),
    [employees, search],
  )

  const allFilteredSelected =
    filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedEmps.has(e.id))

  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assignments) {
      const j = jornadas.find((jornada) => jornada.id === a.jornada_id)
      if (j) map.set(`${a.employee_id}::${a.fecha}`, j.color)
    }
    return map
  }, [assignments, jornadas])

  const assignmentColorByDate = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assignments) {
      if (map.has(a.fecha)) continue
      const j = jornadas.find((jornada) => jornada.id === a.jornada_id)
      if (j) map.set(a.fecha, j.color)
    }
    return map
  }, [assignments, jornadas])

  const selectedJornadaName = useMemo(
    () => jornadas.find((jornada) => jornada.id === selectedJornada)?.nombre ?? '',
    [jornadas, selectedJornada],
  )

  const orgAssignmentMap = useMemo(() => {
    const map = new Map<string, EmployeeOrgAssignment>()
    for (const row of orgAssignments) {
      map.set(row.employee_id, row)
    }
    return map
  }, [orgAssignments])

  const assignedDates = useMemo(() => {
    const s = new Set<string>()
    for (const a of assignments) s.add(a.fecha)
    return s
  }, [assignments])

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>()
    for (const h of holidays) {
      if (h.holiday_date.startsWith(`${year}-`)) {
        map.set(h.holiday_date, h)
      }
    }
    return map
  }, [holidays, year])

  const fullyAssignedDates = useMemo(() => {
    if (selectedEmps.size === 0) return new Set<string>()
    const s = new Set<string>()
    for (const a of assignments) {
      if (selectedEmps.has(a.employee_id)) s.add(a.fecha)
    }
    return s
  }, [assignments, selectedEmps])

  const groupedEmployees = useMemo<OrgGroup[]>(() => {
    const groups = new Map<string, OrgGroup>()

    for (const employee of filteredEmployees) {
      const assignment = orgAssignmentMap.get(employee.id) ?? null
      const unitId = assignment?.org_unit_id ?? null
      const label = unitId ? buildOrgPath(orgUnits, unitId) || 'Unidad sin nombre' : 'Sin unidad'
      const key = unitId ? `unit:${unitId}` : 'unit:unassigned'

      const group = groups.get(key) ?? {
        key,
        label,
        unitId,
        employeeIds: [],
        employees: [],
      }

      group.employeeIds.push(employee.id)
      group.employees.push(employee)
      groups.set(key, group)
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.unitId && !b.unitId) return 1
      if (!a.unitId && b.unitId) return -1
      return a.label.localeCompare(b.label, 'es')
    })
  }, [filteredEmployees, orgAssignmentMap, orgUnits])

  const toggleEmployee = (id: string) =>
    setSelectedEmps((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedEmps((prev) => {
        const next = new Set(prev)
        filteredEmployees.forEach((e) => next.delete(e.id))
        return next
      })
      return
    }

    setSelectedEmps((prev) => {
      const next = new Set(prev)
      filteredEmployees.forEach((e) => next.add(e.id))
      return next
    })
  }

  const toggleGroup = (employeeIds: string[]) => {
    setSelectedEmps((prev) => {
      const next = new Set(prev)
      const allSelected = employeeIds.every((id) => next.has(id))

      if (allSelected) {
        employeeIds.forEach((id) => next.delete(id))
      } else {
        employeeIds.forEach((id) => next.add(id))
      }

      return next
    })
  }

  const toggleDate = (iso: string) =>
    setSelectedDates((prev) => {
      const next = new Set(prev)
      next.has(iso) ? next.delete(iso) : next.add(iso)
      return next
    })

  const clearDates = () => setSelectedDates(new Set())

  const isProtectedDay = (iso: string) => {
    const day = new Date(`${iso}T00:00:00-05:00`)
    const wd = day.getDay()
    return wd === 0 || wd === 6 || holidayMap.has(iso)
  }

  const finalizeDrag = () => {
    if (dragMovedRef.current && dragOriginRef.current && !isProtectedDay(dragOriginRef.current)) {
      addDateToSelection(dragOriginRef.current)
      skipNextClickRef.current = true
      window.setTimeout(() => {
        skipNextClickRef.current = false
      }, 0)
    }

    setIsDragging(false)
    setDragPreview(null)
    dragOriginRef.current = null
    dragMovedRef.current = false
  }

  const startDrag = (iso: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    if (!selectedJornada || selectedEmps.size === 0) return
    if (isProtectedDay(iso)) return

    dragOriginRef.current = iso
    dragMovedRef.current = false
    setIsDragging(true)
    setDragPreview(iso)
    event.preventDefault()
  }

  const addDateToSelection = (iso: string) => {
    if (isProtectedDay(iso)) return
    setSelectedDates((prev) => {
      if (prev.has(iso)) return prev
      const next = new Set(prev)
      next.add(iso)
      return next
    })
  }

  const handleCellEnter = (iso: string) => {
    if (!isDragging || !dragOriginRef.current) return
    if (isProtectedDay(iso)) return

    setDragPreview(iso)
    if (iso !== dragOriginRef.current) dragMovedRef.current = true
    addDateToSelection(iso)
  }

  useEffect(() => {
    const onWindowMouseUp = () => {
      if (isDragging) finalizeDrag()
    }

    const onWindowBlur = () => {
      if (isDragging) finalizeDrag()
    }

    window.addEventListener('mouseup', onWindowMouseUp)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      window.removeEventListener('mouseup', onWindowMouseUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [isDragging, holidayMap])

  const handleAssign = async () => {
    if (selectedEmps.size === 0) {
      toast.error('Selecciona al menos un colaborador')
      return
    }
    if (selectedDates.size === 0) {
      toast.error('Selecciona al menos una fecha en el calendario')
      return
    }
    if (!selectedJornada) {
      toast.error('Selecciona una jornada')
      return
    }

    const employeeCount = selectedEmps.size
    const dateCount = selectedDates.size
    const assignmentCount = employeeCount * dateCount
    const selectedJornadaLabel = selectedJornadaName || 'Jornada sin nombre'
    const attentionLine =
      assignmentCount >= 25 || employeeCount >= 10 || dateCount >= 10
        ? '\n\nAtención: es una asignación masiva. Verifica la selección antes de continuar.'
        : ''
    const confirmMessage =
      `Vas a guardar ${assignmentCount} asignación${assignmentCount !== 1 ? 'es' : ''}.\n` +
      `Colaboradores: ${employeeCount}\n` +
      `Días: ${dateCount}\n` +
      `Jornada: ${selectedJornadaLabel}` +
      attentionLine

    if (!window.confirm(confirmMessage)) return

    setSaving(true)
    try {
      const tid = await resolveTenantId()
      if (!tid) {
        toast.error('Tenant no identificado')
        return
      }

      const rows = Array.from(selectedEmps).flatMap((empId) =>
        Array.from(selectedDates).map((fecha) => ({
          tenant_id: tid,
          employee_id: empId,
          jornada_id: selectedJornada,
          fecha,
        })),
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

  const handleRemove = async () => {
    if (selectedEmps.size === 0) {
      toast.error('Selecciona al menos un colaborador')
      return
    }
    if (selectedDates.size === 0) {
      toast.error('Selecciona al menos una fecha')
      return
    }

    const removeMessage =
      `Vas a quitar las asignaciones existentes de ${selectedDates.size} día${selectedDates.size !== 1 ? 's' : ''} ` +
      `para ${selectedEmps.size} colaborador${selectedEmps.size !== 1 ? 'es' : ''}.\n\n` +
      'Esta acción solo elimina lo ya guardado en el calendario.'

    if (!window.confirm(removeMessage)) return

    setSaving(true)
    try {
      const tid = await resolveTenantId()
      if (!tid) {
        toast.error('Tenant no identificado')
        return
      }

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

  const renderMonth = (month: number) => {
    const days = buildMonthDays(year, month)
    const offset = monthOffset(year, month)
    const cells: React.ReactNode[] = []

    for (let i = 0; i < offset; i += 1) {
      cells.push(<div key={`e-${i}`} />)
    }

    for (const { day, iso, wd } of days) {
      const isSelected = selectedDates.has(iso)
      const isAssigned = assignedDates.has(iso)
      const isCovered = fullyAssignedDates.has(iso)
      const holiday = holidayMap.get(iso) ?? null
      const weekend = wd === 6 || wd === 7
      const selectedEmployeeColor =
        selectedEmps.size === 1
          ? assignmentMap.get(`${Array.from(selectedEmps)[0]}::${iso}`)
          : undefined
      const jornadaColor = selectedEmployeeColor ?? assignmentColorByDate.get(iso)

      const overlays = [
        weekend ? 'linear-gradient(rgba(148,163,184,0.12), rgba(148,163,184,0.12))' : null,
        holiday ? 'linear-gradient(rgba(56,189,248,0.16), rgba(56,189,248,0.16))' : null,
        !isSelected && jornadaColor ? `linear-gradient(${hexToRgba(jornadaColor, 0.32)}, ${hexToRgba(jornadaColor, 0.32)})` : null,
      ].filter(Boolean) as string[]

      cells.push(
        <button
          key={iso}
          type="button"
          onMouseDown={(event) => startDrag(iso, event)}
          onMouseEnter={() => handleCellEnter(iso)}
          onMouseUp={() => {
            if (isDragging) finalizeDrag()
          }}
          onClick={() => {
            if (skipNextClickRef.current) {
              skipNextClickRef.current = false
              return
            }
            toggleDate(iso)
          }}
          title={holiday ? `${iso} · ${holiday.name}` : iso}
          className={[
            'relative w-full aspect-square overflow-hidden rounded text-xs font-semibold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            isSelected
              ? 'ring-2 ring-blue-400 bg-blue-500/40 text-white'
              : isAssigned && isCovered
                ? 'text-white'
                : isAssigned
                  ? 'text-white/80'
                  : 'text-white/70 hover:bg-white/10',
            isDragging && !isProtectedDay(iso) ? 'ring-1 ring-blue-300/50' : '',
          ].join(' ')}
          style={
            {
              backgroundColor: isSelected ? 'rgba(59,130,246,0.40)' : 'rgba(15,23,42,0.48)',
              backgroundImage: overlays.length > 0 ? overlays.join(', ') : undefined,
              border: holiday
                ? '1px solid rgba(56,189,248,0.28)'
                : weekend
                  ? '1px solid rgba(148,163,184,0.18)'
                  : isAssigned
                    ? '1px solid rgba(255,255,255,0.12)'
                    : '1px solid rgba(255,255,255,0.08)',
            } as React.CSSProperties
          }
        >
          {day}
        </button>,
      )
    }

    return (
      <div
        key={month}
        className={`rounded-xl border p-3 ${MONTH_CONTAINER_CLASSES[(month - 1) % MONTH_CONTAINER_CLASSES.length]}`}
      >
        <p className="mb-2 text-center text-xs font-semibold text-white/70">{MONTH_NAMES[month - 1]}</p>
        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {DAY_HEADERS.map((h) => (
            <div key={h} className="text-center text-[10px] font-medium text-white/30">
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">{cells}</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  const hasSelectionContext = selectedEmps.size > 0 || selectedDates.size > 0 || Boolean(selectedJornada)
  const canPersistSelection = selectedEmps.size > 0 && selectedDates.size > 0 && Boolean(selectedJornada)
  const canRemoveSelection = selectedEmps.size > 0 && selectedDates.size > 0

  return (
    <div className="mx-auto max-w-full space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Asignación de Jornadas</h1>
        <p className="mt-1 text-sm text-white/50">
          Selecciona colaboradores y días del calendario, luego asigna una jornada.
        </p>
      </div>

      <div className="flex items-start gap-4">
        <div
          className="flex w-2/5 shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          <div className="border-b border-white/10 p-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código…"
              className="w-full rounded-lg border border-white/20 bg-white/5 p-2 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <input
              type="checkbox"
              id="sel_all"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              className="h-4 w-4 rounded border-white/30 text-blue-500"
            />
            <label htmlFor="sel_all" className="cursor-pointer select-none text-xs text-white/60">
              Seleccionar todos ({filteredEmployees.length})
            </label>
            {selectedEmps.size > 0 && (
              <span className="ml-auto text-xs font-medium text-blue-400">
                {selectedEmps.size} seleccionado{selectedEmps.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {groupedEmployees.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">Sin resultados</p>
            ) : (
              groupedEmployees.map((group) => {
                const selectedCount = group.employeeIds.filter((id) => selectedEmps.has(id)).length
                const checked = selectedCount === group.employeeIds.length && group.employeeIds.length > 0
                const indeterminate = selectedCount > 0 && selectedCount < group.employeeIds.length

                return (
                  <div key={group.key} className="rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-start gap-3 border-b border-white/10 px-3 py-2.5">
                      <GroupCheckbox
                        checked={checked}
                        indeterminate={indeterminate}
                        onChange={() => toggleGroup(group.employeeIds)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{group.label}</p>
                        <p className="text-xs text-white/40">
                          {group.employeeIds.length} colaborador{group.employeeIds.length !== 1 ? 'es' : ''}
                          {indeterminate ? ' · selección parcial' : ''}
                        </p>
                      </div>
                      <div className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/50">
                        {selectedCount}/{group.employeeIds.length}
                      </div>
                    </div>

                    <div className="divide-y divide-white/5">
                      {group.employees.map((emp) => (
                        <label
                          key={emp.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmps.has(emp.id)}
                            onChange={() => toggleEmployee(emp.id)}
                            className="h-4 w-4 shrink-0 rounded border-white/30 text-blue-500"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">
                              {emp.last_name}, {emp.first_name}
                            </p>
                            <p className="font-mono text-xs text-white/40">{emp.employee_code}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                className="h-8 w-8 rounded-lg bg-white/10 text-sm font-bold text-white transition hover:bg-white/20"
              >
                ‹
              </button>
              <span className="w-12 text-center text-lg font-semibold text-white">{year}</span>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                className="h-8 w-8 rounded-lg bg-white/10 text-sm font-bold text-white transition hover:bg-white/20"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-white/20" />
                Con asignación
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-sky-400/70" />
                Feriado
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-slate-400/70" />
                Fin de semana
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-blue-400 ring-2 ring-blue-400" />
                Seleccionado
              </span>
              {loadingHolidays && <span className="text-white/30">Cargando feriados…</span>}
              {isDragging && dragPreview && (
                <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[11px] font-medium text-blue-200">
                  Arrastrando sobre {dragPreview}
                </span>
              )}
            </div>

            {selectedDates.size > 0 && (
              <button
                type="button"
                onClick={clearDates}
                className="ml-auto text-xs text-white/50 transition hover:text-white/80"
              >
                Limpiar selección ({selectedDates.size})
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => renderMonth(i + 1))}
          </div>
        </div>
      </div>

      {hasSelectionContext && (
        <div
          className="fixed bottom-6 left-1/2 z-40 flex min-w-[480px] -translate-x-1/2 items-center gap-4 rounded-2xl border border-white/20 bg-[#0f1a2e] px-6 py-4 shadow-2xl"
        >
          <div className="shrink-0 space-y-1 text-sm text-white/70">
            <p>
              <span className="font-semibold text-white">{selectedEmps.size}</span> colaborador
              {selectedEmps.size !== 1 ? 'es' : ''} ×{' '}
              <span className="font-semibold text-white">{selectedDates.size}</span> día
              {selectedDates.size !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-white/45">
              Jornada: <span className="text-white/75">{selectedJornadaName || 'Sin seleccionar'}</span>
            </p>
          </div>

          <span className="h-6 w-px shrink-0 bg-white/10" />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectedJornada && (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: jornadas.find((j) => j.id === selectedJornada)?.color ?? '#fff' }}
              />
            )}
            <select
              value={selectedJornada}
              onChange={(e) => setSelectedJornada(e.target.value)}
              className="flex-1 rounded-lg border border-white/20 bg-white/10 p-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Selecciona jornada…
              </option>
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleAssign}
            disabled={saving || !canPersistSelection}
            className="shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Asignar'}
          </button>

          <button
            type="button"
            onClick={handleRemove}
            disabled={saving || !canRemoveSelection}
            className="shrink-0 rounded-xl bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            Quitar
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedDates(new Set())
              setSelectedEmps(new Set())
            }}
            className="shrink-0 text-xs text-white/40 transition hover:text-white/70"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default JornadaAsignacionPage
