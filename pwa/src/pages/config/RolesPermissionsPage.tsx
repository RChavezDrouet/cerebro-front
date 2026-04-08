/**
 * RolesPermissionsPage.tsx — Base PWA v4.4.0
 *
 * Matriz interactiva de roles × funcionalidades.
 * Roles: admin, assistant, dept_head, auditor
 * Tabla: attendance.role_permissions
 */
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react'

const ROLES = [
  { key: 'admin',         label: 'Administrador',         color: '#DC2626' },
  { key: 'assistant',     label: 'Asistente',             color: '#2563EB' },
  { key: 'dept_head',     label: 'Jefe de Dpto.',         color: '#7C3AED' },
  { key: 'auditor',       label: 'Auditor',               color: '#D97706' },
]

const FEATURES = [
  { key: 'dashboard',        label: 'Ver Dashboard'          },
  { key: 'attendance_view',  label: 'Ver Asistencia'         },
  { key: 'attendance_mark',  label: 'Registrar Marcación'    },
  { key: 'reports_view',     label: 'Ver Reportes'           },
  { key: 'reports_export',   label: 'Exportar Reportes'      },
  { key: 'employees_view',   label: 'Ver Empleados'          },
  { key: 'employees_manage', label: 'Gestionar Empleados'    },
  { key: 'config_company',   label: 'Config. Empresa'        },
  { key: 'config_biometric', label: 'Config. Biométricos'    },
  { key: 'config_roles',     label: 'Config. Roles'          },
  { key: 'config_security',  label: 'Config. Seguridad'      },
  { key: 'config_marking',   label: 'Config. Marcación'      },
  { key: 'justify_absence',  label: 'Justificar Ausencia'    },
  { key: 'usb_import',       label: 'Importar via USB'       },
]

// Valores por defecto para el primer uso
const DEFAULTS: Record<string, Record<string, boolean>> = {
  admin:         Object.fromEntries(FEATURES.map(f => [f.key, true])),
  assistant:     { dashboard: true, attendance_view: true, attendance_mark: true, reports_view: true, employees_view: true, justify_absence: true },
  dept_head:     { dashboard: true, attendance_view: true, reports_view: true, employees_view: true, justify_absence: true },
  auditor:       { dashboard: true, attendance_view: true, reports_view: true, reports_export: true, employees_view: true },
}

type Matrix = Record<string, Record<string, boolean>>

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

export default function RolesPermissionsPage() {
  const nav = useNavigate()
  const [tid,     setTid]    = useState<string | null>(null)
  const [matrix,  setMatrix] = useState<Matrix>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [dirty,   setDirty]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const tenantId = await getTenantId()
    if (!tenantId) { setLoading(false); return }
    setTid(tenantId)

    const { data } = await supabase
      .schema('attendance').from('role_permissions')
      .select('role_name,feature_key,allowed').eq('tenant_id', tenantId)

    // Arrancar desde defaults, luego aplicar BD
    const m: Matrix = {}
    for (const r of ROLES) m[r.key] = { ...DEFAULTS[r.key] }
    for (const row of (data ?? [])) {
      if (!m[row.role_name]) m[row.role_name] = {}
      m[row.role_name][row.feature_key] = row.allowed
    }
    m['admin'] = Object.fromEntries(FEATURES.map(f => [f.key, true])) // Admin siempre todo
    setMatrix(m)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (role: string, feature: string) => {
    if (role === 'admin') return
    setMatrix(prev => ({ ...prev, [role]: { ...prev[role], [feature]: !prev[role]?.[feature] } }))
    setDirty(true)
  }

  const save = async () => {
    if (!tid) return
    setSaving(true)
    const rows: any[] = []
    for (const r of ROLES) {
      if (r.key === 'admin') continue
      for (const f of FEATURES)
        rows.push({ tenant_id: tid, role_name: r.key, feature_key: f.key, allowed: matrix[r.key]?.[f.key] ?? false })
    }
    const { error } = await supabase.schema('attendance').from('role_permissions')
      .upsert(rows, { onConflict: 'tenant_id,role_name,feature_key' })
    if (error) toast.error('Error: ' + error.message)
    else { toast.success('Permisos guardados'); setDirty(false) }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('/config')} className="p-2 rounded-xl hover:opacity-70 transition"
          style={{ color: 'var(--color-muted)' }}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Roles y Permisos</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Activa o desactiva permisos por rol. El Administrador siempre tiene acceso total.
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-4 mb-6 flex gap-3"
        style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.25)' }}>
        <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Esta matriz controla qué elementos de UI se muestran según el rol.
          La seguridad real se aplica mediante RLS en Supabase.
        </p>
      </div>

      <div className="border rounded-2xl overflow-auto mb-4" style={{ borderColor: 'var(--color-border)' }}>
        <table className="text-sm" style={{ minWidth: 700, width: '100%' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="text-left px-4 py-3 font-medium sticky left-0 z-10"
                style={{ color: 'var(--color-muted)', background: 'var(--color-surface)', minWidth: 180 }}>
                Funcionalidad
              </th>
              {ROLES.map(r => (
                <th key={r.key} className="px-3 py-3 text-center" style={{ color: r.color, minWidth: 110 }}>
                  <div className="text-xs font-semibold">{r.label}</div>
                  {r.key === 'admin' && <div className="text-xs opacity-50 font-normal">(fijo)</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feat, i) => (
              <tr key={feat.key}
                style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}>
                <td className="px-4 py-3 sticky left-0 z-10 font-medium text-sm"
                  style={{ color: 'var(--color-text)', background: 'var(--color-surface)' }}>
                  {feat.label}
                </td>
                {ROLES.map(role => {
                  const checked = matrix[role.key]?.[feat.key] ?? false
                  const isAdmin = role.key === 'admin'
                  return (
                    <td key={role.key} className="px-3 py-3 text-center">
                      <button type="button" disabled={isAdmin}
                        onClick={() => toggle(role.key, feat.key)}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition
                          ${isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80'}`}
                        style={{ background: checked ? role.color : 'transparent', borderColor: checked ? role.color : 'var(--color-border)' }}>
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {dirty ? '⚠ Cambios sin guardar' : 'Sin cambios pendientes'}
        </p>
        <button onClick={save} disabled={saving || !dirty}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Guardando...' : 'Guardar permisos'}
        </button>
      </div>
    </div>
  )
}
