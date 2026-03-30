/**
 * ==============================================
 * HRCloud - CEREBRO | Dashboard
 * ==============================================
 * Basado en "completar y mejorar":
 * - KPI Ingresos vs Objetivo (kpi_targets singleton)
 * - Semáforo por % de cambio mensual configurable
 * - Nuevos clientes vs objetivo
 * - Distribución por plan (ingresos pagados)
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BarChart3, Building2, RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { supabase } from '../config/supabase'
import { formatCurrency, formatPercentage } from '../utils/formatters'
import { useAuth } from '../App'

type KPI = {
  expected_revenue_monthly: number
  expected_new_clients_monthly: number
  green_change_pct: number
  yellow_change_pct: number
}

type PlanSlice = { label: string; total: number }

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const monthBounds = (base: Date) => {
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1)
  return { start, end }
}

const computeDonut = (slices: PlanSlice[]) => {
  const total = slices.reduce((s, x) => s + x.total, 0) || 1
  const palette = [
    'var(--brand-primary)',
    'var(--brand-secondary)',
    'rgba(245, 158, 11, 0.9)',
    'rgba(124, 58, 237, 0.85)',
    'rgba(148, 163, 184, 0.55)',
  ]

  let acc = 0
  const stops = slices.map((s, i) => {
    const pct = (s.total / total) * 100
    const from = acc
    const to = acc + pct
    acc = to
    const color = palette[i % palette.length]
    return `${color} ${from.toFixed(2)}% ${to.toFixed(2)}%`
  })

  return {
    total,
    background: `conic-gradient(${stops.join(', ')})`,
  }
}

const StatusPill = ({ tone, label }: { tone: 'green' | 'yellow' | 'red'; label: string }) => {
  const cls = tone === 'green' ? 'badge badge-success' : tone === 'yellow' ? 'badge badge-warning' : 'badge badge-danger'
  return <span className={cls}>{label}</span>
}

const DashboardPage: React.FC = () => {
  const { userRole } = useAuth()
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<KPI>({
    expected_revenue_monthly: 0,
    expected_new_clients_monthly: 0,
    green_change_pct: 0,
    yellow_change_pct: -5,
  })

  const [revenueThisMonth, setRevenueThisMonth] = useState(0)
  const [revenuePrevMonth, setRevenuePrevMonth] = useState(0)
  const [newClientsThisMonth, setNewClientsThisMonth] = useState(0)
  const [activeClients, setActiveClients] = useState(0)
  const [planSlices, setPlanSlices] = useState<PlanSlice[]>([])

  const { start: startThis, end: endThis } = useMemo(() => monthBounds(new Date()), [])
  const { start: startPrev, end: endPrev } = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return monthBounds(d)
  }, [])

  const refresh = async () => {
    setLoading(true)
    try {
      // KPI targets (singleton)
      const { data: kpiRow } = await supabase.from('kpi_targets').select('*').eq('id', 1).maybeSingle()
      if (kpiRow) {
        setKpi({
          expected_revenue_monthly: Number(kpiRow.expected_revenue_monthly ?? 0),
          expected_new_clients_monthly: Number(kpiRow.expected_new_clients_monthly ?? 0),
          green_change_pct: Number(kpiRow.green_change_pct ?? 0),
          yellow_change_pct: Number(kpiRow.yellow_change_pct ?? -5),
        })
      }

      // Activos
      const { count: activeCount } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      setActiveClients(activeCount ?? 0)

      // Nuevos clientes del mes
      const { count: newCount } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startThis.toISOString())
        .lt('created_at', endThis.toISOString())
      setNewClientsThisMonth(newCount ?? 0)

      // Ingresos pagados (mes actual y anterior)
      const { data: invThis } = await supabase
        .from('invoices')
        .select('total,status,created_at,tenants(plan)')
        .gte('created_at', startThis.toISOString())
        .lt('created_at', endThis.toISOString())

      const { data: invPrev } = await supabase
        .from('invoices')
        .select('total,status,created_at')
        .gte('created_at', startPrev.toISOString())
        .lt('created_at', endPrev.toISOString())

      const paidThis = (invThis ?? []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0)
      const paidPrev = (invPrev ?? []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0)

      setRevenueThisMonth(paidThis)
      setRevenuePrevMonth(paidPrev)

      // Distribución por plan (mes actual)
      const acc: Record<string, number> = {}
      ;(invThis ?? []).filter((i: any) => i.status === 'paid').forEach((i: any) => {
        const plan = i.tenants?.plan || '—'
        acc[plan] = (acc[plan] || 0) + Number(i.total || 0)
      })
      const slices = Object.entries(acc)
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
      setPlanSlices(slices)
    } catch (e) {
      console.error('Dashboard refresh error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changePct = useMemo(() => {
    if (revenuePrevMonth > 0) return ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100
    return revenueThisMonth > 0 ? 100 : 0
  }, [revenuePrevMonth, revenueThisMonth])

  const changeTone = useMemo<'green' | 'yellow' | 'red'>(() => {
    if (changePct >= kpi.green_change_pct) return 'green'
    if (changePct >= kpi.yellow_change_pct) return 'yellow'
    return 'red'
  }, [changePct, kpi.green_change_pct, kpi.yellow_change_pct])

  const revenueProgress = useMemo(() => {
    if (!kpi.expected_revenue_monthly || kpi.expected_revenue_monthly <= 0) return 0
    return clamp((revenueThisMonth / kpi.expected_revenue_monthly) * 100, 0, 100)
  }, [kpi.expected_revenue_monthly, revenueThisMonth])

  const clientsProgress = useMemo(() => {
    if (!kpi.expected_new_clients_monthly || kpi.expected_new_clients_monthly <= 0) return 0
    return clamp((newClientsThisMonth / kpi.expected_new_clients_monthly) * 100, 0, 100)
  }, [kpi.expected_new_clients_monthly, newClientsThisMonth])

  const donut = useMemo(() => computeDonut(planSlices.length ? planSlices : [{ label: '—', total: 1 }]), [planSlices])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">KPIs operativos y financieros (targets configurables).</p>
        </div>
        <button onClick={refresh} className="btn-secondary">
          <RefreshCw className={"w-4 h-4 " + (loading ? 'animate-spin' : '')} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Ingresos (mes)</p>
                <p className="mt-2 text-3xl font-bold">{loading ? '—' : formatCurrency(revenueThisMonth)}</p>
                <p className="mt-2 text-sm text-slate-400">Objetivo: {formatCurrency(kpi.expected_revenue_monthly)}</p>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-300" />
                <StatusPill tone={changeTone} label={formatPercentage(changePct)} />
              </div>
            </div>
            <div className="card-body">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Progreso</span>
                <span>{formatPercentage(revenueProgress)}</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-[rgba(148,163,184,0.14)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${revenueProgress}%`, background: 'linear-gradient(90deg,var(--brand-primary),var(--brand-secondary))' }}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Semáforo por % de cambio vs mes anterior. Umbrales: Verde ≥ {kpi.green_change_pct}%, Amarillo ≥ {kpi.yellow_change_pct}%.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Nuevos clientes (mes)</p>
                <p className="mt-2 text-3xl font-bold">{loading ? '—' : newClientsThisMonth}</p>
                <p className="mt-2 text-sm text-slate-400">Objetivo: {kpi.expected_new_clients_monthly}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,179,255,0.14)', border: '1px solid rgba(0,179,255,0.22)' }}>
                <Users className="w-5 h-5" style={{ color: 'var(--brand-secondary)' }} />
              </div>
            </div>
            <div className="card-body">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Progreso</span>
                <span>{formatPercentage(clientsProgress)}</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-[rgba(148,163,184,0.14)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${clientsProgress}%`, background: 'linear-gradient(90deg,var(--brand-secondary),rgba(124,58,237,0.85))' }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-400">Activos</span>
                <span className="font-semibold">{loading ? '—' : activeClients}</span>
              </div>
            </div>
          </div>

          <div className="card md:col-span-2">
            <div className="card-header flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Distribución de ingresos por plan (mes)</p>
                <p className="mt-2 text-sm text-slate-400">Top planes por total pagado.</p>
              </div>
              <div className="flex items-center gap-2">
                {changePct >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-300" /> : <TrendingDown className="w-5 h-5 text-rose-300" />}
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-center">
                  <div
                    className="relative w-44 h-44 rounded-full"
                    style={{ background: donut.background, boxShadow: '0 18px 45px rgba(0,0,0,0.35)' }}
                  >
                    <div className="absolute inset-8 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(2,6,23,0.85), rgba(15,23,42,0.75))', border: '1px solid rgba(148,163,184,0.14)' }}>
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <span className="text-[10px] tracking-[0.25em] uppercase text-slate-400">Total</span>
                        <span className="mt-1 text-xl font-bold">{loading ? '—' : formatCurrency(donut.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {(planSlices.length ? planSlices : [{ label: '—', total: 0 }]).map((s, idx) => {
                    const pct = donut.total > 0 ? (s.total / donut.total) * 100 : 0
                    const colors = ['var(--brand-primary)', 'var(--brand-secondary)', 'rgba(245,158,11,0.9)', 'rgba(124,58,237,0.85)', 'rgba(148,163,184,0.55)']
                    return (
                      <div key={`${s.label}-${idx}`} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[idx % colors.length] }} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-100">{s.label}</span>
                            <span className="text-slate-300">{formatCurrency(s.total)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-[rgba(148,163,184,0.12)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${clamp(pct, 0, 100)}%`, background: colors[idx % colors.length] }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-header">
            <p className="text-xs uppercase tracking-wide text-slate-400">Accesos rápidos</p>
            <p className="mt-2 text-lg font-semibold">Operación</p>
          </div>
          <div className="card-body space-y-3">
            <Link to="/tenants" className="btn-secondary w-full justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Clientes
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link to="/invoices" className="btn-secondary w-full justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Facturación
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </Link>

            {userRole === 'admin' && (
              <Link to="/settings" className="btn-primary w-full justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(4,19,12,0.25)' }} />
                  Configuración
                </span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            )}

            <div className="mt-6">
              <p className="text-xs text-slate-500">Rol actual: <span className="text-slate-300 font-semibold">{userRole ?? '—'}</span></p>
              <p className="text-xs text-slate-500">Para ajustar targets: <span className="text-slate-300 font-semibold">Settings → KPI Targets</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
