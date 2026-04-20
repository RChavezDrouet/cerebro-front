import React from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Edit3,
  Camera,
  MapPin,
  Briefcase,
  Star,
  Workflow,
  Smartphone,
  LocateFixed,
  CheckCircle2,
  Clock3,
} from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmployeeOrgSection } from '@/components/org/EmployeeOrgSection'
import { AssignmentHistoryTable } from '@/components/org/AssignmentHistoryTable'
import { accessRoleLabel, fetchEmployeeAccessRole } from '@/lib/accessRoles'
import {
  buildOrgPath,
  fetchEmployeeLookup,
  fetchEmployeeOrgAssignment,
  fetchEmployeeShiftAssignment,
  fetchOrgLevelDefinitions,
  fetchOrgUnits,
  isMissingOrgSchemaError,
  resolveSupervisorLabel,
} from '@/lib/orgStructure'

const PHOTO_BUCKET = 'employee_photos'

const DAYS_LABEL: Record<string, string> = {
  '0': 'Dom',
  '1': 'Lun',
  '2': 'Mar',
  '3': 'Miércoles',
  '4': 'Jue',
  '5': 'Vie',
  '6': 'Sábado',
}


async function signedPhoto(path?: string | null): Promise<string | null> {
  if (!path) return null
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 30)
  return data?.signedUrl ?? null
}

async function fetchEmployee(tenantId: string, id: string) {
  const v = await supabase
    .schema('public')
    .from('v_employees_full')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  if (!v.error) return v.data

  const { data, error } = await supabase
    .schema('public')
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

async function fetchEmployeePwaSelfServiceSettings(employeeId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_employee_pwa_self_service_settings', {
      p_employee_id: employeeId,
    })

  if (error) return null
  return (Array.isArray(data) ? data[0] : data) ?? null
}

async function fetchEmployeeProfile(employeeId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_profile')
    .select(
      'employee_id, work_mode, allow_remote_pwa, onsite_days, presential_schedule_id, entry_biometric_id, exit_biometric_id'
    )
    .eq('employee_id', employeeId)
    .maybeSingle()

  if (error) return null
  return data ?? null
}

async function fetchEmployeeContact(tenantId: string, employeeId: string) {
  const { data, error } = await supabase
    .schema('public')
    .from('employees')
    .select('id,phone,address')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .maybeSingle()

  if (error) return null
  return data ?? null
}

async function fetchShiftLookup(tenantId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('turns')
    .select('id,name,code')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error) return []
  return (data ?? []) as Array<{ id: string; name: string; code?: string | null }>
}

async function fetchEmployeeAccess(tenantId: string, employeeId: string, fallbackUserId?: string | null) {
  return fetchEmployeeAccessRole(tenantId, employeeId, fallbackUserId)
}

async function fetchOrgHistory(tenantId: string, employeeId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_org_assignments')
    .select('effective_from,effective_to,org_unit_id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('effective_from', { ascending: false })
    .limit(10)

  if (error) {
    if (isMissingOrgSchemaError(error)) return []
    throw error
  }

  return (data ?? []) as Array<{
    effective_from?: string | null
    effective_to?: string | null
    org_unit_id?: string | null
  }>
}

async function fetchShiftHistory(tenantId: string, employeeId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_shift_assignments')
    .select('effective_from,effective_to,shift_id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('effective_from', { ascending: false })
    .limit(10)

  if (error) {
    if (isMissingOrgSchemaError(error)) return []
    throw error
  }

  return (data ?? []) as Array<{
    effective_from?: string | null
    effective_to?: string | null
    shift_id?: string | null
  }>
}

function toneFromStatus(s?: string | null) {
  const v = String(s || '').toUpperCase()
  if (v === 'ACTIVE') return 'good'
  if (v === 'VACATION') return 'info'
  if (v === 'SUSPENDED') return 'warn'
  if (v === 'TERMINATED' || v === 'INACTIVE') return 'bad'
  return 'neutral'
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const emp = useQuery({
    queryKey: ['employee', tenantId, id],
    enabled: !!tenantId && !!id,
    queryFn: () => fetchEmployee(tenantId!, id!),
  })

  const photo = useQuery({
    queryKey: ['photo', emp.data?.facial_photo_url],
    enabled: !!emp.data?.facial_photo_url,
    queryFn: () => signedPhoto(emp.data?.facial_photo_url),
  })

  const orgAssignment = useQuery({
    queryKey: ['org-assignment', tenantId, id],
    enabled: !!tenantId && !!id,
    queryFn: () => fetchEmployeeOrgAssignment(tenantId!, id!),
  })

  const shiftAssignment = useQuery({
    queryKey: ['shift-assignment', tenantId, id],
    enabled: !!tenantId && !!id,
    queryFn: () => fetchEmployeeShiftAssignment(tenantId!, id!),
  })

  const orgUnits = useQuery({
    queryKey: ['org-units', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchOrgUnits(tenantId!),
  })

  const orgLevels = useQuery({
    queryKey: ['org-levels', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchOrgLevelDefinitions(tenantId!),
  })

  const people = useQuery({
    queryKey: ['employee-lookup', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchEmployeeLookup(tenantId!),
  })

  const shifts = useQuery({
    queryKey: ['shift-lookup', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchShiftLookup(tenantId!),
  })

  const accessInfo = useQuery({
    queryKey: ['employee-access', tenantId, id, (emp.data as any)?.user_id],
    enabled: !!tenantId && !!id,
    queryFn: () => fetchEmployeeAccess(tenantId!, id!, (emp.data as any)?.user_id ?? null),
  })

  const orgHistory = useQuery({
    queryKey: ['org-history', tenantId, id],
    enabled: !!tenantId && !!id,
    queryFn: () => fetchOrgHistory(tenantId!, id!),
  })

  const shiftHistory = useQuery({
    queryKey: ['shift-history', tenantId, id],
    enabled: !!tenantId && !!id,
    queryFn: () => fetchShiftHistory(tenantId!, id!),
  })

  if (emp.isLoading) return <div className="text-white/70">Cargando…</div>
  if (emp.isError) return <div className="text-rose-200">{(emp.error as any)?.message || 'Error'}</div>

  if (!emp.data || typeof emp.data !== 'object') {
    return <div className="text-rose-200">No se pudo cargar la ficha del colaborador.</div>
  }

  const e: any = emp.data
  const status = String(e.employment_status || e.attendance_status || e.status || 'ACTIVE').toUpperCase()
  const modality = String(e.work_mode || e.work_modality || 'PRESENCIAL').toUpperCase()
  const presentialDays: string[] = e.presential_days ?? []

  const currentOrgUnit = (orgUnits.data ?? []).find((row) => row.id === orgAssignment.data?.org_unit_id)
  const leaderUnit = (orgUnits.data ?? []).find(
    (row) => row.id === (orgAssignment.data?.lead_org_unit_id ?? orgAssignment.data?.org_unit_id)
  )
  const leaderLevelLabel =
    (orgLevels.data ?? []).find((row) => row.level_no === leaderUnit?.level_no)?.display_name ?? null
  const shiftInfo = (shifts.data ?? []).find((row) => row.id === shiftAssignment.data?.shift_id)
  const supervisorLabel = resolveSupervisorLabel(orgAssignment.data ?? null, people.data ?? [], orgUnits.data ?? [])

  const orgRows = (orgHistory.data ?? []).map((row) => ({
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    label: row.org_unit_id ? buildOrgPath(orgUnits.data ?? [], row.org_unit_id) : 'Sin unidad organizacional',
  }))

  const shiftRows = (shiftHistory.data ?? []).map((row) => ({
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    label: row.shift_id
      ? ((shifts.data ?? []).find((shift) => shift.id === row.shift_id)?.name ?? 'Turno asignado')
      : 'Sin turno específico',
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            className="mb-2 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
            onClick={() => nav('/employees')}
          >
            <ArrowLeft size={16} /> Volver
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">
              {e.first_name} {e.last_name}
            </h1>

            {orgAssignment.data?.is_unit_leader && (
              <span title="Jefatura organizacional" className="flex items-center gap-1 text-xs text-yellow-400 font-semibold">
                <Star size={14} className="fill-yellow-400" /> Líder de unidad
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={toneFromStatus(status) as any}>{status}</Badge>
            <span className="text-sm text-white/60">
              Código: <span className="font-semibold text-white">{e.employee_code ?? e.employee_number ?? ''}</span>
            </span>
          </div>
        </div>

        <Link to={`/employees/${id}/edit`}>
          <Button leftIcon={<Edit3 size={16} />}>Editar</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Ficha" className="xl:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="card p-4">
              <div className="text-white/60">Departamento / unidad</div>
              <div className="mt-2 font-semibold">{e.department_name ?? ''}</div>
            </div>

            <div className="card p-4">
              <div className="text-white/60">Fecha contratación</div>
              <div className="mt-2 font-semibold">{e.hire_date ?? ''}</div>
            </div>

            <div className="card p-4">
              <div className="text-white/60">Sueldo</div>
              <div className="mt-2 font-semibold">{e.salary != null ? Number(e.salary).toFixed(2) : ''}</div>
            </div>

            <div className="card p-4">
              <div className="text-white/60">Email</div>
              <div className="mt-2 font-semibold">{e.email ?? ''}</div>
            </div>

            <div className="card p-4">
              <div className="text-white/60">Teléfono</div>
              <div className="mt-2 font-semibold">{e.phone ?? ''}</div>
            </div>

            <div className="card p-4 md:col-span-2">
              <div className="text-white/60">Dirección</div>
              <div className="mt-2 font-semibold">{e.address ?? ''}</div>
            </div>

            <div className="card p-4">
              <div className="text-white/60">Rol de acceso Base</div>
              <div className="mt-2 font-semibold">{accessRoleLabel(accessInfo.data?.role)}</div>
              <div className="mt-1 text-xs text-white/50">
                {accessInfo.data?.role === 'tenant_admin'
                  ? 'Administrador HRCloud único por tenant'
                  : accessInfo.data?.has_access
                    ? 'Con credenciales activas'
                    : 'Sin acceso administrativo'}
              </div>
            </div>

            <div className="card p-4">
              <div className="text-white/60">Jefatura organizacional</div>
              <div className="mt-2 font-semibold">
                {orgAssignment.data?.is_unit_leader
                  ? leaderLevelLabel
                    ? `Líder de ${leaderLevelLabel}`
                    : 'L?der de unidad'
                  : 'No aplica'}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Fotografía" subtitle="Reconocimiento facial" actions={<Camera size={18} className="text-white/60" />}>
          {photo.data ? (
            <img src={photo.data} className="w-full rounded-2xl border border-white/10" alt="Foto del colaborador" />
          ) : (
            <div className="text-sm text-white/60">Sin foto registrada.</div>
          )}
        </Card>
      </div>

      <Card title="Modalidad de trabajo" actions={<Briefcase size={18} className="text-white/60" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-white/60 mb-1">Modalidad</div>
            <Badge tone={modality === 'REMOTO' ? 'info' : modality === 'MIXTO' ? 'neutral' : 'good'}>
              {modality}
            </Badge>
          </div>

          {modality === 'MIXTO' && (
            <div>
              <div className="text-white/60 mb-1">Días presenciales</div>
              <div className="flex flex-wrap gap-1">
                {presentialDays.length > 0 ? (
                  [...presentialDays].sort().map((d) => (
                    <span key={d} className="rounded-full px-2 py-0.5 bg-white/10 text-xs font-medium">
                      {DAYS_LABEL[d] ?? d}
                    </span>
                  ))
                ) : (
                  <span className="text-white/50">Sin días presenciales</span>
                )}
              </div>
            </div>
          )}

          {(modality === 'PRESENCIAL' || modality === 'MIXTO') && (
            <div>
              <div className="text-white/60 mb-1">Lugar de marcación</div>
              <div className="flex items-center gap-1 font-semibold">
                <MapPin size={14} className="text-white/60" />
                {e.location_mode === 'UBICACION' ? 'Ubicación fija' : 'Indistinto'}
              </div>

              {e.location_mode === 'UBICACION' && (
                <div className="mt-1 text-xs text-white/50 space-y-0.5">
                  <div>Entrada: {e.entry_biometric_location ?? e.entry_biometric_id ?? 'Sin dato'}</div>
                  <div>Salida: {e.exit_biometric_location ?? e.exit_biometric_id ?? 'Sin dato'}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Autogestión PWA y umbral GPS del puesto"
        subtitle="Aplicable para colaboradores remotos o mixtos; el umbral define el radio permitido para validar la captura GPS en PWA"
        actions={<Smartphone size={18} className="text-white/60" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="card p-4">
            <div className="text-white/60">Autogestión PWA</div>
            <div className="mt-2 font-semibold">{e.pwa_self_service_enabled ? 'Habilitada' : 'Deshabilitada'}</div>
            <div className="mt-1 text-xs text-white/50">
              {e.allow_remote_pwa ? 'Con acceso remoto / PWA' : 'Sin acceso remoto adicional'}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-white/60">Estado de edición</div>
            <div className="mt-2 font-semibold flex items-center gap-2">
              {e.pwa_self_service_locked ? (
                <CheckCircle2 size={14} className="text-emerald-300" />
              ) : (
                <Clock3 size={14} className="text-amber-200" />
              )}

              {e.pwa_self_service_locked
                ? 'Bloqueado luego del guardado'
                : e.pwa_self_service_enabled
                  ? 'Pendiente de completar'
                  : 'No aplica'}
            </div>

            {e.pwa_self_service_completed_at && (
              <div className="mt-1 text-xs text-white/50">
                Completado: {new Date(e.pwa_self_service_completed_at).toLocaleString()}
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="text-white/60">Umbral GPS válido</div>
            <div className="mt-2 font-semibold flex items-center gap-2">
              <LocateFixed size={14} className="text-cyan-300" />
              {e.geofence_radius_m != null ? `${Number(e.geofence_radius_m).toFixed(0)} m` : 'Aún no registrado en PWA'}
            </div>
          </div>

          <div className="card p-4 md:col-span-3">
            <div className="text-white/60">GPS registrado por el colaborador</div>
            <div className="mt-2 font-semibold">
              {e.geofence_lat != null && e.geofence_lng != null
                ? `${Number(e.geofence_lat).toFixed(6)}, ${Number(e.geofence_lng).toFixed(6)}`
                : 'Aún no registrado en PWA'}
            </div>
          </div>
        </div>
      </Card>

      <EmployeeOrgSection
        orgPath={buildOrgPath(orgUnits.data ?? [], orgAssignment.data?.org_unit_id)}
        currentUnit={currentOrgUnit?.name ?? 'Sin unidad organizacional'}
        supervisor={supervisorLabel}
        isLeader={orgAssignment.data?.is_unit_leader}
        leaderLevelLabel={leaderLevelLabel}
      />

      <Card title="Jornada y configuración técnica" actions={<Workflow size={18} className="text-white/60" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="card p-4">
            <div className="text-white/60">Jornada técnica</div>
            <div className="mt-2 font-semibold">
              {shiftInfo ? `${shiftInfo.name}${shiftInfo.code ? ` (${shiftInfo.code})` : ''}` : 'Sin sobrescritura individual'}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-white/60">Jornada presencial</div>
            <div className="mt-2 font-semibold">{e.presential_schedule_name ?? e.presential_schedule_id ?? 'Sin jornada presencial'}</div>
          </div>

          <div className="card p-4">
            <div className="text-white/60">Unidad líder</div>
            <div className="mt-2 font-semibold">{leaderUnit?.name ?? 'No aplica'}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Historial organizacional">
          <AssignmentHistoryTable rows={orgRows} />
        </Card>

        <Card title="Historial de jornadas">
          <AssignmentHistoryTable rows={shiftRows} />
        </Card>
      </div>
    </div>
  )
}
