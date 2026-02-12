import React from 'react'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Modal } from '@/components/Modal'

type DeviceRow = {
  id: string
  serial_no: string
  device_timezone: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string | null
}

function fmtDT(v: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return d.toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function BiometricDevicesPage() {
  const [rows, setRows] = React.useState<DeviceRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<DeviceRow | null>(null)

  const [serial, setSerial] = React.useState('')
  const [tz, setTz] = React.useState('America/Guayaquil')
  const [active, setActive] = React.useState(true)

  const load = React.useCallback(async () => {
    setErr(null)
    setLoading(true)

    const { data, error } = await supabase
      .schema('attendance')
      .from('biometric_devices')
      .select('id,serial_no,device_timezone,is_active,last_seen_at,created_at')
      .order('created_at', { ascending: false })

    setLoading(false)

    if (error) {
      setErr(`No se pudo cargar: ${error.message} (${error.code})`)
      setRows([])
      return
    }

    setRows(((data as any) ?? []) as DeviceRow[])
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setSerial('')
    setTz('America/Guayaquil')
    setActive(true)
    setErr(null)
    setOpen(true)
  }

  function openEdit(r: DeviceRow) {
    setEditing(r)
    setSerial(r.serial_no)
    setTz(r.device_timezone ?? 'America/Guayaquil')
    setActive(!!r.is_active)
    setErr(null)
    setOpen(true)
  }

  async function save() {
    setErr(null)
    const sn = serial.trim()

    if (!sn) return setErr('Debes ingresar el número de serie (SN).')
    if (sn.length < 6) return setErr('SN inválido (muy corto).')

    const payload = {
      serial_no: sn,
      device_timezone: tz.trim() || 'America/Guayaquil',
      is_active: active
    }

    if (editing) {
      const { error } = await supabase
        .schema('attendance')
        .from('biometric_devices')
        .update(payload)
        .eq('id', editing.id)

      if (error) return setErr(`No se pudo guardar: ${error.message} (${error.code})`)
    } else {
      const { error } = await supabase.schema('attendance').from('biometric_devices').insert(payload)
      if (error) return setErr(`No se pudo registrar: ${error.message} (${error.code})`)
    }

    setOpen(false)
    await load()
  }

  async function toggleActive(r: DeviceRow) {
    setErr(null)
    const { error } = await supabase
      .schema('attendance')
      .from('biometric_devices')
      .update({ is_active: !r.is_active })
      .eq('id', r.id)

    if (error) {
      setErr(`No se pudo actualizar: ${error.message} (${error.code})`)
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Biométricos</h1>
          <p className="text-sm text-gray-400">
            Registra el número de serie (SN). El Gateway solo aceptará marcaciones de SN registrados.
          </p>
        </div>
        <Button onClick={openCreate}>Registrar biométrico</Button>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {err}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">SN (Serie)</th>
              <th className="px-4 py-3 text-left">Timezone</th>
              <th className="px-4 py-3 text-left">Último visto</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10 text-gray-100">
                <td className="px-4 py-3 font-semibold">{r.serial_no}</td>
                <td className="px-4 py-3 text-gray-300">{r.device_timezone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-300">{fmtDT(r.last_seen_at)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      r.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {r.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button variant="secondary" onClick={() => toggleActive(r)} disabled={loading}>
                    {r.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button variant="secondary" onClick={() => openEdit(r)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-300" colSpan={5}>
                  {loading ? 'Cargando…' : 'Sin biométricos registrados.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={editing ? 'Editar biométrico' : 'Registrar biométrico'} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Input
            label="Número de serie (SN)"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Ej: 8029252100142"
          />

          <Input label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="America/Guayaquil" />

          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Activo
          </label>

          {err ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
              {err}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editing ? 'Guardar' : 'Registrar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
