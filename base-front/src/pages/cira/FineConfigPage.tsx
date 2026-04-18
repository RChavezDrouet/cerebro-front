import React, { useState, useEffect } from 'react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import { z } from 'zod'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalcMethod   = 'per_minute' | 'fixed' | 'proportional'
type IncidentType = 'ATRASO_ENTRADA' | 'ATRASO_ALMUERZO' | 'SALIDA_TEMPRANA' | 'AUSENCIA_INJUSTIFICADA'

type FineConfig = {
  id?:           string
  tenant_id?:    string
  incident_type: IncidentType
  calc_method:   CalcMethod
  value:         number
  grace_minutes: number
  is_active:     boolean
}

type FineLedgerEntry = {
  id:                 string
  incident_date:      string
  incident_type:      string
  employee_id:        string
  calculated_amount:  number
  applied_amount:     number
  was_capped:         boolean
  cap_excess:         number
  month_year:         string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INCIDENT_TYPES: IncidentType[] = [
  'ATRASO_ENTRADA',
  'ATRASO_ALMUERZO',
  'SALIDA_TEMPRANA',
  'AUSENCIA_INJUSTIFICADA',
]

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  ATRASO_ENTRADA:         'Atraso en Entrada',
  ATRASO_ALMUERZO:        'Atraso Retorno de Almuerzo',
  SALIDA_TEMPRANA:        'Salida Temprana',
  AUSENCIA_INJUSTIFICADA: 'Ausencia Injustificada',
}

const CALC_METHOD_LABELS: Record<CalcMethod, string> = {
  per_minute:   'Por minuto (USD/min)',
  fixed:        'Monto fijo (USD)',
  proportional: 'Proporcional (factor × HB)',
}

// Valores por defecto si la fila no existe aún en DB (idempotente con seed)
const DEFAULT_CONFIGS: FineConfig[] = [
  { incident_type: 'ATRASO_ENTRADA',         calc_method: 'per_minute', value: 0.05, grace_minutes: 5, is_active: true },
  { incident_type: 'ATRASO_ALMUERZO',        calc_method: 'per_minute', value: 0.05, grace_minutes: 5, is_active: true },
  { incident_type: 'SALIDA_TEMPRANA',        calc_method: 'per_minute', value: 0.05, grace_minutes: 0, is_active: true },
  { incident_type: 'AUSENCIA_INJUSTIFICADA', calc_method: 'fixed',      value: 20.0, grace_minutes: 0, is_active: true },
]

// ─── Zod validation ───────────────────────────────────────────────────────────

const fineConfigRowSchema = z.object({
  calc_method:   z.enum(['per_minute', 'fixed', 'proportional']),
  value:         z.number().min(0, 'El valor debe ser ≥ 0'),
  grace_minutes: z.number().int().min(0).max(120, 'Máximo 120 minutos de tolerancia'),
  is_active:     z.boolean(),
})

// ─── Component ────────────────────────────────────────────────────────────────

const FineConfigPage: React.FC = () => {
  const { tenantId } = useTenantStore()

  const [configs, setConfigs]           = useState<FineConfig[]>(DEFAULT_CONFIGS.map(d => ({ ...d })))
  const [ledger, setLedger]             = useState<FineLedgerEntry[]>([])
  const [ledgerPending, setLedgerPending] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // ── fine_config ────────────────────────────────────────────────────────
      const { data: configRows, error: configError } = await supabase
        .schema(ATT_SCHEMA)
        .from('fine_config')
        .select('id, tenant_id, incident_type, calc_method, value, grace_minutes, is_active')
        .order('incident_type')

      if (configError) throw configError

      // Merge filas DB con DEFAULT_CONFIGS: siempre muestra los 4 tipos
      const merged: FineConfig[] = INCIDENT_TYPES.map(type => {
        const dbRow = configRows?.find(r => r.incident_type === type)
        if (dbRow) return dbRow as FineConfig
        return { ...DEFAULT_CONFIGS.find(d => d.incident_type === type)! }
      })
      setConfigs(merged)

      // ── fine_ledger (tabla de Sesión C-4 — puede no existir aún) ──────────
      try {
        const { data: ledgerRows, error: ledgerError } = await supabase
          .schema(ATT_SCHEMA)
          .from('fine_ledger')
          .select('id, incident_date, incident_type, employee_id, calculated_amount, applied_amount, was_capped, cap_excess, month_year')
          .order('incident_date', { ascending: false })
          .limit(50)

        if (ledgerError) throw ledgerError
        setLedger(ledgerRows ?? [])
        setLedgerPending(false)
      } catch {
        setLedgerPending(true)
      }

    } catch (err) {
      toast.error('Error al cargar la configuración de multas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    incidentType: IncidentType,
    field: keyof Omit<FineConfig, 'id' | 'tenant_id' | 'incident_type'>,
    value: string | number | boolean
  ) => {
    setConfigs(prev =>
      prev.map(c => c.incident_type === incidentType ? { ...c, [field]: value } : c)
    )
  }

  const handleSave = async () => {
    if (!tenantId) { toast.error('Tenant no identificado'); return }

    for (const cfg of configs) {
      const result = fineConfigRowSchema.safeParse(cfg)
      if (!result.success) {
        const label = INCIDENT_TYPE_LABELS[cfg.incident_type]
        const msg   = result.error.errors[0]?.message ?? 'Error de validación'
        toast.error(`${label}: ${msg}`)
        return
      }
    }

    setSaving(true)
    try {
      const rows = configs.map(cfg => ({
        tenant_id:     tenantId,
        incident_type: cfg.incident_type,
        calc_method:   cfg.calc_method,
        value:         cfg.value,
        grace_minutes: cfg.grace_minutes,
        is_active:     cfg.is_active,
        ...(cfg.id ? { id: cfg.id } : {}),
      }))

      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('fine_config')
        .upsert(rows, { onConflict: 'tenant_id,incident_type' })

      if (error) throw error
      toast.success('Configuración de multas guardada')
      await loadData()
    } catch (err) {
      toast.error('Error al guardar')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración de Multas</h1>
        <p className="text-sm text-gray-400 mt-1">
          Define el método de cálculo y los parámetros por tipo de incidencia.
          El tope mensual se configura en{' '}
          <a href="/config/cira/regimen-laboral" className="text-blue-600 hover:underline">
            Régimen Laboral
          </a>.
        </p>
      </div>

      {/* Tabla de configuración CRUD */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Reglas de Multa por Incidencia</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-left border-b border-white/10">
                <th className="px-4 py-3 font-medium text-gray-400">Tipo de Incidencia</th>
                <th className="px-4 py-3 font-medium text-gray-400">Método de Cálculo</th>
                <th className="px-4 py-3 font-medium text-gray-400">Valor</th>
                <th className="px-4 py-3 font-medium text-gray-400">Tolerancia (min)</th>
                <th className="px-4 py-3 font-medium text-gray-400 text-center">Activo</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => (
                <tr key={cfg.incident_type} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-gray-200 whitespace-nowrap">
                    {INCIDENT_TYPE_LABELS[cfg.incident_type]}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={cfg.calc_method}
                      onChange={(e) =>
                        handleChange(cfg.incident_type, 'calc_method', e.target.value as CalcMethod)
                      }
                      className="w-full p-1.5 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {(Object.entries(CALC_METHOD_LABELS) as [CalcMethod, string][]).map(([m, label]) => (
                        <option key={m} value={m}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={cfg.calc_method === 'per_minute' ? 0.001 : 0.01}
                      value={cfg.value}
                      onChange={(e) =>
                        handleChange(cfg.incident_type, 'value', parseFloat(e.target.value) || 0)
                      }
                      className="w-24 p-1.5 border border-white/10 rounded-lg text-sm font-mono bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      value={cfg.grace_minutes}
                      onChange={(e) =>
                        handleChange(cfg.incident_type, 'grace_minutes', parseInt(e.target.value) || 0)
                      }
                      className="w-20 p-1.5 border border-white/10 rounded-lg text-sm font-mono bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={cfg.is_active}
                      onChange={(e) =>
                        handleChange(cfg.incident_type, 'is_active', e.target.checked)
                      }
                      className="w-4 h-4 rounded border-white/10 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            Tolerancia: minutos de gracia antes de aplicar la multa.
            Valor: USD por minuto, monto fijo, o factor sobre HB (Sueldo ÷ 240).
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>

      {/* Historial fine_ledger (readonly) */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Historial de Multas Aplicadas</h2>
        <p className="text-xs text-gray-400 mb-4">Últimas 50 multas registradas. Solo lectura.</p>

        {ledgerPending ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-6 py-5 text-sm text-amber-300">
            La tabla{' '}
            <code className="font-mono text-xs bg-amber-500/20 px-1 rounded">
              attendance.fine_ledger
            </code>{' '}
            aún no existe. Se creará en la Sesión C-4 del roadmap CIRA V2.0.
          </div>
        ) : ledger.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-8 text-center text-sm text-gray-400">
            No hay multas registradas aún.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-left border-b border-white/10">
                  <th className="px-4 py-3 font-medium text-gray-400">Fecha</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Empleado</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Tipo</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Periodo</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">Calculado</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">Aplicado</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">Capado</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-4 py-2 text-gray-300">{entry.incident_date}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-400">
                      {entry.employee_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2">
                      {INCIDENT_TYPE_LABELS[entry.incident_type as IncidentType] ?? entry.incident_type}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{entry.month_year}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      ${entry.calculated_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      ${entry.applied_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {entry.was_capped ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
                          Sí +${entry.cap_excess.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-400">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

export default FineConfigPage
