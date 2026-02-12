import React from 'react'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Modal } from '@/components/Modal'

type PunchRow = {
  id: string
  punched_at: string
  source: string
  serial_no: string | null
  biometric_employee_code: string | null
  meta: any
  raw_id: string | null
  device_id: string | null
  created_at?: string
}

type EmployeeRow = {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  status: 'active' | 'inactive'
  schedule_id: string | null
  biometric_employee_code: string | null
}

type ScheduleRow = {
  id: string
  name: string
  color: string
  turn_id: string
  entry_time: string | null
  exit_time: string | null
  crosses_midnight?: boolean | null
  turns?: { name: string; type: string } | null
}

type RawRow = {
  id: string
  created_at: string
  serial_no: string | null
  path: string | null
  query: string | null
  headers: any
  body: string | null
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function toHHMM(v?: string | null): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  return s.length >= 5 ? s.slice(0, 5) : s
}

function fmtLocal(dtIso: string): string {
  try {
    const d = new Date(dtIso)
    // Formato legible (sin depender de librerías)
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  } catch {
    return dtIso
  }
}

function startISO_EC(ymd: string): string {
  // Ecuador: -05:00 (sin DST). Para MVP está OK.
  return new Date(`${ymd}T00:00:00-05:00`).toISOString()
}
function endExclusiveISO_EC(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00-05:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

function safeStr(v: any) {
  try {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

function csvEscape(v: any) {
  const s = safeStr(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`
  return s
}

export default function AttendanceReportPage() {
  const [from, setFrom] = React.useState<string>(todayYMD())
  const [to, setTo] = React.useState<string>(todayYMD())
  const [employeeQ, setEmployeeQ] = React.useState<string>('') // código o ID biométrico (por ahora filtramos por biométrico)
  const [serialQ, setSerialQ] = React.useState<string>('')

  const [source, setSource] = React.useState<string>('all') // all | biometric | web | import
  const [rows, setRows] = React.useState<PunchRow[]>([])
  const [count, setCount] = React.useState<number>(0)

  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [hasSession, setHasSession] = React.useState<boolean>(true)

  const [employeesByBio, setEmployeesByBio] = React.useState<Map<string, EmployeeRow>>(new Map())
  const [employeesByEmpCode, setEmployeesByEmpCode] = React.useState<Map<string, EmployeeRow>>(new Map())
  const [schedulesById, setSchedulesById] = React.useState<Map<string, ScheduleRow>>(new Map())

  // Evidencia
  const [evOpen, setEvOpen] = React.useState(false)
  const [evLoading, setEvLoading] = React.useState(false)
  const [evPunch, setEvPunch] = React.useState<PunchRow | null>(null)
  const [evRaw, setEvRaw] = React.useState<RawRow | null>(null)
  const [evErr, setEvErr] = React.useState<string | null>(null)

  const PAGE_SIZE = 20
  const [page, setPage] = React.useState(1)

  const loadRefs = React.useCallback(async () => {
    // 1) Sesión (para evitar “pantalla en blanco” cuando se deshabilita login)
    const { data: sess } = await supabase.auth.getSession()
    setHasSession(!!sess?.session)

    // 2) Empleados
    const { data: empData, error: empErr } = await supabase
      .schema('attendance')
      .from('employees')
      .select('id,employee_code,first_name,last_name,status,schedule_id,biometric_employee_code')
      .order('employee_code')

    if (empErr) {
      // No rompas la página si RLS bloquea
      setErr(`No se pudo cargar empleados: ${empErr.message} (${empErr.code})`)
      return
    }

    const byBio = new Map<string, EmployeeRow>()
    const byEmpCode = new Map<string, EmployeeRow>()
    ;((empData as any) ?? []).forEach((e: EmployeeRow) => {
      if (e.biometric_employee_code) byBio.set(String(e.biometric_employee_code), e)
      if (e.employee_code) byEmpCode.set(String(e.employee_code), e)
    })
    setEmployeesByBio(byBio)
    setEmployeesByEmpCode(byEmpCode)

    // 3) Horarios (+ turns)
    const { data: schData, error: schErr } = await supabase
      .schema('attendance')
      .from('schedules')
      .select('id,name,color,turn_id,entry_time,exit_time,crosses_midnight,turns(name,type)')
      .order('name')

    if (schErr) {
      setErr(`No se pudo cargar horarios: ${schErr.message} (${schErr.code})`)
      return
    }

    const byId = new Map<string, ScheduleRow>()
    ;((schData as any) ?? []).forEach((s: ScheduleRow) => byId.set(s.id, s))
    setSchedulesById(byId)
  }, [])

  const load = React.useCallback(async () => {
    setErr(null)
    setLoading(true)

    const fromISO = startISO_EC(from)
    const toISO = endExclusiveISO_EC(to)

    let q = supabase
      .schema('attendance')
      .from('punches')
      // OJO: NO existe punches.status. status/verify viven en meta.
      .select('id,punched_at,source,serial_no,biometric_employee_code,meta,raw_id,device_id,created_at', { count: 'exact' })
      .gte('punched_at', fromISO)
      .lt('punched_at', toISO)
      .order('punched_at', { ascending: false })

    if (serialQ.trim()) q = q.ilike('serial_no', `%${serialQ.trim()}%`)
    if (source !== 'all') q = q.eq('source', source)

    // Filtro empleado: en MVP filtra por biometric_employee_code directamente
    const emp = employeeQ.trim()
    if (emp) {
      // Si escribió un código de empleado (ej 001), intentamos resolver al bio-id y filtrar
      const byCode = employeesByEmpCode.get(emp)
      if (byCode?.biometric_employee_code) {
        q = q.eq('biometric_employee_code', String(byCode.biometric_employee_code))
      } else {
        q = q.ilike('biometric_employee_code', `%${emp}%`)
      }
    }

    const fromIdx = (page - 1) * PAGE_SIZE
    const toIdx = fromIdx + PAGE_SIZE - 1
    q = q.range(fromIdx, toIdx)

    const { data, error, count: c } = await q
    setLoading(false)

    if (error) {
      setRows([])
      setCount(0)
      setErr(`No se pudo cargar: ${error.message} (${error.code})`)
      return
    }

    setRows(((data as any) ?? []) as PunchRow[])
    setCount(c ?? 0)
  }, [from, to, employeeQ, serialQ, source, page, employeesByEmpCode])

  React.useEffect(() => {
    void loadRefs()
  }, [loadRefs])

  React.useEffect(() => {
    // Cada vez que cambian filtros “fuertes”, vuelve a página 1
    setPage(1)
  }, [from, to, employeeQ, serialQ, source])

  React.useEffect(() => {
    void load()
  }, [load])

  async function openEvidence(p: PunchRow) {
    setEvPunch(p)
    setEvOpen(true)
    setEvRaw(null)
    setEvErr(null)

    if (!p.raw_id) return

    setEvLoading(true)
    const { data, error } = await supabase
      .schema('attendance')
      .from('biometric_raw')
      .select('id,created_at,serial_no,path,query,headers,body')
      .eq('id', p.raw_id)
      .maybeSingle()

    setEvLoading(false)

    if (error) {
      setEvErr(`No se pudo cargar evidencia: ${error.message} (${error.code})`)
      return
    }
    setEvRaw((data as any) ?? null)
  }

  function scheduleBadgeForPunch(p: PunchRow) {
    const bio = (p.biometric_employee_code ?? '').trim()
    const emp = bio ? employeesByBio.get(bio) : null
    if (!emp?.schedule_id) return null
    const sch = schedulesById.get(emp.schedule_id)
    if (!sch) return null

    const entry = toHHMM(sch.entry_time)
    const exit = toHHMM(sch.exit_time)
    const label = sch.turns?.name
      ? `${sch.turns.name} ${entry && exit ? `${entry}-${exit}` : ''}`.trim()
      : `${sch.name} ${entry && exit ? `${entry}-${exit}` : ''}`.trim()

    return { color: sch.color || '#6366f1', label }
  }

  function statusFromMeta(p: PunchRow): string {
    const m = p.meta ?? {}
    // ZKTeco suele enviar status como "0/1". Aquí solo lo mostramos como viene.
    if (m.status !== undefined && m.status !== null && String(m.status) !== '') return String(m.status)
    return '—'
  }

  function verifyFromMeta(p: PunchRow): string {
    const m = p.meta ?? {}
    if (m.verify_type !== undefined && m.verify_type !== null && String(m.verify_type) !== '') return String(m.verify_type)
    return '—'
  }

  function exportCSV() {
    const headers = [
      'id',
      'fecha_hora_local',
      'punched_at_utc',
      'empleado_bio',
      'serial_no',
      'source',
      'meta_status',
      'meta_verify_type'
    ]
    const lines = [headers.join(',')]

    rows.forEach((r) => {
      lines.push(
        [
          csvEscape(r.id),
          csvEscape(fmtLocal(r.punched_at)),
          csvEscape(r.punched_at),
          csvEscape(r.biometric_employee_code ?? ''),
          csvEscape(r.serial_no ?? ''),
          csvEscape(r.source ?? ''),
          csvEscape(statusFromMeta(r)),
          csvEscape(verifyFromMeta(r))
        ].join(',')
      )
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `marcaciones_${from}_a_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Reporte de Marcaciones</h1>
          <p className="text-sm text-gray-300">
            Consulta y exporta marcaciones. <span className="text-gray-400">(status/verify se leen desde meta)</span>
          </p>
          {!hasSession ? (
            <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-200">
              No hay sesión de usuario. Si deshabilitaste login, RLS puede bloquear datos. (Solución: habilita login o usa un “dev auto-login”.)
            </div>
          ) : null}
        </div>

        <Button variant="secondary" onClick={exportCSV} disabled={rows.length === 0}>
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-6">
        <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input
          label="Empleado (código o ID biométrico)"
          placeholder="Ej: 001 o 1"
          value={employeeQ}
          onChange={(e) => setEmployeeQ(e.target.value)}
          className="md:col-span-2"
        />
        <Input
          label="Serial biométrico"
          placeholder="Ej: 8029..."
          value={serialQ}
          onChange={(e) => setSerialQ(e.target.value)}
        />
        <Select label="Fuente" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">Todas</option>
          <option value="biometric">Biométrico</option>
          <option value="web">Web</option>
          <option value="import">Import</option>
        </Select>

        <div className="md:col-span-6 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-400">
            Resultados: <span className="text-gray-200">{count}</span> (página {page} de {totalPages})
          </div>
          <Button onClick={() => void load()} disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>

        {err ? (
          <div className="md:col-span-6 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            {err}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">Fecha/Hora</th>
              <th className="px-4 py-3 text-left">Empleado</th>
              <th className="px-4 py-3 text-left">Horario</th>
              <th className="px-4 py-3 text-left">Fuente</th>
              <th className="px-4 py-3 text-left">Serial</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Verificación</th>
              <th className="px-4 py-3 text-right">Evidencia</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const badge = scheduleBadgeForPunch(r)
              const bio = (r.biometric_employee_code ?? '').trim()
              const emp = bio ? employeesByBio.get(bio) : null
              const empLabel = emp ? `${emp.employee_code} • ${emp.first_name} ${emp.last_name}` : (bio ? `Bio: ${bio}` : '—')

              return (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-100">{fmtLocal(r.punched_at)}</div>
                    <div className="text-xs text-gray-400">UTC: {r.punched_at}</div>
                  </td>

                  <td className="px-4 py-3 text-gray-100">{empLabel}</td>

                  <td className="px-4 py-3">
                    {badge ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded" style={{ backgroundColor: badge.color }} />
                        <span className="text-gray-100">{badge.label}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-gray-200">{r.source ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{r.serial_no ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{statusFromMeta(r)}</td>
                  <td className="px-4 py-3 text-gray-200">{verifyFromMeta(r)}</td>

                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => void openEvidence(r)}>
                      Ver
                    </Button>
                  </td>
                </tr>
              )
            })}

            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-400" colSpan={8}>
                  Sin resultados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-3 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <div className="text-gray-200">Página {page} de {totalPages}</div>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Siguiente
          </Button>
        </div>
      </div>

      <Modal open={evOpen} title="Evidencia de marcación" onClose={() => setEvOpen(false)}>
        <div className="space-y-3 text-sm">
          {evPunch ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-gray-200"><span className="text-gray-400">ID:</span> {evPunch.id}</div>
              <div className="text-gray-200"><span className="text-gray-400">UTC:</span> {evPunch.punched_at}</div>
              <div className="text-gray-200"><span className="text-gray-400">Serial:</span> {evPunch.serial_no ?? '—'}</div>
              <div className="text-gray-200"><span className="text-gray-400">Raw ID:</span> {evPunch.raw_id ?? '—'}</div>
              <div className="mt-2 text-xs text-gray-400">meta</div>
              <pre className="mt-1 max-h-52 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-gray-200">
                {JSON.stringify(evPunch.meta ?? {}, null, 2)}
              </pre>
            </div>
          ) : null}

          {evLoading ? <div className="text-gray-300">Cargando evidencia…</div> : null}
          {evErr ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-rose-100">{evErr}</div> : null}

          {evRaw ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-gray-200"><span className="text-gray-400">Raw created_at:</span> {evRaw.created_at}</div>
              <div className="text-gray-200"><span className="text-gray-400">Path:</span> {evRaw.path ?? '—'}</div>
              <div className="text-gray-200"><span className="text-gray-400">Query:</span> {evRaw.query ?? '—'}</div>
              <div className="mt-2 text-xs text-gray-400">headers</div>
              <pre className="mt-1 max-h-40 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-gray-200">
                {JSON.stringify(evRaw.headers ?? {}, null, 2)}
              </pre>
              <div className="mt-2 text-xs text-gray-400">body (recortado)</div>
              <pre className="mt-1 max-h-52 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-gray-200">
                {(evRaw.body ?? '').slice(0, 4000) || '—'}
              </pre>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setEvOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}


