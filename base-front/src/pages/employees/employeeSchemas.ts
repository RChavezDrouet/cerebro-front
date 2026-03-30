/**
 * employeeSchemas.ts — Base PWA
 * Ampliado para jerarquía organizacional, supervisor inmediato y asignación de turnos.
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

  password: z.string().optional(),
  password_confirm: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.employment_status === 'VACATION' && (!d.vacation_start || !d.vacation_end)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vacation_start'], message: 'Define periodo de vacaciones' })
  }

  if (d.work_modality === 'MIXTO' && (!d.presential_days || d.presential_days.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['presential_days'], message: 'Selecciona al menos un día presencial para modalidad Mixto' })
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
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

export type FacialRecognitionConfig = {
  min_brightness: number
  max_brightness: number
  min_contrast: number
  min_sharpness: number
  max_tilt_angle?: number
  enforce_on_enrollment?: boolean
  enforce_on_attendance?: boolean
  require_liveness?: boolean
}

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
  max_tilt_angle: 15,
  enforce_on_enrollment: true,
  enforce_on_attendance: false,
  require_liveness: false,
}
