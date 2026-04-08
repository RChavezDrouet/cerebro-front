import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, Loader2 } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Holiday = { id: string; holiday_date: string; name: string; is_mandatory: boolean }

async function fetchHolidays(tenantId: string): Promise<Holiday[]> {
  const { data, error } = await supabase.schema(ATT_SCHEMA).from('holidays').select('id,holiday_date,name,is_mandatory').eq('tenant_id', tenantId).order('holiday_date')
  if (error) throw error
  return (data ?? []) as any
}

export default function HolidaysPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId
  const qc = useQueryClient()

  const [holiday_date, setDate] = React.useState('')
  const [name, setName] = React.useState('')
  const [mandatory, setMandatory] = React.useState(true)

  const hol = useQuery({ queryKey: ['holidays', tenantId], enabled: !!tenantId, queryFn: () => fetchHolidays(tenantId!), retry: 0 })

  const add = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sin tenant')
      if (!holiday_date || !name) throw new Error('Completa fecha y nombre')
      const { error } = await supabase.schema(ATT_SCHEMA).from('holidays').insert({ tenant_id: tenantId, holiday_date, name, is_mandatory: mandatory })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Feriado guardado')
      setDate(''); setName(''); setMandatory(true)
      qc.invalidateQueries({ queryKey: ['holidays', tenantId] })
    },
    onError: (e: any) => toast.error(e?.message || 'Error')
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Sin tenant')
      const { error } = await supabase.schema(ATT_SCHEMA).from('holidays').delete().eq('tenant_id', tenantId).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Eliminado')
      qc.invalidateQueries({ queryKey: ['holidays', tenantId] })
    },
    onError: (e: any) => toast.error(e?.message || 'Error')
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Feriados</h1>
        <p className="mt-1 text-sm text-white/60">Feriados de obligatorio descanso por tenant.</p>
      </div>

      <Card title="Nuevo feriado">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input label="Fecha" type="date" value={holiday_date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Feriado nacional" />
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />Obligatorio</label>
          </div>
          <div className="flex items-end">
            <Button leftIcon={add.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} onClick={() => add.mutate()} disabled={add.isPending}>Agregar</Button>
          </div>
        </div>
        {hol.isError ? <div className="mt-3 text-xs text-amber-200">No existe la tabla attendance.holidays o RLS lo bloquea. Ejecuta el SQL del ZIP.</div> : null}
      </Card>

      <Card title="Listado">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60"><tr><th className="py-2 text-left">Fecha</th><th className="py-2 text-left">Nombre</th><th className="py-2 text-left">Obligatorio</th><th className="py-2 text-right">Acción</th></tr></thead>
            <tbody>
              {(hol.data ?? []).map((h) => (
                <tr key={h.id} className="border-t border-white/10">
                  <td className="py-2 font-semibold">{h.holiday_date}</td>
                  <td className="py-2">{h.name}</td>
                  <td className="py-2 text-white/70">{h.is_mandatory ? 'Sí' : 'No'}</td>
                  <td className="py-2 text-right"><Button variant="danger" leftIcon={<Trash2 size={16} />} onClick={() => del.mutate(h.id)} disabled={del.isPending}>Eliminar</Button></td>
                </tr>
              ))}
              {(hol.data ?? []).length === 0 ? <tr><td className="py-6 text-center text-white/55" colSpan={4}>Sin feriados.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
