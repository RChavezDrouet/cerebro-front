/**
 * employeeSchemas.ts — Base HRCloud
 * Incluye validaciones de ficha de empleado, autogestión PWA,
 * geocerca/umbral GPS y configuración de reconocimiento facial por tenant.
 */
import { z } from 'zod'

export const WORK_MODALITY_OPTIONS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'REMOTO', label: 'Remoto' },
  { value: 'MIXTO', label: 'Mixto' },
] as const

export const LOCATION_MODE_OPTIONS = [
  { value: 'INDISTINTO', label: 'Indistinto' },
  { value: 'UBICACION', label: 'Ubicación fija' },
] as const

export type WorkModality = typeof WORK_MODALITY_OPTIONS[number]['value']
export type LocationMode = typeof LOCATION_MODE_OPTIONS[number]['value']

export const ACCESS_ROLE_OPTIONS = [
  { value: 'employee', label: 'Empleado' },
  { value: 'assistant', label: 'Asistente' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'tenant_admin', label: 'Administrador HRCloud' },
] as const

export type AccessRole = typeof ACCESS_ROLE_OPTIONS[number]['value']


export const employeeFormSchema = z.object({
  employee_code: z.string().min(1, 'Código requerido').max(50),
  first_name: z.string().min(2, 'Nombre requerido').max(100),
  last_name: z.string().min(2, 'Apellido requerido').max(100),
  email: z.string().email('Correo inválido'),
  phone: z.string().max(30, 'Teléfono demasiado largo').nullable().optional(),
  address: z.string().max(300, 'Dirección demasiado larga').nullable().optional(),
  identification: z.string().min(5, 'Cédula/ID requerido').max(20).regex(/^\d+$/, 'Cédula / ID debe contener solo números'),
  department_id: z.string().uuid().nullable().optional(),
  hire_date: z.string().nullable().optional(),
  salary: z.number().nonnegative().nullable().optional(),
  employment_status: z.enum(['ACTIVE', 'VACATION', 'SUSPENDED', 'TERMINATED']).default('ACTIVE'),
  vacation_start: z.string().nullable().optional(),
  vacation_end: z.string().nullable().optional(),
  lunch_tracking: z.boolean().default(true),
  facial_photo_url: z.string().nullable().optional(),

  work_modality: z.enum(['PRESENCIAL', 'REMOTO', 'MIXTO']).default('PRESENCIAL'),
  presential_days: z.array(z.string().regex(/^[0-6]$/)).nullable().optional(),
  presential_schedule_id: z.string().uuid().nullable().optional(),
  location_mode: z.enum(['INDISTINTO', 'UBICACION']).default('INDISTINTO'),
  entry_biometric_id: z.string().uuid().nullable().optional(),
  exit_biometric_id: z.string().uuid().nullable().optional(),
  is_department_head: z.boolean().default(false),

  org_unit_id: z.string().uuid().nullable().optional(),
  supervisor_employee_id: z.string().uuid().nullable().optional(),
  is_org_unit_leader: z.boolean().default(false),
  lead_org_unit_id: z.string().uuid().nullable().optional(),
  work_shift_id: z.string().uuid().nullable().optional(),
  access_role: z.enum(['employee', 'assistant', 'auditor', 'tenant_admin']).default('employee'),

  pwa_self_service_enabled: z.boolean().default(false),
  geofence_radius_m: z.number().positive('El umbral GPS debe ser mayor a 0').nullable().optional(),
  reset_pwa_self_service_lock: z.boolean().default(false),
  pwa_self_service_locked: z.boolean().default(false),
  pwa_self_service_completed_at: z.string().nullable().optional(),
  geofence_lat: z.number().nullable().optional(),
  geofence_lng: z.number().nullable().optional(),

  password: z.string().optional(),
  password_confirm: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.employment_status === 'VACATION' && (!d.vacation_start || !d.vacation_end)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vacation_start'], message: 'Define periodo de vacaciones' })
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
      message: 'Define el umbral GPS válido en metros para empleados remotos o mixtos',
    })
  }
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

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
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  min_brightness: z.number().min(0, 'El brillo mínimo no puede ser negativo').max(255, 'El brillo mínimo no puede exceder 255'),
  max_brightness: z.number().min(0, 'El brillo máximo no puede ser negativo').max(255, 'El brillo máximo no puede exceder 255'),
  min_contrast: z.number().min(0, 'El contraste mínimo no puede ser negativo').max(100, 'El contraste mínimo no puede exceder 100'),
  min_sharpness: z.number().min(0, 'La nitidez mínima no puede ser negativa').max(100, 'La nitidez mínima no puede exceder 100'),
  min_face_width_px: z.number().min(50, 'El ancho mínimo del rostro debe ser al menos 50px').max(600, 'El ancho mínimo del rostro es demasiado alto'),
  min_face_height_px: z.number().min(50, 'El alto mínimo del rostro debe ser al menos 50px').max(600, 'El alto mínimo del rostro es demasiado alto'),
  max_tilt_angle: z.number().min(0, 'El ángulo no puede ser negativo').max(45, 'El ángulo máximo permitido es 45°'),
  capture_count: z.number().int().min(1, 'Debe capturar al menos una foto').max(10, 'No se recomienda capturar más de 10 fotos'),
  capture_interval_sec: z.number().int().min(1, 'El intervalo debe ser al menos 1 segundo').max(10, 'El intervalo máximo permitido es 10 segundos'),
  enforce_on_enrollment: z.boolean().default(true),
  enforce_on_attendance: z.boolean().default(false),
  require_liveness: z.boolean().default(false),
  match_threshold_percent: z.number().min(50, 'El umbral facial mínimo recomendado es 50%').max(100, 'El umbral facial no puede exceder 100%'),
  face_threshold: z.number().optional(),
  threshold_pct: z.number().optional(),
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
  min_brightness: 40,
  max_brightness: 220,
  min_contrast: 30,
  min_sharpness: 40,
  min_face_width_px: 120,
  min_face_height_px: 120,
  max_tilt_angle: 15,
  capture_count: 3,
  capture_interval_sec: 2,
  enforce_on_enrollment: true,
  enforce_on_attendance: false,
  require_liveness: false,
  match_threshold_percent: 75,
  face_threshold: 75,
  threshold_pct: 75,
  similarity_threshold_pct: 75,
}
