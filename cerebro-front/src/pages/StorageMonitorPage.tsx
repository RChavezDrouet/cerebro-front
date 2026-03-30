
import React, { useEffect, useMemo, useState } from 'react'
import { Download, HardDrive, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadStorageSettings, loadStorageUsage, saveStorageSettings } from '../services/cerebroEnhancements'

export default function StorageMonitorPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({
    enabled: true,
    threshold_gb: 8,
    threshold_percent: 80,
    notify_emails: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [rows, cfg] = await Promise.all([loadStorageUsage(), loadStorageSettings()])
      setUsage(rows || [])
      setSettings(cfg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totalUsed = useMemo(() => usage.reduce((acc, row) => acc + Number(row.used_gb || 0), 0), [usage])

  const onSave = async () => {
    setSaving(true)
    try {
      await saveStorageSettings(settings)
      toast.success('Parámetros de umbral guardados')
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    const header = ['tenant_id', 'tenant_name', 'used_gb', 'quota_gb', 'measured_at', 'source']
    const lines = [header.join(',')]
    usage.forEach((row) => {
      lines.push([
        row.tenant_id,
        `"${String(row.tenant_name || '').replace(/"/g, '""')}"`,
        row.used_gb,
        row.quota_gb,
        row.measured_at || '',
        row.source || '',
      ].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cerebro-storage-usage.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const tone = (row: any) => {
    const used = Number(row.used_gb || 0)
    const quota = Number(row.quota_gb || 0)
    const pct = quota > 0 ? (used / quota) * 100 : 0
    if (used >= Number(settings.threshold_gb || 0) || pct >= Number(settings.threshold_percent || 0)) return 'text-red-200 bg-red-500/10 border-red-500/25'
    if (quota > 0 && pct >= Number(settings.threshold_percent || 0) * 0.8) return 'text-amber-200 bg-amber-500/10 border-amber-500/25'
    return 'text-emerald-200 bg-emerald-500/10 border-emerald-500/25'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Capacidad de base / almacenamiento</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitorea consumo por tenant y define umbrales para alertas por correo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary inline-flex items-center gap-2" onClick={load}>
            <RefreshCw className="w-4 h-4" />
            Recargar
          </button>
          <button className="btn-primary inline-flex items-center gap-2" onClick={exportCsv}>
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-slate-100" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">Alerta de uso</div>
              <div className="text-xs text-slate-400">Cuando se supera el umbral configurado se dispara el correo.</div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={settings.enabled !== false} onChange={(e) => setSettings((p: any) => ({ ...p, enabled: e.target.checked }))} />
            Alertas habilitadas
          </label>

          <div>
            <label className="input-label">Umbral GB</label>
            <input type="number" step="0.1" className="input-field" value={settings.threshold_gb} onChange={(e) => setSettings((p: any) => ({ ...p, threshold_gb: Number(e.target.value || 0) }))} />
          </div>
          <div>
            <label className="input-label">Umbral %</label>
            <input type="number" className="input-field" value={settings.threshold_percent} onChange={(e) => setSettings((p: any) => ({ ...p, threshold_percent: Number(e.target.value || 0) }))} />
          </div>
          <div>
            <label className="input-label">Enviar correo a</label>
            <textarea className="input-field min-h-[120px]" value={settings.notify_emails || ''} onChange={(e) => setSettings((p: any) => ({ ...p, notify_emails: e.target.value }))} placeholder="soporte@empresa.com, finanzas@empresa.com" />
          </div>

          <button className="btn-primary inline-flex items-center gap-2 w-full" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="text-xs text-slate-400">Tenants medidos</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{usage.length}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-slate-400">Total estimado / medido</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{totalUsed.toFixed(2)} GB</div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-slate-400">Origen</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{usage[0]?.source || '—'}</div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(148,163,184,0.10)] text-sm text-slate-300">
              {loading ? 'Cargando uso...' : 'Detalle por tenant'}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tenant</th>
                    <th className="px-4 py-3 font-medium text-right">Usado GB</th>
                    <th className="px-4 py-3 font-medium text-right">Cuota GB</th>
                    <th className="px-4 py-3 font-medium text-right">% uso</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row) => {
                    const used = Number(row.used_gb || 0)
                    const quota = Number(row.quota_gb || 0)
                    const pct = quota > 0 ? (used / quota) * 100 : 0
                    return (
                      <tr key={row.tenant_id} className="border-t border-[rgba(148,163,184,0.08)]">
                        <td className="px-4 py-3 text-slate-100">{row.tenant_name || row.tenant_id}</td>
                        <td className="px-4 py-3 text-right text-slate-200">{used.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-200">{quota ? quota.toFixed(2) : '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-200">{quota ? `${pct.toFixed(1)}%` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone(row)}`}>
                            {quota ? (pct >= settings.threshold_percent || used >= settings.threshold_gb ? 'Umbral superado' : 'Normal') : 'Sin cuota'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {!loading && usage.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        Sin datos de uso.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.35)] p-5 text-sm text-slate-300">
            El uso físico exacto por tenant en una base compartida debe ser calculado en backend mediante tarea programada. Esta pantalla ya deja parametrizado el umbral y la lista de destinatarios.
          </div>
        </div>
      </div>
    </div>
  )
}
