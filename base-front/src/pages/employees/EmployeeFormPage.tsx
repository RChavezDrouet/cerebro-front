import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { EmployeeSchema, type EmployeeForm } from './employeeSchemas'
import { resolveTenantId } from '@/lib/tenant'

type Turn = { id: string; name: string; type: string; is_active?: boolean; tenant_id?: string }
type Schedule = {
  id: string
  tenant_id?: string
  name: string
  turn_id: string
  entry_time?: string | null
  exit_time?: string | null
  is_active?: boolean
}

type Props = { mode: 'create' | 'edit' }

function toHHMM(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  return s.length >= 5 ? s.slice(0, 5) : s
}

function scheduleLabel(s: Schedule): string {
  const a = toHHMM(s.entry_time)
  const b = toHHMM(s.exit_time)
  if (a && b && !s.name.includes(a) && !s.name.includes(b)) return `${s.name} ${a}-${b}`
  return s.name
}

export default function EmployeeFormPage({ mode }: Props) {
  const navigate = useNavigate()
  const { id } = useParams()

  const [turns, setTurns] = React.useState<Turn[]>([])
  const [selectedTurnId, setSelectedTurnId] = React.useState<string>('')

  const [schedules, setSchedules] = React.useState<Schedule[]>([])
  const schedulesCache = React.useRef<Map<string, Schedule[]>>(new Map())

  const [attendanceMode, setAttendanceMode] = React.useState<'biometric' | 'web'>('biometric')
  const [tenantId, setTenantId] = React.useState<string>('')
  const [err, setErr] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const [form, setForm] = React.useState<EmployeeForm>({
    employee_code: '',
    first_name: '',
    last_name: '',
    status: 'active',
    schedule_id: '',
    biometric_employee_code: null
  })

  async function getTenantId(): Promise<string> {
    if (tenantId) return tenantId

    const { data: s, error: sErr } = await supabase.auth.getSession()
    const userId = s?.session?.user?.id
    if (sErr || !userId) throw new Error('No hay sesión activa.')

    const t = await resolveTenantId(userId)
    if (!t) throw new Error(`tenant_id no resuelto para user_id=${userId}`)

    setTenantId(t)
    return t
  }

  async function loadSchedulesForTurn(turnId: string) {
    if (!turnId) {
      setSchedules([])
      return
    }

    const tId = await getTenantId()

    // Cache por turnId (pero en multi-tenant, el turnId ya es del tenant filtrado)
    const cached = schedulesCache.current.get(turnId)
    if (cached) {
      setSchedules(cached)
      if (cached.length === 0) setForm((p) => ({ ...p, schedule_id: '' }))
      else if (!cached.some((x) => x.id === form.schedule_id)) setForm((p) => ({ ...p, schedule_id: cached[0].id }))
      return
    }

    const { data, error } = await supabase
      .schema('attendance')
      .from('schedules')
      .select('id,tenant_id,name,turn_id,entry_time,exit_time,is_active')
      .eq('tenant_id', tId)
      .eq('is_active', true)
      .eq('turn_id', turnId)
      .order('name')

    if (error) {
      setErr(`No se pudo cargar horarios: ${error.message} (${error.code})`)
      setSchedules([])
      return
    }

    const list = ((data as any) ?? []) as Schedule[]
    schedulesCache.current.set(turnId, list)
    setSchedules(list)

    // Auto-selección de horario
    if (list.length === 0) {
      setForm((p) => ({ ...p, schedule_id: '' }))
    } else {
      setForm((p) => ({ ...p, schedule_id: list.some((x) => x.id === p.schedule_id) ? p.schedule_id : list[0].id }))
    }
  }

  React.useEffect(() => {
    const load = async () => {
      setErr(null)

      const tId = await getTenantId()

      // 1) Modo de marcación del tenant
      const { data: settings } = await supabase
        .schema('attendance')
        .from('settings')
        .select('mode')
        .eq('tenant_id', tId)
        .limit(1)
        .maybeSingle()

      if ((settings as any)?.mode === 'web' || (settings as any)?.mode === 'biometric') {
        setAttendanceMode((settings as any).mode)
      }

      // 2) Turnos activos del tenant
      const { data: turnsData, error: turnsErr } = await supabase
        .schema('attendance')
        .from('turns')
        .select('id,tenant_id,name,type,is_active')
        .eq('tenant_id', tId)
        .eq('is_active', true)
        .order('name')

      if (turnsErr) {
        setErr(`No se pudo cargar turnos: ${turnsErr.message} (${turnsErr.code})`)
        return
      }

      const t = ((turnsData as any) ?? []) as Turn[]
      setTurns(t)

      // 3) Create vs Edit
      if (mode === 'create') {
        const defaultTurnId = t[0]?.id ?? ''
        setSelectedTurnId(defaultTurnId)
        await loadSchedulesForTurn(defaultTurnId)
        return
      }

      if (mode === 'edit' && id) {
        const { data: emp, error: empErr } = await supabase
          .schema('attendance')
          .from('employees')
          .select('employee_code,first_name,last_name,status,schedule_id,biometric_employee_code')
          .eq('tenant_id', tId)
          .eq('id', id)
          .maybeSingle()

        if (empErr || !emp) {
          setErr(empErr ? `No se pudo cargar empleado: ${empErr.message} (${empErr.code})` : 'Empleado no encontrado')
          return
        }

        const scheduleId = (emp as any).schedule_id as string

        setForm({
          employee_code: (emp as any).employee_code ?? '',
          first_name: (emp as any).first_name ?? '',
          last_name: (emp as any).last_name ?? '',
          status: (emp as any).status ?? 'active',
          schedule_id: scheduleId ?? '',
          biometric_employee_code: (emp as any).biometric_employee_code ?? null
        })

        // Resolver turn_id del horario del empleado
        const { data: sch, error: schErr } = await supabase
          .schema('attendance')
          .from('schedules')
          .select('turn_id')
          .eq('tenant_id', tId)
          .eq('id', scheduleId)
          .maybeSingle()

        if (schErr || !sch?.turn_id) {
          const fallbackTurn = t[0]?.id ?? ''
          setSelectedTurnId(fallbackTurn)
          await loadSchedulesForTurn(fallbackTurn)
          return
        }

        setSelectedTurnId((sch as any).turn_id)
        await loadSchedulesForTurn((sch as any).turn_id)
      }
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id])

  async function onChangeTurn(turnId: string) {
    setSelectedTurnId(turnId)
    setErr(null)
    await loadSchedulesForTurn(turnId)
  }

  function onChangeSchedule(scheduleId: string) {
    setForm((p) => ({ ...p, schedule_id: scheduleId }))
  }

  async function save() {
    setErr(null)

    const tId = await getTenantId()

    if (!selectedTurnId) {
      setErr('Selecciona un turno.')
      return
    }
    if (!form.schedule_id) {
      setErr('Selecciona un horario.')
      return
    }

    // Regla: modo biométrico => ID biométrico requerido
    if (attendanceMode === 'biometric') {
      const v = (form.biometric_employee_code ?? '').trim()
      if (!v) {
        setErr('ID en biométrico requerido (modo Biométrico).')
        return
      }
    }

    // ✅ Preflight: validar que el schedule_id realmente exista en DB (evita FK 23503)
    const { data: schExists, error: schErr } = await supabase
      .schema('attendance')
      .from('schedules')
      .select('id')
      .eq('tenant_id', tId)
      .eq('id', form.schedule_id)
      .maybeSingle()

    if (schErr) {
      setErr(`No se pudo validar horario: ${schErr.message} (${schErr.code})`)
      return
    }
    if (!schExists?.id) {
      setErr('El horario seleccionado no existe (o no pertenece a tu tenant). Vuelve a seleccionar el horario.')
      return
    }

    const parsed = EmployeeSchema.safeParse(form)
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? 'Formulario inválido')
      return
    }

    const payload: any = {
      ...parsed.data,
      tenant_id: tId, // ✅ asegura multi-tenant correcto (y policies consistentes)
      employee_code: parsed.data.employee_code.trim(),
      first_name: parsed.data.first_name.trim(),
      last_name: parsed.data.last_name.trim(),
      biometric_employee_code: parsed.data.biometric_employee_code ? parsed.data.biometric_employee_code.trim() : null
    }

    setLoading(true)

    if (mode === 'edit' && id) {
      const { error } = await supabase
        .schema('attendance')
        .from('employees')
        .update(payload)
        .eq('tenant_id', tId)
        .eq('id', id)

      setLoading(false)
      if (error) {
        // Mensaje específico FK schedule
        if ((error as any)?.code === '23503' && String((error as any)?.message || '').includes('schedule')) {
          setErr('No se pudo guardar: el horario seleccionado no existe (FK). Selecciona un horario válido.')
          return
        }
        setErr(`No se pudo guardar: ${error.message} (${error.code})`)
        return
      }
      navigate('/employees')
      return
    }

    const { error } = await supabase.schema('attendance').from('employees').insert(payload)
    setLoading(false)

    if (error) {
      if ((error as any)?.code === '23503' && String((error as any)?.message || '').includes('schedule')) {
        setErr('No se pudo crear: el horario seleccionado no existe (FK). Selecciona un horario válido.')
        return
      }
      setErr(`No se pudo crear: ${error.message} (${error.code})`)
      return
    }

    navigate('/employees')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{mode === 'create' ? 'Nuevo empleado' : 'Editar empleado'}</h1>
        <p className="text-sm text-gray-400">Número de empleado único dentro de la empresa.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 md:grid-cols-2">
        <Input
          label="Número de empleado"
          value={form.employee_code}
          onChange={(e) => setForm((s) => ({ ...s, employee_code: e.target.value }))}
        />

        <Select label="Estado" value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as any }))}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </Select>

        <Input label="Nombres" value={form.first_name} onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} />
        <Input label="Apellidos" value={form.last_name} onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} />

        <Select label="Turno" value={selectedTurnId} onChange={(e) => void onChangeTurn(e.target.value)} disabled={turns.length === 0}>
          {turns.length === 0 ? <option value="">(No hay turnos activos)</option> : null}
          {turns.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.type})
            </option>
          ))}
        </Select>

        <Select
          label="Horario"
          value={form.schedule_id}
          onChange={(e) => onChangeSchedule(e.target.value)}
          disabled={!selectedTurnId || schedules.length === 0}
        >
          {!selectedTurnId ? <option value="">(Selecciona un turno)</option> : null}
          {selectedTurnId && schedules.length === 0 ? <option value="">(No hay horarios para este turno)</option> : null}
          {schedules.map((sch) => (
            <option key={sch.id} value={sch.id}>
              {scheduleLabel(sch)}
            </option>
          ))}
        </Select>

        {attendanceMode === 'biometric' ? (
          <Input
            label="ID en biométrico (requerido)"
            value={form.biometric_employee_code ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, biometric_employee_code: e.target.value }))}
          />
        ) : (
          <div className="text-sm text-gray-400 md:col-span-2">
            Modo de marcación: <span className="font-semibold text-gray-200">WEB (PWA)</span>. No se requiere ID biométrico.
          </div>
        )}

        <div className="md:col-span-2">
          {err ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm">{err}</div> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/employees')}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


