import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChevronLeft,
  Save,
  Loader2,
  Camera,
  MapPin,
  Users,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Workflow,
  ShieldCheck,
  KeyRound,
  Smartphone,
  LocateFixed,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { provisionEmployeeUser } from '@/lib/provisionEmployeeUser'
import {
  buildOrgPath,
  fetchEmployeeLookup,
  fetchEmployeeOrgAssignment,
  fetchEmployeeShiftAssignment,
  fetchOrgLevelDefinitions,
  fetchOrgUnits,
  isMissingOrgSchemaError,
  ORG_MIGRATION_HINT,
  saveEmployeeOrgAssignment,
  saveEmployeeShiftAssignment,
} from '@/lib/orgStructure'

import {
  employeeFormSchema,
  type EmployeeFormValues,
  type FacialRecognitionConfig,
  FACIAL_CONFIG_DEFAULTS,
  WORK_MODALITY_OPTIONS,
  LOCATION_MODE_OPTIONS,
  ACCESS_ROLE_OPTIONS as EMPLOYEE_ACCESS_ROLE_OPTIONS,
} from './employeeSchemas'
import { computeImageMetrics, validateMetrics } from '@/lib/facialQuality'
import { ACCESS_ROLE_OPTIONS, accessRoleLabel, ensureUniqueTenantAdmin, fetchEmployeeAccessRole } from '@/lib/accessRoles'

type Props = { mode: 'create' | 'edit' }

const PHOTO_BUCKET = 'employee_photos'

const DAYS_OF_WEEK = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
]

async function fetchEmployee(tenantId: string, id: string) {
  let baseRow: any = null

  const v = await supabase
    .schema('public')
    .from('v_employees_full')
    .select(
      'id,tenant_id,employee_code,employee_number,first_name,last_name,email,identification,department_id,hire_date,salary,employment_status,facial_photo_url,vacation_start,vacation_end,lunch_tracking,work_mode,schedule_id,biometric_employee_code,created_at,updated_at,allow_remote_pwa,geofence_lat,geofence_lng,geofence_radius_m,first_login_pending'
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  if (!v.error) {
    baseRow = v.data
  } else {
    const { data, error } = await supabase
      .schema('public')
      .from('employees')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (error) throw error
    baseRow = data
  }

  const [contact, pwaSettings] = await Promise.all([
    fetchEmployeeContact(tenantId, id),
    fetchEmployeePwaSelfServiceSettings(tenantId, id),
  ])

  return {
    ...baseRow,
    phone: contact?.phone ?? null,
    address: contact?.address ?? null,
    pwa_self_service_enabled: pwaSettings?.pwa_self_service_enabled ?? false,
    pwa_self_service_locked: pwaSettings?.pwa_self_service_locked ?? false,
    pwa_self_service_completed_at: pwaSettings?.pwa_self_service_completed_at ?? null,
    geofence_radius_m: pwaSettings?.geofence_radius_m ?? baseRow?.geofence_radius_m ?? null,
    geofence_lat: pwaSettings?.geofence_lat ?? baseRow?.geofence_lat ?? null,
    geofence_lng: pwaSettings?.geofence_lng ?? baseRow?.geofence_lng ?? null,
    allow_remote_pwa: pwaSettings?.allow_remote_pwa ?? baseRow?.allow_remote_pwa ?? null,
  }
}

async function fetchEmployeePwaSelfServiceSettings(tenantId: string, employeeId: string) {
  const { data, error } = await supabase.schema(ATT_SCHEMA).rpc('get_employee_pwa_self_service_settings', {
    p_tenant_id: tenantId,
    p_employee_id: employeeId,
  })

  if (error) {
    const msg = String(error.message ?? '')
    if (msg.includes('get_employee_pwa_self_service_settings')) return null
    throw error
  }

  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
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

async function fetchDepartments(tenantId: string) {
  const { data, error } = await supabase
    .schema('public')
    .from('departments')
    .select('id,name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

async function fetchEmployeeAccess(tenantId: string, employeeId: string, fallbackUserId?: string | null) {
  return fetchEmployeeAccessRole(tenantId, employeeId, fallbackUserId)
}

async function fetchFacialConfig(tenantId: string): Promise<FacialRecognitionConfig> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('facial_recognition_config')
    .select('min_brightness,max_brightness,min_contrast,min_sharpness')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return FACIAL_CONFIG_DEFAULTS
  return { ...FACIAL_CONFIG_DEFAULTS, ...(data ?? {}) } as FacialRecognitionConfig
}

async function fetchBiometricDevices(tenantId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('biometric_devices')
    .select('id,serial_no,name,location_alias,is_active,display_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) return []
  return (data ?? []) as Array<{ id: string; serial_no: string; name: string; location_alias?: string | null; is_active: boolean; display_order?: number | null }>
}

async function fetchSchedules(tenantId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('schedules')
    .select('id,name,turn_id')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error) return []
  return (data ?? []) as Array<{ id: string; name: string; turn_id: string }>
}

async function fetchShifts(tenantId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('turns')
    .select('id,name,code,is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) return []
  return (data ?? []) as Array<{ id: string; name: string; code?: string | null; is_active: boolean }>
}

function pill(active: boolean) {
  return (
    'rounded-full px-3 py-1 text-xs font-semibold border ' +
    (active ? 'bg-white/15 border-white/15 text-white' : 'border-white/10 hover:bg-white/5 text-white/70')
  )
}

function note(text: string) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-white/70">
      {text}
    </div>
  )
}


function parseEmployeeSaveError(err: unknown) {
  const raw = String((err as any)?.message ?? err ?? '').trim()
  const msg = raw.toLowerCase()

  if (!raw) return 'No se pudo guardar el empleado. Intenta nuevamente.'

  if (msg.includes('duplicate key') || msg.includes('ya está en uso') || msg.includes('already exists') || msg.includes('unique constraint')) {
    if (msg.includes('email') || msg.includes('correo')) {
      return 'No se pudo guardar porque el correo electrónico ya está registrado en otro empleado o usuario. Usa un correo diferente o edita el registro existente.'
    }
    if (msg.includes('employee_code') || msg.includes('employees_employee_code') || msg.includes('employee code')) {
      return 'No se pudo guardar porque el código de empleado ya existe. Usa un código diferente.'
    }
    if (msg.includes('identification') || msg.includes('cedula') || msg.includes('cédula')) {
      return 'No se pudo guardar porque la cédula o identificación ya está registrada en otro empleado.'
    }
    return 'No se pudo guardar porque ya existe otro registro con los mismos datos clave.'
  }

  if (msg.includes('row-level security') || msg.includes('rls') || msg.includes('403')) {
    if (msg.includes('departments')) {
      return 'No se pudo guardar porque el sistema intentó crear o actualizar el departamento visible y la base de datos lo bloqueó por permisos. Aplica el fix de la RPC ensure_department_for_org_unit o revisa las políticas RLS de departments.'
    }
    return 'No se pudo guardar porque tu usuario no tiene permisos suficientes para esta operación.'
  }

  if (msg.includes('jwt') || msg.includes('401') || msg.includes('invalid login')) {
    return 'Tu sesión ya no es válida. Recarga la página e inicia sesión nuevamente.'
  }

  if (msg == 'sin tenant' || msg.includes('tenant')) {
    return 'No se pudo determinar la empresa activa del usuario. Cierra sesión y vuelve a ingresar.'
  }

  return raw
}

type OrgUnitLike = { id: string; name?: string | null; parent_id?: string | null }
type DepartmentLike = { id: string; name?: string | null }

function getOrgUnitLeafName(units: OrgUnitLike[], orgUnitId?: string | null) {
  if (!orgUnitId) return null
  const unit = units.find((row) => row.id === orgUnitId)
  const raw = String(unit?.name ?? '').trim()
  return raw || null
}

async function ensureDepartmentFromOrgUnit(
  tenantId: string,
  orgUnits: OrgUnitLike[],
  orgUnitId?: string | null,
  existingDepartmentId?: string | null,
  existingDepartments: DepartmentLike[] = [],
) {
  if (existingDepartmentId) return { departmentId: existingDepartmentId, departmentName: null as string | null, created: false }

  const leafName = getOrgUnitLeafName(orgUnits, orgUnitId)
  if (!leafName) return { departmentId: null as string | null, departmentName: null as string | null, created: false }

  const localMatch = existingDepartments.find((row) => String(row.name ?? '').trim().toLowerCase() === leafName.toLowerCase())
  if (localMatch?.id) {
    return { departmentId: localMatch.id, departmentName: leafName, created: false }
  }

  const { data: ensured, error: ensureError } = await supabase
    .rpc('ensure_department_for_org_unit', {
      p_tenant_id: tenantId,
      p_name: leafName,
    })
    .maybeSingle<{ id: string; name: string }>()

  if (ensureError) throw ensureError
  if (ensured?.id) {
    return { departmentId: ensured.id as string, departmentName: ensured.name as string, created: true }
  }

  const { data: retryFound, error: retryError } = await supabase
    .schema('public')
    .from('departments')
    .select('id,name')
    .eq('tenant_id', tenantId)
    .ilike('name', leafName)
    .limit(1)
    .maybeSingle()

  if (retryError) throw retryError
  if (retryFound?.id) {
    return { departmentId: retryFound.id as string, departmentName: leafName, created: false }
  }

  throw new Error('No se pudo asegurar el departamento visible a partir de la unidad organizacional.')
}

export default function EmployeeFormPage({ mode }: Props) {
  const nav = useNavigate()
  const { id } = useParams()
  const isEdit = mode === 'edit'

  const qc = useQueryClient()
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const [form, setForm] = React.useState<EmployeeFormValues>({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: null,
    address: null,
    identification: '',
    department_id: null,
    hire_date: null,
    salary: null,
    employment_status: 'ACTIVE',
    vacation_start: null,
    vacation_end: null,
    lunch_tracking: true,
    facial_photo_url: null,

    work_modality: 'PRESENCIAL',
    presential_days: [],
    presential_schedule_id: null,
    location_mode: 'INDISTINTO',
    entry_biometric_id: null,
    exit_biometric_id: null,
    is_department_head: false,

    org_unit_id: null,
    supervisor_employee_id: null,
    is_org_unit_leader: false,
    lead_org_unit_id: null,
    work_shift_id: null,
    access_role: 'employee',

    pwa_self_service_enabled: false,
    geofence_radius_m: null,
    reset_pwa_self_service_lock: false,
    pwa_self_service_locked: false,
    pwa_self_service_completed_at: null,
    geofence_lat: null,
    geofence_lng: null,

    password: '',
    password_confirm: '',
  })

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [vacOpen, setVacOpen] = React.useState(false)
  const [photoFile, setPhotoFile] = React.useState<File | null>(null)
  const [photoCheck, setPhotoCheck] = React.useState<{ ok: boolean; issues: string[] } | null>(null)
  const [showPass, setShowPass] = React.useState(false)

  const deps = useQuery({ queryKey: ['deps', tenantId], enabled: !!tenantId, queryFn: () => fetchDepartments(tenantId!) })
  const facialCfg = useQuery({
    queryKey: ['facialCfg', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchFacialConfig(tenantId!),
    retry: 0,
    staleTime: 300_000,
  })
  const bioDevices = useQuery({ queryKey: ['bioDevices', tenantId], enabled: !!tenantId, queryFn: () => fetchBiometricDevices(tenantId!) })
  const schedules = useQuery({ queryKey: ['schedules', tenantId], enabled: !!tenantId, queryFn: () => fetchSchedules(tenantId!) })
  const shifts = useQuery({ queryKey: ['shifts', tenantId], enabled: !!tenantId, queryFn: () => fetchShifts(tenantId!) })
  const orgLevels = useQuery({ queryKey: ['org-levels', tenantId], enabled: !!tenantId, queryFn: () => fetchOrgLevelDefinitions(tenantId!) })
  const orgUnits = useQuery({ queryKey: ['org-units', tenantId], enabled: !!tenantId, queryFn: () => fetchOrgUnits(tenantId!) })
  const people = useQuery({ queryKey: ['employee-lookup', tenantId], enabled: !!tenantId, queryFn: () => fetchEmployeeLookup(tenantId!) })

  const emp = useQuery({
    queryKey: ['emp', tenantId, id],
    enabled: !!tenantId && !!id && isEdit,
    queryFn: () => fetchEmployee(tenantId!, id!),
  })

  const accessInfo = useQuery({
    queryKey: ['employee-access', tenantId, id, (emp.data as any)?.user_id],
    enabled: !!tenantId && !!id && isEdit,
    queryFn: () => fetchEmployeeAccess(tenantId!, id!, (emp.data as any)?.user_id ?? null),
  })

  const orgAssignment = useQuery({
    queryKey: ['employee-org-assignment', tenantId, id],
    enabled: !!tenantId && !!id && isEdit,
    queryFn: () => fetchEmployeeOrgAssignment(tenantId!, id!),
  })

  const shiftAssignment = useQuery({
    queryKey: ['employee-shift-assignment', tenantId, id],
    enabled: !!tenantId && !!id && isEdit,
    queryFn: () => fetchEmployeeShiftAssignment(tenantId!, id!),
  })

  React.useEffect(() => {
    if (!emp.data) return
    const e: any = emp.data
    setForm((f) => ({
      ...f,
      employee_code: e.employee_code ?? e.employee_number ?? '',
      first_name: e.first_name ?? '',
      last_name: e.last_name ?? '',
      email: e.email ?? '',
      phone: e.phone ?? null,
      address: e.address ?? null,
      identification: e.identification ?? e.cedula ?? '',
      department_id: e.department_id ?? null,
      hire_date: e.hire_date ?? null,
      salary: e.salary != null ? Number(e.salary) : null,
      employment_status: String(e.employment_status ?? 'ACTIVE').toUpperCase() as EmployeeFormValues['employment_status'],
      vacation_start: e.vacation_start ?? null,
      vacation_end: e.vacation_end ?? null,
      lunch_tracking: e.lunch_tracking ?? true,
      facial_photo_url: e.facial_photo_url ?? null,
      work_modality: e.work_modality ?? e.work_mode ?? 'PRESENCIAL',
      presential_days: e.presential_days ?? [],
      presential_schedule_id: e.presential_schedule_id ?? e.schedule_id ?? null,
      location_mode: e.location_mode ?? 'INDISTINTO',
      entry_biometric_id: e.entry_biometric_id ?? null,
      exit_biometric_id: e.exit_biometric_id ?? null,
      is_department_head: e.is_department_head ?? false,
      pwa_self_service_enabled: e.pwa_self_service_enabled ?? false,
      geofence_radius_m: e.geofence_radius_m != null ? Number(e.geofence_radius_m) : null,
      reset_pwa_self_service_lock: false,
      pwa_self_service_locked: e.pwa_self_service_locked ?? false,
      pwa_self_service_completed_at: e.pwa_self_service_completed_at ?? null,
      geofence_lat: e.geofence_lat != null ? Number(e.geofence_lat) : null,
      geofence_lng: e.geofence_lng != null ? Number(e.geofence_lng) : null,
      password: '',
      password_confirm: '',
    }))
  }, [emp.data])

  React.useEffect(() => {
    if (!orgAssignment.data) return
    setForm((f) => ({
      ...f,
      org_unit_id: orgAssignment.data?.org_unit_id ?? null,
      supervisor_employee_id: orgAssignment.data?.supervisor_employee_id ?? null,
      is_org_unit_leader: orgAssignment.data?.is_unit_leader ?? false,
      lead_org_unit_id: orgAssignment.data?.lead_org_unit_id ?? null,
    }))
  }, [orgAssignment.data])

  React.useEffect(() => {
    if (!shiftAssignment.data) return
    setForm((f) => ({ ...f, work_shift_id: shiftAssignment.data?.shift_id ?? null }))
  }, [shiftAssignment.data])

  React.useEffect(() => {
    if (!accessInfo.data) return
    setForm((f) => ({ ...f, access_role: accessInfo.data?.role ?? 'employee' }))
  }, [accessInfo.data])

  const set = (k: keyof EmployeeFormValues, v: any) => setForm((f) => ({ ...f, [k]: v }))

  React.useEffect(() => {
    if (!form.presential_schedule_id) return
    const selectedSchedule = (schedules.data ?? []).find((row) => row.id === form.presential_schedule_id)
    if (!selectedSchedule) return
    if (form.work_shift_id && selectedSchedule.turn_id !== form.work_shift_id) {
      set('presential_schedule_id', null)
    }
  }, [form.work_shift_id, form.presential_schedule_id, schedules.data])

  const toggleDay = (day: string) => {
    const current = form.presential_days ?? []
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    set('presential_days', next)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sin tenant')
      setErrors({})

      const parsed = employeeFormSchema.safeParse(form)
      if (!parsed.success) {
        const nextErrors: Record<string, string> = {}
        parsed.error.issues.forEach((issue) => {
          const key = String(issue.path[0] ?? 'form')
          if (!nextErrors[key]) nextErrors[key] = issue.message
        })
        setErrors(nextErrors)
        throw new Error('VALIDATION')
      }

      if (!isEdit && !photoFile && !form.facial_photo_url) {
        setErrors((p) => ({ ...p, facial_photo_url: 'La fotografía es obligatoria' }))
        throw new Error('VALIDATION')
      }

      const requiresSystemAccess = form.work_modality !== 'PRESENCIAL' || form.access_role !== 'employee' || form.pwa_self_service_enabled
      let tempPassword: string | null = null
      if (!isEdit && requiresSystemAccess) {
        if (!form.password || form.password.length < 8) {
          setErrors((p) => ({ ...p, password: 'La contraseña temporal debe tener mínimo 8 caracteres' }))
          throw new Error('VALIDATION')
        }
        if (form.password !== form.password_confirm) {
          setErrors((p) => ({ ...p, password_confirm: 'Las contraseñas no coinciden' }))
          throw new Error('VALIDATION')
        }
        tempPassword = form.password
      } else if (isEdit && (form.password || form.password_confirm)) {
        setErrors((p) => ({ ...p, password: 'El cambio de contraseña no se realiza desde este formulario' }))
        throw new Error('ADMIN_PASSWORD_EDIT_NOT_SUPPORTED')
      }

      const employeeId = isEdit ? String(id) : crypto.randomUUID()

      const departmentResolution = await ensureDepartmentFromOrgUnit(
        tenantId,
        (orgUnits.data ?? []) as OrgUnitLike[],
        form.org_unit_id ?? null,
        form.department_id ?? null,
        (deps.data ?? []) as DepartmentLike[],
      )
      const effectiveDepartmentId = departmentResolution.departmentId

      if (form.access_role === 'tenant_admin') {
        await ensureUniqueTenantAdmin(tenantId, employeeId, accessInfo.data?.user_id ?? (emp.data as any)?.user_id ?? null)
      }

      let facial_photo_url = form.facial_photo_url
      if (photoFile) {
        const cfg = facialCfg.data ?? FACIAL_CONFIG_DEFAULTS
        const metrics = await computeImageMetrics(photoFile)
        const validation = validateMetrics(metrics, cfg)
        setPhotoCheck(validation)
        if (!validation.ok) throw new Error('FOTO_NO_CUMPLE_CONFIG')

        const ext = (photoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
        const path = `${tenantId}/${employeeId}/${Date.now()}.${safeExt}`
        const uploadRes = await supabase.storage.from(PHOTO_BUCKET).upload(path, photoFile, { upsert: true })
        if (uploadRes.error) throw uploadRes.error
        facial_photo_url = path
      }

      const normalizedEmploymentStatus = String(form.employment_status || 'ACTIVE').toLowerCase()

      const { error } = await supabase.schema(ATT_SCHEMA).rpc('upsert_employee_full', {
        p_tenant_id: tenantId,
        p_employee_id: employeeId,
        p_employee_code: form.employee_code,
        p_first_name: form.first_name,
        p_last_name: form.last_name,
        p_email: form.email,
        p_phone: form.phone,
        p_address: form.address,
        p_identification: form.identification,
        p_department_id: effectiveDepartmentId,
        p_hire_date: form.hire_date,
        p_salary: form.salary,
        p_employment_status: normalizedEmploymentStatus,
        p_facial_photo_url: facial_photo_url,
        p_vacation_start: form.vacation_start,
        p_vacation_end: form.vacation_end,
        p_lunch_tracking: form.lunch_tracking,
      })
      if (error) throw error

      const { error: pwaSettingsError } = await supabase.schema(ATT_SCHEMA).rpc('upsert_employee_pwa_self_service_settings', {
        p_tenant_id: tenantId,
        p_employee_id: employeeId,
        p_work_mode: form.work_modality,
        p_geofence_radius_m: form.pwa_self_service_enabled ? form.geofence_radius_m : null,
        p_pwa_self_service_enabled: form.pwa_self_service_enabled,
        p_reset_pwa_self_service_lock: form.reset_pwa_self_service_lock,
      })
      if (pwaSettingsError) throw pwaSettingsError

      const shouldSyncAccess = (form.work_modality !== 'PRESENCIAL' || form.access_role !== 'employee' || form.pwa_self_service_enabled) || !!accessInfo.data?.has_access
      if (shouldSyncAccess) {
        await provisionEmployeeUser({
          tenant_id: tenantId,
          employee_id: employeeId,
          email: form.email,
          temp_password: tempPassword,
          role: form.access_role,
        })
      }

      const warnings: string[] = []
      try {
        await saveEmployeeOrgAssignment(tenantId, {
          employee_id: employeeId,
          org_unit_id: form.org_unit_id ?? null,
          supervisor_employee_id: form.supervisor_employee_id ?? null,
          is_unit_leader: form.is_org_unit_leader ?? false,
          lead_org_unit_id: form.is_org_unit_leader ? form.lead_org_unit_id ?? form.org_unit_id ?? null : null,
        })
      } catch (assignmentError: any) {
        if (isMissingOrgSchemaError(assignmentError)) {
          warnings.push('No se guardó estructura organizacional porque faltan las tablas nuevas.')
        } else {
          throw assignmentError
        }
      }

      try {
        await saveEmployeeShiftAssignment(tenantId, {
          employee_id: employeeId,
          shift_id: form.work_shift_id ?? null,
        })
      } catch (shiftError: any) {
        if (isMissingOrgSchemaError(shiftError)) {
          warnings.push('No se guardó turno efectivo porque falta la tabla employee_shift_assignments.')
        } else {
          throw shiftError
        }
      }

      return { id: employeeId, warnings, departmentResolution }
    },
    onSuccess: (result) => {
      toast.success(isEdit ? 'Empleado actualizado' : 'Empleado creado')
      result.warnings.forEach((warning) => toast(warning, { icon: '⚠️' }))
      if (result.departmentResolution?.departmentName) {
        toast(`Departamento visible sincronizado con unidad organizacional: ${result.departmentResolution.departmentName}`, { icon: '🏷️' })
      }
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['emp'] })
      qc.invalidateQueries({ queryKey: ['employee-org-assignment'] })
      qc.invalidateQueries({ queryKey: ['employee-shift-assignment'] })
      qc.invalidateQueries({ queryKey: ['employee-access'] })
      nav(`/employees/${result.id}`, { replace: true })
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? '')
      if (msg === 'VALIDATION') return
      if (msg === 'FOTO_NO_CUMPLE_CONFIG') {
        toast.error('La fotografía no cumple la configuración facial.')
        return
      }
      if (msg === 'ADMIN_PASSWORD_EDIT_NOT_SUPPORTED') {
        toast.error('El cambio de contraseña no se realiza desde este formulario.')
        return
      }
      if (msg.includes('TENANT_ADMIN_ALREADY_EXISTS')) {
        toast.error('Ya existe un Administrador HRCloud activo para esta empresa. Solo puede haber uno.')
        return
      }
      toast.error(parseEmployeeSaveError(e))
    },
  })

  const bioOptions = (bioDevices.data ?? []).map((d) => ({
    value: d.id,
    label: `${(d.location_alias ?? d.name ?? d.serial_no)}${d.serial_no ? ` (${d.serial_no})` : ''}`
  }))
  const filteredSchedules = React.useMemo(() => {
    const rows = schedules.data ?? []
    if (!form.work_shift_id) return rows
    return rows.filter((row) => row.turn_id === form.work_shift_id)
  }, [schedules.data, form.work_shift_id])
  const scheduleOptions = filteredSchedules.map((s) => ({ value: s.id, label: s.name }))
  const shiftOptions = (shifts.data ?? []).map((shift) => ({ value: shift.id, label: shift.code ? `${shift.name} (${shift.code})` : shift.name }))
  const orgUnitOptions = (orgUnits.data ?? []).filter((unit) => unit.is_active !== false).map((unit) => ({ value: unit.id, label: buildOrgPath(orgUnits.data ?? [], unit.id) }))
  const peopleOptions = (people.data ?? []).map((person) => ({ value: person.id, label: person.employee_code ? `${person.full_name} (${person.employee_code})` : person.full_name }))
  const showLocationFields = form.work_modality === 'PRESENCIAL' || form.work_modality === 'MIXTO'
  const requiresSystemAccess = form.work_modality !== 'PRESENCIAL' || form.access_role !== 'employee' || form.pwa_self_service_enabled
  const orgSchemaMissing = isMissingOrgSchemaError(orgLevels.error) || isMissingOrgSchemaError(orgUnits.error) || isMissingOrgSchemaError(orgAssignment.error)
  const orgSummary = form.org_unit_id ? buildOrgPath(orgUnits.data ?? [], form.org_unit_id) : 'Sin unidad organizacional asignada'
  const leadLevelLabel = React.useMemo(() => {
    const unit = (orgUnits.data ?? []).find((row) => row.id === (form.lead_org_unit_id ?? form.org_unit_id))
    const level = (orgLevels.data ?? []).find((row) => row.level_no === unit?.level_no)
    return level?.display_name ?? null
  }, [form.lead_org_unit_id, form.org_unit_id, orgUnits.data, orgLevels.data])
  const selectedRoleMeta = ACCESS_ROLE_OPTIONS.find((opt) => opt.value === form.access_role)
  const selfServiceStateLabel = form.pwa_self_service_locked ? 'Bloqueado después del registro del empleado' : form.pwa_self_service_enabled ? 'Habilitado y pendiente de completar en PWA' : 'Deshabilitado'
  const selfServiceStateTone = form.pwa_self_service_locked ? 'text-emerald-300' : form.pwa_self_service_enabled ? 'text-amber-200' : 'text-white/60'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button className="mb-2 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white" onClick={() => nav('/employees')}>
            <ChevronLeft size={16} /> Volver
          </button>
          <h1 className="text-xl font-bold">{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</h1>
        </div>
        <Button leftIcon={save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} onClick={() => save.mutate()} disabled={save.isPending}>
          Guardar
        </Button>
      </div>

      <Card title="Estado del empleado">
        <div className="flex flex-wrap gap-2">
          {(['ACTIVE', 'VACATION', 'SUSPENDED', 'TERMINATED'] as const).map((status) => (
            <button
              key={status}
              className={pill(form.employment_status === status)}
              onClick={() => {
                set('employment_status', status)
                if (status === 'VACATION') setVacOpen(true)
              }}
            >
              {{ ACTIVE: 'Activo', VACATION: 'Vacaciones', SUSPENDED: 'Suspendido', TERMINATED: 'Cesante' }[status]}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Datos básicos" className="xl:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Código" value={form.employee_code} onChange={(e) => set('employee_code', e.target.value)} error={errors.employee_code} />
            <Input label="Cédula / ID" value={form.identification} onChange={(e) => set('identification', e.target.value.replace(/\D+/g, ''))} error={errors.identification} inputMode="numeric" />
            <Input label="Nombres" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} />
            <Input label="Apellidos" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
            <Input label="Teléfono" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} error={errors.phone} />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-white/80 mb-1">Dirección</label>
              <textarea
                value={form.address ?? ''}
                onChange={(e) => set('address', e.target.value || null)}
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/20"
                placeholder="Dirección actual del empleado"
              />
              {errors.address ? <p className="text-xs text-red-300 mt-1">{errors.address}</p> : null}
            </div>
            <Input label="Fecha contratación" type="date" value={form.hire_date ?? ''} onChange={(e) => set('hire_date', e.target.value || null)} />
            <Input label="Sueldo" type="number" value={form.salary ?? ''} onChange={(e) => set('salary', e.target.value ? Number(e.target.value) : null)} />
          </div>
        </Card>

        <Card title="Fotografía" subtitle="Reconocimiento facial" actions={<Camera size={18} className="text-white/60" />}>
          <div className="space-y-2">
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="text-sm text-white/70" />
            {errors.facial_photo_url && <div className="text-xs text-rose-200">{errors.facial_photo_url}</div>}
            {photoCheck && !photoCheck.ok && <div className="text-xs text-rose-200">La foto no cumple: {photoCheck.issues.join(', ')}</div>}
            <p className="text-xs text-white/50">La fotografía es obligatoria y se valida contra la configuración facial del tenant.</p>
          </div>
        </Card>
      </div>

      <Card title="Rol de acceso en Base" subtitle="Diferencia la jefatura organizacional del rol de acceso al sistema" actions={<ShieldCheck size={18} className="text-white/60" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Rol del sistema"
            value={form.access_role}
            onChange={(v) => set('access_role', (v || 'employee') as any)}
            options={EMPLOYEE_ACCESS_ROLE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            placeholder="Seleccione rol…"
          />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Rol seleccionado</div>
            <div className="mt-2 font-semibold">{accessRoleLabel(form.access_role)}</div>
            <div className="mt-2 text-xs text-white/60">{selectedRoleMeta?.help ?? 'Sin observaciones'}</div>
            {form.access_role === 'tenant_admin' && (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Debe existir un solo Administrador HRCloud activo por tenant. El sistema validará la unicidad antes de guardar.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="Autogestión PWA / revisión de datos personales"
        subtitle="Se habilita desde Base para que el empleado revise y actualice sus datos una sola vez y registre el GPS del puesto de trabajo."
        actions={<Smartphone size={18} className="text-white/60" />}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">Habilitar revisión en PWA</div>
                <p className="mt-1 text-xs text-white/60">El empleado podrá ingresar a PWA, revisar sus datos personales, registrar la georreferenciación de su puesto y guardar una sola vez.</p>
              </div>
              <button
                type="button"
                onClick={() => set('pwa_self_service_enabled', !form.pwa_self_service_enabled)}
                className={`w-12 h-7 rounded-full transition-colors flex items-center ${form.pwa_self_service_enabled ? 'bg-blue-500 justify-end' : 'bg-white/20 justify-start'}`}
              >
                <span className="w-6 h-6 mx-0.5 rounded-full bg-white shadow" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Rango válido de georreferenciación (metros)"
              type="number"
              min={1}
              value={form.geofence_radius_m ?? ''}
              onChange={(e) => set('geofence_radius_m', e.target.value ? Number(e.target.value) : null)}
              error={errors.geofence_radius_m}
              hint="Este es el radio que se tomará como válido para el GPS que registrará el empleado en PWA."
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Estado actual</div>
              <div className={`mt-2 text-sm font-semibold ${selfServiceStateTone}`}>{selfServiceStateLabel}</div>
              {form.pwa_self_service_completed_at && (
                <div className="mt-2 text-xs text-white/50">Completado: {new Date(form.pwa_self_service_completed_at).toLocaleString()}</div>
              )}
              {(form.geofence_lat != null && form.geofence_lng != null) && (
                <div className="mt-2 text-xs text-white/50">GPS guardado: {Number(form.geofence_lat).toFixed(6)}, {Number(form.geofence_lng).toFixed(6)}</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-white/80">
              <LocateFixed size={16} className="mt-0.5 text-cyan-300" />
              <div>
                <div className="font-medium">Comportamiento esperado en PWA</div>
                <div className="mt-1 text-xs text-white/60">1) El empleado revisa/actualiza sus datos. 2) Captura el GPS del puesto de trabajo. 3) Confirma que desea guardar. 4) El sistema bloquea nuevas ediciones.</div>
              </div>
            </div>

            {form.pwa_self_service_locked && (
              <label className="flex items-start gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!form.reset_pwa_self_service_lock}
                  onChange={(e) => set('reset_pwa_self_service_lock', e.target.checked)}
                />
                <span>
                  Rehabilitar edición en PWA para que el empleado pueda volver a actualizar datos y registrar nuevamente la georreferenciación.
                </span>
              </label>
            )}

            {!form.pwa_self_service_locked && form.pwa_self_service_enabled && (
              <div className="flex items-center gap-2 text-xs text-emerald-200">
                <CheckCircle2 size={14} /> Quedará pendiente para que el empleado complete el proceso desde PWA.
              </div>
            )}
            {form.pwa_self_service_locked && (
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <RotateCcw size={14} /> El empleado ya completó el proceso. Marca la opción de rehabilitar si deseas permitir una nueva actualización.
              </div>
            )}
          </div>
        </div>
      </Card>

      {requiresSystemAccess ? (
        <Card title="Credenciales de acceso" subtitle={!isEdit ? 'Contraseña temporal para el primer ingreso al sistema' : 'La contraseña no se cambia desde este formulario'} actions={<KeyRound size={18} className="text-white/60" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-white/60">Contraseña temporal{!isEdit && <span className="text-rose-400 ml-1">*</span>}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password ?? ''}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder={isEdit ? 'No editable desde este formulario' : 'Mínimo 8 caracteres'}
                  disabled={isEdit}
                  className="w-full px-3 py-2 pr-10 rounded-xl text-sm outline-none border border-white/15 bg-white/5 text-white placeholder:text-white/30 focus:border-blue-500 disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-2.5 text-white/40 hover:text-white/70">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-rose-300 mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-white/60">Confirmar contraseña{!isEdit && <span className="text-rose-400 ml-1">*</span>}</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password_confirm ?? ''}
                onChange={(e) => set('password_confirm', e.target.value)}
                placeholder={isEdit ? 'No editable desde este formulario' : 'Repetir contraseña'}
                disabled={isEdit}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border border-white/15 bg-white/5 text-white placeholder:text-white/30 focus:border-blue-500 disabled:opacity-50"
              />
              {errors.password_confirm && <p className="text-xs text-rose-300 mt-1">{errors.password_confirm}</p>}
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
            <Lock size={13} className="flex-shrink-0 mt-0.5 text-blue-400" />
            <p className="text-xs text-white/60">Estas credenciales cubren el acceso PWA para personal remoto/mixto y también el acceso administrativo cuando el rol del sistema no es Empleado.</p>
          </div>
        </Card>
      ) : (
        <Card title="Acceso al sistema" subtitle="No requiere credenciales en este momento" actions={<KeyRound size={18} className="text-white/60" />}>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Este empleado es presencial y no tiene rol administrativo. Por eso no se provisionan credenciales PWA ni acceso Base en la creación.
          </div>
        </Card>
      )}

      <Card title="Modalidad de trabajo" subtitle="Define cómo y desde dónde trabaja el empleado" actions={<Briefcase size={18} className="text-white/60" />}>
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-white/60 mb-2">Modalidad</label>
            <div className="flex flex-wrap gap-2">
              {WORK_MODALITY_OPTIONS.map((opt) => (
                <button key={opt.value} className={pill(form.work_modality === opt.value)} onClick={() => set('work_modality', opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.work_modality === 'MIXTO' && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
              <p className="text-sm font-medium text-white/80">Días presenciales</p>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => (
                  <button key={d.value} className={pill((form.presential_days ?? []).includes(d.value))} onClick={() => toggleDay(d.value)}>
                    {d.label}
                  </button>
                ))}
              </div>
              {errors.presential_days && <p className="text-xs text-rose-300">{errors.presential_days}</p>}
              <p className="text-xs text-white/50">El horario se asigna en la sección de estructura organizacional y asignación laboral.</p>
            </div>
          )}

          {showLocationFields && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={15} className="text-white/60" />
                <p className="text-sm font-medium text-white/80">Lugar de marcación</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {LOCATION_MODE_OPTIONS.map((opt) => (
                  <button key={opt.value} className={pill(form.location_mode === opt.value)} onClick={() => set('location_mode', opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.location_mode === 'UBICACION' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <Select label="Biométrico de entrada" value={form.entry_biometric_id ?? ''} onChange={(v) => set('entry_biometric_id', v || null)} options={bioOptions} placeholder="Seleccione ubicación…" error={errors.entry_biometric_id} />
                  <Select label="Biométrico de salida" value={form.exit_biometric_id ?? ''} onChange={(v) => set('exit_biometric_id', v || null)} options={bioOptions} placeholder="Seleccione ubicación…" error={errors.exit_biometric_id} />
                </div>
              )}
              {bioDevices.isError && <p className="text-xs text-amber-300">No se pudieron cargar los biométricos. Verifique attendance.biometric_devices.</p>}
            </div>
          )}
        </div>
      </Card>

      <Card title="Departamento / jefatura inmediata y asignación laboral" subtitle="Asigna el área, sección o departamento donde pertenece el empleado, su jefatura inmediata, turno y horario" actions={<Workflow size={18} className="text-white/60" />}>
        <div className="space-y-5">
          {orgSchemaMissing && note(ORG_MIGRATION_HINT)}
          {!orgSchemaMissing && note('Política estructural activa: si el empleado tiene unidad organizacional y no tiene departamento explícito, el sistema usa la unidad como departamento visible en reportes y listados.')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Departamento / área / sección donde pertenece *"
              value={form.org_unit_id ?? ''}
              onChange={(v) => set('org_unit_id', v || null)}
              options={orgUnitOptions}
              placeholder="Seleccione el departamento, área o sección…"
              error={errors.org_unit_id}
            />
            <Select
              label="Turno efectivo"
              value={form.work_shift_id ?? ''}
              onChange={(v) => {
                set('work_shift_id', v || null)
                if (!v) set('presential_schedule_id', null)
              }}
              options={shiftOptions}
              placeholder="Seleccione turno…"
              error={errors.work_shift_id}
            />
            <div className="space-y-1">
              <Select
                label="Horario asignado"
                value={form.presential_schedule_id ?? ''}
                onChange={(v) => {
                  const nextId = v || null
                  set('presential_schedule_id', nextId)
                  const selectedSchedule = (schedules.data ?? []).find((row) => row.id === nextId)
                  if (selectedSchedule?.turn_id && selectedSchedule.turn_id !== form.work_shift_id) {
                    set('work_shift_id', selectedSchedule.turn_id)
                  }
                }}
                options={scheduleOptions}
                placeholder={form.work_shift_id ? 'Seleccione horario…' : 'Seleccione primero un turno…'}
                error={errors.presential_schedule_id}
              />
              <p className="text-xs text-white/50">Los horarios se filtran según el turno seleccionado y se usan en asistencia, dashboardes y reportes.</p>
            </div>
            <Select
              label="Jefatura inmediata / supervisor inmediato"
              value={form.supervisor_employee_id ?? ''}
              onChange={(v) => set('supervisor_employee_id', v || null)}
              options={peopleOptions.filter((person) => person.value !== id)}
              placeholder="Seleccione la jefatura inmediata o deje resolución automática"
              error={errors.supervisor_employee_id}
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
              <div className="text-xs text-white/60">Ruta completa del organigrama</div>
              <div className="mt-2 font-semibold">{orgSummary}</div>
              <div className="mt-2 text-xs text-white/50">Aquí defines el departamento, área o sección exacta donde pertenece el empleado y quién es su jefatura inmediata.</div>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => set('is_org_unit_leader', !form.is_org_unit_leader)} className={`w-10 h-6 rounded-full transition-colors flex items-center ${form.is_org_unit_leader ? 'bg-blue-500 justify-end' : 'bg-white/20 justify-start'}`}>
                <span className="w-5 h-5 mx-0.5 rounded-full bg-white shadow" />
              </button>
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-white/60" />
                <span className="text-sm text-white/80">Es jefe del departamento / área / sección a la que pertenece</span>
              </div>
            </div>

            {form.is_org_unit_leader && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Departamento / área / sección que lidera"
                  value={form.lead_org_unit_id ?? form.org_unit_id ?? ''}
                  onChange={(v) => set('lead_org_unit_id', v || null)}
                  options={orgUnitOptions}
                  placeholder="Seleccione unidad…"
                  error={errors.lead_org_unit_id}
                />
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="text-white/60">Nivel de jefatura</div>
                  <div className="mt-2 font-semibold">{leadLevelLabel ?? 'Se determinará por la unidad seleccionada'}</div>
                </div>
              </div>
            )}
          </div>

          {(orgLevels.data ?? []).length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-white/80 mb-2">Niveles organizacionales habilitados</div>
              <div className="flex flex-wrap gap-2">
                {(orgLevels.data ?? []).filter((row) => row.is_enabled).map((row) => (
                  <span key={row.level_no} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/75">
                    Nivel {row.level_no}: {row.display_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Modal open={vacOpen} onClose={() => setVacOpen(false)} title="Periodo de vacaciones">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Inicio" type="date" value={form.vacation_start ?? ''} onChange={(e) => set('vacation_start', e.target.value || null)} />
          <Input label="Fin" type="date" value={form.vacation_end ?? ''} onChange={(e) => set('vacation_end', e.target.value || null)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setVacOpen(false)}>Cerrar</Button>
          <Button onClick={() => setVacOpen(false)}>Aplicar</Button>
        </div>
      </Modal>
    </div>
  )
}
