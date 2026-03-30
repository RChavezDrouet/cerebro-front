
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Download, PlayCircle, RefreshCw, Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadBiometricDevices, loadBiometricHistory, loadTenantOptions, runBiometricDiagnostic } from '../services/cerebroEnhancements'

const statusTone = (status: string) => {
  if (status === 'healthy') return 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10'
  if (status === 'warning') return 'text-amber-200 border-amber-500/25 bg-amber-500/10'
  return 'text-red-200 border-red-500/25 bg-red-500/10'
}

export default function BiometricTestsPage() {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [tenants, setTenants] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    tenant_id: '',
    serial_no: '',
    window_minutes: 15,
  })
  const [result, setResult] = useState<any>(null)
  const reportRef = useRef<HTMLDivElement | null>(null)

  const filteredDevices = useMemo(() => {
    if (!form.tenant_id) return devices
    return devices.filter((row) => row.tenant_id === form.tenant_id)
  }, [devices, form.tenant_id])

  const load = async () => {
    setLoading(true)
    try {
      const [tenantRows, historyRows] = await Promise.all([loadTenantOptions(), loadBiometricHistory()])
      setTenants(tenantRows || [])
      setHistory(historyRows || [])
      if (form.tenant_id) {
        setDevices(await loadBiometricDevices(form.tenant_id))
      } else {
        setDevices(await loadBiometricDevices())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    ;(async () => {
      setDevices(await loadBiometricDevices(form.tenant_id || null))
    })()
  }, [form.tenant_id])

  const onRun = async () => {
    if (!form.tenant_id) {
      toast.error('Seleccione una empresa')
      return
    }
    if (!form.serial_no) {
      toast.error('Seleccione un biométrico')
      return
    }

    setRunning(true)
    try {
      const diagnostic = await runBiometricDiagnostic(form)
      setResult(diagnostic)
      setHistory(await loadBiometricHistory())
      toast.success('Diagnóstico ejecutado')
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo ejecutar diagnóstico')
    } finally {
      setRunning(false)
    }
  }

  const exportPdf = () => {
    const report = result || history[0]
    if (!report) {
      toast.error('No hay resultado para exportar')
      return
    }

    const tenantName = tenants.find((t) => t.id === report.tenant_id)?.name || report.tenant_id || 'Tenant'
    const rows = (report.checks || [])
      .map((check: any) => `<tr><td style="padding:8px;border:1px solid #d6d6d6">${check.label}</td><td style="padding:8px;border:1px solid #d6d6d6">${check.status ? 'OK' : 'FALLO'}</td><td style="padding:8px;border:1px solid #d6d6d6">${check.detail}</td></tr>`)
      .join('')

    const html = `
      <html>
        <head>
          <title>Test biométrico</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin-bottom: 8px; }
            .meta { margin-bottom: 16px; font-size: 12px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #e5e7eb; font-size: 12px; font-weight: bold; }
            .healthy { background: #dcfce7; }
            .warning { background: #fef3c7; }
            .critical { background: #fee2e2; }
          </style>
        </head>
        <body>
          <h1>Reporte de test biométrico</h1>
          <div class="meta">Empresa: ${tenantName} · Serial: ${report.serial_no || 'N/D'} · Ejecutado: ${new Date(report.executed_at).toLocaleString()}</div>
          <span class="badge ${report.overall_status}">${String(report.overall_status || '').toUpperCase()}</span>
          <table>
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #d6d6d6;text-align:left">Chequeo</th>
                <th style="padding:8px;border:1px solid #d6d6d6;text-align:left">Estado</th>
                <th style="padding:8px;border:1px solid #d6d6d6;text-align:left">Detalle</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:16px;font-size:12px;color:#6b7280">Nota: la exportación PDF usa el diálogo de impresión del navegador.</p>
        </body>
      </html>
    `

    const win = window.open('', '_blank', 'width=920,height=720')
    if (!win) {
      toast.error('El navegador bloqueó la ventana emergente')
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Test biométrico</h1>
          <p className="text-sm text-slate-400 mt-1">
            Verifica registro del equipo, actividad del gateway y persistencia en raw, punches y attendance_records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary inline-flex items-center gap-2" onClick={load}>
            <RefreshCw className="w-4 h-4" />
            Recargar
          </button>
          <button className="btn-primary inline-flex items-center gap-2" onClick={exportPdf}>
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="card p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="input-label">Empresa</label>
          <select className="input-field" value={form.tenant_id} onChange={(e) => setForm((p: any) => ({ ...p, tenant_id: e.target.value, serial_no: '' }))}>
            <option value="">Seleccione</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name || tenant.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Biométrico / Serial</label>
          <select className="input-field" value={form.serial_no} onChange={(e) => setForm((p: any) => ({ ...p, serial_no: e.target.value }))}>
            <option value="">Seleccione</option>
            {filteredDevices.map((device) => {
              const serial = device.serial_no || device.serial || device.sn || device.device_serial || device.id
              return (
                <option key={device.id || serial} value={serial}>
                  {serial} {device.location ? `· ${device.location}` : ''}
                </option>
              )
            })}
          </select>
        </div>
        <div>
          <label className="input-label">Ventana de análisis (min)</label>
          <input type="number" className="input-field" value={form.window_minutes} onChange={(e) => setForm((p: any) => ({ ...p, window_minutes: Number(e.target.value || 15) }))} />
        </div>
        <div className="flex items-end">
          <button className="btn-primary inline-flex items-center gap-2 w-full" onClick={onRun} disabled={running || loading}>
            <PlayCircle className="w-4 h-4" />
            {running ? 'Ejecutando...' : 'Ejecutar test'}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Resultado actual</h2>
              <p className="text-sm text-slate-400">El diagnóstico usa la última ventana de eventos del equipo seleccionado.</p>
            </div>
            {result && (
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(result.overall_status)}`}>
                <Activity className="w-4 h-4" />
                {String(result.overall_status || '').toUpperCase()}
              </span>
            )}
          </div>

          {!result ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[rgba(148,163,184,0.16)] p-8 text-center text-sm text-slate-500">
              Ejecute un test para ver el reporte.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[rgba(148,163,184,0.10)] bg-white/5 p-4">
                  <div className="text-xs text-slate-400">Serial</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{result.serial_no || 'N/D'}</div>
                </div>
                <div className="rounded-2xl border border-[rgba(148,163,184,0.10)] bg-white/5 p-4">
                  <div className="text-xs text-slate-400">Último heartbeat</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{result.last_heartbeat_at ? new Date(result.last_heartbeat_at).toLocaleString() : 'Sin eventos'}</div>
                </div>
                <div className="rounded-2xl border border-[rgba(148,163,184,0.10)] bg-white/5 p-4">
                  <div className="text-xs text-slate-400">Ventana</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{result.window_minutes} min</div>
                </div>
              </div>

              <div className="space-y-3">
                {(result.checks || []).map((check: any) => (
                  <div key={check.key} className="rounded-2xl border border-[rgba(148,163,184,0.10)] bg-[rgba(15,23,42,0.35)] p-4">
                    <div className="flex items-start gap-3">
                      {check.status ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-300 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-300 mt-0.5" />
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{check.label}</div>
                        <div className="mt-1 text-xs text-slate-400">{check.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)] p-4 text-sm text-slate-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" />
                <div>
                  El test valida flujo lógico y persistencia. La prueba física del equipo y del gateway expuesto en red debe complementarse con revisión operativa y logs del host.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold">Historial</h2>
          <p className="text-sm text-slate-400">Últimos diagnósticos ejecutados.</p>

          <div className="mt-4 space-y-3">
            {!history.length && <div className="text-sm text-slate-500">Sin historial todavía.</div>}
            {history.map((item: any) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setResult(item.payload || item)}
                className="w-full rounded-2xl border border-[rgba(148,163,184,0.10)] bg-white/5 p-4 text-left hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-100">{item.serial_no || item.payload?.serial_no || 'N/D'}</div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(item.overall_status || item.payload?.overall_status || 'warning')}`}>
                    {(item.overall_status || item.payload?.overall_status || 'warning').toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{new Date(item.executed_at || item.payload?.executed_at || Date.now()).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
