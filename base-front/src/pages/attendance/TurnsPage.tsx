import React from 'react'
import { supabase } from '@/config/supabase'
import { resolveTenantId } from '@/lib/tenant'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Modal } from '@/components/Modal'
import { TurnSchema, type TurnForm } from './turnSchemas'

// Importante: en DB validamos días como 1..7 (ISO): Lun=1 ... Dom=7
const DAYS = [
  { i: 1, label: 'Lun' },
  { i: 2, label: 'Mar' },
  { i: 3, label: 'Mié' },
  { i: 4, label: 'Jue' },
  { i: 5, label: 'Vie' },
  { i: 6, label: 'Sáb' },
  { i: 7, label: 'Dom' }
]

type TurnRow = {
  id: string
  tenant_id?: string
  name: string
  type: 'diurno' | 'vespertino' | 'nocturno'
  color: string
  days: number[]
  is_active: boolean
  created_at: string
}

export default function TurnsPage() {
  const [rows, setRows] = React.useState<TurnRow[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TurnRow | null>(null)
  const [form, setForm] = React.useState<TurnForm>({
    name: '',
    type: 'diurno',
    color: '#6366F1',
    days: [1, 2, 3, 4, 5],
    is_active: true
  })
  const [err, setErr] = React.useState<string | null>(null)

  // Cache de tenant_id para no resolverlo en cada click
  const tenantIdRef = React.useRef<string | null>(null)

  const getTenantId = React.useCallback(async (): Promise<string> => {
    if (tenantIdRef.current) return tenantIdRef.current

    const { data: s, error: sErr } = await supabase.auth.getSession()
    const userId = s?.session?.user?.id

    if (sErr || !userId) {
      throw new Error('No hay sesión activa. Inicia sesión para continuar.')
    }

    const tenantId = await resolveTenantId(userId)
    if (!tenantId) {
      throw new Error(`tenant_id no resuelto para el usuario ${userId}. Verifica public.profiles.tenant_id`)
    }

    tenantIdRef.current = tenantId
    return tenantId
  }, [])

  const load = React.useCallback(async () => {
    try {
      setErr(null)

      // ✅ CRÍTICO MULTI-TENANT:
      // No dependemos “solo” de RLS (en pruebas RLS puede estar off o policies pueden ser amplias).
      // Filtramos explícitamente por tenant_id.
      const tenantId = await getTenantId()

      const { data, error } = await supabase
        .schema('attendance')
        .from('turns')
        .select('id,tenant_id,name,type,color,days,is_active,created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('LOAD turns error:', error)
        setErr(`No se pudo cargar turnos: ${error.message} (${error.code})`)
        setRows([])
        return
      }

      setRows((data as any) ?? [])
    } catch (e: any) {
      console.error('load() error:', e)
      setErr(e?.message ?? 'No se pudo cargar turnos.')
      setRows([])
    }
  }, [getTenantId])

  React.useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', type: 'diurno', color: '#6366F1', days: [1, 2, 3, 4, 5], is_active: true })
    setErr(null)
    setOpen(true)
  }

  function openEdit(r: TurnRow) {
    setEditing(r)
    setForm({ name: r.name, type: r.type, color: r.color, days: r.days ?? [], is_active: r.is_active })
    setErr(null)
    setOpen(true)
  }

  async function save() {
    setErr(null)

    const parsed = TurnSchema.safeParse(form)
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? 'Formulario inválido')
      return
    }

    try {
      const tenantId = await getTenantId()

      if (editing) {
        // UPDATE: por seguridad, filtramos por tenant_id también
        const { error } = await supabase
          .schema('attendance')
          .from('turns')
          .update(parsed.data)
          .eq('id', editing.id)
          .eq('tenant_id', tenantId)

        if (error) {
          console.error('UPDATE turns error:', error)
          setErr(`No se pudo guardar: ${error.message} (${error.code})`)
          return
        }
      } else {
        // INSERT: incluir tenant_id para evitar 23502 y asegurar tenant ownership
        const payload = { ...parsed.data, tenant_id: tenantId }

        const { error } = await supabase.schema('attendance').from('turns').insert(payload)

        if (error) {
          console.error('INSERT turns error:', error)
          setErr(`No se pudo crear: ${error.message} (${error.code})`)
          return
        }
      }

      setOpen(false)
      await load()
    } catch (e: any) {
      console.error('save() error:', e)
      setErr(e?.message ?? 'No se pudo completar la operación.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Turnos</h1>
          <p className="text-sm text-gray-400">Diurno / Vespertino / Nocturno (por empresa)</p>
        </div>
        <Button onClick={openCreate}>Nuevo turno</Button>
      </div>

      {err ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm">{err}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-300">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Color</th>
              <th className="px-4 py-3 text-left">Días</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3 capitalize">{r.type}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded" style={{ backgroundColor: r.color }} />
                    <span className="text-gray-300">{r.color}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {(r.days ?? [])
                    .map((d) => DAYS.find((x) => x.i === d)?.label)
                    .filter(Boolean)
                    .join(', ')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      r.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {r.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="secondary" onClick={() => openEdit(r)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                  Sin turnos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={editing ? 'Editar turno' : 'Nuevo turno'} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />

          <Select label="Tipo" value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value as any }))}>
            <option value="diurno">Diurno</option>
            <option value="vespertino">Vespertino</option>
            <option value="nocturno">Nocturno</option>
          </Select>

          <Input
            label="Color"
            type="color"
            value={form.color}
            onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))}
          />

          <div>
            <div className="mb-2 text-sm text-gray-300">Días aplicables</div>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const checked = form.days.includes(d.i)
                return (
                  <label
                    key={d.i}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs ${
                      checked ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={checked}
                      onChange={(e) => {
                        setForm((s) => {
                          const days = new Set(s.days)
                          if (e.target.checked) days.add(d.i)
                          else days.delete(d.i)
                          return { ...s, days: Array.from(days).sort() }
                        })
                      }}
                    />
                    {d.label}
                  </label>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
            />
            Activo
          </label>

          {err ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm">{err}</div> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
