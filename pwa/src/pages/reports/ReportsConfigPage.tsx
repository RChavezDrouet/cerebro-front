import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, FileText, Eye, EyeOff } from 'lucide-react'

type ColToggle = { key: string; label: string; enabled: boolean }

const DEFAULT_COLS: ColToggle[] = [
  { key: 'date',       label: 'Fecha',                  enabled: true },
  { key: 'employee',   label: 'Empleado',               enabled: true },
  { key: 'department', label: 'Departamento',           enabled: true },
  { key: 'turn',       label: 'Turno',                  enabled: true },
  { key: 'entry',      label: 'Entrada',                enabled: true },
  { key: 'lunch_out',  label: 'Salida a comer',         enabled: true },
  { key: 'lunch_in',   label: 'Regreso de comer',       enabled: true },
  { key: 'exit',       label: 'Salida',                 enabled: true },
  { key: 'status',     label: 'Estado',                 enabled: true },
  { key: 'source',     label: 'Fuente de marcación',    enabled: true },
  { key: 'novelty',    label: 'Novedad',                enabled: true },
  { key: 'emp_code',   label: 'Código empleado',        enabled: false },
  { key: 'schedule',   label: 'Horario',                enabled: false },
]

const STORAGE_PREFIX = 'attendance_reports_config'

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

function storageKey(tenantId: string) {
  return `${STORAGE_PREFIX}:${tenantId}`
}

function Switch({ enabled }: { enabled: boolean }) {
  return (
    <div className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${enabled ? 'bg-violet-500/80' : 'bg-white/15'}`}>
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? 'translate-x-8' : 'translate-x-1'}`}
      />
    </div>
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
      if (!tid) {
        setLoading(false)
        return
      }

      let hydrated = false
      const { data } = await supabase.schema('attendance')
        .from('tenant_reports_config')
        .select('columns_config')
        .eq('tenant_id', tid)
        .maybeSingle()

      if (data?.columns_config) {
        const saved: Record<string, boolean> = data.columns_config
        setCols(prev => prev.map(c => ({ ...c, enabled: saved[c.key] ?? c.enabled })))
        try {
          window.localStorage.setItem(storageKey(tid), JSON.stringify(saved))
        } catch {}
        hydrated = true
      }

      if (!hydrated) {
        try {
          const raw = window.localStorage.getItem(storageKey(tid))
          if (raw) {
            const saved = JSON.parse(raw) as Record<string, boolean>
            setCols(prev => prev.map(c => ({ ...c, enabled: saved[c.key] ?? c.enabled })))
          }
        } catch {}
      }

      setLoading(false)
    }
    void init()
  }, [])

  const visibleCount = useMemo(() => cols.filter(c => c.enabled).length, [cols])

  const toggle = (key: string) => {
    setCols(prev => prev.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c))
  }

  const save = async () => {
    if (!tenantId) {
      toast.error('No se pudo resolver el tenant activo.')
      return
    }

    setSaving(true)
    const columns_config = Object.fromEntries(cols.map(c => [c.key, c.enabled]))

    try {
      const { error } = await supabase.schema('attendance')
        .from('tenant_reports_config')
        .upsert({ tenant_id: tenantId, columns_config }, { onConflict: 'tenant_id' })

      if (error) throw error

      try {
        window.localStorage.setItem(storageKey(tenantId), JSON.stringify(columns_config))
      } catch {}

      toast.success(`Configuración guardada (${visibleCount} columnas visibles)`)
    } catch (e: any) {
      toast.error('Error guardando configuración: ' + (e?.message ?? 'desconocido'))
    } finally {
      setSaving(false)
    }
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
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
        >
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
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Columnas visibles
            </p>
            <div className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
              {visibleCount} activas de {cols.length}
            </div>
          </div>

          {cols.map(col => (
            <button
              key={col.key}
              type="button"
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl transition hover:opacity-95"
              style={{ background: 'var(--color-background)' }}
              onClick={() => toggle(col.key)}
            >
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{col.label}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  {col.enabled ? 'VISIBLE en reportes y exportaciones' : 'OCULTA en reportes y exportaciones'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`hidden sm:flex items-center gap-1 text-xs font-semibold ${col.enabled ? 'text-emerald-300' : 'text-white/50'}`}>
                  {col.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                  {col.enabled ? 'VISIBLE' : 'OCULTA'}
                </div>
                <Switch enabled={col.enabled} />
              </div>
            </button>
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
