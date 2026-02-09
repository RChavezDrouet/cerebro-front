/**
 * ==============================================
 * CEREBRO SaaS - Tenants (Inquilinos)
 * ==============================================
 * Admin/Assistant:
 * - Listar, buscar, filtrar
 * - Cambiar status (active/paused)
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, PauseCircle, PlayCircle, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../config/supabase'
import { useAuth } from '../App'
import { formatSupabaseError } from '../utils/supabaseErrors'
import { formatDateSmart, formatRUC, formatRelativeTime } from '../utils/formatters'

type Tenant = {
  id: string
  name: string | null
  ruc: string | null
  contact_email: string | null
  plan: string | null
  status: string | null
  bio_serial?: string | null
  bio_location?: string | null
  billing_period?: string | null
  grace_days?: number | null
  pause_after_grace?: boolean | null
  created_at: string
}

const statusBadge = (status?: string | null) => {
  const s = (status || 'active').toLowerCase()
  const base = 'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border'
  if (s === 'paused' || s === 'suspended') {
    return (
      <span className={`${base} bg-red-500/10 border-red-500/30 text-red-200`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Deshabilitado
      </span>
    )
  }
  if (s === 'trial') {
    return <span className={`${base} bg-amber-500/10 border-amber-500/30 text-amber-100`}><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Trial</span>
  }
  return <span className={`${base} bg-emerald-500/10 border-emerald-500/30 text-emerald-100`}><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Activo</span>
}

export default function TenantsPage() {
  const { can } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Tenant[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'paused' | 'trial'>('all')

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return rows.filter((t) => {
      const s = (t.status || 'active').toLowerCase()
      if (status !== 'all' && s !== status) return false
      if (!qq) return true
      return (
        String(t.name || '').toLowerCase().includes(qq) ||
        String(t.ruc || '').toLowerCase().includes(qq) ||
        String(t.contact_email || '').toLowerCase().includes(qq) ||
        String(t.plan || '').toLowerCase().includes(qq)
      )
    })
  }, [rows, q, status])

  const load = async () => {
    setLoading(true)
    try {
      // Si el schema en Supabase no está alineado (migraciones incompletas),
      // PostgREST responde 400 con PGRST204 (columna no encontrada).
      // Para NO bloquear la UI, intentamos degradar el SELECT removiendo columnas faltantes.
      let cols = [
        'id',
        'name',
        'ruc',
        'contact_email',
        'plan',
        'status',
        'bio_serial',
        'bio_location',
        'billing_period',
        'grace_days',
        'pause_after_grace',
        'created_at',
      ]
      let orderCol: string = 'created_at'

      for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase
          .from('tenants')
          .select(cols.join(','))
          .order(orderCol, { ascending: false })

        if (!error) {
          setRows((data as any) || [])
          return
        }

        const msg = String((error as any)?.message || (error as any)?.details || error || '')
        const missingMatch =
          msg.match(/Could not find the '(.+?)' column of/i) || msg.match(/column "(.+?)" does not exist/i)

        const missingCol = missingMatch?.[1]
        if (missingCol) {
          // Si falta la columna de orden, degradar orden.
          if (missingCol === orderCol) orderCol = 'id'
          // No remover id (es el mínimo viable)
          if (missingCol !== 'id' && cols.includes(missingCol)) {
            cols = cols.filter((c) => c !== missingCol)
            continue
          }
        }

        const e = formatSupabaseError(error)
        toast.error(`${e.title}: ${e.hint}`)
        console.error('Tenants load error:', error)
        setRows([])
        return
      }

      // Fallback final (no debería llegar aquí)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const togglePause = async (tenant: Tenant) => {
  // Manual pause SOLO si NO está activo pause_after_grace (auto pausa)
  if (tenant.pause_after_grace) {
    return toast.error('Este cliente tiene pausa automática activa. Desactívala para pausar manualmente.')
  }

  const canManual = typeof can === 'function' ? (can('clients.pause_manual') || can('clients.edit')) : false
  if (!canManual) {
    return toast.error('No tiene permiso para pausar/activar clientes.')
  }

  const next = (tenant.status || 'active').toLowerCase() === 'paused' ? 'active' : 'paused'
  const { error } = await supabase.from('tenants').update({ status: next }).eq('id', tenant.id)
  if (error) return toast.error('No se pudo actualizar status (RLS?)')
  toast.success(`Cliente ${next === 'paused' ? 'pausado' : 'activado'}`)
  await load()
}

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes (Inquilinos)</h1>
          <p className="text-sm text-slate-400 mt-1">Alta, control de estado, plan y monitoreo operativo.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Recargar
          </button>
          <Link to="/tenants/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 card p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, RUC, email o plan..."
                className="input pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Estado</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input">
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="trial">Trial</option>
                <option value="paused">Pausados</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 card p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[rgba(0,230,115,0.10)] border border-[rgba(0,230,115,0.25)]">
              <ShieldCheck className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Política de pausa automática</p>
              <p className="text-xs text-slate-400 mt-1">
                Si <b>pause_after_grace</b> está activo en el tenant, el back puede pausar al exceder los días de tolerancia.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(148,163,184,0.12)] flex items-center justify-between">
          <p className="text-sm text-slate-300">{filtered.length} clientes</p>
          {loading && <p className="text-xs text-slate-500">Cargando...</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="text-left text-xs text-slate-400">
              <tr className="border-b border-[rgba(148,163,184,0.10)]">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">RUC</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Tolerancia</th>
                <th className="px-4 py-3 font-medium">Auto pausa</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                              </tr>
            </thead>
            <tbody className="text-sm">
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No hay resultados.
                  </td>
                </tr>
              )}

              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-[rgba(148,163,184,0.08)] hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-100">{t.name || '—'}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{t.contact_email || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-200">{formatRUC(String(t.ruc || '')) || '—'}</td>
                  <td className="px-4 py-4 text-slate-200">{t.plan || '—'}</td>
                  <td className="px-4 py-4 text-slate-200">
                    {typeof t.grace_days === 'number' ? `${t.grace_days} días` : '—'}
                  </td>
                  <td className="px-4 py-4 text-slate-200">
                    {t.pause_after_grace ? (
                      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border bg-amber-500/10 border-amber-500/30 text-amber-100">
                        <ShieldCheck className="w-4 h-4" /> Activa
                      </span>
                    ) : (
                      <span className="text-slate-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => togglePause(t)}
                        disabled={!!t.pause_after_grace || !(can('clients.pause_manual') || can('clients.edit'))}
                        title={t.pause_after_grace ? 'Auto-pausa activa: pausa manual deshabilitada' : 'Clic para cambiar Activo/Pausado'}
                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {statusBadge(t.status)}
                      </button>
                    </td>
                  <td className="px-4 py-4 text-slate-300" title={formatDateSmart(t.created_at)}>
                    {formatRelativeTime(t.created_at)}
                  </td>
</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
