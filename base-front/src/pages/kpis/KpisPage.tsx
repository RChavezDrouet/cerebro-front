import React from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarDays, Download, Filter, Trophy, Search } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'

import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type KpiAggRow = {
  department_name?: string | null
  turn_name?: string | null
  a_tiempo: number
  atrasado: number
  anticipada: number
  novedad: number
  total: number
}

type RankingRow = {
  employee_id: string
  employee_code: string
  employee_name: string
  department_name: string
  atrasos: number
  anticipadas: number
  novedades: number
  score: number
}

type Settings = { ranking_limit: number; chart_type: 'bar' | 'pie'; dashboard_widgets: string[] }

type EmployeeOption = { id: string; employee_code: string; first_name: string; last_name: string }

function iso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function fetchSettings(tenantId: string): Promise<Settings> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('kpi_settings')
    .select('ranking_limit,chart_type,dashboard_widgets')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error

  return {
    ranking_limit: Number(data?.ranking_limit ?? 10),
    chart_type: (data?.chart_type ?? 'bar') as any,
    dashboard_widgets: Array.isArray(data?.dashboard_widgets) ? (data?.dashboard_widgets as any) : ['turn', 'department', 'ranking']
  }
}

async function fetchByDepartment(tenantId: string, from: string, to: string): Promise<KpiAggRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_kpi_attendance_by_department', { p_tenant_id: tenantId, p_date_from: from, p_date_to: to })
  if (error) throw error
  return (data ?? []) as any
}

async function fetchByTurn(tenantId: string, from: string, to: string): Promise<KpiAggRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_kpi_attendance_by_turn', { p_tenant_id: tenantId, p_date_from: from, p_date_to: to })
  if (error) throw error
  return (data ?? []) as any
}

async function fetchRanking(tenantId: string, from: string, to: string, limit: number): Promise<RankingRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_kpi_ranking', { p_tenant_id: tenantId, p_date_from: from, p_date_to: to, p_limit: limit })
  if (error) throw error
  return (data ?? []) as any
}

async function fetchEmployeeDaily(tenantId: string, from: string, to: string, employeeId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_daily_attendance_report', { p_tenant_id: tenantId, p_date_from: from, p_date_to: to })
  if (error) throw error
  const rows = (data ?? []) as any[]
  return rows.filter((r) => String(r.employee_id) === employeeId)
}

async function searchEmployees(tenantId: string, q: string): Promise<EmployeeOption[]> {
  if (!q.trim()) return []
  const p = `%${q.trim()}%`
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employees')
    .select('id,employee_code,first_name,last_name')
    .eq('tenant_id', tenantId)
    .or(`employee_code.ilike.${p},first_name.ilike.${p},last_name.ilike.${p}`)
    .limit(10)

  if (error) throw error
  return (data ?? []) as any
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="h-2 w-full rounded-full bg-white/10">
      <div className="h-2 rounded-full bg-white/30" style={{ width: `${pct}%` }} />
    </div>
  )
}

function AggTable({ title, rows, keyField }: { title: string; rows: KpiAggRow[]; keyField: 'department_name' | 'turn_name' }) {
  const maxTotal = Math.max(1, ...rows.map((r) => Number(r.total || 0)))
  return (
    <Card title={title} subtitle={`Filas: ${rows.length}`}>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-white/60">
            <tr>
              <th className="py-2 text-left">Grupo</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2 text-right">A tiempo</th>
              <th className="py-2 text-right">Atrasado</th>
              <th className="py-2 text-right">Anticipada</th>
              <th className="py-2 text-right">Novedad</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t border-white/10 align-top">
                <td className="py-2">
                  <div className="font-semibold">{String((r as any)[keyField] ?? '—')}</div>
                  <div className="mt-2"><Bar value={Number(r.total || 0)} max={maxTotal} /></div>
                </td>
                <td className="py-2 text-right font-semibold">{r.total}</td>
                <td className="py-2 text-right">{r.a_tiempo}</td>
                <td className="py-2 text-right">{r.atrasado}</td>
                <td className="py-2 text-right">{r.anticipada}</td>
                <td className="py-2 text-right">{r.novedad}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td className="py-6 text-center text-white/55" colSpan={6}>Sin datos.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function KpisPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const [from, setFrom] = React.useState(() => iso(new Date()))
  const [to, setTo] = React.useState(() => iso(new Date()))

  const settings = useQuery({ queryKey: ['kpi-settings', tenantId], enabled: !!tenantId, queryFn: () => fetchSettings(tenantId!), retry: 0 })
  const rankingLimit = settings.data?.ranking_limit ?? 10
  const widgets = settings.data?.dashboard_widgets ?? ['turn', 'department', 'ranking']

  const byDept = useQuery({ queryKey: ['kpi-dept', tenantId, from, to], enabled: !!tenantId && widgets.includes('department'), queryFn: () => fetchByDepartment(tenantId!, from, to), retry: 0 })
  const byTurn = useQuery({ queryKey: ['kpi-turn', tenantId, from, to], enabled: !!tenantId && widgets.includes('turn'), queryFn: () => fetchByTurn(tenantId!, from, to), retry: 0 })
  const ranking = useQuery({ queryKey: ['kpi-ranking', tenantId, from, to, rankingLimit], enabled: !!tenantId && widgets.includes('ranking'), queryFn: () => fetchRanking(tenantId!, from, to, rankingLimit), retry: 0 })

  // KPI 2: comportamiento por empleado (búsqueda)
  const [empQ, setEmpQ] = React.useState('')
  const [empId, setEmpId] = React.useState('')

  const empOptions = useQuery({
    queryKey: ['kpi-emp-search', tenantId, empQ],
    enabled: !!tenantId && empQ.trim().length >= 2,
    queryFn: () => searchEmployees(tenantId!, empQ),
    retry: 0
  })

  const empDaily = useQuery({
    queryKey: ['kpi-emp-daily', tenantId, from, to, empId],
    enabled: !!tenantId && !!empId,
    queryFn: () => fetchEmployeeDaily(tenantId!, from, to, empId)
  })

  const empSummary = React.useMemo(() => {
    const rows = (empDaily.data ?? []) as any[]
    const s = { total: rows.length, a_tiempo: 0, atrasado: 0, anticipada: 0, novedad: 0 }
    for (const r of rows) {
      const st = String(r.day_status || '').toUpperCase()
      if (st.includes('A_TIEM')) s.a_tiempo++
      else if (st.includes('ATRAS')) s.atrasado++
      else if (st.includes('ANTIC')) s.anticipada++
      else if (st.includes('NOVE')) s.novedad++
    }
    return s
  }, [empDaily.data])

  // Drill-down desde ranking
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<RankingRow | null>(null)

  const detail = useQuery({
    queryKey: ['kpi-employee-detail', tenantId, from, to, selected?.employee_id],
    enabled: !!tenantId && !!selected?.employee_id && open,
    queryFn: () => fetchEmployeeDaily(tenantId!, from, to, selected!.employee_id)
  })

  const exportExcel = () => {
    const sheets: Record<string, any[]> = {}
    if (byTurn.data) sheets['PorTurno'] = byTurn.data
    if (byDept.data) sheets['PorDepto'] = byDept.data
    if (ranking.data) sheets['Ranking'] = ranking.data
    if (empDaily.data) sheets['Empleado'] = empDaily.data

    const wb = XLSX.utils.book_new()
    Object.entries(sheets).forEach(([name, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, name)
    })

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `kpis_${from}_${to}.xlsx`)
  }

  const exportPDF = async () => {
    const el = document.getElementById('kpi-root')
    if (!el) return toast.error('No se encontró el contenedor')
    const canvas = await html2canvas(el as any, { scale: 2, backgroundColor: '#0b1220' })
    const img = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'pt', 'a4')
    const w = pdf.internal.pageSize.getWidth()
    const h = (canvas.height * w) / canvas.width
    pdf.addImage(img, 'PNG', 20, 20, w - 40, h)
    pdf.save(`kpis_${from}_${to}.pdf`)
  }

  return (
    <div id="kpi-root" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">KPIs</h1>
          <p className="mt-1 text-sm text-white/60">KPIs por periodo con drill-down y exportación.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<Download size={16} />} onClick={exportExcel}>Excel</Button>
          <Button variant="secondary" leftIcon={<Download size={16} />} onClick={exportPDF}>PDF</Button>
        </div>
      </div>

      <Card title="Filtros" actions={<Filter size={18} className="text-white/60" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="flex items-end text-xs text-white/50"><CalendarDays size={14} className="mr-2" />Top X: {rankingLimit}</div>
        </div>
        {settings.isError ? <div className="mt-3 text-xs text-amber-200">No existe attendance.kpi_settings. Ejecuta el SQL del ZIP.</div> : null}
      </Card>

      <Card title="KPI 2 — Comportamiento por Empleado" subtitle="Buscar empleado para ver su comportamiento en el periodo">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Buscar" value={empQ} onChange={(e) => setEmpQ(e.target.value)} right={<Search size={16} className="text-white/40" />} hint="Min. 2 caracteres" />
          <Select
            label="Empleado"
            value={empId}
            onChange={setEmpId}
            options={(empOptions.data ?? []).map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.first_name} ${e.last_name}` }))}
            placeholder={empOptions.isFetching ? 'Buscando…' : 'Selecciona…'}
          />
          <div className="flex items-end text-xs text-white/50">
            Total días: <span className="ml-2 font-semibold text-white">{empSummary.total}</span>
          </div>
        </div>

        {empId ? (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <div className="card p-3"><div className="text-white/60 text-xs">A tiempo</div><div className="text-lg font-bold">{empSummary.a_tiempo}</div></div>
            <div className="card p-3"><div className="text-white/60 text-xs">Atrasado</div><div className="text-lg font-bold">{empSummary.atrasado}</div></div>
            <div className="card p-3"><div className="text-white/60 text-xs">Anticipada</div><div className="text-lg font-bold">{empSummary.anticipada}</div></div>
            <div className="card p-3"><div className="text-white/60 text-xs">Novedad</div><div className="text-lg font-bold">{empSummary.novedad}</div></div>
            <div className="card p-3"><div className="text-white/60 text-xs">Total</div><div className="text-lg font-bold">{empSummary.total}</div></div>
          </div>
        ) : null}

        {empDaily.isError ? <div className="mt-3 text-xs text-rose-200">{(empDaily.error as any)?.message || 'Error'}</div> : null}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {widgets.includes('turn') ? (
          byTurn.isError ? (
            <Card title="KPI 1 — Asistencia por Turno"><div className="text-xs text-amber-200">RPC get_kpi_attendance_by_turn no disponible. Ejecuta el SQL del ZIP.</div></Card>
          ) : (
            <AggTable title="KPI 1 — Asistencia por Turno" rows={byTurn.data ?? []} keyField="turn_name" />
          )
        ) : null}

        {widgets.includes('department') ? (
          byDept.isError ? (
            <Card title="KPI 3 — Asistencia por Departamento"><div className="text-xs text-amber-200">RPC get_kpi_attendance_by_department no disponible. Ejecuta el SQL del ZIP.</div></Card>
          ) : (
            <AggTable title="KPI 3 — Asistencia por Departamento" rows={byDept.data ?? []} keyField="department_name" />
          )
        ) : null}
      </div>

      {widgets.includes('ranking') ? (
        <Card title="KPI Ranking Top X" subtitle="Click para drill-down" actions={<Trophy size={18} className="text-white/60" />}>
          {ranking.isError ? (
            <div className="text-xs text-amber-200">RPC get_kpi_ranking no disponible. Ejecuta el SQL del ZIP.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-white/60">
                  <tr>
                    <th className="py-2 text-left">Empleado</th>
                    <th className="py-2 text-left">Departamento</th>
                    <th className="py-2 text-right">Score</th>
                    <th className="py-2 text-right">Atrasos</th>
                    <th className="py-2 text-right">Anticipadas</th>
                    <th className="py-2 text-right">Novedades</th>
                  </tr>
                </thead>
                <tbody>
                  {(ranking.data ?? []).map((r) => (
                    <tr
                      key={r.employee_id}
                      className="border-t border-white/10 cursor-pointer hover:bg-white/5"
                      onClick={() => { setSelected(r); setOpen(true) }}
                    >
                      <td className="py-2"><div className="font-semibold">{r.employee_code}</div><div className="text-white/70">{r.employee_name}</div></td>
                      <td className="py-2 text-white/70">{r.department_name}</td>
                      <td className="py-2 text-right"><Badge tone={r.score >= 3 ? 'bad' : r.score >= 1 ? 'warn' : 'good'}>{r.score}</Badge></td>
                      <td className="py-2 text-right">{r.atrasos}</td>
                      <td className="py-2 text-right">{r.anticipadas}</td>
                      <td className="py-2 text-right">{r.novedades}</td>
                    </tr>
                  ))}
                  {(ranking.data ?? []).length === 0 ? <tr><td className="py-6 text-center text-white/55" colSpan={6}>Sin datos.</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      <Modal open={open} title={selected ? `Detalle: ${selected.employee_code} — ${selected.employee_name}` : 'Detalle'} onClose={() => setOpen(false)}>
        {detail.isLoading ? (
          <div className="text-white/70">Cargando…</div>
        ) : detail.isError ? (
          <div className="text-rose-200">{(detail.error as any)?.message || 'Error'}</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-white/60"><tr><th className="py-2 text-left">Fecha</th><th className="py-2 text-left">Estado</th><th className="py-2 text-left">Novedad</th></tr></thead>
              <tbody>
                {(detail.data ?? []).map((r: any, idx: number) => (
                  <tr key={idx} className="border-t border-white/10"><td className="py-2">{r.work_date}</td><td className="py-2"><Badge tone={String(r.day_status || '').includes('ATRAS') ? 'warn' : String(r.day_status || '').includes('NOVE') ? 'bad' : 'good'}>{r.day_status ?? '—'}</Badge></td><td className="py-2 text-white/70">{r.novelty ?? '—'}</td></tr>
                ))}
                {(detail.data ?? []).length === 0 ? <tr><td className="py-6 text-center text-white/55" colSpan={3}>Sin datos.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
