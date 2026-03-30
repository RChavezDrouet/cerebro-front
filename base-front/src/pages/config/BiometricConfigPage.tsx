/**
 * BiometricConfigPage.tsx — Base PWA v4.4.0
 *
 * Los números de serie vienen de Cerebro (attendance.biometric_devices).
 * El admin solo asigna la "Ubicación" de cada dispositivo.
 * Tabla: attendance.biometric_device_locations
 */
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Cpu, MapPin, Save, Loader2 } from 'lucide-react'

interface Device {
  id: string
  serial_no: string
  is_active: boolean
  last_seen_at: string | null
  location: string
  locationId: string | null
  dirty: boolean
}

function fmt(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata as any)?.tenant_id
  if (meta) return meta
  const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return (p as any)?.tenant_id ?? null
}

export default function BiometricConfigPage() {
  const nav = useNavigate()
  const [tid,     setTid]     = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const tenantId = await getTenantId()
    if (!tenantId) { setLoading(false); return }
    setTid(tenantId)

    const { data: devs, error } = await supabase
      .schema('attendance').from('biometric_devices')
      .select('id,serial_no,is_active,last_seen_at')
      .eq('tenant_id', tenantId).order('serial_no')

    if (error) { toast.error('Error al cargar biométricos'); setLoading(false); return }

    const { data: locs } = await supabase
      .schema('attendance').from('biometric_device_locations')
      .select('id,device_id,location').eq('tenant_id', tenantId)

    const locMap = new Map((locs ?? []).map((l: any) => [l.device_id, l]))
    setDevices((devs ?? []).map((d: any) => {
      const loc = locMap.get(d.id)
      return { ...d, location: loc?.location ?? '', locationId: loc?.id ?? null, dirty: false }
    }))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setLoc = (id: string, val: string) =>
    setDevices(prev => prev.map(d => d.id === id ? { ...d, location: val, dirty: true } : d))

  const save = async () => {
    if (!tid) return
    const dirty = devices.filter(d => d.dirty)
    if (!dirty.length) { toast('Sin cambios'); return }
    setSaving(true)
    let ok = 0
    for (const d of dirty) {
      const loc = d.location.trim() || 'Sin ubicación'
      const { error } = d.locationId
        ? await supabase.schema('attendance').from('biometric_device_locations')
            .update({ location: loc }).eq('id', d.locationId)
        : await supabase.schema('attendance').from('biometric_device_locations')
            .insert({ tenant_id: tid, device_id: d.id, location: loc })
      if (error) toast.error(`Error en ${d.serial_no}`)
      else ok++
    }
    if (ok) { toast.success(`${ok} ubicación(es) guardada(s)`); await load() }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('/config')} className="p-2 rounded-xl hover:opacity-70 transition"
          style={{ color: 'var(--color-muted)' }}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Biométricos</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Los números de serie son registrados por Cerebro. Aquí asignas la ubicación física.
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-4 mb-6 flex gap-3"
        style={{ background: 'rgba(8,145,178,0.08)', borderColor: 'rgba(8,145,178,0.3)' }}>
        <Cpu size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#0891B2' }} />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Los biométricos fueron asignados a tu empresa por el administrador de <strong>Cerebro</strong>.
          Aquí solo debes indicar la ubicación física de cada dispositivo (ej: "Entrada principal", "Piso 3").
        </p>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl" style={{ borderColor: 'var(--color-border)' }}>
          <Cpu size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            No hay biométricos registrados. Contacta al administrador de Cerebro.
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-2xl overflow-hidden mb-4" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--color-border)' }}>
                  {['N° de Serie', 'Estado', 'Última actividad', 'Ubicación'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((d, i) => (
                  <tr key={d.id} style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined,
                    background: d.dirty ? 'rgba(37,99,235,0.04)' : undefined }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Cpu size={13} style={{ color: 'var(--color-primary)' }} />
                        <span className="font-mono text-xs font-medium" style={{ color: 'var(--color-text)' }}>{d.serial_no}</span>
                        {d.dirty && <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(37,99,235,0.15)', color: '#2563EB' }}>editado</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        d.is_active
                          ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                          : 'text-slate-400 bg-slate-700 border border-slate-600'
                      }`}>{d.is_active ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>{fmt(d.last_seen_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="flex-shrink-0" style={{ color: 'var(--color-muted)' }} />
                        <input value={d.location} onChange={e => setLoc(d.id, e.target.value)}
                          placeholder="Ej: Entrada principal"
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm outline-none transition"
                          style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {devices.filter(d => d.dirty).length} cambio(s) pendiente(s)
            </p>
            <button onClick={save} disabled={saving || devices.every(d => !d.dirty)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Guardando...' : 'Guardar ubicaciones'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
