export interface Employee {
  id: string
  tenant_id: string
  user_id?: string
  employee_code: string
  first_name: string
  last_name: string
  email?: string
  department_id?: string
  employee_type: 'employee' | 'department_head' | 'manager'
  status: 'active' | 'inactive'
  work_mode: 'onsite' | 'remote' | 'hybrid'
  photo_path?: string
  geofence_lat?: number
  geofence_lng?: number
  geofence_radius_m: number
  first_login_pending: boolean
  created_at: string
  departments?: { id: string; name: string }
}

export interface Department {
  id: string
  tenant_id: string
  name: string
  code?: string
  manager_id?: string
  is_active: boolean
  created_at: string
}

export interface BaseTenantConfig {
  id: string
  tenant_id: string
  company_name?: string
  ruc?: string
  legal_rep_name?: string
  company_logo_path?: string
  logo_url?: string
  color_primary: string
  color_secondary: string
  color_accent: string
  color_sidebar: string
  color_header: string
  theme: 'dark' | 'light'
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_from_name?: string
  smtp_from_email?: string
  smtp_verified: boolean
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  tenant_id: string
  timestamp: string
  type: 'clock_in' | 'clock_out'
  latitude?: number
  longitude?: number
  geofence_ok?: boolean
  face_verified?: boolean
}

export interface TenantGateResult {
  status: string
  is_suspended: boolean
}
