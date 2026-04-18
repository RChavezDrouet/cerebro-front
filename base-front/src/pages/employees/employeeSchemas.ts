/**
 * employeeSchemas.ts — Base HRCloud
 * Ficha completa del colaborador (estándar Ecuador).
 */
import { z } from 'zod'

export const WORK_MODALITY_OPTIONS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'REMOTO',     label: 'Remoto' },
  { value: 'MIXTO',      label: 'Mixto' },
] as const

export const LOCATION_MODE_OPTIONS = [
  { value: 'INDISTINTO', label: 'Indistinto' },
  { value: 'UBICACION',  label: 'Ubicación fija' },
] as const

export type WorkModality  = typeof WORK_MODALITY_OPTIONS[number]['value']
export type LocationMode  = typeof LOCATION_MODE_OPTIONS[number]['value']

export const ACCESS_ROLE_OPTIONS = [
  { value: 'employee',     label: 'Colaborador' },
  { value: 'assistant',    label: 'Asistente' },
  { value: 'auditor',      label: 'Auditor' },
  { value: 'tenant_admin', label: 'Administrador HRCloud' },
] as const

export type AccessRole = typeof ACCESS_ROLE_OPTIONS[number]['value']

// ─── Options lists ───────────────────────────────────────────────────────────

export const IDENTIFICATION_TYPE_OPTIONS = [
  { value: 'CEDULA',     label: 'Cédula' },
  { value: 'PASAPORTE',  label: 'Pasaporte' },
] as const

export const GENDER_OPTIONS = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMENINO',  label: 'Femenino' },
  { value: 'OTRO',      label: 'Otro' },
] as const

export const CIVIL_STATUS_OPTIONS = [
  { value: 'SOLTERO',     label: 'Soltero/a' },
  { value: 'CASADO',      label: 'Casado/a' },
  { value: 'UNION_LIBRE', label: 'Unión libre' },
  { value: 'DIVORCIADO',  label: 'Divorciado/a' },
  { value: 'VIUDO',       label: 'Viudo/a' },
] as const

export const CONTRACT_TYPE_OPTIONS = [
  { value: 'INDEFINIDO',  label: 'Indefinido' },
  { value: 'PLAZO_FIJO',  label: 'Plazo fijo' },
  { value: 'OBRA',        label: 'Por obra' },
  { value: 'PRUEBA',      label: 'A prueba' },
  { value: 'PART_TIME',   label: 'Part-time' },
  { value: 'HONORARIOS',  label: 'Honorarios' },
] as const

export const LABOR_REGIME_OPTIONS = [
  { value: 'CODIGO_TRABAJO', label: 'Código de Trabajo' },
  { value: 'LOSEP',          label: 'LOSEP' },
  { value: 'EPE',            label: 'EPE' },
] as const

export const DISABILITY_TYPE_OPTIONS = [
  { value: 'FISICA',       label: 'Física' },
  { value: 'INTELECTUAL',  label: 'Intelectual' },
  { value: 'VISUAL',       label: 'Visual' },
  { value: 'AUDITIVA',     label: 'Auditiva' },
  { value: 'MENTAL',       label: 'Mental' },
  { value: 'MULTIPLE',     label: 'Múltiple' },
] as const

export const DISABILITY_GRADE_OPTIONS = [
  { value: 'LEVE',      label: 'Leve' },
  { value: 'MODERADO',  label: 'Moderado' },
  { value: 'GRAVE',     label: 'Grave' },
  { value: 'MUY_GRAVE', label: 'Muy grave' },
] as const

export const EDUCATION_LEVEL_OPTIONS = [
  { value: 'PRIMARIA',    label: 'Primaria' },
  { value: 'SECUNDARIA',  label: 'Secundaria' },
  { value: 'TECNICO',     label: 'Técnico' },
  { value: 'SUPERIOR',    label: 'Superior' },
  { value: 'POSGRADO',    label: 'Posgrado' },
] as const

// ─── Main schema ─────────────────────────────────────────────────────────────

export const employeeFormSchema = z.object({
  // Identification
  employee_code:      z.string().min(1, 'Código requerido').max(50),
  identification_type: z.enum(['CEDULA', 'PASAPORTE']).default('CEDULA'),
  identification:     z.string().min(5, 'Número de identificación requerido').max(20),

  // Datos personales
  first_name:    z.string().min(2, 'Nombre requerido').max(100),
  last_name:     z.string().min(2, 'Apellido requerido').max(100),
  birth_date:    z.string().nullable().optional(),
  gender:        z.enum(['MASCULINO', 'FEMENINO', 'OTRO']).nullable().optional(),
  civil_status:  z.enum(['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO']).nullable().optional(),
  nationality:   z.string().max(100).nullable().optional(),
  birth_place:   z.string().max(200).nullable().optional(),

  // Contacto
  email:                    z.string().email('Correo inválido'),
  phone:                    z.string().max(30).nullable().optional(),
  phone_home:               z.string().max(30).nullable().optional(),
  emergency_contact_name:   z.string().max(200).nullable().optional(),
  emergency_contact_phone:  z.string().max(30).nullable().optional(),
  address:                  z.string().max(300).nullable().optional(),

  // Información laboral
  department_id:  z.string().uuid().nullable().optional(),
  hire_date:      z.string().nullable().optional(),
  salary:         z.number().nonnegative().nullable().optional(),
  position:       z.string().max(200).nullable().optional(),
  contract_type:  z.enum(['INDEFINIDO', 'PLAZO_FIJO', 'OBRA', 'PRUEBA', 'PART_TIME', 'HONORARIOS']).nullable().optional(),
  labor_regime:   z.enum(['CODIGO_TRABAJO', 'LOSEP', 'EPE']).nullable().optional(),

  // IESS y tributaria
  iess_number:    z.string().max(20).nullable().optional(),
  iess_entry_date: z.string().nullable().optional(),
  ruc:            z.string().max(20).nullable().optional(),
  children_count: z.number().int().min(0).max(30).nullable().optional(),

  // Discapacidad
  has_disability:          z.boolean().default(false),
  disability_type:         z.enum(['FISICA', 'INTELECTUAL', 'VISUAL', 'AUDITIVA', 'MENTAL', 'MULTIPLE']).nullable().optional(),
  conadis_number:          z.string().max(50).nullable().optional(),
  disability_percentage:   z.number().int().min(1).max(100).nullable().optional(),
  disability_card_issued:  z.string().nullable().optional(),
  disability_card_expires: z.string().nullable().optional(),
  disability_grade:        z.enum(['LEVE', 'MODERADO', 'GRAVE', 'MUY_GRAVE']).nullable().optional(),

  // Académica
  education_level:       z.enum(['PRIMARIA', 'SECUNDARIA', 'TECNICO', 'SUPERIOR', 'POSGRADO']).nullable().optional(),
  degree_title:          z.string().max(200).nullable().optional(),
  education_institution: z.string().max(300).nullable().optional(),

  // Estado laboral
  employment_status: z.enum(['ACTIVE', 'VACATION', 'SUSPENDED', 'TERMINATED']).default('ACTIVE'),
  vacation_start:    z.string().nullable().optional(),
  vacation_end:      z.string().nullable().optional(),
  lunch_tracking:    z.boolean().default(true),
  facial_photo_url:  z.string().nullable().optional(),

  // Modalidad y ubicación
  work_modality:           z.enum(['PRESENCIAL', 'REMOTO', 'MIXTO']).default('PRESENCIAL'),
  presential_days:         z.array(z.string().regex(/^[0-6]$/)).nullable().optional(),
  presential_schedule_id:  z.string().uuid().nullable().optional(),
  location_mode:           z.enum(['INDISTINTO', 'UBICACION']).default('INDISTINTO'),
  entry_biometric_id:      z.string().uuid().nullable().optional(),
  exit_biometric_id:       z.string().uuid().nullable().optional(),
  is_department_head:      z.boolean().default(false),

  // Organización
  org_unit_id:             z.string().uuid().nullable().optional(),
  supervisor_employee_id:  z.string().uuid().nullable().optional(),
  is_org_unit_leader:      z.boolean().default(false),
  lead_org_unit_id:        z.string().uuid().nullable().optional(),
  work_shift_id:           z.string().uuid().nullable().optional(),
  access_role:             z.enum(['employee', 'assistant', 'auditor', 'tenant_admin']).default('employee'),

  // PWA self-service
  pwa_self_service_enabled:      z.boolean().default(false),
  geofence_radius_m:             z.number().positive().nullable().optional(),
  reset_pwa_self_service_lock:   z.boolean().default(false),
  pwa_self_service_locked:       z.boolean().default(false),
  pwa_self_service_completed_at: z.string().nullable().optional(),
  geofence_lat:                  z.number().nullable().optional(),
  geofence_lng:                  z.number().nullable().optional(),

  // Credenciales
  password:         z.string().optional(),
  password_confirm: z.string().optional(),
}).superRefine((d, ctx) => {
  // Identification type-specific validation
  if (d.identification_type === 'CEDULA') {
    if (!/^\d{10}$/.test(d.identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identification'],
        message: 'La cédula debe tener exactamente 10 dígitos numéricos',
      })
    }
  } else {
    if (!/^[a-zA-Z0-9]{5,20}$/.test(d.identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identification'],
        message: 'El pasaporte debe ser alfanumérico (5–20 caracteres)',
      })
    }
  }

  if (d.employment_status === 'VACATION' && (!d.vacation_start || !d.vacation_end)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vacation_start'],
      message: 'Define el período de vacaciones',
    })
  }

  if (d.work_modality === 'MIXTO' && (!d.presential_days || d.presential_days.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['presential_days'],
      message: 'Selecciona al menos un día presencial para modalidad Mixto',
    })
  }

  if ((d.work_modality === 'PRESENCIAL' || d.work_modality === 'MIXTO') && d.location_mode === 'UBICACION') {
    if (!d.entry_biometric_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['entry_biometric_id'], message: 'Selecciona el biométrico de entrada' })
    }
    if (!d.exit_biometric_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exit_biometric_id'], message: 'Selecciona el biométrico de salida' })
    }
  }

  if (d.is_org_unit_leader && !d.lead_org_unit_id && !d.org_unit_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lead_org_unit_id'], message: 'Selecciona la unidad de la que será jefe' })
  }

  if (d.work_modality !== 'PRESENCIAL' && d.pwa_self_service_enabled && (!d.geofence_radius_m || Number(d.geofence_radius_m) <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['geofence_radius_m'],
      message: 'Define el umbral GPS válido en metros para colaboradores remotos o mixtos',
    })
  }
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

// ─── Facial recognition ──────────────────────────────────────────────────────

export type FacialRecognitionConfig = {
  id?: string
  tenant_id?: string
  min_brightness: number
  max_brightness: number
  min_contrast: number
  min_sharpness: number
  min_face_width_px: number
  min_face_height_px: number
  max_tilt_angle: number
  capture_count: number
  capture_interval_sec: number
  enforce_on_enrollment: boolean
  enforce_on_attendance: boolean
  require_liveness: boolean
  match_threshold_percent: number
  face_threshold?: number
  threshold_pct?: number
  similarity_threshold_pct?: number
  created_at?: string
  updated_at?: string
}

export const facialRecognitionConfigSchema = z.object({
  id:         z.string().uuid().optional(),
  tenant_id:  z.string().uuid().optional(),
  min_brightness:     z.number().min(0).max(255),
  max_brightness:     z.number().min(0).max(255),
  min_contrast:       z.number().min(0).max(100),
  min_sharpness:      z.number().min(0).max(100),
  min_face_width_px:  z.number().min(50).max(600),
  min_face_height_px: z.number().min(50).max(600),
  max_tilt_angle:     z.number().min(0).max(45),
  capture_count:      z.number().int().min(1).max(10),
  capture_interval_sec: z.number().int().min(1).max(10),
  enforce_on_enrollment: z.boolean().default(true),
  enforce_on_attendance: z.boolean().default(false),
  require_liveness:      z.boolean().default(false),
  match_threshold_percent: z.number().min(50).max(100),
  face_threshold:           z.number().optional(),
  threshold_pct:            z.number().optional(),
  similarity_threshold_pct: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.max_brightness <= d.min_brightness) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['max_brightness'],
      message: 'El brillo máximo debe ser mayor que el brillo mínimo',
    })
  }
})

export type Department = {
  id: string
  tenant_id: string
  name: string
  description?: string | null
  is_active?: boolean
}

export const FACIAL_CONFIG_DEFAULTS: FacialRecognitionConfig = {
  min_brightness:     40,
  max_brightness:     220,
  min_contrast:       30,
  min_sharpness:      40,
  min_face_width_px:  120,
  min_face_height_px: 120,
  max_tilt_angle:     15,
  capture_count:      3,
  capture_interval_sec: 2,
  enforce_on_enrollment: true,
  enforce_on_attendance: false,
  require_liveness:      false,
  match_threshold_percent: 75,
  face_threshold:           75,
  threshold_pct:            75,
  similarity_threshold_pct: 75,
}
