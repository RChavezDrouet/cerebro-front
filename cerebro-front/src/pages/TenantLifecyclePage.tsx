import React, { useEffect, useMemo, useState } from 'react'
import { Archive, Download, PauseCircle, PlayCircle, RefreshCw, Save, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  buildDarPayload,
  loadLifecycleSettings,
  loadTenantOptions,
  monthsPaused,
  saveLifecycleSettings,
  updateTenantLifecycleStatus,
} from '../services/cerebroEnhancements'

function tenantLabel(row: any) {
  return row?.business_name || row?.name || row?.id || 'tenant'
}

function effectiveStatus(row: any) {
  if (!row) return 'active'
  if (row.is_suspended) return 'suspended'
  return (row.status || 'active').toLowerCase()
}

export default function TenantLifecyclePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenants, setTenants] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [settings, setSettings] = useState<any>({
    paused_months_before_deactivation: 6,
    allow_manual_suspend: true,
    dar_format: 'json',
  })

  const selectedTenant = useMemo(
    () => tenants.find((row) => row.id === selectedId) || null,
    [tenants, selectedId]
  )

  const load = async () => {
    setLoading(true)
    try {
      const [tenantRows, cfg] = await Promise.all([loadTenantOptions(), loadLifecycleSettings()])
      setTenants(tenantRows || [])
      setSettings(cfg)
      if (!selectedId && tenantRows?.length) setSelectedId(tenantRows[0].id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const persistSettings = async () => {
    setSaving(true)
    try {
      await saveLifecycleSettings(settings)
      toast.success('Parámetros guardados')
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const transition = async (nextStatus: string) => {
    if (!selectedTenant) {
      toast.error('Seleccione un tenant')
      return
    }

    if (nextStatus === 'deactivated') {
      const requiredMonths = Number(settings.paused_months_before_deactivation || 0)
      const pausedMonths = monthsPaused(selectedTenant)
      if (effectiveStatus(selectedTenant) !== 'paused') {
        toast.error('Solo se puede dar de baja a un tenant pausado')
        return
      }
      if (pausedMonths < requiredMonths) {
        toast.error(`El tenant requiere al menos ${requiredMonths} meses pausado para darlo de baja`)
        return
      }
    }

    try {
      await updateTenantLifecycleStatus(selectedTenant, nextStatus)
      toast.success(`Tenant actualizado a ${nextStatus}`)
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar el tenant')
    }
  }

  const exportDar = () => {
    if (!selectedTenant) {
      toast.error('Seleccione un tenant')
      return
    }

    const payload = buildDarPayload(selectedTenant, settings)
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tenantLabel(selectedTenant).toString().replace(/\s+/g, '_')}.dar.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pausedMonths = selectedTenant ? monthsPaused(selectedTenant) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ciclo de vida del tenant</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona activación, pausa, suspensión y baja final con validación por meses pausado.
          </p>
        </div>
        <button className="btn-secondary inline-flex items-center gap-2" onClick={load}>
          <RefreshCw className="w-4 h-4" />
          Recargar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 space-y-4">
          <div className="text-sm font-semibold text-slate-100">Parámetros de baja</div>
          <div>
            <label className="input-label">Meses pausado para permitir baja</label>
            <input
              type="number"
              className="input-field"
              value={settings.paused_months_before_deactivation}
              onChange={(e) =>
                setSettings((p: any) => ({
                  ...p,
                  paused_months_before_deactivation: Number(e.target.value || 0),
                }))
              }
            />
          </div>
          <div>
            <label className="input-label">Formato DAR</label>
            <select
              className="input-field"
              value={settings.dar_format}
              onChange={(e) => setSettings((p: any) => ({ ...p, dar_format: e.target.value }))}
            >
              <option value="json">JSON</option>
              <option value="zip">ZIP</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={settings.allow_manual_suspend !== false}
              onChange={(e) =>
                setSettings((p: any) => ({ ...p, allow_manual_suspend: e.target.checked }))
              }
            />
            Permitir suspensión manual
          </label>

          <button className="btn-primary inline-flex items-center gap-2 w-full" onClick={persistSettings} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar parámetros'}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Empresa</label>
                <select className="input-field" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  <option value="">Seleccione</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenantLabel(tenant)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-3xl border border-[rgba(148,163,184,0.10)] bg-white/5 p-4">
                <div className="text-xs text-slate-400">Elegibilidad de baja</div>
                <div className="mt-2 text-sm font-semibold text-slate-100">
                  {selectedTenant &&
                  effectiveStatus(selectedTenant) === 'paused' &&
                  pausedMonths >= Number(settings.paused_months_before_deactivation || 0)
                    ? 'Cumple condición'
                    : 'Aún no cumple'}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Meses pausado aproximados: {pausedMonths.toFixed(1)}
                </div>
              </div>
            </div>

            {selectedTenant && (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                <button className="btn-primary inline-flex items-center gap-2 justify-center" onClick={() => transition('active')}>
                  <PlayCircle className="w-4 h-4" />
                  Activar
                </button>
                <button className="btn-secondary inline-flex items-center gap-2 justify-center" onClick={() => transition('paused')}>
                  <PauseCircle className="w-4 h-4" />
                  Pausar
                </button>
                <button
                  className="btn-secondary inline-flex items-center gap-2 justify-center"
                  onClick={() => transition('suspended')}
                  disabled={settings.allow_manual_suspend === false}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Suspender
                </button>
                <button className="btn-danger inline-flex items-center gap-2 justify-center" onClick={() => transition('deactivated')}>
                  <Archive className="w-4 h-4" />
                  Dar de baja
                </button>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Paquete DAR</h2>
                <p className="text-sm text-slate-400">
                  Genera el archivo de salida para respaldo y transferencia manual a USB autorizado.
                </p>
              </div>
              <button className="btn-primary inline-flex items-center gap-2" onClick={exportDar}>
                <Download className="w-4 h-4" />
                Exportar DAR
              </button>
            </div>

            {selectedTenant ? (
              <div className="mt-4 rounded-3xl border border-[rgba(148,163,184,0.10)] bg-[rgba(15,23,42,0.35)] p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">Tenant</div>
                    <div className="mt-1 text-slate-100 font-semibold">{tenantLabel(selectedTenant)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Estado actual</div>
                    <div className="mt-1 text-slate-100 font-semibold">{effectiveStatus(selectedTenant)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Meses pausado</div>
                    <div className="mt-1 text-slate-100 font-semibold">{pausedMonths.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Formato</div>
                    <div className="mt-1 text-slate-100 font-semibold">{settings.dar_format}</div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-400">
                  La exportación entregada por frontend contiene el manifiesto DAR. El respaldo integral de datos operativos debe ser producido por backend y luego copiado al USB en un equipo seguro.
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">Seleccione un tenant para generar el paquete DAR.</div>
            )}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(148,163,184,0.10)] text-sm text-slate-300">
              Resumen de tenants
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Empresa</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Meses pausado</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-t border-[rgba(148,163,184,0.08)]">
                      <td className="px-4 py-3 text-slate-100">{tenantLabel(tenant)}</td>
                      <td className="px-4 py-3 text-slate-200">{effectiveStatus(tenant)}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{monthsPaused(tenant).toFixed(1)}</td>
                    </tr>
                  ))}
                  {!loading && tenants.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                        Sin tenants.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
