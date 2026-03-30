import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Save, Loader2, PieChart, BarChart3 } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const WIDGETS = [
  { key: 'turn', label: 'Asistencia por Turno' },
  { key: 'department', label: 'Asistencia por Departamento' },
  { key: 'ranking', label: 'Ranking Top X' },
]

type ChartType = 'bar' | 'pie' | 'donut' | '3d'

type KpiSettings = {
  tenant_id: string
  ranking_limit: number
  chart_type: ChartType
  dashboard_widgets: string[]
}

const DEFAULT_WIDGETS = ['turn', 'department', 'ranking']

async function fetchSettings(tenantId: string): Promise<KpiSettings | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('kpi_settings')
    .select('tenant_id,ranking_limit,chart_type,dashboard_widgets')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    tenant_id: data.tenant_id,
    ranking_limit: Number(data.ranking_limit ?? 10),
    chart_type: (data.chart_type ?? 'bar') as ChartType,
    dashboard_widgets: Array.isArray(data.dashboard_widgets) ? (data.dashboard_widgets as string[]) : [],
  }
}

function ChartPreview({ type }: { type: ChartType }) {
  if (type === 'pie') return <PieChart size={16} className="text-sky-200" />
  if (type === 'donut') return <PieChart size={16} className="text-fuchsia-200" />
  if (type === '3d') return <BarChart3 size={16} className="text-amber-200" />
  return <BarChart3 size={16} className="text-emerald-200" />
}

export default function KpiConfigPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId
  const qc = useQueryClient()

  const settings = useQuery({
    queryKey: ['kpi-settings', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchSettings(tenantId!),
    retry: 0,
  })

  const [rankingLimit, setRankingLimit] = React.useState(10)
  const [chartType, setChartType] = React.useState<ChartType>('bar')
  const [widgets, setWidgets] = React.useState<string[]>(DEFAULT_WIDGETS)

  React.useEffect(() => {
    if (!settings.data) return
    setRankingLimit(settings.data.ranking_limit)
    setChartType(settings.data.chart_type)
    setWidgets(settings.data.dashboard_widgets.length ? settings.data.dashboard_widgets : DEFAULT_WIDGETS)
  }, [settings.data])

  const save = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sin tenant')
      const payload = {
        tenant_id: tenantId,
        ranking_limit: Math.max(1, Math.min(100, Number(rankingLimit) || 10)),
        chart_type: chartType,
        dashboard_widgets: widgets.length ? widgets : DEFAULT_WIDGETS,
      }

      const { error } = await supabase.schema(ATT_SCHEMA).from('kpi_settings').upsert(payload, { onConflict: 'tenant_id' })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Configuración KPI guardada')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['kpi-settings', tenantId] }),
        qc.invalidateQueries({ queryKey: ['dashboard-kpi-settings', tenantId] }),
        qc.invalidateQueries({ queryKey: ['dashboard-turn-kpi'] }),
        qc.invalidateQueries({ queryKey: ['dashboard-department-kpi'] }),
        qc.invalidateQueries({ queryKey: ['dashboard-ranking-kpi'] }),
      ])
    },
    onError: (e: any) => toast.error(e?.message || 'Error al guardar la configuración KPI'),
  })

  const toggle = (key: string) => {
    setWidgets((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Configuración KPI</h1>
        <p className="mt-1 text-sm text-white/60">Parametriza Top X, KPIs visibles y el tipo de gráfica que verá el Dashboard.</p>
      </div>

      <Card title="Parámetros">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Top X (Ranking)"
            type="number"
            value={String(rankingLimit)}
            onChange={(e) => setRankingLimit(Number(e.target.value))}
            hint="1 a 100"
          />

          <div className="space-y-1">
            <Select
              label="Tipo de gráfica"
              value={chartType}
              onChange={(v) => setChartType((v as ChartType) || 'bar')}
              options={[
                { value: 'bar', label: 'Barras' },
                { value: 'pie', label: 'Pie' },
                { value: 'donut', label: 'Donut' },
                { value: '3d', label: 'Barras 3D' },
              ]}
            />
            <div className="flex items-center gap-2 text-xs text-white/60 pt-1">
              <ChartPreview type={chartType} />
              Vista seleccionada para los gráficos del dashboard.
            </div>
          </div>

          <div className="flex items-end">
            <Button
              leftIcon={save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Guardar
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-white/80">Widgets visibles en Dashboard</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            {WIDGETS.map((widget) => (
              <label key={widget.key} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <input type="checkbox" checked={widgets.includes(widget.key)} onChange={() => toggle(widget.key)} />
                {widget.label}
              </label>
            ))}
          </div>
        </div>

        {settings.isError ? (
          <div className="mt-3 text-xs text-amber-200">
            No existe la tabla <b>attendance.kpi_settings</b> o RLS la está bloqueando. Ejecuta el SQL de configuración.
          </div>
        ) : null}
      </Card>
    </div>
  )
}
