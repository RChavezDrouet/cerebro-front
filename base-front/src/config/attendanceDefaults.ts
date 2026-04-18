import type { AttendanceRuleV2 } from '../types/attendance'

export const defaultAttendanceRules: AttendanceRuleV2 = {
  timezone: 'America/Guayaquil',
  grace_entry_minutes: 5,
  grace_exit_minutes: 5,
  rounding_policy: 'none',
  max_punches_per_day: 8,
  allow_duplicates: false,
  geo_enabled: false,
  geo_radius_m: 150,
  geo_point_lat: null,
  geo_point_lng: null,
  face_required: false,
  device_required: false,
  allow_remote: true,
  ai_enabled: false,
  ai_provider: 'openai',
  ai_model: 'gpt-4.1-mini',
  ai_sensitivity_level: 'medium',
}
