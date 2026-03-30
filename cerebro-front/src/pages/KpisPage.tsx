// src/pages/KpisPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { cerebro, supabase } from '@/config/supabase'
import { Card, Button, Input, Select, Spinner } from '@/components/ui'
import { BarChart3, TrendingUp, Users, Receipt, Clock, AlertTriangle } from 'lucide-react'

// ── Catálogo de KPIs estático (hasta que exista cerebro.kpi_catalog en DB) ──
const KPI_CATALOG = [
  { key: 'active_tenants',   name: 'Tenants Activos',       description: 'Empresas con status=active',                data_source: 'tenants'  as const, default_chart: 'donut' as const, enabled: true },
  { key: 'overdue_invoices', name: 'Facturas Vencidas',     description: 'Facturas con status=overdue',               data_source: 'invoices' as const, default_chart: 'bar'   as const, enabled: true },
  { key: 'revenue_30d',      name: 'Ingresos 30 días',      description: 'Suma de facturas paid últimos 30 días',      data_source: 'invoices' as const, default_chart: 'line'  as const, enabled: true },
  { key: 'dso',              name: 'DSO (Días de Cobro)',   description: 'Días promedio para cobrar una factura',      data_source: 'invoices' as const, default_chart: 'line'  as const, enabled: true },
  { key: 'cei',              name: 'CEI (Eficiencia Cobro)',description: 'Porcentaje de facturas cobradas a tiempo',   data_source: 'invoices' as const, default_chart: 'bar'   as const, enabled: true },
  { key: 'new_tenants_30d',  name: 'Nuevos Clientes 30d',   description: 'Tenants creados en los últimos 30 días',    data_source: 'tenants'  as const, default_chart: 'bar'   as const, enabled: true },
  { key: 'paused_tenants',   name: 'Tenants Pausados',      description: 'Empresas en estado pausado o suspendido',   data_source: 'tenants'  as const, default_chart: 'donut' as const, enabled: true },
]

type KPI = typeof KPI_CATALOG[0]
type Widget = { kpiKey: string; chart: 'line' | 'bar' | 'donut' }
const DEFAULT_LAYOUT: Widget[] = [
  { kpiKey: 'active_tenants',   chart: 'donut' },
  { kpiKey: 'overdue_invoices', chart: 'bar'   },
  { kpiKey: 'revenue_30d',      chart: 'line'  },
]

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

export default function KpisPage() {
  const [loading, setLoading]   = useState(true)
  const [layout, setLayout]     = useState<Widget[]>(DEFAULT_LAYOUT)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const userId = await getUserId()
        if (!userId) { setLayout(DEFAULT_LAYOUT); return }

        const { data, error } = await cerebro
          .from('dashboard_layouts')
          .select('layout')
          .eq('user_id', userId)
          .maybeSingle()

        if (!error && (data as any)?.layout) {
          setLayout((data as any).layout as Widget[])
        } else {
          setLayout(DEFAULT_LAYOUT)
        }
      } catch {
        setLayout(DEFAULT_LAYOUT)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return KPI_CATALOG
    return KPI_CATALOG.filter(k => k.name.toLowerCase().includes(q) || k.key.toLowerCase().includes(q))
  }, [search])

  const addWidget = (k: KPI) => {
    if (layout.some(w => w.kpiKey === k.key)) return toast('Ya está en tu dashboard')
    setLayout(prev => [...prev, { kpiKey: k.key, chart: k.default_chart }])
  }

  const removeWidget = (key: string) => setLayout(prev => prev.filter(w => w.kpiKey !== key))

  const save = async () => {
    const userId = await getUserId()
    if (!userId) return toast.error('No hay sesión activa')
    try {
      const { error } = await cerebro
        .from('dashboard_layouts')
        .upsert({ user_id: userId, layout }, { onConflict: 'user_id' })
      if (error) throw error
      toast.success('Dashboard guardado')
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo guardar')
    }
  }

  const iconMap: Record<string, React.ReactNode> = {
    active_tenants:   <Users size={15} className="text-neon-cyan" />,
    overdue_invoices: <AlertTriangle size={15} className="text-neon-red" />,
    revenue_30d:      <TrendingUp size={15} className="text-neon-green" />,
    dso:              <Clock size={15} className="text-neon-amber" />,
    cei:              <BarChart3 size={15} className="text-neon-blue" />,
    new_tenants_30d:  <Users size={15} className="text-neon-violet" />,
    paused_tenants:   <Receipt size={15} className="text-neon-amber" />,
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">KPIs</h1>
          <p className="text-slate-500 mt-1 text-sm font-body">Catálogo de indicadores y configuración del tablero.</p>
        </div>
        <Button onClick={save}>Guardar tablero</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catálogo */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Catálogo</h2>
            <span className="text-xs text-slate-600 font-mono">{KPI_CATALOG.length} KPIs</span>
          </div>
          <Input placeholder="Buscar KPI" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-4 space-y-2 max-h-[520px] overflow-auto">
            {filtered.map(k => (
              <div key={k.key} className="p-3 rounded-xl border border-white/5 bg-white/2 hover:border-neon-blue/15 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {iconMap[k.key]}
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{k.name}</div>
                      <div className="text-xs text-slate-600 font-mono">{k.key} · {k.default_chart}</div>
                    </div>
                  </div>
                  <Button onClick={() => addWidget(k)} size="sm">+</Button>
                </div>
                {k.description && <p className="text-xs text-slate-600 mt-2">{k.description}</p>}
              </div>
            ))}
          </div>
        </Card>

        {/* Mi Dashboard */}
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Mi Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1">Widgets activos en tu dashboard.</p>
          <div className="mt-4 space-y-3">
            {layout.map(w => {
              const kpi = KPI_CATALOG.find(k => k.key === w.kpiKey)
              return (
                <div key={w.kpiKey} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/2">
                  <div className="flex items-center gap-2 min-w-0">
                    {iconMap[w.kpiKey]}
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium">{kpi?.name ?? w.kpiKey}</div>
                      <div className="text-xs text-slate-600 font-mono">{w.kpiKey}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={w.chart}
                      onChange={e => setLayout(prev => prev.map(x => x.kpiKey === w.kpiKey ? { ...x, chart: e.target.value as any } : x))}
                    >
                      <option value="line">Líneas</option>
                      <option value="bar">Barras</option>
                      <option value="donut">Anillo</option>
                    </Select>
                    <Button variant="danger" size="sm" onClick={() => removeWidget(w.kpiKey)}>Quitar</Button>
                  </div>
                </div>
              )
            })}
            {layout.length === 0 && (
              <div className="text-sm text-slate-600 py-10 text-center">
                No tienes widgets. Agrega desde el catálogo.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
