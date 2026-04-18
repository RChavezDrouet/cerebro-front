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
  Building2,
  Workflow,
  ShieldCheck,
  KeyRound,
  Smartphone,
  LocateFixed,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  UserCheck,
  Briefcase,
  GraduationCap,
  Heart,
  Phone,
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
  IDENTIFICATION_TYPE_OPTIONS,
  GENDER_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  LABOR_REGIME_OPTIONS,
  DISABILITY_TYPE_OPTIONS,
  DISABILITY_GRADE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
} from './employeeSchemas'
import { computeImageMetrics, validateMetrics } from '@/lib/facialQuality'
import {
  ACCESS_ROLE_OPTIONS,
  accessRoleLabel,
  ensureUniqueTenantAdmin,
  fetchEmployeeAccessRole,
} from '@/lib/accessRoles'
import { listBiometricDevicesConfig } from '@/services/biometricAliasesService'

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

async function fetchDepartments(tenantId: string) {
  const { data, error } = await supabase
    .schema('public')
    .from('departments')
    .select('id,name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

async function fetchEmployeeAccess(tenantId: string, employeeId: string, fallbackUserId?: string | null) {
  return fetchEmployeeAccessRole(tenantId, employeeId, fallbackUserId)
}

async function fetchEmployeePwaSelfServiceSettings(employeeId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_employee_pwa_self_service_settings', { p_employee_id: employeeId })

  if (error) return null
  return (Array.isArray(data) ? data[0] : data) ?? null
}

async function fetchEmployeeProfile(employeeId: string) {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('employee_profile')
    .select('employee_id,work_mode,allow_remote_pwa,onsite_days,presential_schedule_id,entry_biometric_id,exit_biometric_id')
    .eq('employee_id', employeeId)
    .maybeSingle()

  if (error) return null
  return data ?? null
}

async function fetchFacialConfig(tenantId: string): Promise<FacialRecognitionConfig> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('facial_recognition_config')
    .select('min_brightness,max_brightness,min_contrast,min_sharpness,min_face_width_px,min_face_height_px,max_tilt_angle,capture_count,capture_interval_sec,match_threshold_percent')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return FACIAL_CONFIG_DEFAULTS
  return { ...FACIAL_CONFIG_DEFAULTS, ...(data ?? {}) } as FacialRecognitionConfig
}

async function fetchBiometricDevices(tenantId: string) {
  try {
    const rows = await listBiometricDevicesConfig(supabase)
    return rows
      .filter((row) => row.tenant_id === tenantId)
      .filter((row) => row.is_active !== false)
      .sort((a, b) => {
        const ao = a.display_order ?? 999999
        const bo = b.display_order ?? 999999
        if (ao !== bo) return ao - bo
        return biometricPrimaryLabel(a).localeCompare(biometricPrimaryLabel(b))
      })
  } catch {
    return []
  }
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pill(active: boolean) {
  return (
    'rounded-full px-3 py-1 text-xs font-semibold border ' +
    (active
      ? 'bg-white/15 border-white/15 text-white'
      : 'border-white/10 hover:bg-white/5 text-white/70')
  )
}

function note(text: string) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-white/70">
      {text}
    </div>
  )
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        className={`w-10 h-6 rounded-full transition-colors flex items-center ${
          on ? 'bg-blue-500 justify-end' : 'bg-white/20 justify-start'
        }`}
      >
        <span className="w-5 h-5 mx-0.5 rounded-full bg-white shadow" />
      </button>
      <span className="text-sm text-white/80">{label}</span>
    </div>
  )
}

type BiometricOptionRow = {
  id: string
  serial_no: string
  name?: string | null
  location_alias?: string | null
  location_details?: string | null
  display_alias?: string | null
  is_active?: boolean
  display_order?: number | null
  tenant_id?: string
}

function cleanBiometricText(value?: string | null) {
  return String(value ?? '').trim()
}

function isTechnicalBiometricText(value: string, device: Pick<BiometricOptionRow, 'serial_no' | 'name'>) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return true
  const serial = cleanBiometricText(device.serial_no).toLowerCase()
  const name   = cleanBiometricText(device.name).toLowerCase()
  if (serial && normalized === serial) return true
  if (name   && normalized === name)   return true
  if (serial && (normalized === `biométrico ${serial}` || normalized === `biometrico ${serial}`)) return true
  if (serial && (normalized.startsWith('biométrico ') || normalized.startsWith('biometrico ')) && normalized.includes(serial)) return true
  return false
}

function biometricPrimaryLabel(device: Pick<BiometricOptionRow, 'serial_no' | 'name' | 'location_alias' | 'location_details' | 'display_alias'>) {
  const preferred = [
    cleanBiometricText(device.location_alias),
    cleanBiometricText(device.location_details),
    cleanBiometricText(device.display_alias),
    cleanBiometricText(device.name),
  ].find((candidate) => candidate && !isTechnicalBiometricText(candidate, device as BiometricOptionRow))

  return (
    preferred ||
    cleanBiometricText(device.location_details) ||
    cleanBiometricText(device.location_alias)   ||
    cleanBiometricText(device.display_alias)    ||
    cleanBiometricText(device.name)             ||
    cleanBiometricText(device.serial_no)        ||
    'Biométrico'
  )
}

function biometricSelectLabel(device: Pick<BiometricOptionRow, 'serial_no' | 'name' | 'location_alias' | 'location_details' | 'display_alias'>) {
  const primary = biometricPrimaryLabel(device)
  const serial  = cleanBiometricText(device.serial_no)
  return serial && primary.toLowerCase() !== serial.toLowerCase()
    ? `${primary} · ${serial}`
    : primary || serial || 'Biométrico'
}

// ─── Initial form values ──────────────────────────────────────────────────────

const INITIAL_FORM: EmployeeFormValues = {
  employee_code:      '',
  identification_type: 'CEDULA',
  identification:     '',

  first_name:   '',
  last_name:    '',
  birth_date:   null,
  gender:       null,
  civil_status: null,
  nationality:  null,
  birth_place:  null,

  email:                   '',
  phone:                   null,
  phone_home:              null,
  emergency_contact_name:  null,
  emergency_contact_phone: null,
  address:                 null,

  department_id: null,
  hire_date:     null,
  salary:        null,
  position:      null,
  contract_type: null,
  labor_regime:  null,

  iess_number:    null,
  iess_entry_date: null,
  ruc:            null,
  children_count: null,

  has_disability:          false,
  disability_type:         null,
  conadis_number:          null,
  disability_percentage:   null,
  disability_card_issued:  null,
  disability_card_expires: null,
  disability_grade:        null,

  education_level:       null,
  degree_title:          null,
  education_institution: null,
  dependents_registered_at: null,

  employment_status: 'ACTIVE',
  vacation_start:    null,
  vacation_end:      null,
  lunch_tracking:    true,
  facial_photo_url:  null,

  work_modality:          'PRESENCIAL',
  presential_days:        [],
  presential_schedule_id: null,
  location_mode:          'INDISTINTO',
  entry_biometric_id:     null,
  exit_biometric_id:      null,
  is_department_head:     false,

  org_unit_id:            null,
  supervisor_employee_id: null,
  is_org_unit_leader:     false,
  lead_org_unit_id:       null,
  work_shift_id:          null,
  access_role:            'employee',

  pwa_self_service_enabled:      false,
  geofence_radius_m:             null,
  reset_pwa_self_service_lock:   false,
  pwa_self_service_locked:       false,
  pwa_self_service_completed_at: null,
  geofence_lat: null,
  geofence_lng: null,

  password:         '',
  password_confirm: '',
}

// ─── Dependents ───────────────────────────────────────────────────────────────

type DependentRow = {
  id: string
  full_name: string
  birth_date: string | null
  identification: string | null
  relationship: 'CONYUGE' | 'UNION_HECHO' | 'HIJO'
  has_disability: boolean
  is_active: boolean
  isNew: boolean
}

async function fetchDependents(tenantId: string, employeeId: string): Promise<DependentRow[]> {
  const { data, error } = await supabase
    .schema('public')
    .from('employee_dependents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('created_at')

  if (error) return []
  return (data ?? []).map((r: any) => ({
    id:             r.id,
    full_name:      r.full_name ?? '',
    birth_date:     r.birth_date ?? null,
    identification: r.identification ?? null,
    relationship:   r.relationship ?? 'HIJO',
    has_disability: r.has_disability ?? false,
    is_active:      r.is_active ?? true,
    isNew:          false,
  }))
}

async function saveDependents(tenantId: string, employeeId: string, rows: DependentRow[]) {
  await supabase
    .schema('public')
    .from('employee_dependents')
    .delete()
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId)

  if (rows.length === 0) return

  const { error } = await supabase.schema('public').from('employee_dependents').insert(
    rows.map((r) => ({
      tenant_id:      tenantId,
      employee_id:    employeeId,
      full_name:      r.full_name,
      birth_date:     r.birth_date || null,
      identification: r.identification || null,
      relationship:   r.relationship,
      has_disability: r.has_disability,
      is_active:      r.is_active,
    }))
  )
  if (error) throw error
}

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
}

// ─── CargasFamiliaresSection ──────────────────────────────────────────────────

function CargasFamiliaresSection({
  dependents,
  setDependents,
  registeredAt,
  onChangeRegisteredAt,
}: {
  dependents: DependentRow[]
  setDependents: React.Dispatch<React.SetStateAction<DependentRow[]>>
  registeredAt: string | null
  onChangeRegisteredAt: (v: string | null) => void
}) {
  const today        = new Date()
  const march30      = new Date(today.getFullYear(), 2, 30)
  const pastDeadline = today > march30
  const regDate      = registeredAt ? new Date(registeredAt) : null
  const showWarning  = !regDate || regDate > march30

  const spouse      = dependents.find((d) => d.relationship === 'CONYUGE' || d.relationship === 'UNION_HECHO')
  const hasSpouse   = !!spouse
  const children    = dependents.filter((d) => d.relationship === 'HIJO')

  const validCount = dependents.filter((d) => {
    if (!d.is_active) return false
    if (d.relationship === 'CONYUGE' || d.relationship === 'UNION_HECHO') return true
    if (d.relationship === 'HIJO') {
      if (d.has_disability) return true
      const age = getAge(d.birth_date)
      return age !== null && age < 18
    }
    return false
  }).length

  function updateDep(idx: number, patch: Partial<DependentRow>) {
    setDependents((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }

  function removeDep(idx: number) {
    setDependents((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleSpouse() {
    if (hasSpouse) {
      setDependents((prev) =>
        prev.filter((d) => d.relationship !== 'CONYUGE' && d.relationship !== 'UNION_HECHO')
      )
    } else {
      setDependents((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          full_name: '',
          birth_date: null,
          identification: null,
          relationship: 'CONYUGE',
          has_disability: false,
          is_active: true,
          isNew: true,
        },
      ])
    }
  }

  function addChild() {
    setDependents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        full_name: '',
        birth_date: null,
        identification: null,
        relationship: 'HIJO',
        has_disability: false,
        is_active: true,
        isNew: true,
      },
    ])
  }

  return (
    <Card
      title="Cargas familiares"
      subtitle="Art. 6 y 7 Código de Trabajo — cálculo 5% utilidades"
    >
      <div className="space-y-5">

        {/* Resumen y fecha de registro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
            <div className="text-xs text-white/60">Total cargas familiares válidas</div>
            <div className="text-2xl font-bold">{validCount}</div>
            <div className="text-xs text-white/50">
              Cónyuge/conviviente activo + hijos &lt;18 años + hijos con discapacidad
            </div>
          </div>

          <div className="space-y-2">
            <Input
              label="Fecha de registro de cargas"
              type="date"
              value={registeredAt ?? ''}
              onChange={(e) => onChangeRegisteredAt(e.target.value || null)}
            />
            {showWarning && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                ⚠ {pastDeadline
                  ? 'El plazo del 30 de marzo ya venció. Registra igualmente para el próximo período.'
                  : 'Registra las cargas antes del 30 de marzo para que apliquen al reparto de utilidades.'}
              </div>
            )}
          </div>
        </div>

        {/* Cónyuge / conviviente */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
          <Toggle
            on={hasSpouse}
            onToggle={toggleSpouse}
            label="Tiene cónyuge o conviviente"
          />

          {hasSpouse && spouse && (() => {
            const spouseIdx = dependents.findIndex(
              (d) => d.relationship === 'CONYUGE' || d.relationship === 'UNION_HECHO'
            )
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/10">
                <Input
                  label="Nombre completo"
                  value={spouse.full_name}
                  onChange={(e) => updateDep(spouseIdx, { full_name: e.target.value })}
                />
                <Input
                  label="Cédula"
                  value={spouse.identification ?? ''}
                  onChange={(e) =>
                    updateDep(spouseIdx, {
                      identification: e.target.value.replace(/\D+/g, '').slice(0, 10) || null,
                    })
                  }
                  inputMode="numeric"
                />
                <div>
                  <label className="block text-xs font-medium mb-1 text-white/60">Tipo</label>
                  <div className="flex gap-2">
                    {(['CONYUGE', 'UNION_HECHO'] as const).map((rel) => (
                      <button
                        key={rel}
                        type="button"
                        className={pill(spouse.relationship === rel)}
                        onClick={() => updateDep(spouseIdx, { relationship: rel })}
                      >
                        {rel === 'CONYUGE' ? 'Cónyuge' : 'Unión de hecho'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Hijos / dependientes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">
              Hijos / dependientes ({children.length})
            </p>
            <Button variant="secondary" size="sm" onClick={addChild}>
              + Agregar dependiente
            </Button>
          </div>

          {children.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/50 text-center">
              No hay dependientes registrados
            </div>
          )}

          {children.map((dep) => {
            const globalIdx = dependents.findIndex((d) => d === dep)
            const age       = getAge(dep.birth_date)
            const qualifies = dep.has_disability || (age !== null && age < 18)

            return (
              <div
                key={dep.id}
                className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        dep.is_active && qualifies ? 'bg-emerald-400' : 'bg-white/20'
                      }`}
                    />
                    <span className="text-sm font-medium">
                      {dep.full_name || 'Nuevo dependiente'}
                    </span>
                    {age !== null && (
                      <span className="text-xs text-white/50">{age} años</span>
                    )}
                    {dep.is_active && qualifies && (
                      <span className="text-xs text-emerald-300">✓ Califica</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDep(globalIdx)}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Eliminar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Nombres completos"
                    value={dep.full_name}
                    onChange={(e) => updateDep(globalIdx, { full_name: e.target.value })}
                  />
                  <Input
                    label="Fecha de nacimiento"
                    type="date"
                    value={dep.birth_date ?? ''}
                    onChange={(e) =>
                      updateDep(globalIdx, { birth_date: e.target.value || null })
                    }
                  />
                  <Input
                    label="Cédula (opcional)"
                    value={dep.identification ?? ''}
                    onChange={(e) =>
                      updateDep(globalIdx, {
                        identification: e.target.value.replace(/\D+/g, '').slice(0, 10) || null,
                      })
                    }
                    inputMode="numeric"
                  />
                  <div className="space-y-2">
                    <Toggle
                      on={dep.has_disability}
                      onToggle={() =>
                        updateDep(globalIdx, { has_disability: !dep.has_disability })
                      }
                      label="Tiene discapacidad (califica sin límite de edad)"
                    />
                    <Toggle
                      on={dep.is_active}
                      onToggle={() => updateDep(globalIdx, { is_active: !dep.is_active })}
                      label="Activo"
                    />
                  </div>
                </div>

                {!dep.has_disability && age !== null && age >= 18 && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    ⚠ Mayor de 18 años sin discapacidad — no califica como carga familiar
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </Card>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmployeeFormPage({ mode }: Props) {
  const nav = useNavigate()
  const { id } = useParams()
  const isEdit = mode === 'edit'

  const qc    = useQueryClient()
  const { user } = useAuth()
  const tctx  = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const [form, setForm]         = React.useState<EmployeeFormValues>(INITIAL_FORM)
  const [errors, setErrors]     = React.useState<Record<string, string>>({})
  const [vacOpen, setVacOpen]   = React.useState(false)
  const [photoFile, setPhotoFile]     = React.useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [photoCheck, setPhotoCheck]   = React.useState<{ ok: boolean; issues: string[] } | null>(null)
  const [showPass, setShowPass] = React.useState(false)
  const [dependents, setDependents] = React.useState<DependentRow[]>([])

  // ─── Queries ──────────────────────────────────────────────────────────────

  const deps = useQuery({
    queryKey: ['deps', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchDepartments(tenantId!),
  })

  const facialCfg = useQuery({
    queryKey: ['facialCfg', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchFacialConfig(tenantId!),
    retry: 0,
    staleTime: 300_000,
  })

  const bioDevices = useQuery({
    queryKey: ['bioDevices', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchBiometricDevices(tenantId!),
  })

  const schedules = useQuery({
    queryKey: ['schedules', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchSchedules(tenantId!),
  })

  const shifts = useQuery({
    queryKey: ['shifts', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchShifts(tenantId!),
  })

  const orgLevels = useQuery({
    queryKey: ['org-levels', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchOrgLevelDefinitions(tenantId!),
  })

  const orgUnits = useQuery({
    queryKey: ['org-units', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchOrgUnits(tenantId!),
  })

  const people = useQuery({
    queryKey: ['employee-lookup', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => fetchEmployeeLookup(tenantId!),
  })

  const emp = useQuery({
    queryKey: ['emp', tenantId, id],
    enabled:  !!tenantId && !!id && isEdit,
    queryFn:  () => fetchEmployee(tenantId!, id!),
  })

  const existingPhoto = useQuery({
    queryKey: ['emp-photo', (emp.data as any)?.facial_photo_url],
    enabled:  !!(emp.data as any)?.facial_photo_url,
    queryFn:  () => signedPhoto((emp.data as any)?.facial_photo_url),
    staleTime: 25 * 60 * 1000,
  })

  const accessInfo = useQuery({
    queryKey: ['employee-access', tenantId, id, (emp.data as any)?.user_id],
    enabled:  !!tenantId && !!id && isEdit,
    queryFn:  () => fetchEmployeeAccess(tenantId!, id!, (emp.data as any)?.user_id ?? null),
  })

  const pwaSettings = useQuery({
    queryKey: ['employee-pwa-settings', tenantId, id],
    enabled:  !!tenantId && !!id && isEdit,
    queryFn:  () => fetchEmployeePwaSelfServiceSettings(id!),
  })

  const profile = useQuery({
    queryKey: ['employee-profile', tenantId, id],
    enabled:  !!tenantId && !!id && isEdit,
    queryFn:  () => fetchEmployeeProfile(id!),
  })

  const orgAssignment = useQuery({
    queryKey: ['employee-org-assignment', tenantId, id],
    enabled:  !!tenantId && !!id && isEdit,
    queryFn:  () => fetchEmployeeOrgAssignment(tenantId!, id!),
  })

  const shiftAssignment = useQuery({
    queryKey: ['employee-shift-assignment', tenantId, id],
    enabled:  !!tenantId && !!id && isEdit,
    queryFn:  () => fetchEmployeeShiftAssignment(tenantId!, id!),
  })

  const dependentsQuery = useQuery({
    queryKey: ['employee-dependents', tenantId, id],
    enabled:  !!tenantId && !!id && isEdit,
    queryFn:  () => fetchDependents(tenantId!, id!),
  })

  // ─── Effects ──────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!photoFile) return
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  React.useEffect(() => {
    if (!emp.data) return
    const e: any = emp.data

    setForm((f) => ({
      ...f,
      employee_code:      e.employee_code ?? e.employee_number ?? e.biometric_employee_code ?? '',
      identification_type: (e.identification_type ?? 'CEDULA') as 'CEDULA' | 'PASAPORTE',
      identification:     e.identification ?? e.cedula ?? '',

      first_name:   e.first_name ?? '',
      last_name:    e.last_name ?? '',
      birth_date:   e.birth_date ?? null,
      gender:       e.gender ?? null,
      civil_status: e.civil_status ?? null,
      nationality:  e.nationality ?? null,
      birth_place:  e.birth_place ?? null,

      email:                   e.email ?? '',
      phone:                   e.phone ?? null,
      phone_home:              e.phone_home ?? null,
      emergency_contact_name:  e.emergency_contact_name ?? null,
      emergency_contact_phone: e.emergency_contact_phone ?? null,
      address:                 e.address ?? null,

      department_id: e.department_id ?? null,
      hire_date:     e.hire_date ?? null,
      salary:        e.salary != null ? Number(e.salary) : null,
      position:      e.position ?? null,
      contract_type: e.contract_type ?? null,
      labor_regime:  e.labor_regime ?? null,

      iess_number:     e.iess_number ?? null,
      iess_entry_date: e.iess_entry_date ?? null,
      ruc:             e.ruc ?? null,
      children_count:  e.children_count != null ? Number(e.children_count) : null,

      has_disability:          e.has_disability ?? false,
      disability_type:         e.disability_type ?? null,
      conadis_number:          e.conadis_number ?? null,
      disability_percentage:   e.disability_percentage != null ? Number(e.disability_percentage) : null,
      disability_card_issued:  e.disability_card_issued ?? null,
      disability_card_expires: e.disability_card_expires ?? null,
      disability_grade:        e.disability_grade ?? null,

      education_level:       e.education_level ?? null,
      degree_title:          e.degree_title ?? null,
      education_institution:    e.education_institution ?? null,
      dependents_registered_at: e.dependents_registered_at ?? null,

      employment_status: String(e.employment_status ?? 'ACTIVE').toUpperCase() as EmployeeFormValues['employment_status'],
      vacation_start:    e.vacation_start ?? null,
      vacation_end:      e.vacation_end ?? null,
      lunch_tracking:    e.lunch_tracking ?? true,
      facial_photo_url:  e.facial_photo_url ?? null,

      work_modality:
        profile.data?.work_mode?.toUpperCase?.() ??
        e.work_mode?.toUpperCase?.() ??
        e.work_modality?.toUpperCase?.() ??
        'PRESENCIAL',

      presential_days:        profile.data?.onsite_days ?? e.onsite_days ?? e.presential_days ?? [],
      presential_schedule_id: profile.data?.presential_schedule_id ?? e.presential_schedule_id ?? null,
      location_mode:          e.location_mode ?? 'INDISTINTO',
      entry_biometric_id:     profile.data?.entry_biometric_id ?? e.entry_biometric_id ?? null,
      exit_biometric_id:      profile.data?.exit_biometric_id  ?? e.exit_biometric_id  ?? null,
      is_department_head:     e.is_department_head ?? false,

      pwa_self_service_enabled:      pwaSettings.data?.pwa_self_service_enabled ?? false,
      geofence_radius_m:             pwaSettings.data?.geofence_radius_m != null ? Number(pwaSettings.data.geofence_radius_m) : null,
      reset_pwa_self_service_lock:   false,
      pwa_self_service_locked:       pwaSettings.data?.pwa_self_service_locked ?? false,
      pwa_self_service_completed_at: pwaSettings.data?.pwa_self_service_completed_at ?? null,
      geofence_lat:                  pwaSettings.data?.geofence_lat != null ? Number(pwaSettings.data.geofence_lat) : null,
      geofence_lng:                  pwaSettings.data?.geofence_lng != null ? Number(pwaSettings.data.geofence_lng) : null,

      password:         '',
      password_confirm: '',
    }))
  }, [emp.data, pwaSettings.data, profile.data])

  React.useEffect(() => {
    if (!orgAssignment.data) return
    setForm((f) => ({
      ...f,
      org_unit_id:            orgAssignment.data?.org_unit_id ?? null,
      supervisor_employee_id: orgAssignment.data?.supervisor_employee_id ?? null,
      is_org_unit_leader:     orgAssignment.data?.is_unit_leader ?? false,
      lead_org_unit_id:       orgAssignment.data?.lead_org_unit_id ?? null,
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

  React.useEffect(() => {
    if (!dependentsQuery.data) return
    setDependents(dependentsQuery.data)
  }, [dependentsQuery.data])

  const setField = <K extends keyof EmployeeFormValues>(k: K, v: EmployeeFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  React.useEffect(() => {
    if (!form.presential_schedule_id) return
    const sel = (schedules.data ?? []).find((row) => row.id === form.presential_schedule_id)
    if (!sel) return
    if (form.work_shift_id && sel.turn_id !== form.work_shift_id) setField('presential_schedule_id', null)
  }, [form.work_shift_id, form.presential_schedule_id, schedules.data])

  const toggleDay = (day: string) => {
    const current = form.presential_days ?? []
    setField('presential_days', current.includes(day) ? current.filter((d: string) => d !== day) : [...current, day])
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

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

      const requiresSystemAccess = form.work_modality !== 'PRESENCIAL' || form.access_role !== 'employee'
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
      } else if (isEdit && requiresSystemAccess && (form.password || form.password_confirm)) {
        if (form.password && form.password.length < 8) {
          setErrors((p) => ({ ...p, password: 'La contraseña debe tener mínimo 8 caracteres' }))
          throw new Error('VALIDATION')
        }
        if (form.password && form.password !== form.password_confirm) {
          setErrors((p) => ({ ...p, password_confirm: 'Las contraseñas no coinciden' }))
          throw new Error('VALIDATION')
        }
        if (form.password) tempPassword = form.password
      }

      const employeeId = isEdit ? String(id) : crypto.randomUUID()

      if (form.access_role === 'tenant_admin') {
        await ensureUniqueTenantAdmin(
          tenantId,
          employeeId,
          accessInfo.data?.user_id ?? (emp.data as any)?.user_id ?? null
        )
      }

      let facial_photo_url = form.facial_photo_url
      if (photoFile) {
        const cfg     = facialCfg.data ?? FACIAL_CONFIG_DEFAULTS
        const metrics = await computeImageMetrics(photoFile)
        const validation = validateMetrics(metrics, cfg)
        setPhotoCheck(validation)
        if (!validation.ok) throw new Error('FOTO_NO_CUMPLE_CONFIG')

        const ext    = (photoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
        const path   = `${tenantId}/${employeeId}/${Date.now()}.${safeExt}`
        const uploadRes = await supabase.storage.from(PHOTO_BUCKET).upload(path, photoFile, { upsert: true })
        if (uploadRes.error) throw uploadRes.error
        facial_photo_url = path
      }

      const normalizedEmploymentStatus = String(form.employment_status || 'ACTIVE').toLowerCase()

      const { error } = await supabase.schema(ATT_SCHEMA).rpc('upsert_employee_full', {
        p_tenant_id:         tenantId,
        p_employee_id:       employeeId,
        p_employee_code:     form.employee_code,
        p_first_name:        form.first_name,
        p_last_name:         form.last_name,
        p_email:             form.email,
        p_phone:             form.phone ?? null,
        p_address:           form.address ?? null,
        p_identification:    form.identification,
        p_department_id:     form.department_id,
        p_hire_date:         form.hire_date,
        p_salary:            form.salary,
        p_employment_status: normalizedEmploymentStatus,
        p_facial_photo_url:  facial_photo_url,
        p_vacation_start:    form.vacation_start,
        p_vacation_end:      form.vacation_end,
        p_lunch_tracking:    form.lunch_tracking,
        p_work_modality:     form.work_modality,
        p_presential_days:   form.presential_days ?? [],
        p_location_mode:     form.location_mode,
        p_entry_biometric_id: form.entry_biometric_id ?? null,
        p_exit_biometric_id:  form.exit_biometric_id  ?? null,
        p_is_department_head: form.is_department_head ?? false,
      })
      if (error) throw error

      // Save extended fields — graceful: swallow if migration not yet applied
      await supabase.schema('public').from('employees').update({
        identification_type:      form.identification_type,
        birth_date:               form.birth_date   || null,
        gender:                   form.gender        || null,
        civil_status:             form.civil_status  || null,
        nationality:              form.nationality   || null,
        birth_place:              form.birth_place   || null,
        phone_home:               form.phone_home    || null,
        emergency_contact_name:   form.emergency_contact_name  || null,
        emergency_contact_phone:  form.emergency_contact_phone || null,
        position:                 form.position      || null,
        contract_type:            form.contract_type || null,
        labor_regime:             form.labor_regime  || null,
        iess_number:              form.iess_number   || null,
        iess_entry_date:          form.iess_entry_date || null,
        ruc:                      form.ruc           || null,
        children_count:           form.children_count ?? null,
        has_disability:           form.has_disability ?? false,
        disability_type:          form.disability_type     || null,
        conadis_number:           form.conadis_number      || null,
        disability_percentage:    form.disability_percentage ?? null,
        disability_card_issued:   form.disability_card_issued  || null,
        disability_card_expires:  form.disability_card_expires || null,
        disability_grade:         form.disability_grade   || null,
        education_level:            form.education_level    || null,
        degree_title:               form.degree_title       || null,
        education_institution:      form.education_institution || null,
        dependents_registered_at:   form.dependents_registered_at || null,
      }).eq('id', employeeId).eq('tenant_id', tenantId)

      await saveDependents(tenantId, employeeId, dependents)

      const { error: pwaSyncError } = await supabase.schema(ATT_SCHEMA).rpc('upsert_employee_pwa_self_service_settings', {
        p_employee_id:              employeeId,
        p_pwa_self_service_enabled: form.pwa_self_service_enabled ?? false,
        p_geofence_radius_m:        form.geofence_radius_m ?? null,
        p_reset_lock:               form.reset_pwa_self_service_lock ?? false,
      })
      if (pwaSyncError) throw pwaSyncError

      const shouldSyncAccess =
        (form.work_modality !== 'PRESENCIAL' || form.access_role !== 'employee') ||
        !!accessInfo.data?.has_access

      if (shouldSyncAccess) {
        await provisionEmployeeUser({
          tenant_id:     tenantId,
          employee_id:   employeeId,
          email:         form.email,
          temp_password: tempPassword,
          role:          form.access_role,
        })
      }

      const warnings: string[] = []

      try {
        await saveEmployeeOrgAssignment(tenantId, {
          employee_id:            employeeId,
          org_unit_id:            form.org_unit_id ?? null,
          supervisor_employee_id: form.supervisor_employee_id ?? null,
          is_unit_leader:         form.is_org_unit_leader ?? false,
          lead_org_unit_id:       form.is_org_unit_leader
            ? form.lead_org_unit_id ?? form.org_unit_id ?? null
            : null,
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
          shift_id:    form.work_shift_id ?? null,
        })
      } catch (shiftError: any) {
        if (isMissingOrgSchemaError(shiftError)) {
          warnings.push('No se guardó turno efectivo porque falta la tabla employee_shift_assignments.')
        } else {
          throw shiftError
        }
      }

      return { id: employeeId, warnings }
    },
    onSuccess: (result) => {
      toast.success(isEdit ? 'Colaborador actualizado' : 'Colaborador creado')
      result.warnings.forEach((warning) => toast(warning, { icon: '⚠️' }))

      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['emp'] })
      qc.invalidateQueries({ queryKey: ['employee'] })
      qc.invalidateQueries({ queryKey: ['employee-org-assignment'] })
      qc.invalidateQueries({ queryKey: ['employee-shift-assignment'] })
      qc.invalidateQueries({ queryKey: ['employee-pwa-settings'] })
      qc.invalidateQueries({ queryKey: ['employee-profile'] })
      qc.invalidateQueries({ queryKey: ['employee-dependents'] })

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
      toast.error(e?.message || 'No se pudo guardar')
    },
  })

  // ─── Derived values ───────────────────────────────────────────────────────

  const bioOptions = (bioDevices.data ?? []).map((d) => ({
    value: d.id,
    label: biometricSelectLabel(d as BiometricOptionRow),
  }))

  const filteredSchedules = React.useMemo(() => {
    const rows = schedules.data ?? []
    if (!form.work_shift_id) return rows
    return rows.filter((row) => row.turn_id === form.work_shift_id)
  }, [schedules.data, form.work_shift_id])

  const scheduleOptions  = filteredSchedules.map((s) => ({ value: s.id, label: s.name }))
  const shiftOptions     = (shifts.data ?? []).map((shift) => ({
    value: shift.id,
    label: shift.code ? `${shift.name} (${shift.code})` : shift.name,
  }))
  const orgUnitOptions   = (orgUnits.data ?? [])
    .filter((unit) => unit.is_active !== false)
    .map((unit) => ({ value: unit.id, label: buildOrgPath(orgUnits.data ?? [], unit.id) }))
  const peopleOptions    = (people.data ?? []).map((person) => ({
    value: person.id,
    label: person.employee_code ? `${person.full_name} (${person.employee_code})` : person.full_name,
  }))

  const showLocationFields   = form.work_modality === 'PRESENCIAL' || form.work_modality === 'MIXTO'
  const requiresSystemAccess = form.work_modality !== 'PRESENCIAL' || form.access_role !== 'employee'
  const showPwaSection       = form.work_modality !== 'PRESENCIAL'

  const orgSchemaMissing =
    isMissingOrgSchemaError(orgLevels.error) ||
    isMissingOrgSchemaError(orgUnits.error)  ||
    isMissingOrgSchemaError(orgAssignment.error)

  const orgSummary = form.org_unit_id
    ? buildOrgPath(orgUnits.data ?? [], form.org_unit_id)
    : 'Sin unidad organizacional asignada'

  const leadLevelLabel = React.useMemo(() => {
    const unit  = (orgUnits.data ?? []).find((row) => row.id === (form.lead_org_unit_id ?? form.org_unit_id))
    const level = (orgLevels.data ?? []).find((row) => row.level_no === unit?.level_no)
    return level?.display_name ?? null
  }, [form.lead_org_unit_id, form.org_unit_id, orgUnits.data, orgLevels.data])

  const selectedRoleMeta = ACCESS_ROLE_OPTIONS.find((opt) => opt.value === form.access_role)

  if (isEdit && emp.isLoading) {
    return <div className="text-white/70 p-6">Cargando datos del colaborador…</div>
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            className="mb-2 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
            onClick={() => nav(isEdit ? `/employees/${id}` : '/employees')}
          >
            <ChevronLeft size={16} /> {isEdit ? 'Volver al perfil' : 'Volver'}
          </button>
          <h1 className="text-xl font-bold">
            {isEdit
              ? `Editar: ${emp.data ? `${(emp.data as any).first_name} ${(emp.data as any).last_name}` : '…'}`
              : 'Nuevo colaborador'}
          </h1>
        </div>
        <Button
          leftIcon={save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      {/* Estado del colaborador */}
      <Card title="Estado del colaborador">
        <div className="flex flex-wrap gap-2">
          {(['ACTIVE', 'VACATION', 'SUSPENDED', 'TERMINATED'] as const).map((status) => (
            <button
              key={status}
              className={pill(form.employment_status === status)}
              onClick={() => {
                setField('employment_status', status)
                if (status === 'VACATION') setVacOpen(true)
              }}
            >
              {{ ACTIVE: 'Activo', VACATION: 'Vacaciones', SUSPENDED: 'Suspendido', TERMINATED: 'Cesante' }[status]}
            </button>
          ))}
        </div>
      </Card>

      {/* Datos personales + Fotografía */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Datos personales" className="xl:col-span-2" actions={<UserCheck size={18} className="text-white/60" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Código"
              value={form.employee_code}
              onChange={(e) => setField('employee_code', e.target.value)}
              error={errors.employee_code}
            />

            {/* Tipo de identificación */}
            <Select
              label="Tipo de identificación"
              value={form.identification_type}
              onChange={(v) => {
                setField('identification_type', (v || 'CEDULA') as 'CEDULA' | 'PASAPORTE')
                setField('identification', '')
              }}
              options={IDENTIFICATION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />

            {/* Número de identificación */}
            <Input
              label={form.identification_type === 'CEDULA' ? 'Número de cédula' : 'Número de pasaporte'}
              value={form.identification}
              onChange={(e) => {
                const raw = e.target.value
                if (form.identification_type === 'CEDULA') {
                  setField('identification', raw.replace(/\D+/g, '').slice(0, 10))
                } else {
                  setField('identification', raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20))
                }
              }}
              error={errors.identification}
              inputMode={form.identification_type === 'CEDULA' ? 'numeric' : 'text'}
              placeholder={form.identification_type === 'CEDULA' ? '10 dígitos' : '5–20 caracteres alfanuméricos'}
            />

            <Input
              label="Nombres"
              value={form.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              error={errors.first_name}
            />
            <Input
              label="Apellidos"
              value={form.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              error={errors.last_name}
            />
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={form.birth_date ?? ''}
              onChange={(e) => setField('birth_date', e.target.value || null)}
            />
            <Select
              label="Género"
              value={form.gender ?? ''}
              onChange={(v) => setField('gender', (v || null) as EmployeeFormValues['gender'])}
              options={GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="Seleccione…"
            />
            <Select
              label="Estado civil"
              value={form.civil_status ?? ''}
              onChange={(v) => setField('civil_status', (v || null) as EmployeeFormValues['civil_status'])}
              options={CIVIL_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="Seleccione…"
            />
            <Input
              label="Nacionalidad"
              value={form.nationality ?? ''}
              onChange={(e) => setField('nationality', e.target.value || null)}
            />
            <Input
              label="Lugar de nacimiento"
              value={form.birth_place ?? ''}
              onChange={(e) => setField('birth_place', e.target.value || null)}
            />
          </div>
        </Card>

        {/* Fotografía */}
        <Card title="Fotografía" subtitle="Reconocimiento facial" actions={<Camera size={18} className="text-white/60" />}>
          <div className="space-y-3">
            {!photoPreview && existingPhoto.data && (
              <img src={existingPhoto.data} alt="Foto actual"
                className="w-full rounded-2xl border border-white/10 object-cover max-h-56" />
            )}
            {!photoPreview && form.facial_photo_url && !existingPhoto.data && (
              <div className="text-xs text-white/50 italic">Foto guardada. Cargando vista previa…</div>
            )}
            {photoPreview && (
              <img src={photoPreview} alt="Vista previa nueva foto"
                className="w-full rounded-2xl border border-white/10 object-cover max-h-56" />
            )}
            <input type="file" accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="text-sm text-white/70" />
            {errors.facial_photo_url && (
              <div className="text-xs text-rose-200">{errors.facial_photo_url}</div>
            )}
            {photoCheck && !photoCheck.ok && (
              <div className="text-xs text-rose-200">La foto no cumple: {photoCheck.issues.join(', ')}</div>
            )}
            {photoCheck?.ok && (
              <div className="text-xs text-emerald-300">✓ Fotografía válida</div>
            )}
          </div>
        </Card>
      </div>

      {/* Información de contacto */}
      <Card title="Información de contacto" actions={<Phone size={18} className="text-white/60" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
          />
          <Input
            label="Teléfono celular"
            value={form.phone ?? ''}
            onChange={(e) => setField('phone', e.target.value || null)}
            error={errors.phone}
          />
          <Input
            label="Teléfono convencional"
            value={form.phone_home ?? ''}
            onChange={(e) => setField('phone_home', e.target.value || null)}
          />
          <div className="md:col-span-2">
            <Input
              label="Dirección domiciliaria"
              value={form.address ?? ''}
              onChange={(e) => setField('address', e.target.value || null)}
              error={errors.address}
            />
          </div>
          <Input
            label="Contacto de emergencia — nombre"
            value={form.emergency_contact_name ?? ''}
            onChange={(e) => setField('emergency_contact_name', e.target.value || null)}
          />
          <Input
            label="Contacto de emergencia — teléfono"
            value={form.emergency_contact_phone ?? ''}
            onChange={(e) => setField('emergency_contact_phone', e.target.value || null)}
          />
        </div>
      </Card>

      {/* Información laboral */}
      <Card title="Información laboral" actions={<Briefcase size={18} className="text-white/60" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Cargo / Puesto"
            value={form.position ?? ''}
            onChange={(e) => setField('position', e.target.value || null)}
          />
          <Select
            label="Departamento"
            value={form.department_id ?? ''}
            onChange={(v) => setField('department_id', v || null)}
            options={(deps.data ?? []).map((d: any) => ({ value: d.id, label: d.name }))}
            placeholder="Seleccione departamento…"
            error={errors.department_id}
          />
          <Input
            label="Fecha de contratación"
            type="date"
            value={form.hire_date ?? ''}
            onChange={(e) => setField('hire_date', e.target.value || null)}
          />
          <Input
            label="Sueldo base"
            type="number"
            value={form.salary ?? ''}
            onChange={(e) => setField('salary', e.target.value ? Number(e.target.value) : null)}
          />
          <Select
            label="Tipo de contrato"
            value={form.contract_type ?? ''}
            onChange={(v) => setField('contract_type', (v || null) as EmployeeFormValues['contract_type'])}
            options={CONTRACT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="Seleccione…"
          />
          <Select
            label="Régimen laboral"
            value={form.labor_regime ?? ''}
            onChange={(v) => setField('labor_regime', (v || null) as EmployeeFormValues['labor_regime'])}
            options={LABOR_REGIME_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="Seleccione…"
          />
        </div>
      </Card>

      {/* IESS y tributaria */}
      <Card title="IESS y tributaria">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Número IESS / afiliación"
            value={form.iess_number ?? ''}
            onChange={(e) => setField('iess_number', e.target.value.replace(/\D+/g, '').slice(0, 9) || null)}
            inputMode="numeric"
            placeholder="9 dígitos"
          />
          <Input
            label="Fecha de ingreso IESS"
            type="date"
            value={form.iess_entry_date ?? ''}
            onChange={(e) => setField('iess_entry_date', e.target.value || null)}
          />
          <Input
            label="RUC / SRI (si aplica)"
            value={form.ruc ?? ''}
            onChange={(e) => setField('ruc', e.target.value.replace(/\D+/g, '').slice(0, 13) || null)}
            inputMode="numeric"
          />
          <Input
            label="Cargas familiares (número de hijos)"
            type="number"
            value={form.children_count ?? ''}
            onChange={(e) => setField('children_count', e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
          />
        </div>
      </Card>

      {/* Discapacidad */}
      <Card title="Discapacidad" actions={<Heart size={18} className="text-white/60" />}>
        <div className="space-y-4">
          <Toggle
            on={form.has_disability}
            onToggle={() => setField('has_disability', !form.has_disability)}
            label="¿Tiene discapacidad?"
          />

          {form.has_disability && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <Select
                label="Tipo de discapacidad"
                value={form.disability_type ?? ''}
                onChange={(v) => setField('disability_type', (v || null) as EmployeeFormValues['disability_type'])}
                options={DISABILITY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                placeholder="Seleccione…"
              />
              <Select
                label="Grado"
                value={form.disability_grade ?? ''}
                onChange={(v) => setField('disability_grade', (v || null) as EmployeeFormValues['disability_grade'])}
                options={DISABILITY_GRADE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                placeholder="Seleccione…"
              />
              <Input
                label="Número de carnet CONADIS"
                value={form.conadis_number ?? ''}
                onChange={(e) => setField('conadis_number', e.target.value || null)}
              />
              <div>
                <Input
                  label="Porcentaje de discapacidad"
                  type="number"
                  value={form.disability_percentage ?? ''}
                  onChange={(e) => {
                    const n = e.target.value ? Math.min(100, Math.max(1, Number(e.target.value))) : null
                    setField('disability_percentage', n)
                  }}
                  placeholder="1 – 100"
                />
                <p className="text-xs text-white/50 mt-1">%</p>
              </div>
              <Input
                label="Fecha de emisión del carnet"
                type="date"
                value={form.disability_card_issued ?? ''}
                onChange={(e) => setField('disability_card_issued', e.target.value || null)}
              />
              <Input
                label="Fecha de caducidad del carnet"
                type="date"
                value={form.disability_card_expires ?? ''}
                onChange={(e) => setField('disability_card_expires', e.target.value || null)}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Información académica */}
      <Card title="Información académica" actions={<GraduationCap size={18} className="text-white/60" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Nivel de instrucción"
            value={form.education_level ?? ''}
            onChange={(v) => setField('education_level', (v || null) as EmployeeFormValues['education_level'])}
            options={EDUCATION_LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="Seleccione…"
          />
          <Input
            label="Título obtenido"
            value={form.degree_title ?? ''}
            onChange={(e) => setField('degree_title', e.target.value || null)}
          />
          <div className="md:col-span-2">
            <Input
              label="Institución educativa"
              value={form.education_institution ?? ''}
              onChange={(e) => setField('education_institution', e.target.value || null)}
            />
          </div>
        </div>
      </Card>

      {/* Rol de acceso */}
      <Card
        title="Rol de acceso en Base"
        subtitle="Diferencia la jefatura organizacional del rol de acceso al sistema"
        actions={<ShieldCheck size={18} className="text-white/60" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Rol del sistema"
            value={form.access_role}
            onChange={(v) => setField('access_role', (v || 'employee') as EmployeeFormValues['access_role'])}
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

      {/* Credenciales */}
      {requiresSystemAccess ? (
        <Card
          title="Credenciales de acceso"
          subtitle={!isEdit ? 'Contraseña temporal para el primer ingreso al sistema' : 'Opcional: ingresa nueva contraseña solo si deseas cambiarla'}
          actions={<KeyRound size={18} className="text-white/60" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-white/60">
                Contraseña temporal{!isEdit && <span className="text-rose-400 ml-1">*</span>}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password ?? ''}
                  onChange={(e) => setField('password', e.target.value)}
                  placeholder={isEdit ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                  className="w-full px-3 py-2 pr-10 rounded-xl text-sm outline-none border border-white/15 bg-white/5 text-white placeholder:text-white/30 focus:border-blue-500"
                />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-2.5 text-white/40 hover:text-white/70">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-rose-300 mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-white/60">
                Confirmar contraseña{!isEdit && <span className="text-rose-400 ml-1">*</span>}
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password_confirm ?? ''}
                onChange={(e) => setField('password_confirm', e.target.value)}
                placeholder={isEdit ? 'Dejar vacío para no cambiar' : 'Repetir contraseña'}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border border-white/15 bg-white/5 text-white placeholder:text-white/30 focus:border-blue-500"
              />
              {errors.password_confirm && (
                <p className="text-xs text-rose-300 mt-1">{errors.password_confirm}</p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Acceso al sistema" subtitle="No requiere credenciales en este momento" actions={<KeyRound size={18} className="text-white/60" />}>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Este colaborador es presencial y no tiene rol administrativo. Por eso no se provisionan credenciales PWA ni acceso Base en la creación.
          </div>
        </Card>
      )}

      {/* Modalidad de trabajo */}
      <Card title="Modalidad de trabajo" subtitle="Define cómo y desde dónde trabaja el colaborador" actions={<MapPin size={18} className="text-white/60" />}>
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-white/60 mb-2">Modalidad</label>
            <div className="flex flex-wrap gap-2">
              {WORK_MODALITY_OPTIONS.map((opt) => (
                <button key={opt.value} className={pill(form.work_modality === opt.value)}
                  onClick={() => setField('work_modality', opt.value)}>
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
                  <button key={d.value} className={pill((form.presential_days ?? []).includes(d.value))}
                    onClick={() => toggleDay(d.value)}>
                    {d.label}
                  </button>
                ))}
              </div>
              {errors.presential_days && (
                <p className="text-xs text-rose-300">{errors.presential_days}</p>
              )}
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
                  <button key={opt.value} className={pill(form.location_mode === opt.value)}
                    onClick={() => setField('location_mode', opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.location_mode === 'UBICACION' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <Select
                    label="Biométrico de entrada"
                    value={form.entry_biometric_id ?? ''}
                    onChange={(v) => setField('entry_biometric_id', v || null)}
                    options={bioOptions}
                    placeholder="Seleccione ubicación…"
                    error={errors.entry_biometric_id}
                  />
                  <Select
                    label="Biométrico de salida"
                    value={form.exit_biometric_id ?? ''}
                    onChange={(v) => setField('exit_biometric_id', v || null)}
                    options={bioOptions}
                    placeholder="Seleccione ubicación…"
                    error={errors.exit_biometric_id}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Autogestión PWA */}
      {showPwaSection && (
        <Card
          title="Autogestión PWA y umbral GPS"
          subtitle="Visible para colaboradores remotos o mixtos; define el radio válido de captura GPS en PWA"
          actions={<Smartphone size={18} className="text-white/60" />}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-white/60 mb-2">Autogestión PWA</label>
              <div className="flex flex-wrap gap-2">
                <button className={pill(form.pwa_self_service_enabled === true)}
                  onClick={() => setField('pwa_self_service_enabled', true)}>Habilitada</button>
                <button className={pill(form.pwa_self_service_enabled === false)}
                  onClick={() => setField('pwa_self_service_enabled', false)}>Deshabilitada</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Umbral GPS válido (m a la redonda)"
                type="number"
                value={form.geofence_radius_m ?? ''}
                onChange={(e) => setField('geofence_radius_m', e.target.value ? Number(e.target.value) : null)}
                error={errors.geofence_radius_m}
                placeholder="Ej: 100 metros"
              />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="text-white/60">Estado actual</div>
                <div className="mt-2 font-semibold flex items-center gap-2">
                  {form.pwa_self_service_locked ? (
                    <CheckCircle2 size={14} className="text-emerald-300" />
                  ) : (
                    <Clock3 size={14} className="text-amber-200" />
                  )}
                  {form.pwa_self_service_locked ? 'Bloqueado' : 'Editable / pendiente'}
                </div>
                {form.pwa_self_service_completed_at && (
                  <div className="mt-1 text-xs text-white/50">
                    Completado: {new Date(form.pwa_self_service_completed_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
              <Toggle
                on={form.reset_pwa_self_service_lock}
                onToggle={() => setField('reset_pwa_self_service_lock', !form.reset_pwa_self_service_lock)}
                label="Resetear bloqueo de autogestión PWA al guardar"
              />
              <div className="text-xs text-white/50">
                Si activas esta opción, el sistema dejará nuevamente editable la autogestión en PWA para el colaborador.
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-white/60 mb-1">GPS registrado por el colaborador</div>
              <div className="font-semibold flex items-center gap-2">
                <LocateFixed size={14} className="text-cyan-300" />
                {form.geofence_lat != null && form.geofence_lng != null
                  ? `${Number(form.geofence_lat).toFixed(6)}, ${Number(form.geofence_lng).toFixed(6)}`
                  : 'Aún no registrado en PWA'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Organización / turno / horario */}
      <Card
        title="Departamento / jefatura inmediata y asignación laboral"
        subtitle="Asigna el área, sección o departamento donde pertenece el colaborador, su jefatura inmediata, turno y horario"
        actions={<Workflow size={18} className="text-white/60" />}
      >
        <div className="space-y-5">
          {orgSchemaMissing && note(ORG_MIGRATION_HINT)}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Departamento / área / sección donde pertenece *"
              value={form.org_unit_id ?? ''}
              onChange={(v) => setField('org_unit_id', v || null)}
              options={orgUnitOptions}
              placeholder="Seleccione el departamento, área o sección…"
              error={errors.org_unit_id}
            />
            <Select
              label="Turno efectivo"
              value={form.work_shift_id ?? ''}
              onChange={(v) => {
                setField('work_shift_id', v || null)
                if (!v) setField('presential_schedule_id', null)
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
                  setField('presential_schedule_id', nextId)
                  const sel = (schedules.data ?? []).find((row) => row.id === nextId)
                  if (sel?.turn_id && sel.turn_id !== form.work_shift_id) {
                    setField('work_shift_id', sel.turn_id)
                  }
                }}
                options={scheduleOptions}
                placeholder={form.work_shift_id ? 'Seleccione horario…' : 'Seleccione primero un turno…'}
                error={errors.presential_schedule_id}
              />
              <p className="text-xs text-white/50">
                Los horarios se filtran según el turno seleccionado y se usan en asistencia, dashboards y reportes.
              </p>
            </div>
            <Select
              label="Jefatura inmediata / supervisor inmediato"
              value={form.supervisor_employee_id ?? ''}
              onChange={(v) => setField('supervisor_employee_id', v || null)}
              options={peopleOptions.filter((person) => person.value !== id)}
              placeholder="Seleccione la jefatura inmediata o deje resolución automática"
              error={errors.supervisor_employee_id}
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
              <div className="text-xs text-white/60">Ruta completa del organigrama</div>
              <div className="mt-2 font-semibold">{orgSummary}</div>
              <div className="mt-2 text-xs text-white/50">
                Aquí defines el departamento, área o sección exacta donde pertenece el colaborador y quién es su jefatura inmediata.
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <Toggle
              on={form.is_org_unit_leader}
              onToggle={() => setField('is_org_unit_leader', !form.is_org_unit_leader)}
              label="Es jefe del departamento / área / sección a la que pertenece"
            />
            {form.is_org_unit_leader && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Departamento / área / sección que lidera"
                  value={form.lead_org_unit_id ?? form.org_unit_id ?? ''}
                  onChange={(v) => setField('lead_org_unit_id', v || null)}
                  options={orgUnitOptions}
                  placeholder="Seleccione unidad…"
                  error={errors.lead_org_unit_id}
                />
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="text-white/60">Nivel de jefatura</div>
                  <div className="mt-2 font-semibold">
                    {leadLevelLabel ?? 'Se determinará por la unidad seleccionada'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <Toggle
              on={form.is_department_head}
              onToggle={() => setField('is_department_head', !form.is_department_head)}
              label={<><Building2 size={14} className="inline mr-1 text-white/60" />Jefe de departamento (legacy)</>}
            />
          </div>
        </div>
      </Card>

      {/* Cargas familiares */}
      <CargasFamiliaresSection
        dependents={dependents}
        setDependents={setDependents}
        registeredAt={form.dependents_registered_at ?? null}
        onChangeRegisteredAt={(v: string | null) => setField('dependents_registered_at', v)}
      />

      {/* Sticky save button */}
      <div className="sticky bottom-4 flex justify-end z-10">
        <Button
          leftIcon={save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="shadow-2xl shadow-purple-900/40"
        >
          {save.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      {/* Vacation modal */}
      <Modal open={vacOpen} onClose={() => setVacOpen(false)} title="Período de vacaciones">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Inicio" type="date" value={form.vacation_start ?? ''}
            onChange={(e) => setField('vacation_start', e.target.value || null)} />
          <Input label="Fin" type="date" value={form.vacation_end ?? ''}
            onChange={(e) => setField('vacation_end', e.target.value || null)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setVacOpen(false)}>Cerrar</Button>
          <Button onClick={() => setVacOpen(false)}>Aplicar</Button>
        </div>
      </Modal>
    </div>
  )
}
