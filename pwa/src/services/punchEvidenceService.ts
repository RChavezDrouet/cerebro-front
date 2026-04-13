// =============================================
// HRCloud Attendance PWA — Punch Evidence Service
// =============================================
// Utilidades para consultar attendance.punch_evidence.
// El INSERT se hace inline en useAttendance (best-effort).
// Este servicio se usa para lectura/admin en componentes de UI.

import { attendanceDb } from '../lib/supabase'

export interface PunchEvidence {
  id:                  string
  punch_id:            string
  tenant_id:           string
  employee_id:         string
  selfie_bucket:       string | null
  selfie_path:         string | null
  selfie_uploaded_at:  string | null
  latitude:            number | null
  longitude:           number | null
  gps_accuracy_m:      number | null
  distance_to_fence_m: number | null
  geofence_ok:         boolean | null
  device_info:         Record<string, unknown> | null
  verification_status: 'pending' | 'ok' | 'failed' | 'skipped'
  verification_at:     string | null
  verification_detail: Record<string, unknown> | null
  created_at:          string
}

/**
 * Obtiene la evidencia de un punch específico (best-effort).
 * Devuelve null si no existe o si falla la query.
 */
export async function getPunchEvidence(punchId: string): Promise<PunchEvidence | null> {
  try {
    const { data, error } = await attendanceDb
      .from('punch_evidence')
      .select('*')
      .eq('punch_id', punchId)
      .maybeSingle()

    if (error) {
      console.warn('[PUNCH_EVIDENCE] getPunchEvidence error:', error.message)
      return null
    }
    return (data as PunchEvidence) ?? null
  } catch (e) {
    console.warn('[PUNCH_EVIDENCE] getPunchEvidence excepción:', e)
    return null
  }
}

/**
 * Lista evidencias pendientes de verificación para el tenant del usuario.
 * Uso: panel admin / worker de verificación asíncrona.
 */
export async function listPendingEvidence(): Promise<PunchEvidence[]> {
  try {
    const { data, error } = await attendanceDb
      .from('punch_evidence')
      .select('*')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      console.warn('[PUNCH_EVIDENCE] listPendingEvidence error:', error.message)
      return []
    }
    return (data as PunchEvidence[]) ?? []
  } catch (e) {
    console.warn('[PUNCH_EVIDENCE] listPendingEvidence excepción:', e)
    return []
  }
}
