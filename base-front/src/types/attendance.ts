export type RoundingPolicy = 'none' | '5m' | '10m' | '15m' | 'nearest_schedule'
export type AiSensitivity = 'low' | 'medium' | 'high'

export interface AttendanceRuleV2 {
  id?: string
  tenant_id?: string
  timezone: string
  grace_entry_minutes: number
  grace_exit_minutes: number
  rounding_policy: RoundingPolicy
  max_punches_per_day: number
  allow_duplicates: boolean
  geo_enabled: boolean
  geo_radius_m: number | null
  geo_point_lat: number | null
  geo_point_lng: number | null
  face_required: boolean
  device_required: boolean
  allow_remote: boolean
  ai_enabled: boolean
  ai_provider: string | null
  ai_model: string | null
  ai_sensitivity_level: AiSensitivity
}

export interface AttendanceNovelty {
  id: string
  work_date: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detected_by: 'rules' | 'ai' | 'manual'
  status: string
  title: string
  description: string | null
  confidence_score?: number | null
  employee_code?: string | null
  employee_name?: string | null
  department_name?: string | null
  evidence?: Record<string, unknown>
}

export interface EmployeeEnterpriseProfile {
  employee_id?: string
  personal_email?: string | null
  mobile_phone?: string | null
  emergency_contact_name?: string | null
  emergency_contact_relationship?: string | null
  emergency_contact_phone?: string | null
  medical_notes?: string | null
  allergies?: string | null
  chronic_conditions?: string | null
  work_modality: 'remoto' | 'presencial' | 'mixto'
  geofence_lat?: number | null
  geofence_lng?: number | null
  geofence_radius_m?: number | null
  biometric_code?: string | null
  official_photo_path?: string | null
  department_name?: string | null
  position_name?: string | null
  labor_history?: Array<Record<string, unknown>>
  custom_fields?: Record<string, unknown>
}
