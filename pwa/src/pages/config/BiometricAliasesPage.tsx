import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { MapPin, Save, Cpu, RefreshCw } from 'lucide-react'

// AJUSTAR esta ruta al cliente Supabase real de Base-Front.
import { supabase } from '../../config/supabase'
import {
  listBiometricDevicesConfig,
  updateBiometricDeviceAlias,
} from '../../services/biometricAliasesService'
import type { BiometricDeviceConfig } from '../../types/biometric'

type DraftMap = Record<
  string,
  {
    location_alias: string
    location_details: string
    display_order: string
    is_active: boolean
  }
>

export default function BiometricAliasesPage() {
  const [devices, setDevices] = useState<BiometricDeviceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftMap>({})

  const loadDevices = async () => {
    try {
      setLoading(true)
      const rows = await listBiometricDevicesConfig(supabase)
      setDevices(rows)

      const nextDrafts: DraftMap = {}
      for (const row of rows) {
        nextDrafts[row.id] = {
          location_alias: row.location_alias ?? row.display_alias ?? row.name ?? row.serial_no,
          location_details: row.location_details ?? '',
          display_order: row.display_order != null ? String(row.display_order) : '',
          is_active: !!row.is_active,
        }
      }
      setDrafts(nextDrafts)
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || 'No se pudo cargar la configuración de biométricos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  const orderedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      const ao = a.display_order ?? 999999
      const bo = b.display_order ?? 999999
      if (ao !== bo) return ao - bo
      return (a.display_alias || '').localeCompare(b.display_alias || '')
    })
  }, [devices])

  const patchDraft = (id: string, partial: Partial<DraftMap[string]>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...partial,
      },
    }))
  }

  const handleSave = async (deviceId: string) => {
    const draft = drafts[deviceId]
    if (!draft) return

    const alias = draft.location_alias.trim()
    if (!alias) {
      toast.error('El alias es obligatorio. Ejemplo: Entrada principal, Bodega, Sala de reuniones.')
      return
    }

    try {
      setSavingId(deviceId)
      const updated = await updateBiometricDeviceAlias(supabase, {
        deviceId,
        locationAlias: alias,
        locationDetails: draft.location_details.trim() || null,
        displayOrder: draft.display_order.trim() ? Number(draft.display_order) : null,
        isActive: draft.is_active,
      })

      setDevices((prev) => prev.map((d) => (d.id === deviceId ? updated : d)))
      patchDraft(deviceId, {
        location_alias: updated.location_alias ?? updated.display_alias,
        location_details: updated.location_details ?? '',
        display_order: updated.display_order != null ? String(updated.display_order) : '',
        is_active: updated.is_active,
      })
      toast.success('Alias del biométrico actualizado')
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || 'No se pudo guardar el alias')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Biométricos / Ubicaciones</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Aquí se configura el alias operativo que verán RRHH y los empleados. El serial sigue siendo el
              identificador técnico, pero la operación diaria debe trabajar con alias como Entrada principal,
              Bodega o Sala de reuniones.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDevices}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-8 text-slate-300 backdrop-blur-xl">
          Cargando biométricos del tenant...
        </div>
      ) : orderedDevices.length === 0 ? (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-8 text-amber-100 backdrop-blur-xl">
          No hay biométricos registrados para este tenant. Primero deben existir en Cerebro.
        </div>
      ) : (
        <div className="grid gap-4">
          {orderedDevices.map((device) => {
            const draft = drafts[device.id]
            if (!draft) return null

            return (
              <div
                key={device.id}
                className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl"
              >
                <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Cpu className="h-5 w-5 text-slate-200" />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-white">{device.display_alias}</div>
                        <div className="text-xs text-slate-400">Serie: {device.serial_no}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                      <div><span className="text-slate-400">Nombre técnico:</span> {device.name || '—'}</div>
                      <div><span className="text-slate-400">Última actividad:</span> {device.last_seen_at || '—'}</div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-200">Alias visible</label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                        <input
                          value={draft.location_alias}
                          onChange={(e) => patchDraft(device.id, { location_alias: e.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/50"
                          placeholder="Ej. Entrada principal"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-200">Detalle de ubicación</label>
                      <input
                        value={draft.location_details}
                        onChange={(e) => patchDraft(device.id, { location_details: e.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                        placeholder="Ej. Puerta del lobby, planta baja"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-200">Orden</label>
                        <input
                          value={draft.display_order}
                          onChange={(e) => patchDraft(device.id, { display_order: e.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                          placeholder="1"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={draft.is_active}
                            onChange={(e) => patchDraft(device.id, { is_active: e.target.checked })}
                            className="h-4 w-4 rounded border-white/20"
                          />
                          Biométrico activo
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSave(device.id)}
                        disabled={savingId === device.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {savingId === device.id ? 'Guardando...' : 'Guardar alias'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
