import React from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/Button'

type Row = {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  status: 'active' | 'inactive'
  schedule_id: string
  created_at: string
  schedules?: { name: string } | null
}

export default function EmployeesPage() {
  const [rows, setRows] = React.useState<Row[]>([])

  const load = React.useCallback(async () => {
    const { data } = await supabase
      .schema('attendance')
      .from('employees')
      .select('id,employee_code,first_name,last_name,status,schedule_id,created_at,schedules(name)')
      .order('created_at', { ascending: false })

    setRows((data as any) ?? [])
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Empleados</h1>
          <p className="text-sm text-gray-400">Número de empleado único por empresa (tenant).</p>
        </div>
        <Link to="/employees/new">
          <Button>Nuevo empleado</Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-300">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Horario</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-4 py-3 font-semibold">{r.employee_code}</td>
                <td className="px-4 py-3">{r.first_name} {r.last_name}</td>
                <td className="px-4 py-3 text-gray-300">{r.schedules?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${r.status === 'active' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'}`}>
                    {r.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/employees/${r.id}`}>
                    <Button variant="secondary">Editar</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                  Sin empleados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
