// =============================================
// HRCloud Attendance PWA - Basic Device Fingerprint
// =============================================
// Objetivo: generar un device_id estable (best-effort) SIN invadir privacidad.
// - Se guarda en localStorage
// - No usa técnicas agresivas (canvas fingerprinting, etc.)

import { v4 as uuidv4 } from 'uuid'

const KEY = 'hrcloud_device_id_v1'

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing && existing.length > 10) return existing
    const id = uuidv4()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // Fallback si storage está bloqueado
    return uuidv4()
  }
}
