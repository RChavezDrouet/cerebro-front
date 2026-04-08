import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, FileText, ToggleLeft, ToggleRight } from 'lucide-react'

type ColumnKey =
  | 'work_date'
  | 'employee_name'
  | 'department_name'
  | 'turn_name'
  | 'schedule_name'
  | 'entry_at'
  | 'lunch_out_at'
  | 'lunch_in_at'
  | 'exit_at'
  | 'source'
  | 'day_status'
  | 'novelty'
  | 'employee_code'

type StoredColumnConfig = boolean | { visible?: boolean; label?: string; order?: number; required?: boolean }

type ColToggle = {
  key: ColumnKey
  label: string
  enabled: boolean
  order: number
  required?: boolean
}

const DEFAULT_COLS: ColToggle[] = [
  { key: 'work_date',       label: 'Fecha',              enabled: true,  order: 1, required: true },
  { key: 'employee_name',   label: 'Empleado',           enabled: true,  order: 2, required: true },
  { key: 'department_name', label: 'Departamento',       enabled: true,  order: 3 },
  { key: 'turn_name',       label: 'Turno',              enabled: true,  order: 4 },
  { key: 'schedule_name',   label: 'Horario',            enabled: false, order: 5 },
  { key: 'entry_at',        label: 'Entrada',            enabled: true,  order: 6 },
  { key: 'lunch_out_at',    label: 'Salida a comer',     enabled: true,  order: 7 },
  { key: 'lunch_in_at',     label: 'Regreso de comer',   enabled: true,  order: 8 },
  { key: 'exit_at',         label: 'Salida',             enabled: true,  order: 9 },
  { key: 'source',          label: 'Fuente de marcación',enabled: true,  order: 10 },
  { key: 'day_status',      label: 'Estado',             enabled: true,  order: 11, required: true },
  { key: 'novelty',         label: 'Novedad',            enabled: true,  order: 12 },
  { key: 'employee_code',   label: 'Código empleado',    enabled: false, order: 13 },
]

const LEGACY_KEY_MAP: Record<string, ColumnKey> = {
  date: 'work_date',
  employee: 'employee_name',
  department: 'department_name',
  turn: 'turn_name',
  schedule: 'schedule_name',
  entry: 'entry_at',
  lunch_out: 'lunch_out_at',
  lunch_in: 'lunch_in_at',
  exit: 'exit_at',
  source: 'source',
  status: 'day_status',
  novelty: 'novelty',
  emp_code: 'employee_code',
}

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

function normalizeColumnsConfig(raw: Record<string, StoredColumnConfig> | null | undefined): ColToggle[] {
  const byKey = new Map(DEFAULT_COLS.map((col) => [col.key, { ...col }]))
  const entries = Object.entries(raw ?? {})

  for (const [rawKey, value] of entries) {
    const mappedKey = (LEGACY_KEY_MAP[rawKey] ?? rawKey) as ColumnKey
    const target = byKey.get(mappedKey)
    if (!target) continue

    if (typeof value === 'boolean') {
      target.enabled = value
      continue
    }

    if (typeof value === 'object' && value) {
      target.enabled = value.visible ?? target.enabled
      target.label = value.label ?? target.label
      target.order = Number(value.order ?? target.order)
      target.required = value.required ?? target.required
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.order - b.order)
}

function serializeColumnsConfig(cols: ColToggle[]) {
  return Object.fromEntries(
    cols.map((col) => [
      col.key,
      {
        visible: col.required ? true : col.enabled,
        label: col.label,
        order: col.order,
        required: !!col.required,
      },
    ]),
  )
}

export default function ReportsConfigPage() {
  const nav = useNavigate()
  const [cols, setCols] = useState<ColToggle[]>(DEFAULT_COLS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const tid = await getTenantId()
      setTenantId(tid)
      if (!tid) { setLoading(false); return }
      const { data } = await supabase.schema('attendance')
        .from('tenant_reports_config')
        .select('columns_config')
        .eq('tenant_id', tid)
        .maybeSingle()
      setCols(normalizeColumnsConfig((data as any)?.columns_config as Record<string, StoredColumnConfig> | undefined))
      setLoading(false)
    }
    void init()
  }, [])

  const toggle = (key: ColumnKey) => {
    setCols((prev) => prev.map((col) => (col.key === key ? { ...col, enabled: col.required ? true : !col.enabled } : col)))
  }

  const save = async () => {
    if (!tenantId) return
    setSaving(true)
    const columns_config = serializeColumnsConfig(cols)
    const { error } = await supabase.schema('attendance')
      .from('tenant_reports_config')
      .upsert({ tenant_id: tenantId, columns_config }, { onConflict: 'tenant_id' })
    if (error) toast.error('Error: ' + error.message)
    else toast.success('Configuración de reportes guardada')
    setSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => nav('/config')}
        className="flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--color-muted)' }}
      >
        <ArrowLeft size={16} /> Volver a Configuración
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Configuración de Reportes</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Selecciona las columnas visibles en los reportes de asistencia. Los cambios aplican al reporte diario y a sus exportaciones.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Columnas visibles</p>

          {cols.map((col) => (
            <div
              key={col.key}
              className="flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer hover:opacity-80 transition"
              style={{ background: 'var(--color-background)' }}
              onClick={() => toggle(col.key)}
            >
              <div>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{col.label}</span>
                {col.required ? <div className="text-[11px] text-white/45 mt-1">Columna recomendada del sistema</div> : null}
              </div>
              {col.enabled || col.required
                ? <ToggleRight size={24} style={{ color: 'var(--color-primary)' }} />
                : <ToggleLeft size={24} style={{ color: 'var(--color-muted)' }} />
              }
            </div>
          ))}

          <button
            onClick={save}
            disabled={saving}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar configuración
          </button>
        </div>
      )}
    </div>
  )
}
