import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Star, Users, AlertCircle } from 'lucide-react'

import { supabase } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

type Row = {
  id: string
  employee_code: string | null
  first_name: string
  last_name: string
  employment_status: string | null
  attendance_status: string | null
  department_name: string | null
  work_mode: string | null
  is_department_head?: boolean | null
}

async function fetchOrgUnitFallbacks(tenantId: string, employeeIds: string[]): Promise<Record<string, string>> {
  if (!employeeIds.length) return {}

  const { data: assignments, error: aerr } = await supabase
    .schema('attendance')
    .from('employee_org_assignments')
    .select('employee_id, org_unit_id, effective_to, effective_from')
    .eq('tenant_id', tenantId)
    .in('employee_id', employeeIds)
    .is('effective_to', null)
    .order('effective_from', { ascending: false, nullsFirst: false })

  if (aerr || !assignments?.length) return {}

  const winner = new Map<string, string>()
  const unitIds: string[] = []
  for (const a of assignments as any[]) {
    if (!a?.employee_id || !a?.org_unit_id) continue
    if (!winner.has(a.employee_id)) {
      winner.set(a.employee_id, a.org_unit_id)
      unitIds.push(a.org_unit_id)
    }
  }

  if (!unitIds.length) return {}

  const { data: units } = await supabase
    .schema('attendance')
    .from('org_units')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .in('id', unitIds)

  const unitNameById = new Map<string, string>()
  ;(units ?? []).forEach((u: any) => {
    if (u?.id && u?.name) unitNameById.set(u.id, u.name)
  })

  const out: Record<string, string> = {}
  winner.forEach((unitId, employeeId) => {
    const name = unitNameById.get(unitId)
    if (name) out[employeeId] = name
  })
  return out
}

async function fetchEmployees(tenantId: string): Promise<Row[]> {
  const v = await supabase
    .schema('public')
    .from('v_employees_full')
    .select(`
      id, employee_code, first_name, last_name,
      employment_status, attendance_status,
      department_name, work_mode, is_department_head, created_at
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (!v.error && v.data) {
    const base = (v.data as any[]).map(r => ({
      id: r.id,
      employee_code: r.employee_code ?? null,
      first_name: r.first_name ?? '',
      last_name: r.last_name ?? '',
      employment_status: r.employment_status ?? null,
      attendance_status: r.attendance_status ?? null,
      department_name: r.department_name ?? null,
      work_mode: r.work_mode ?? 'PRESENCIAL',
      is_department_head: Boolean(r.is_department_head),
    }))

    const missingIds = base.filter(r => !r.department_name).map(r => r.id)
    const orgFallback = await fetchOrgUnitFallbacks(tenantId, missingIds)
    return base.map(r => ({ ...r, department_name: r.department_name ?? orgFallback[r.id] ?? null }))
  }

  const { data, error } = await supabase
    .schema('public')
    .from('employees')
    .select(`
      id,
      employee_number,
      first_name,
      last_name,
      employment_status,
      is_department_head,
      created_at,
      departments ( name )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const ids = ((data ?? []) as any[]).map((r: any) => r.id)
  let profileMap: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .schema('attendance')
      .from('employee_profile')
      .select('employee_id, work_mode')
      .in('employee_id', ids)
    ;(profiles ?? []).forEach((p: any) => {
      profileMap[p.employee_id] = p.work_mode ?? 'PRESENCIAL'
    })
  }

  const base = ((data ?? []) as any[]).map((r: any) => ({
    id: r.id,
    employee_code: r.employee_number ?? null,
    first_name: r.first_name ?? '',
    last_name: r.last_name ?? '',
    employment_status: r.employment_status ?? null,
    attendance_status: null,
    department_name: (r.departments as any)?.name ?? null,
    work_mode: profileMap[r.id] ?? 'PRESENCIAL',
  }))

  const missingIds = base.filter(r => !r.department_name).map(r => r.id)
  const orgFallback = await fetchOrgUnitFallbacks(tenantId, missingIds)
  return base.map(r => ({ ...r, department_name: r.department_name ?? orgFallback[r.id] ?? null }))
}

const STATUS_MAP: Record<string, { label: string; tone: 'good'|'info'|'warn'|'bad'|'neutral' }> = {
  active:     { label: 'Activo',       tone: 'good'    },
  probation:  { label: 'Prueba',       tone: 'info'    },
  contract:   { label: 'Contrato',     tone: 'info'    },
  permanent:  { label: 'Permanente',   tone: 'good'    },
  on_leave:   { label: 'Permiso',      tone: 'warn'    },
  terminated: { label: 'Retirado',     tone: 'bad'     },
  ACTIVE:     { label: 'Activo',       tone: 'good'    },
  VACATION:   { label: 'Vacaciones',   tone: 'info'    },
  SUSPENDED:  { label: 'Suspendido',   tone: 'warn'    },
  TERMINATED: { label: 'Retirado',     tone: 'bad'     },
}

function statusInfo(s: string | null) {
  if (!s) return { label: 'Sin estado', tone: 'neutral' as const }
  return STATUS_MAP[s] ?? { label: s, tone: 'neutral' as const }
}

const WORK_MODE_MAP: Record<string, { label: string; tone: 'good'|'info'|'neutral' }> = {
  PRESENCIAL: { label: 'Presencial', tone: 'good'    },
  REMOTO:     { label: 'Remoto',     tone: 'info'    },
  MIXTO:      { label: 'Mixto',      tone: 'neutral' },
}

function workModeInfo(m: string | null) {
  const key = (m ?? 'PRESENCIAL').toUpperCase()
  return WORK_MODE_MAP[key] ?? { label: m ?? 'Presencial', tone: 'good' as const }
}

function parseErrorMessage(err: unknown): string {
  const msg = (err as any)?.message ?? String(err)
  if (msg.includes('duplicate key') || msg.includes('ya está en uso')) {
    if (msg.includes('email')) return 'El correo electrónico ya está registrado para otro empleado.'
    if (msg.includes('employee_code') || msg.includes('employees_employee_code')) return 'El código de empleado ya existe. Usa un código diferente.'
    if (msg.includes('identification') || msg.includes('cedula')) return 'La cédula/identificación ya está registrada para otro empleado.'
    return 'Ya existe un registro con estos datos. Verifica el correo o código.'
  }
  if (msg.includes('does not exist') && msg.includes('column')) return 'Error interno: columna no encontrada. Contacta al administrador.'
  if (msg.includes('violates check constraint')) return 'Valor no permitido en uno de los campos. Verifica el estado o modalidad.'
  if (msg.includes('violates not-null')) return 'Falta un campo obligatorio. Verifica que todos los campos requeridos estén llenos.'
  if (msg.includes('JWT') || msg.includes('401')) return 'Sesión expirada. Recarga la página e inicia sesión nuevamente.'
  if (msg.includes('RLS') || msg.includes('row-level security') || msg.includes('403')) return 'Sin permisos para realizar esta acción.'
  return msg || 'Error desconocido. Intenta nuevamente.'
}

export default function EmployeesPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const [q, setQ] = React.useState('')
  const [department, setDept] = React.useState('')
  const [workMode, setMode] = React.useState('')
  const [statusFilter, setSt] = React.useState('')

  const emp = useQuery({
    queryKey: ['employees', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchEmployees(tenantId!),
  })

  const departments = React.useMemo(() => {
    const set = new Set<string>()
    ;(emp.data ?? []).forEach(r => { if (r.department_name) set.add(r.department_name) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [emp.data])

  const rows = React.useMemo(() => {
    const base = emp.data ?? []
    const qq = q.trim().toLowerCase()
    return base
      .filter(r => !qq || `${r.employee_code ?? ''} ${r.first_name} ${r.last_name} ${r.department_name ?? ''}`.toLowerCase().includes(qq))
      .filter(r => !department || (r.department_name ?? '') === department)
      .filter(r => !workMode || (r.work_mode ?? 'PRESENCIAL').toUpperCase() === workMode)
      .filter(r => !statusFilter || (r.employment_status ?? '') === statusFilter)
  }, [emp.data, q, department, workMode, statusFilter])

  const errorMsg = emp.isError ? parseErrorMessage(emp.error) : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Empleados</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            {emp.data ? `${emp.data.length} empleado${emp.data.length !== 1 ? 's' : ''} registrados` : 'Gestión del personal'}
          </p>
        </div>
        <Link to="/employees/new">
          <Button leftIcon={<Plus size={16} />}>Nuevo empleado</Button>
        </Link>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <p className="text-sm text-red-300">{errorMsg}</p>
        </div>
      )}

      <Card title="Filtros">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            label="Buscar"
            value={q}
            onChange={e => setQ(e.target.value)}
            right={<Search size={16} style={{ color: 'var(--color-muted)' }} />}
            placeholder="Nombre, código, depto…"
          />
          <Select
            label="Departamento"
            value={department}
            onChange={setDept}
            options={departments.map(d => ({ value: d, label: d }))}
            placeholder="Todos"
          />
          <Select
            label="Modalidad"
            value={workMode}
            onChange={setMode}
            options={[
              { value: 'PRESENCIAL', label: 'Presencial' },
              { value: 'REMOTO', label: 'Remoto' },
              { value: 'MIXTO', label: 'Mixto' },
            ]}
            placeholder="Todas"
          />
          <Select
            label="Estado"
            value={statusFilter}
            onChange={setSt}
            options={[
              { value: 'active', label: 'Activo' },
              { value: 'probation', label: 'Prueba' },
              { value: 'contract', label: 'Contrato' },
              { value: 'permanent', label: 'Permanente' },
              { value: 'on_leave', label: 'Permiso' },
              { value: 'terminated', label: 'Retirado' },
            ]}
            placeholder="Todos"
          />
        </div>
      </Card>

      <Card title={`Resultados (${rows.length})`} subtitle={emp.isFetching ? 'Actualizando…' : undefined}>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--color-muted)' }}>
                <th className="py-2.5 text-left font-semibold text-xs uppercase tracking-wider">Código</th>
                <th className="py-2.5 text-left font-semibold text-xs uppercase tracking-wider">Nombre</th>
                <th className="py-2.5 text-left font-semibold text-xs uppercase tracking-wider">Departamento</th>
                <th className="py-2.5 text-left font-semibold text-xs uppercase tracking-wider">Modalidad</th>
                <th className="py-2.5 text-left font-semibold text-xs uppercase tracking-wider">Estado</th>
                <th className="py-2.5 text-right font-semibold text-xs uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const si = statusInfo(r.employment_status)
                const wi = workModeInfo(r.work_mode)
                return (
                  <tr key={r.id} className="border-t transition hover:bg-white/[0.02]" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold font-mono text-xs" style={{ color: 'var(--color-text)' }}>
                          {r.employee_code ?? '—'}
                        </span>
                        {r.is_department_head && <span title="Jefe de Departamento"><Star size={11} className="text-yellow-400 fill-yellow-400 flex-shrink-0" /></span>}
                      </div>
                    </td>
                    <td className="py-3" style={{ color: 'var(--color-text)' }}>{r.first_name} {r.last_name}</td>
                    <td className="py-3 text-sm" style={{ color: 'var(--color-muted)' }}>
                      {r.department_name ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="py-3"><Badge tone={wi.tone}>{wi.label}</Badge></td>
                    <td className="py-3"><Badge tone={si.tone}>{si.label}</Badge></td>
                    <td className="py-3 text-right">
                      <Link to={`/employees/${r.id}`}><Button variant="secondary" size="sm">Ver</Button></Link>
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && !emp.isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={28} style={{ color: 'var(--color-muted)', opacity: 0.4 }} />
                      <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
                        {emp.isError ? errorMsg : q || department || workMode || statusFilter ? 'Sin resultados para los filtros aplicados.' : 'No hay empleados registrados aún.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {emp.isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>Cargando empleados…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
