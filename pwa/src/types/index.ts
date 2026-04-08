/**
 * Alineado al esquema real de HRCloud Base / PWA.
 */

export type WorkMode = 'presencial' | 'remoto' | 'mixto'

export interface Employee {
  id: string
  tenant_id: string
  user_id: string | null
  employee_code: string
  first_name: string
  last_name: string
  status: 'active' | 'inactive'
  schedule_id: string | null
  biometric_employee_code: string | null
  work_mode?: WorkMode | null
  geofence_lat?: number | null
  geofence_lng?: number | null
  photo_path?: string | null
}

export interface AttendancePunch {
  id: string
  tenant_id: string
  employee_id: string
  punched_at: string
  source: string
  serial: string | null
  status: string | null
  verification: any | null
  evidence: any | null
  created_at: string
}

export interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type GeofenceStatus = 'checking' | 'inside' | 'outside' | 'error' | 'no_geofence'
export type ClockStatus = 'idle' | 'clocked_in' | 'on_break' | 'loading'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  tenant_id: string
  tenant_name?: string
  tenant_status?: string | null
  tenant_is_suspended?: boolean | null
  tenant_paused_message?: string | null
  employee_id: string
  employee_code?: string
  biometric_employee_code?: string | null
  photo_path?: string | null
  geofence_lat?: number | null
  geofence_lng?: number | null
  geofence_radius_m?: number | null
  work_mode?: WorkMode | null
  phone?: string | null
  address?: string | null
  pwa_self_service_enabled?: boolean
  pwa_self_service_locked?: boolean
  pwa_self_service_completed_at?: string | null
}

export interface PunchRequest {
  action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  location?: GeoLocation
  notes?: string
  device_id?: string
  selfie_path?: string
}

export interface PunchResponse {
  ok: boolean
  punch_id?: string
  reason?: string
}

export interface PunchAttempt {
  id: string
  tenant_id: string
  employee_id: string
  attempted_at: string
  action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  ok: boolean
  step: 'face' | 'gps' | 'insert' | 'rule' | 'unknown'
  reason: string | null
  meta: any | null
  created_at: string
}

export interface EmployeeRequest {
  id: string
  tenant_id: string
  employee_id: string
  type: string
  subject: string
  detail: string
  status: 'open' | 'in_review' | 'approved' | 'rejected' | 'closed'
  created_at: string
  updated_at: string
}
