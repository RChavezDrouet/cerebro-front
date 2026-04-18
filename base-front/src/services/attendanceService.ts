import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttendanceNovelty, AttendanceRuleV2, EmployeeEnterpriseProfile } from '../types/attendance'

export class AttendanceService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getRules() {
    return this.supabase.from('attendance_rules_v2').select('*').limit(1).single()
  }

  async saveRules(input: AttendanceRuleV2) {
    return this.supabase.rpc('rpc_upsert_attendance_rules_v2', {
      p_timezone: input.timezone,
      p_grace_entry_minutes: input.grace_entry_minutes,
      p_grace_exit_minutes: input.grace_exit_minutes,
      p_rounding_policy: input.rounding_policy,
      p_max_punches_per_day: input.max_punches_per_day,
      p_allow_duplicates: input.allow_duplicates,
      p_geo_enabled: input.geo_enabled,
      p_geo_radius_m: input.geo_radius_m,
      p_geo_point_lat: input.geo_point_lat,
      p_geo_point_lng: input.geo_point_lng,
      p_face_required: input.face_required,
      p_device_required: input.device_required,
      p_allow_remote: input.allow_remote,
      p_ai_enabled: input.ai_enabled,
      p_ai_provider: input.ai_provider,
      p_ai_model: input.ai_model,
      p_ai_sensitivity_level: input.ai_sensitivity_level,
    })
  }

  async getDailyAttendance(dateFrom: string, dateTo: string) {
    return this.supabase.rpc('get_daily_attendance_report', { p_date_from: dateFrom, p_date_to: dateTo })
  }

  async getNovelties(workDate?: string) {
    let query = this.supabase.from('v_novelties_report').select('*').order('work_date', { ascending: false })
    if (workDate) query = query.eq('work_date', workDate)
    return query as PromiseLike<{ data: AttendanceNovelty[] | null; error: unknown }>
  }

  async getPunctualityRanking() {
    return this.supabase.from('v_punctuality_ranking').select('*').order('punctuality_pct', { ascending: false })
  }

  async getHeatmap() {
    return this.supabase.from('v_attendance_heatmap').select('*').order('work_date', { ascending: false })
  }

  async analyzeWithAI(workDate: string, tenantId: string) {
    return this.supabase.functions.invoke('attendance-ai-analyze', {
      body: { work_date: workDate, tenant_id: tenantId },
    })
  }

  async getEmployeeProfile(employeeId: string) {
    return this.supabase.from('employee_enterprise_profile').select('*').eq('employee_id', employeeId).single() as PromiseLike<{
      data: EmployeeEnterpriseProfile | null
      error: unknown
    }>
  }

  async upsertEmployeeProfile(employeeId: string, payload: EmployeeEnterpriseProfile) {
    return this.supabase.from('employee_enterprise_profile').upsert({ employee_id: employeeId, ...payload }).select('*').single()
  }
}
