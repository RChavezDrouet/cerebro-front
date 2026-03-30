import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Timer, AlertTriangle, CalendarDays, PieChart, BarChart3, Trophy, Building2 } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'

type DailyRow = { day_status?: string | null }
type ChartType = 'bar' | 'pie' | 'donut' | '3d'
type KpiSettings = { ranking_limit: number; chart_type: ChartType; dashboard_widgets: string[] }
type DepartmentKpi = { department_name: string; total: number; a_tiempo: number; atrasado: number; anticipada: number; novedad: number }
type TurnKpi = { turn_name: string; total: number; a_tiempo: number; atrasado: number; anticipada: number; novedad: number }
type RankingKpi = { employee_id?: string; employee_code: string; employee_name: string; total: number; atrasos: number; novedades: number }

type ChartDatum = { label: string; value: number; detail?: string }

const DEFAULT_SETTINGS: KpiSettings = {
  ranking_limit: 10,
  chart_type: 'bar',
  dashboard_widgets: ['turn', 'department', 'ranking'],
}

function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function fetchDaily(tenantId: string, date: string): Promise<DailyRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_daily_attendance_report_v2', { p_tenant_id: tenantId, p_date_from: date, p_date_to: date })
  if (error) throw error
  return (data ?? []) as DailyRow[]
}

async function fetchSettings(tenantId: string): Promise<KpiSettings> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('kpi_settings')
    .select('ranking_limit,chart_type,dashboard_widgets')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  if (!data) return DEFAULT_SETTINGS
  return {
    ranking_limit: Number(data.ranking_limit ?? DEFAULT_SETTINGS.ranking_limit),
    chart_type: (data.chart_type ?? DEFAULT_SETTINGS.chart_type) as ChartType,
    dashboard_widgets: Array.isArray(data.dashboard_widgets) && data.dashboard_widgets.length ? (data.dashboard_widgets as string[]) : DEFAULT_SETTINGS.dashboard_widgets,
  }
}

async function fetchDepartmentKpi(tenantId: string, date: string): Promise<DepartmentKpi[]> {
  const { data, error } = await supabase.schema(ATT_SCHEMA).rpc('get_kpi_attendance_by_department', {
    p_tenant_id: tenantId,
    p_date_from: date,
    p_date_to: date,
  })
  if (error) throw error
  return (data ?? []) as DepartmentKpi[]
}

async function fetchTurnKpi(tenantId: string, date: string): Promise<TurnKpi[]> {
  const { data, error } = await supabase.schema(ATT_SCHEMA).rpc('get_kpi_attendance_by_turn', {
    p_tenant_id: tenantId,
    p_date_from: date,
    p_date_to: date,
  })
  if (error) throw error
  return (data ?? []) as TurnKpi[]
}

async function fetchRankingKpi(tenantId: string, date: string, limit: number): Promise<RankingKpi[]> {
  const { data, error } = await supabase.schema(ATT_SCHEMA).rpc('get_kpi_ranking', {
    p_tenant_id: tenantId,
    p_date_from: date,
    p_date_to: date,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as RankingKpi[]
}

function norm(s?: string | null) {
  const v = String(s || '').toUpperCase()
  if (v.includes('ATRAS')) return 'ATRASADO'
  if (v.includes('A_TIEM')) return 'A_TIEMPO'
  if (v.includes('ANTIC')) return 'ANTICIPADA'
  if (v.includes('NOVE')) return 'NOVEDAD'
  return v || '—'
}

function chartTone(index: number) {
  const tones = [
    'from-sky-500/80 to-cyan-300/70',
    'from-fuchsia-500/80 to-pink-300/70',
    'from-emerald-500/80 to-lime-300/70',
    'from-amber-500/80 to-yellow-300/70',
    'from-violet-500/80 to-indigo-300/70',
    'from-rose-500/80 to-orange-300/70',
  ]
  return tones[index % tones.length]
}

function chartSolid(index: number) {
  const tones = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#818cf8', '#fb7185']
  return tones[index % tones.length]
}

function formatPct(value: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function makeConicGradient(items: ChartDatum[]) {
  const total = Math.max(1, items.reduce((acc, item) => acc + item.value, 0))
  let cursor = 0
  const slices = items.map((item, index) => {
    const start = cursor
    const end = cursor + (item.value / total) * 360
    cursor = end
    return `${chartSolid(index)} ${start}deg ${end}deg`
  })
  return `conic-gradient(${slices.join(', ')})`
}

function ChartCard({
  title,
  icon,
  type,
  data,
  emptyText,
}: {
  title: string
  icon: React.ReactNode
  type: ChartType
  data: ChartDatum[]
  emptyText: string
}) {
  const total = data.reduce((acc, item) => acc + item.value, 0)

  return (
    <Card title={title} actions={icon} className="overflow-hidden">
      {!data.length ? (
        <div className="text-sm text-white/55 py-6">{emptyText}</div>
      ) : type === 'pie' || type === 'donut' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-5 items-center">
          <div className="flex items-center justify-center py-2">
            <div
              className="relative h-44 w-44 rounded-full shadow-[0_18px_55px_rgba(0,0,0,0.35)]"
              style={{ background: makeConicGradient(data) }}
            >
              {type === 'donut' ? <div className="absolute inset-8 rounded-full bg-slate-950/95 border border-white/10" /> : null}
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Total</div>
                  <div className="text-3xl font-bold">{total}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {data.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: chartSolid(index) }} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.label}</div>
                    {item.detail ? <div className="text-xs text-white/50 truncate">{item.detail}</div> : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{item.value}</div>
                  <div className="text-xs text-white/50">{formatPct(item.value, total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => {
            const ratio = total ? Math.max(10, Math.round((item.value / total) * 100)) : 0
            const barClass = type === '3d'
              ? `bg-gradient-to-r ${chartTone(index)} shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_rgba(0,0,0,0.25)]`
              : `bg-gradient-to-r ${chartTone(index)}`
            return (
              <div key={`${item.label}-${index}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium truncate">{item.label}</span>
                  <span className="text-white/70 shrink-0">{item.value}</span>
                </div>
                <div className="h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barClass}`}
                    style={{ width: `${ratio}%`, transform: type === '3d' ? 'perspective(90px) rotateX(-18deg)' : 'none', transformOrigin: 'left center' }}
                  />
                </div>
                {item.detail ? <div className="text-xs text-white/45">{item.detail}</div> : null}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const date = todayISO()

  const settings = useQuery({
    queryKey: ['dashboard-kpi-settings', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchSettings(tenantId!),
    staleTime: 60_000,
  })

  const daily = useQuery({
    queryKey: ['dash-daily', tenantId, date],
    enabled: !!tenantId,
    queryFn: () => fetchDaily(tenantId!, date),
  })

  const department = useQuery({
    queryKey: ['dashboard-department-kpi', tenantId, date],
    enabled: !!tenantId,
    queryFn: () => fetchDepartmentKpi(tenantId!, date),
  })

  const turn = useQuery({
    queryKey: ['dashboard-turn-kpi', tenantId, date],
    enabled: !!tenantId,
    queryFn: () => fetchTurnKpi(tenantId!, date),
  })

  const rankingLimit = settings.data?.ranking_limit ?? DEFAULT_SETTINGS.ranking_limit
  const ranking = useQuery({
    queryKey: ['dashboard-ranking-kpi', tenantId, date, rankingLimit],
    enabled: !!tenantId,
    queryFn: () => fetchRankingKpi(tenantId!, date, rankingLimit),
  })

  const chartType = settings.data?.chart_type ?? DEFAULT_SETTINGS.chart_type
  const widgets = settings.data?.dashboard_widgets ?? DEFAULT_SETTINGS.dashboard_widgets

  const stats = React.useMemo(() => {
    const rows = (daily.data ?? []) as DailyRow[]
    const s = { total: rows.length, a_tiempo: 0, atrasado: 0, novedad: 0 }
    for (const r of rows) {
      const st = norm(r.day_status)
      if (st === 'A_TIEMPO') s.a_tiempo++
      else if (st === 'ATRASADO') s.atrasado++
      else if (st === 'NOVEDAD') s.novedad++
    }
    return s
  }, [daily.data])

  const departmentData = React.useMemo<ChartDatum[]>(() =>
    (department.data ?? [])
      .map((row) => ({
        label: row.department_name || 'Sin departamento',
        value: Number(row.total ?? 0),
        detail: `${row.a_tiempo ?? 0} a tiempo · ${row.atrasado ?? 0} atrasos · ${row.novedad ?? 0} novedades`,
      }))
      .filter((item) => item.value > 0),
    [department.data],
  )

  const turnData = React.useMemo<ChartDatum[]>(() =>
    (turn.data ?? [])
      .map((row) => ({
        label: row.turn_name || 'Sin turno',
        value: Number(row.total ?? 0),
        detail: `${row.a_tiempo ?? 0} a tiempo · ${row.atrasado ?? 0} atrasos · ${row.novedad ?? 0} novedades`,
      }))
      .filter((item) => item.value > 0),
    [turn.data],
  )

  const rankingData = React.useMemo<ChartDatum[]>(() =>
    (ranking.data ?? []).map((row) => ({
      label: `${row.employee_name} (${row.employee_code})`,
      value: Number(row.novedades ?? row.atrasos ?? 0),
      detail: `${row.atrasos ?? 0} atrasos · ${row.novedades ?? 0} novedades · ${row.total ?? 0} registros`,
    })),
    [ranking.data],
  )

  const anyError = daily.isError || department.isError || turn.isError || ranking.isError || settings.isError

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-white/60">Resumen de asistencia del día y KPIs configurables.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title="Empleados" subtitle="Registros del día" actions={<Users size={18} className="text-white/60" />}>
          <div className="text-3xl font-bold">{stats.total}</div>
        </Card>
        <Card title="A tiempo" subtitle="Marcaciones correctas" actions={<Timer size={18} className="text-white/60" />}>
          <div className="flex items-end justify-between"><div className="text-3xl font-bold">{stats.a_tiempo}</div><Badge tone="good">OK</Badge></div>
        </Card>
        <Card title="Atrasados" subtitle="Llegadas tardías" actions={<AlertTriangle size={18} className="text-white/60" />}>
          <div className="flex items-end justify-between"><div className="text-3xl font-bold">{stats.atrasado}</div><Badge tone="warn">Atención</Badge></div>
        </Card>
        <Card title="Novedades" subtitle="Inconsistencias" actions={<CalendarDays size={18} className="text-white/60" />}>
          <div className="flex items-end justify-between"><div className="text-3xl font-bold">{stats.novedad}</div><Badge tone="bad">Revisión</Badge></div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Tipo de gráfica: <b className="text-white">{chartType}</b></span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Top X: <b className="text-white">{rankingLimit}</b></span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Widgets: <b className="text-white">{widgets.join(', ') || 'ninguno'}</b></span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {widgets.includes('turn') ? (
          <ChartCard
            title="Asistencia por turno"
            icon={chartType === 'pie' || chartType === 'donut' ? <PieChart size={18} className="text-white/60" /> : <BarChart3 size={18} className="text-white/60" />}
            type={chartType}
            data={turnData}
            emptyText="No hay datos de turnos para el día seleccionado."
          />
        ) : null}

        {widgets.includes('department') ? (
          <ChartCard
            title="Asistencia por departamento"
            icon={<Building2 size={18} className="text-white/60" />}
            type={chartType}
            data={departmentData}
            emptyText="No hay datos de departamentos para el día seleccionado."
          />
        ) : null}

        {widgets.includes('ranking') ? (
          <ChartCard
            title={`Ranking Top ${rankingLimit}`}
            icon={<Trophy size={18} className="text-white/60" />}
            type={chartType === 'pie' ? 'bar' : chartType}
            data={rankingData}
            emptyText="No hay ranking calculado para el día seleccionado."
          />
        ) : null}
      </div>

      {anyError ? <div className="text-sm text-rose-200">{(daily.error as any)?.message || (department.error as any)?.message || (turn.error as any)?.message || (ranking.error as any)?.message || (settings.error as any)?.message || 'Error cargando el dashboard'}</div> : null}
    </div>
  )
}
