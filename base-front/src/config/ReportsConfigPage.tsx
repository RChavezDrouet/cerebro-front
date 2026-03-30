/**
 * ReportsConfigPage.tsx — Base PWA v4.8.5
 * Configuración de columnas y formato de reportes de asistencia.
 * Tabla: attendance.tenant_reports_config (upsert por tenant_id)
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, FileText, ToggleLeft, ToggleRight } from 'lucide-react'

interface ColToggle { key: string; label: string; enabled: boolean }

const DEFAULT_COLS: ColToggle[] = [
  { key: 'date',        label: 'Fecha',               enabled: true  },
  { key: 'employee',    label: 'Empleado',             enabled: true  },
  { key: 'department',  label: 'Departamento',         enabled: true  },
  { key: 'turn',        label: 'Turno',                enabled: true  },
  { key: 'entry',       label: 'Entrada',              enabled: true  },
  { key: 'lunch_out',   label: 'Salida a comer',       enabled: true  },
  { key: 'lunch_in',    label: 'Regreso de comer',     enabled: true  },
  { key: 'exit',        label: 'Salida',               enabled: true  },
  { key: 'status',      label: 'Estado',               enabled: true  },
  { key: 'source',      label: 'Fuente de marcación',  enabled: true  },
  { key: 'novelty',     label: 'Novedad',              enabled: true  },
  { key: 'emp_code',    label: 'Código empleado',      enabled: false },
  { key: 'schedule',    label: 'Horario',              enabled: false },
]

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

export default function ReportsConfigPage() {
  const nav = useNavigate()
  const [cols,    setCols]    = useState<ColToggle[]>(DEFAULT_COLS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
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
      if (data?.columns_config) {
        const saved: Record<string, boolean> = data.columns_config
        setCols(prev => prev.map(c => ({
          ...c, enabled: saved[c.key] ?? c.enabled
        })))
      }
      setLoading(false)
    }
    init()
  }, [])

  const toggle = (key: string) =>
    setCols(prev => prev.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c))

  const save = async () => {
    if (!tenantId) return
    setSaving(true)
    const columns_config = Object.fromEntries(cols.map(c => [c.key, c.enabled]))
    const { error } = await supabase.schema('attendance')
      .from('tenant_reports_config')
      .upsert({ tenant_id: tenantId, columns_config }, { onConflict: 'tenant_id' })
    if (error) toast.error('Error: ' + error.message)
    else toast.success('Configuración de reportes guardada')
    setSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => nav('/config')}
        className="flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--color-muted)' }}
      >
        <ArrowLeft size={16} /> Volver a Configuración
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Configuración de Reportes
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Selecciona las columnas visibles en los reportes de asistencia.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : (
        <div className="rounded-2xl p-5 space-y-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Columnas visibles
          </p>
          {cols.map(col => (
            <div key={col.key}
              className="flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer hover:opacity-80 transition"
              style={{ background: 'var(--color-background)' }}
              onClick={() => toggle(col.key)}
            >
              <span className="text-sm" style={{ color: 'var(--color-text)' }}>{col.label}</span>
              {col.enabled
                ? <ToggleRight size={24} style={{ color: 'var(--color-primary)' }} />
                : <ToggleLeft  size={24} style={{ color: 'var(--color-muted)'   }} />
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
