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

type WebSettings = {
  tenant_id: string
  geo_enabled: boolean
  geo_max_m: number
  face_enabled: boolean
  face_threshold: number
  selfie_required: boolean
}

type FaceResult = {
  match: boolean
  score: number | null
  threshold: number | null
  provider: string
  reason?: string | null
}

type AttendanceState = {
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
const FACE_VERIFY_FUNCTION = (import.meta.env.VITE_FACE_VERIFY_FUNCTION as string) || 'face-verify'

function isoLocalDayRange(): { start: string; end: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function lastAction(punch: AttendancePunch | null): string {
  return String((punch?.evidence as any)?.action || '')
}

function todaySelfiePrefix(tenantId: string, employeeId: string) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${tenantId}/${employeeId}/${yyyy}-${mm}-${dd}`
}

export function useAttendance(profile: UserProfile | null) {
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
    settings: DEFAULT_SETTINGS,
    biometricStatus: 'idle',
    biometricResult: null,
  })

  const deviceId = useMemo(() => getOrCreateDeviceId(), [])

  const loadSettings = useCallback(async () => {
    if (!profile) return
    const settings = await safeSelect<any>(() =>
      attendanceDb
        .from('settings')
        .select('geo_enabled,geo_max_m,face_enabled,face_threshold,selfie_required')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle()
    )

    setState((prev) => ({
      ...prev,
      settings: {
        ...DEFAULT_SETTINGS,
        tenant_id: profile.tenant_id,
        geo_enabled: settings?.geo_enabled ?? DEFAULT_SETTINGS.geo_enabled,
        geo_max_m: settings?.geo_max_m ?? DEFAULT_SETTINGS.geo_max_m,
        face_enabled: settings?.face_enabled ?? DEFAULT_SETTINGS.face_enabled,
        face_threshold: settings?.face_threshold ?? DEFAULT_SETTINGS.face_threshold,
        selfie_required: settings?.selfie_required ?? DEFAULT_SETTINGS.selfie_required,
      },
    }))
  }, [profile])

  const loadTodayPunches = useCallback(async () => {
    if (!profile) return
    const { start, end } = isoLocalDayRange()

    const rows =
      (await safeSelect<any[]>(() =>
        attendanceDb
          .from('punches')
          .select('id,tenant_id,employee_id,punched_at,source,verification,evidence,created_at')
          .eq('tenant_id', profile.tenant_id)
          .eq('employee_id', profile.employee_id)
          .gte('punched_at', start)
          .lte('punched_at', end)
          .order('punched_at', { ascending: false })
      )) || []

    const punches = rows as AttendancePunch[]
    const lastPunch = punches[0] || null
    const last = lastAction(lastPunch)

    const clockStatus: ClockStatus =
      last === 'clock_in'
        ? 'clocked_in'
        : last === 'break_start'
        ? 'on_break'
        : 'idle'

    setState((prev) => ({
      ...prev,
      todayPunches: punches,
      lastPunch,
      clockStatus,
    }))
  }, [profile])

  const loadTodayAttempts = useCallback(async () => {
    if (!profile) return
    const { start, end } = isoLocalDayRange()

    const attempts =
      (await safeSelect<any[]>(() =>
        attendanceDb
          .from('punch_attempts')
          .select('id,tenant_id,employee_id,attempted_at,action,ok,step,reason,meta,created_at')
          .eq('tenant_id', profile.tenant_id)
          .eq('employee_id', profile.employee_id)
          .gte('attempted_at', start)
          .lte('attempted_at', end)
          .order('attempted_at', { ascending: false })
      )) || []

    setState((prev) => ({ ...prev, todayAttempts: attempts as PunchAttempt[] }))
  }, [profile])

  const recordAttempt = useCallback(
    async (
      ok: boolean,
      action: PunchAttempt['action'],
      step: PunchAttempt['step'],
      reason: string | null,
      meta: any
    ) => {
      if (!profile) return
      try {
        await attendanceDb.from('punch_attempts').insert({
          tenant_id: profile.tenant_id,
          employee_id: profile.employee_id,
          attempted_at: new Date().toISOString(),
          ok,
          action,
          step,
          reason,
          meta,
        })
      } catch {}
    },
    [profile]
  )

  const captureLocation = useCallback(async () => {
    try {
      const location = await getCurrentPosition()

      if (!isAccuracyAcceptable(location.accuracy, MAX_ACCURACY)) {
        setState((prev) => ({
          ...prev,
          location,
          geofenceStatus: 'error',
          error: `Precisión GPS insuficiente (${Math.round(location.accuracy)}m).`,
        }))
        return null
      }

      const lat0 = (profile as any)?.geofence_lat as number | null | undefined
      const lng0 = (profile as any)?.geofence_lng as number | null | undefined

      if (state.settings.geo_enabled && lat0 != null && lng0 != null) {
        const result = validateGeofence(
          location.latitude,
          location.longitude,
          lat0,
          lng0,
          state.settings.geo_max_m
        )

        setState((prev) => ({
          ...prev,
          location,
          geofenceStatus: result.status,
          geofenceDistance: result.distance,
          error: result.status === 'outside' ? `Fuera del área permitida (${result.distance}m).` : null,
        }))

        if (result.status === 'outside') return null
      } else {
        setState((prev) => ({
          ...prev,
          location,
          geofenceStatus: 'no_geofence',
          geofenceDistance: null,
        }))
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
      const previous = lastAction(state.lastPunch)
      if (action === 'clock_in' && previous === 'clock_in') return 'Ya existe una entrada abierta.'
      if (action === 'clock_out' && !['clock_in', 'break_start', 'break_end'].includes(previous)) {
        return 'No puedes marcar salida sin una entrada previa.'
      }
      if (action === 'break_start' && previous !== 'clock_in') {
        return 'No puedes salir a comer si no has marcado entrada.'
      }
      if (action === 'break_end' && previous !== 'break_start') {
        return 'No puedes regresar de comer si no estabas en descanso.'
      }
      return null
    },
    [state.lastPunch]
  )

  const verifyFace = useCallback(
    async (selfie: { bucket: string; path: string }): Promise<FaceResult> => {
      if (!state.settings.face_enabled) {
        return { match: true, score: null, threshold: null, provider: 'disabled' }
      }

      setState((prev) => ({ ...prev, biometricStatus: 'verifying', biometricResult: null }))

      const { data, error } = await supabase.functions.invoke(FACE_VERIFY_FUNCTION, {
        body: {
          tenant_id: profile?.tenant_id,
          employee_id: profile?.employee_id,
          selfie,
          threshold: state.settings.face_threshold,
        },
      })

      if (error) {
        throw new Error('No se pudo validar el rostro en backend.')
      }

      const result = data as FaceResult
      if (!result || typeof result.match !== 'boolean') {
        throw new Error('Respuesta inválida del servicio biométrico.')
      }

      setState((prev) => ({
        ...prev,
        biometricStatus: result.match ? 'ok' : 'failed',
        biometricResult: result,
      }))

      return result
    },
    [profile?.tenant_id, profile?.employee_id, state.settings.face_enabled, state.settings.face_threshold]
  )

  const uploadAndVerifySelfie = useCallback(
    async (blob: Blob | null | undefined) => {
      const required = state.settings.selfie_required || state.settings.face_enabled
      if (!required) return { selfie: null, face: null }

      if (!blob) throw new Error('Debe capturar una selfie para marcar.')

      setState((prev) => ({ ...prev, biometricStatus: 'uploading', biometricResult: null }))

      const path = `${todaySelfiePrefix(profile!.tenant_id, profile!.employee_id)}/${crypto.randomUUID()}.jpg`
      await uploadSelfie({ bucket: SELFIE_BUCKET, path, blob })
      const selfie = { bucket: SELFIE_BUCKET, path }
      const face = await verifyFace(selfie)
      return { selfie, face }
    },
    [profile, state.settings.face_enabled, state.settings.selfie_required, verifyFace]
  )

  const registerPunch = useCallback(
    async (
      action: PunchAttempt['action'],
      options?: { notes?: string; selfieBlob?: Blob | null }
    ) => {
      if (!profile) return false

      const sequenceError = validateSequence(action)
      if (sequenceError) {
        setState((prev) => ({ ...prev, error: sequenceError }))
        await recordAttempt(false, action, 'rule', sequenceError, { action })
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

      let selfie: { bucket: string; path: string } | null = null
      let face: FaceResult | null = null

      try {
        const facePayload = await uploadAndVerifySelfie(options?.selfieBlob)
        selfie = facePayload.selfie
        face = facePayload.face

        if (state.settings.face_enabled && face && face.match === false) {
          const reason = face.reason || 'Rostro no coincide.'
          await recordAttempt(false, action, 'face', reason, { selfie, face })
          setState((prev) => ({ ...prev, loading: false, error: `Validación biométrica fallida: ${reason}` }))
          return false
        }

        const location = state.settings.geo_enabled ? await captureLocation() : null
        if (state.settings.geo_enabled && !location) {
          await recordAttempt(false, action, 'gps', 'No se pudo validar GPS.', { selfie, face })
          setState((prev) => ({ ...prev, loading: false }))
          return false
        }

        const geo =
          location && state.settings.geo_enabled
            ? {
                lat: location.latitude,
                lng: location.longitude,
                accuracy_m: Math.round(location.accuracy),
                timestamp: location.timestamp,
                distance_m: state.geofenceDistance,
                in_range: state.geofenceStatus === 'inside' || state.geofenceStatus === 'no_geofence',
              }
            : null

        const verification = {
          provider: face?.provider ?? (state.settings.face_enabled ? 'unknown' : 'disabled'),
          match: face?.match ?? !state.settings.face_enabled,
          score: face?.score ?? null,
          threshold: face?.threshold ?? state.settings.face_threshold,
          reason: face?.reason ?? null,
        }

        const evidence = {
          action,
          notes: options?.notes ?? null,
          geo,
          selfie,
          face: verification,
          device: {
            device_id: deviceId,
            ua: navigator.userAgent,
            lang: navigator.language,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }

        const { data, error } = await attendanceDb.rpc('register_web_punch', {
          p_action: action,
          p_punched_at: new Date().toISOString(),
          p_evidence: evidence,
          p_verification: verification,
          p_serial_no: null,
        })

        if (error) {
          await recordAttempt(false, action, 'insert', error.message, { selfie, face, geo })
          setState((prev) => ({ ...prev, loading: false, error: error.message }))
          return false
        }

        await recordAttempt(true, action, 'insert', null, { punch_id: data })
        setState((prev) => ({
          ...prev,
          loading: false,
          success: 'Marcación registrada correctamente.',
          biometricStatus: 'idle',
        }))

        await loadTodayPunches()
        await loadTodayAttempts()
        return true
      } catch (err: any) {
        const message = err?.message || 'No se pudo completar la marcación.'
        await recordAttempt(false, action, 'unknown', message, { selfie, face })
        setState((prev) => ({ ...prev, loading: false, error: message }))
        return false
      }
    },
    [
      captureLocation,
      deviceId,
      loadTodayAttempts,
      loadTodayPunches,
      profile,
      recordAttempt,
      state.geofenceDistance,
      state.geofenceStatus,
      state.settings.face_enabled,
      state.settings.face_threshold,
      state.settings.geo_enabled,
      uploadAndVerifySelfie,
      validateSequence,
    ]
  )

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    void loadTodayPunches()
    void loadTodayAttempts()
  }, [loadTodayAttempts, loadTodayPunches])

  return {
    ...state,
    deviceId,
    clockIn: (notes?: string, selfieBlob?: Blob | null) =>
      registerPunch('clock_in', { notes, selfieBlob }),
    breakStart: (selfieBlob?: Blob | null) =>
      registerPunch('break_start', { selfieBlob }),
    breakEnd: (selfieBlob?: Blob | null) =>
      registerPunch('break_end', { selfieBlob }),
    clockOut: (notes?: string, selfieBlob?: Blob | null) =>
      registerPunch('clock_out', { notes, selfieBlob }),
    refreshLocation: captureLocation,
    clearMessages: () =>
      setState((prev) => ({ ...prev, error: null, success: null })),
  }
}
