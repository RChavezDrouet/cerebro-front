/**
 * BiometricosConfigPage.tsx — Base PWA v4.7.3
 *
 * Mejoras:
 *  - Edición inline de ubicación con campo de texto + Enter/Escape/botón guardar
 *  - Toggle is_active con switch animado
 *  - Stats: Total / Activos / Sin ubicación
 *  - Última conexión con timeSince
 *  - RLS por tenant_id (JWT user_metadata)
 */
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Wifi, WifiOff, RefreshCw, MapPin, Edit2, Check, X, Loader2 } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'

type Device = {
  id: string
  serial_no: string
  name: string | null
  device_timezone: string | null
  is_active: boolean
  last_seen_at: string | null
}

function timeSince(iso: string | null): string {
  if (!iso) return 'Nunca'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'Hace un momento'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`
  return `Hace ${Math.floor(diff / 86400)}d`
}

export default function BiometricosConfigPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId
  const qc = useQueryClient()

  // editing: deviceId → current text being edited
  const [editing, setEditing] = useState<Record<string, string>>({})

  const devicesQ = useQuery({
    queryKey: ['biometric_devices', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('biometric_devices')
        .select('id,serial_no,name,device_timezone,is_active,last_seen_at')
        .eq('tenant_id', tenantId!)
        .order('serial_no')
      if (error) throw error
      return (data ?? []) as Device[]
    },
  })

  const updateM = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Device> }) => {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('biometric_devices')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', tenantId!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['biometric_devices'] })
      toast.success('Dispositivo actualizado')
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al actualizar'),
  })

  const startEdit = (d: Device) =>
    setEditing(p => ({ ...p, [d.id]: d.name ?? '' }))

  const cancelEdit = (id: string) =>
    setEditing(p => { const n = { ...p }; delete n[id]; return n })

  const saveEdit = (id: string) => {
    const name = (editing[id] ?? '').trim()
    if (!name) { toast.error('La ubicación no puede estar vacía'); return }
    updateM.mutate({ id, patch: { name } })
    cancelEdit(id)
  }

  const devices = devicesQ.data ?? []
  const total = devices.length
  const activos = devices.filter(d => d.is_active).length
  const sinUbicacion = devices.filter(d => !d.name?.trim()).length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Dispositivos Biométricos
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            Seriales registrados en Cerebro. Asigna aquí la ubicación de cada dispositivo.
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['biometric_devices'] })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition hover:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total dispositivos', value: total, color: 'var(--color-text)' },
          { label: 'Activos',            value: activos, color: '#10B981' },
          { label: 'Sin ubicación',      value: sinUbicacion, color: sinUbicacion > 0 ? '#F59E0B' : '#10B981' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-5 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="text-3xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs mt-1 font-medium" style={{ color: 'var(--color-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>

        {devicesQ.isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        )}

        {!devicesQ.isLoading && devices.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
            No hay dispositivos registrados en Cerebro para este tenant.
          </div>
        )}

        {devices.length > 0 && (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid var(--color-border)' }}>
              <tr style={{ color: 'var(--color-muted)' }}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">Serial</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">Ubicación</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">Última conexión</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => {
                const isEditing = d.id in editing
                const connected = d.last_seen_at &&
                  (Date.now() - new Date(d.last_seen_at).getTime()) < 5 * 60 * 1000

                return (
                  <tr key={d.id}
                    className="transition hover:bg-white/[0.02]"
                    style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>

                    {/* Serial */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: d.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)' }}>
                          {d.is_active
                            ? <Wifi size={16} style={{ color: '#10B981' }} />
                            : <WifiOff size={16} style={{ color: 'var(--color-muted)' }} />}
                        </div>
                        <div>
                          <div className="font-bold font-mono text-xs" style={{ color: 'var(--color-text)' }}>
                            {d.serial_no}
                          </div>
                          {d.device_timezone && (
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
                              {d.device_timezone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Ubicación — editable inline */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editing[d.id]}
                            onChange={e => setEditing(p => ({ ...p, [d.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(d.id)
                              if (e.key === 'Escape') cancelEdit(d.id)
                            }}
                            placeholder="Ej: Entrada principal"
                            className="flex-1 rounded-xl px-3 py-2 text-sm border outline-none transition"
                            style={{
                              background: 'rgba(255,255,255,0.07)',
                              borderColor: 'var(--color-primary)',
                              color: 'var(--color-text)',
                              minWidth: 0,
                            }}
                          />
                          <button onClick={() => saveEdit(d.id)}
                            className="p-2 rounded-lg transition hover:opacity-80"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}
                            title="Guardar (Enter)">
                            <Check size={14} />
                          </button>
                          <button onClick={() => cancelEdit(d.id)}
                            className="p-2 rounded-lg transition hover:opacity-80"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-muted)' }}
                            title="Cancelar (Escape)">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <MapPin size={13} style={{ color: d.name ? 'var(--color-primary)' : 'var(--color-muted)', flexShrink: 0 }} />
                          <span className={d.name ? '' : 'italic'} style={{ color: d.name ? 'var(--color-text)' : 'var(--color-muted)' }}>
                            {d.name?.trim() || 'Sin ubicación asignada'}
                          </span>
                          <button
                            onClick={() => startEdit(d)}
                            className="ml-1 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition"
                            style={{ background: 'rgba(255,255,255,0.06)' }}
                            title="Editar ubicación">
                            <Edit2 size={12} style={{ color: 'var(--color-muted)' }} />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Última conexión */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Wifi size={12} style={{ color: connected ? '#10B981' : 'var(--color-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                          {timeSince(d.last_seen_at)}
                        </span>
                      </div>
                    </td>

                    {/* Toggle is_active */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => updateM.mutate({ id: d.id, patch: { is_active: !d.is_active } })}
                        disabled={updateM.isPending}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 disabled:opacity-50"
                        style={{ background: d.is_active ? '#10B981' : 'rgba(255,255,255,0.12)' }}>
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: d.is_active ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          La <strong style={{ color: 'var(--color-text)' }}>ubicación</strong> asignada aquí aparece
          en el formulario de empleados cuando se selecciona marcación por{' '}
          <em>"Ubicación fija"</em>. Ejemplo: "Entrada principal", "Bodega norte", "Recepción".
          Haz clic en el ícono de editar (✎) sobre cada fila para modificar la ubicación.
        </p>
      </div>
    </div>
  )
}
