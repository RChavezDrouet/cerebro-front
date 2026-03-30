export type UserProfile = {
  id: string
  email: string
  full_name: string
  role: string
  tenant_id: string
  tenant_name: string
  tenant_status: string | null
  tenant_is_suspended: boolean | null
  tenant_paused_message: string | null
  employee_id: string
  employee_code?: string
  photo_path?: string | null
  geofence_lat?: number | null
  geofence_lng?: number | null
  work_mode?: string | null
}

export type ClockStatus = 'loading' | 'idle' | 'clocked_in' | 'on_break'

export type GeoLocation = {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type GeofenceStatus = 'checking' | 'inside' | 'outside' | 'no_geofence' | 'error'

export type AttendancePunch = {
  id: string
  tenant_id: string
  employee_id: string
  punched_at: string
  source?: string | null
  verification?: any
  evidence?: any
  created_at?: string
}

export type PunchAttempt = {
  id: string
  tenant_id: string
  employee_id: string
  attempted_at: string
  action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  ok: boolean
  step: string
  reason: string | null
  meta?: any
  created_at?: string
}