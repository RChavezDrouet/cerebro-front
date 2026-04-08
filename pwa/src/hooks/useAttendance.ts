// =============================================
// HRCloud Attendance PWA - Attendance Hook (Base-Front aligned)
// =============================================
// OBJETIVO (nuevo requerimiento):
// - Flujo de marcación: 1) Selfie 2) Verificación facial en BACKEND 3) GPS 4) Insert punch
// - Registrar marcaciones Web en: attendance.punches con source='web'
// - Guardar evidencia en punches.evidence (jsonb/text según tu BD):
//     evidence.action, evidence.geo, evidence.selfie, evidence.face, evidence.device, evidence.notes
// - Registrar intentos fallidos en: attendance.punch_attempts (si existe)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { attendanceDb, safeSelect, supabase } from '../lib/supabase'
import { getCurrentPosition, validateGeofence, isAccuracyAcceptable } from '../lib/geolocation'
import { getOrCreateDeviceId } from '../lib/device'
import { uploadSelfie } from '../lib/storage'
import type {
  AttendancePunch,
  ClockStatus,
  GeoLocation,
  GeofenceStatus,
  PunchAttempt,
  UserProfile,
} from '../types'

export type WebSettings = {
  tenant_id: string
  geo_enabled: boolean
  geo_max_m: number
  face_enabled: boolean
  face_threshold: number
  selfie_required: boolean
}

export type FaceResult = {
  match: boolean
  score: number | null
  threshold: number | null
  provider: string
  reason?: string | null
}

interface AttendanceState {
  clockStatus: ClockStatus
  lastPunch: AttendancePunch | null
  todayPunches: AttendancePunch[]
  todayAttempts: PunchAttempt[]
  location: GeoLocation | null
  geofenceStatus: GeofenceStatus
  geofenceDistance: number | null
  loading: boolean
  error: string | null
  success: string | null
  settings: WebSettings
  biometricStatus: 'idle' | 'uploading' | 'verifying' | 'ok' | 'failed'
  biometricResult: FaceResult | null
}

const DEFAULT_SETTINGS: WebSettings = {
  tenant_id: '',
  geo_enabled: true,
  geo_max_m: Number(import.meta.env.VITE_GEO_MAX_METERS) || 400,
  face_enabled: true,
  face_threshold: Number(import.meta.env.VITE_FACE_THRESHOLD) || 0.6,
  selfie_required: true,
}

const MAX_ACCURACY = Number(import.meta.env.VITE_MIN_GPS_ACCURACY) || 50
const SELFIE_BUCKET = (import.meta.env.VITE_SELFIE_BUCKET as string) || 'punch-selfies'

function isoDayRangeUTC(): { start: string; end: string } {
  const today = new Date().toISOString().split('T')[0]
  return {
    start: `${today}T00:00:00.000Z`,
    end: `${today}T23:59:59.999Z`,
  }
}

function lastAction(p: AttendancePunch | null): string {
  return (p?.evidence?.action as string) || ''
}

function todayPathPrefix(tenantId: string, employeeId: string) {
  const dt = new Date()
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${tenantId}/${employeeId}/${yyyy}-${mm}-${dd}`
}

function getFaceVerifyMode(): 'strict' | 'mvp' {
  const mode = String(import.meta.env.VITE_FACE_VERIFY_MODE || 'strict').toLowerCase()
  return mode === 'mvp' ? 'mvp' : 'strict'
}

function getFaceVerifyFunctionName(): string {
  return (import.meta.env.VITE_FACE_VERIFY_FUNCTION as string) || 'face-verify'
}

function getWebPunchStatusDefault(): string {
  // La columna attendance.punches.status es TEXT (confirmado en tu BD).
  // Para no acoplar a un catálogo aún, usamos un default parametrizable.
  return (import.meta.env.VITE_WEB_PUNCH_STATUS as string) || '0'
}

function getWebPunchVerificationDefault(): number {
  // Puede ser int o text en BD; enviar número suele castear bien a TEXT.
  const raw = (import.meta.env.VITE_WEB_PUNCH_VERIFICATION as string) || '15'
  const n = Number(raw)
  return Number.isFinite(n) ? n : 15
}

export const useAttendance = (profile: UserProfile | null) => {
  const [state, setState] = useState<AttendanceState>({
    clockStatus: 'loading',
    lastPunch: null,
    todayPunches: [],
    todayAttempts: [],
    location: null,
    geofenceStatus: 'checking',
    geofenceDistance: null,
    loading: false,
    error: null,
    success: null,
    settings: { ...DEFAULT_SETTINGS },
    biometricStatus: 'idle',
    biometricResult: null,
  })

  const deviceId = useMemo(() => getOrCreateDeviceId(), [])

  const loadSettings = useCallback(async () => {
    if (!profile) return
    // IMPORTANTE (alineación Base): no dependemos de tablas inexistentes como attendance.web_settings.
    // Settings se gestionan localmente (env/defaults) para no bloquear marcaciones.
    setState((prev) => ({
      ...prev,
      settings: {
        ...DEFAULT_SETTINGS,
        tenant_id: profile.tenant_id,
      },
    }))
  }, [profile])

  const loadTodayPunches = useCallback(async () => {
    if (!profile) return
    const { start, end } = isoDayRangeUTC()

    // ⚙️ Selección robusta (compatibilidad de esquemas):
    // - Algunos entornos tienen serial_no en lugar de serial
    // - Algunos entornos NO tienen verification
    const runSelect = async (cols: string) =>
      attendanceDb
        .from('punches')
        .select(cols)
        .eq('tenant_id', profile.tenant_id)
        .eq('employee_id', profile.employee_id)
        .gte('punched_at', start)
        .lte('punched_at', end)
        .order('punched_at', { ascending: false })

    const candidates = [
      'id,tenant_id,employee_id,punched_at,source,serial_no,status,verification,evidence,created_at',
      'id,tenant_id,employee_id,punched_at,source,serial_no,status,evidence,created_at',
      'id,tenant_id,employee_id,punched_at,source,serial,status,verification,evidence,created_at',
      'id,tenant_id,employee_id,punched_at,source,serial,status,evidence,created_at',
    ]

    let data: any[] | null = null
    let error: any = null
    for (const cols of candidates) {
      const res = await runSelect(cols)
      data = res.data as any[] | null
      error = res.error
      if (!error) break

      // Si no es "columna no existe", no tiene sentido seguir probando.
      if (String(error.code || '') !== '42703') break
    }

    if (error) {
      console.error('Error cargando punches:', error)
      setState((prev) => ({ ...prev, error: `No se pudo cargar marcaciones: ${error.message}` }))
      return
    }

    const punches = (data || []) as AttendancePunch[]
    const last = punches[0] || null

    // Estado UX simple
    const a = lastAction(last)
    const clockStatus: ClockStatus =
      a === 'clock_in' ? 'clocked_in' : a === 'break_start' ? 'on_break' : 'idle'

    setState((prev) => ({
      ...prev,
      todayPunches: punches,
      lastPunch: last,
      clockStatus,
    }))
  }, [profile])

  const loadTodayAttempts = useCallback(async () => {
    if (!profile) return
    const { start, end } = isoDayRangeUTC()

    // tabla opcional: si no existe, safeSelect devuelve null
    const attempts = await safeSelect<PunchAttempt[]>(() =>
      attendanceDb
        .from('punch_attempts')
        .select('id,tenant_id,employee_id,attempted_at,action,ok,step,reason,meta,created_at')
        .eq('tenant_id', profile.tenant_id)
        .eq('employee_id', profile.employee_id)
        .gte('attempted_at', start)
        .lte('attempted_at', end)
        .order('attempted_at', { ascending: false })
    )

    setState((prev) => ({ ...prev, todayAttempts: attempts || [] }))
  }, [profile])

  const recordAttemptBestEffort = useCallback(
    async (params: {
      ok: boolean
      step: PunchAttempt['step']
      action: PunchAttempt['action']
      reason: string | null
      meta: any
    }) => {
      if (!profile) return
      try {
        await attendanceDb.from('punch_attempts').insert({
          tenant_id: profile.tenant_id,
          employee_id: profile.employee_id,
          attempted_at: new Date().toISOString(),
          ok: params.ok,
          step: params.step,
          action: params.action,
          reason: params.reason,
          meta: params.meta,
        })
      } catch (e) {
        // No rompemos el flujo si la tabla no existe o si la policy bloquea
        console.warn('No se pudo registrar punch_attempt (best-effort).', e)
      }
    },
    [profile]
  )

  const captureLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, geofenceStatus: 'checking', error: null }))

    try {
      const location = await getCurrentPosition()

      if (!isAccuracyAcceptable(location.accuracy, MAX_ACCURACY)) {
        setState((prev) => ({
          ...prev,
          location,
          geofenceStatus: 'error',
          error: `Precisión GPS insuficiente (${Math.round(location.accuracy)}m).`,
        }))
        return location
      }

      if (!profile) {
        setState((prev) => ({ ...prev, location, geofenceStatus: 'no_geofence', geofenceDistance: null }))
        return location
      }

      const lat0 = (profile as any).geofence_lat as number | null | undefined
      const lng0 = (profile as any).geofence_lng as number | null | undefined

      if (state.settings.geo_enabled && lat0 != null && lng0 != null) {
        const { status, distance } = validateGeofence(location.latitude, location.longitude, lat0, lng0, state.settings.geo_max_m)
        setState((prev) => ({
          ...prev,
          location,
          geofenceStatus: status,
          geofenceDistance: distance,
          error: status === 'outside' ? `Fuera del área permitida (${distance}m).` : null,
        }))
      } else {
        setState((prev) => ({ ...prev, location, geofenceStatus: 'no_geofence', geofenceDistance: null }))
      }

      return location
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        geofenceStatus: 'error',
        error: err?.message || 'No se pudo obtener la ubicación.',
      }))
      return null
    }
  }, [profile, state.settings.geo_enabled, state.settings.geo_max_m])

  const validateSequence = useCallback(
    (action: PunchAttempt['action']) => {
      const a = lastAction(state.lastPunch)

      // Reglas mínimas (puedes sofisticar luego)
      if (action === 'clock_in' && a === 'clock_in') return 'Ya existe una ENTRADA previa. Debe marcar SALIDA.'
      if (action === 'clock_out' && a !== 'clock_in') return 'No puede marcar SALIDA sin una ENTRADA previa.'
      if (action === 'break_start' && a !== 'clock_in') return 'No puede iniciar descanso sin estar en jornada (ENTRADA).' 
      if (action === 'break_end' && a !== 'break_start') return 'No puede finalizar descanso si no está en descanso.'
      return null
    },
    [state.lastPunch]
  )

  const verifyFaceOnBackend = useCallback(
    async (selfie: { bucket: string; path: string }): Promise<FaceResult> => {
      if (!state.settings.face_enabled) {
        return { match: true, score: null, threshold: null, provider: 'disabled' }
      }

      const fnName = getFaceVerifyFunctionName()
      const mode = getFaceVerifyMode()

      try {
        setState((p) => ({ ...p, biometricStatus: 'verifying', biometricResult: null }))

        const { data, error } = await supabase.functions.invoke(fnName, {
          body: {
            tenant_id: profile?.tenant_id,
            employee_id: profile?.employee_id,
            selfie,
            threshold: state.settings.face_threshold,
          },
        })

        if (error) throw error
        const r = (data || null) as FaceResult | null
        if (!r || typeof r.match !== 'boolean') throw new Error('Respuesta inválida del servicio biométrico.')

        setState((p) => ({ ...p, biometricStatus: r.match ? 'ok' : 'failed', biometricResult: r }))
        return r
      } catch (e: any) {
        console.error('Error verificando rostro en backend:', e)

        if (mode === 'mvp') {
          const r: FaceResult = {
            match: true,
            score: null,
            threshold: state.settings.face_threshold,
            provider: 'selfie_only_mvp',
            reason: 'fallback_mvp',
          }
          setState((p) => ({ ...p, biometricStatus: 'ok', biometricResult: r }))
          return r
        }

        setState((p) => ({ ...p, biometricStatus: 'failed', biometricResult: null }))
        throw new Error('No se pudo validar el rostro (servicio biométrico).')
      }
    },
    [profile?.tenant_id, profile?.employee_id, state.settings.face_enabled, state.settings.face_threshold]
  )

  const uploadAndVerifySelfie = useCallback(
    async (blob: Blob | null | undefined): Promise<{ selfie: { bucket: string; path: string } | null; face: FaceResult | null }> => {
      const requiresSelfie = Boolean(state.settings.selfie_required || state.settings.face_enabled)
      if (!requiresSelfie) return { selfie: null, face: null }

      if (!blob) {
        throw new Error('Debe capturar una selfie para marcar.')
      }

      setState((p) => ({ ...p, biometricStatus: 'uploading', biometricResult: null }))

      const prefix = todayPathPrefix(profile!.tenant_id, profile!.employee_id)
      const path = `${prefix}/${crypto.randomUUID()}.jpg`
      await uploadSelfie({ bucket: SELFIE_BUCKET as any, path, blob })

      const selfie = { bucket: SELFIE_BUCKET, path }
      const face = await verifyFaceOnBackend(selfie)
      return { selfie, face }
    },
    [profile, state.settings.selfie_required, state.settings.face_enabled, verifyFaceOnBackend]
  )

  const registerPunch = useCallback(
    async (
      action: PunchAttempt['action'],
      opts?: {
        notes?: string
        selfieBlob?: Blob | null
      }
    ) => {
      if (!profile) {
        setState((prev) => ({ ...prev, error: 'No hay perfil cargado.' }))
        return false
      }

      const seqErr = validateSequence(action)
      if (seqErr) {
        setState((p) => ({ ...p, error: seqErr }))
        await recordAttemptBestEffort({ ok: false, step: 'rule', action, reason: seqErr, meta: { action } })
        return false
      }

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        success: null,
        biometricStatus: 'idle',
        biometricResult: null,
      }))

      // 1) Selfie + Verificación facial en BACKEND
      let selfie: { bucket: string; path: string } | null = null
      let face: FaceResult | null = null
      try {
        const r = await uploadAndVerifySelfie(opts?.selfieBlob)
        selfie = r.selfie
        face = r.face

        if (state.settings.face_enabled && face && face.match === false) {
          const reason = face.reason || 'Rostro no coincide.'
          await recordAttemptBestEffort({
            ok: false,
            step: 'face',
            action,
            reason,
            meta: {
              action,
              selfie,
              face,
              device: { device_id: deviceId, ua: navigator.userAgent },
            },
          })
          setState((p) => ({ ...p, loading: false, error: `Validación biométrica fallida: ${reason}` }))
          return false
        }
      } catch (e: any) {
        const msg = e?.message || 'Error en captura/verificación biométrica.'
        await recordAttemptBestEffort({ ok: false, step: 'face', action, reason: msg, meta: { action } })
        setState((p) => ({ ...p, loading: false, error: msg }))
        return false
      }

      // 2) GPS (solo después de biometría OK)
      let loc: GeoLocation | null = null
      if (state.settings.geo_enabled) {
        loc = await captureLocation()
        if (!loc) {
          await recordAttemptBestEffort({ ok: false, step: 'gps', action, reason: 'No se pudo obtener GPS.', meta: { action, selfie, face } })
          setState((prev) => ({ ...prev, loading: false, error: 'No se pudo obtener ubicación (GPS).' }))
          return false
        }
        if (!isAccuracyAcceptable(loc.accuracy, MAX_ACCURACY)) {
          const reason = `Precisión GPS insuficiente (${Math.round(loc.accuracy)}m).`
          await recordAttemptBestEffort({ ok: false, step: 'gps', action, reason, meta: { action, selfie, face } })
          setState((prev) => ({ ...prev, loading: false, error: reason }))
          return false
        }
      }

      // 3) Construir evidencia geo + hard-block geofence
      const lat0 = (profile as any).geofence_lat as number | null | undefined
      const lng0 = (profile as any).geofence_lng as number | null | undefined

      let geo: any = null
      if (loc && state.settings.geo_enabled) {
        let inRange: boolean | null = null
        let distanceM: number | null = null

        if (lat0 != null && lng0 != null) {
          const { status, distance } = validateGeofence(loc.latitude, loc.longitude, lat0, lng0, state.settings.geo_max_m)
          inRange = status === 'inside'
          distanceM = distance
        }

        geo = {
          lat: loc.latitude,
          lng: loc.longitude,
          accuracy_m: Math.round(loc.accuracy),
          timestamp: loc.timestamp,
          base_lat: lat0 ?? null,
          base_lng: lng0 ?? null,
          max_m: state.settings.geo_max_m,
          distance_m: distanceM,
          in_range: inRange,
        }

        if (inRange === false) {
          const reason = `Fuera del rango permitido (${distanceM}m).`
          await recordAttemptBestEffort({ ok: false, step: 'gps', action, reason, meta: { action, selfie, face, geo } })
          setState((prev) => ({ ...prev, loading: false, error: reason }))
          return false
        }
      }

      // 4) Insert punch
      const evidence: any = {
        action,
        notes: opts?.notes || null,
        geo,
        selfie,
        face: face || {
          provider: state.settings.face_enabled ? 'unknown' : 'disabled',
          match: state.settings.face_enabled ? null : true,
          score: null,
          threshold: state.settings.face_enabled ? state.settings.face_threshold : null,
        },
        device: {
          device_id: deviceId,
          ua: navigator.userAgent,
          lang: navigator.language,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }

      const payload: any = {
        tenant_id: profile.tenant_id,
        employee_id: profile.employee_id,
        punched_at: new Date().toISOString(),
        source: 'web',
        serial_no: null,
        status: getWebPunchStatusDefault(),
        verification: getWebPunchVerificationDefault(),
        evidence,
      }

      // Insert robusto: si evidence fuese TEXT en tu BD, reintentamos con JSON.stringify.
      let { error } = await attendanceDb.from('punches').insert(payload)

      // Fallback 1: si evidence fuese TEXT en tu BD, reintentamos con JSON.stringify.
      if (error && String(error.message || '').toLowerCase().includes('evidence')) {
        try {
          const retryPayload = { ...payload, evidence: JSON.stringify(evidence) }
          ;({ error } = await attendanceDb.from('punches').insert(retryPayload))
        } catch {
          // dejamos que el error original fluya
        }
      }

      // Fallback 2: compatibilidad de columnas (serial_no/serial y verification opcional)
      if (error && String(error.code || '') === '42703') {
        const msg = String(error.message || '').toLowerCase()

        // Si no existe verification, reintenta sin ella
        if (msg.includes('verification') && 'verification' in payload) {
          const { verification, ...rest } = payload
          ;({ error } = await attendanceDb.from('punches').insert(rest))
        }

        // Si no existe serial_no, reintenta usando serial
        if (error && msg.includes('serial_no') && 'serial_no' in payload) {
          const { serial_no, ...rest } = payload
          ;({ error } = await attendanceDb.from('punches').insert({ ...rest, serial: null }))
        }

        // Si no existe serial (entorno viejo), reintenta usando serial_no
        if (error && msg.includes('serial') && !msg.includes('serial_no') && 'serial' in payload) {
          const { serial, ...rest } = payload
          ;({ error } = await attendanceDb.from('punches').insert({ ...rest, serial_no: null }))
        }
      }

      if (error) {
        const reason = `No se pudo registrar: ${error.message} (${error.code})`
        await recordAttemptBestEffort({ ok: false, step: 'insert', action, reason, meta: { action, selfie, face, geo, err: error } })
        setState((prev) => ({ ...prev, loading: false, error: reason }))
        return false
      }

      setState((prev) => ({ ...prev, loading: false, success: 'Marcación registrada.', biometricStatus: 'idle', biometricResult: null }))
      await loadTodayPunches()
      await loadTodayAttempts()
      return true
    },
    [
      profile,
      state.settings.geo_enabled,
      state.settings.geo_max_m,
      state.settings.face_enabled,
      state.settings.face_threshold,
      captureLocation,
      deviceId,
      loadTodayPunches,
      loadTodayAttempts,
      uploadAndVerifySelfie,
      recordAttemptBestEffort,
      validateSequence,
    ]
  )

  // === Public API ===
  const clockIn = useCallback(
    (notes?: string, selfieBlob?: Blob | null) => registerPunch('clock_in', { notes, selfieBlob }),
    [registerPunch]
  )

  const clockOut = useCallback(
    (notes?: string, selfieBlob?: Blob | null) => registerPunch('clock_out', { notes, selfieBlob }),
    [registerPunch]
  )

  const breakStart = useCallback(
    (selfieBlob?: Blob | null) => registerPunch('break_start', { selfieBlob }),
    [registerPunch]
  )

  const breakEnd = useCallback(
    (selfieBlob?: Blob | null) => registerPunch('break_end', { selfieBlob }),
    [registerPunch]
  )

  const refreshLocation = useCallback(() => captureLocation(), [captureLocation])

  useEffect(() => {
    void loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.tenant_id])

  useEffect(() => {
    void loadTodayPunches()
    void loadTodayAttempts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.tenant_id, profile?.employee_id])

  return {
    ...state,
    deviceId,
    // loaders
    loadSettings,
    loadTodayPunches,
    loadTodayAttempts,
    // geo
    captureLocation,
    refreshLocation,
    // punch actions
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    registerPunch,
    // ui helpers
    clearMessages: () => setState((p) => ({ ...p, error: null, success: null })),
    resetBiometric: () => setState((p) => ({ ...p, biometricStatus: 'idle', biometricResult: null })),
  }
}
