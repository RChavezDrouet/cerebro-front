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

    // Estado UX: break_end vuelve a clocked_in (el empleado regresó del descanso → siguiente acción es clock_out)
    const a = lastAction(last)
    const clockStatus: ClockStatus =
      a === 'clock_in'    || a === 'break_end' ? 'clocked_in'
      : a === 'break_start'                    ? 'on_break'
      :                                          'idle'

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

      const punched_at = new Date().toISOString()
      const novelties: Array<{ step: string; ok: boolean; reason: string }> = []

      // ── 1. Selfie + Verificación facial ──────────────────────────────────────
      // NO bloquea la marcación. Si falla, queda como novedad.
      let selfie: { bucket: string; path: string } | null = null
      let face: FaceResult | null = null
      let faceVerified = false

      if (state.settings.selfie_required || state.settings.face_enabled) {
        try {
          const r = await uploadAndVerifySelfie(opts?.selfieBlob)
          selfie = r.selfie
          face = r.face

          if (state.settings.face_enabled && face && face.match === false) {
            // ── Rostro no coincide: pausar flujo y retornar al componente ────────
            // El componente mostrará modal con opciones:
            //   [Reintentar]  →  vuelve a capturar selfie
            //   [Marcar de todas formas]  →  llama registerPunch con forceWithFaceWarning=true
            setState((prev) => ({ ...prev, loading: false, biometricStatus: 'failed' }))
            return 'face_rejected' as const
          } else {
            faceVerified = face?.match === true
          }
        } catch (e: any) {
          novelties.push({
            step: 'face',
            ok: false,
            reason: e?.message || 'Error en captura/verificación biométrica',
          })
        }
      }

      // ── 2. GPS + Geocerca ─────────────────────────────────────────────────────
      // NO bloquea la marcación. Si falla, queda como novedad.
      let loc: GeoLocation | null = null
      let geoEvidence: any = null
      let geofenceOk: boolean | null = null
      let distanceM: number | null = null

      if (state.settings.geo_enabled) {
        try {
          loc = await getCurrentPosition()

          if (!isAccuracyAcceptable(loc.accuracy, MAX_ACCURACY)) {
            novelties.push({
              step: 'gps',
              ok: false,
              reason: `Precisión GPS insuficiente: ${Math.round(loc.accuracy)}m (máximo permitido: ${MAX_ACCURACY}m)`,
            })
          }

          const lat0 = (profile as any).geofence_lat as number | null | undefined
          const lng0 = (profile as any).geofence_lng as number | null | undefined

          if (lat0 != null && lng0 != null) {
            const { status, distance } = validateGeofence(
              loc.latitude, loc.longitude, lat0, lng0, state.settings.geo_max_m
            )
            geofenceOk = status === 'inside'
            distanceM  = distance

            if (!geofenceOk) {
              novelties.push({
                step: 'gps',
                ok: false,
                reason: `Fuera del área de trabajo: ${distanceM}m del centro (radio permitido: ${state.settings.geo_max_m}m)`,
              })
            }
          }
          // null = sin geocerca configurada (no es novedad)

          geoEvidence = {
            lat:        loc.latitude,
            lng:        loc.longitude,
            accuracy_m: Math.round(loc.accuracy),
            in_range:   geofenceOk,
            distance_m: distanceM,
          }

          // Actualizar estado visual de geocerca
          setState((prev) => ({
            ...prev,
            location: loc,
            geofenceStatus: geofenceOk === false ? 'outside' : geofenceOk === true ? 'inside' : 'no_geofence',
            geofenceDistance: distanceM,
          }))
        } catch (err: any) {
          novelties.push({
            step: 'gps',
            ok: false,
            reason: `GPS no disponible: ${err?.message || 'Error desconocido'}`,
          })
        }
      }

      // ── 3. Construir evidence ─────────────────────────────────────────────────
      const device = {
        device_id: deviceId,
        ua:         navigator.userAgent,
        tz:         Intl.DateTimeFormat().resolvedOptions().timeZone,
      }

      const evidence: any = {
        action,
        face: face ?? {
          provider:  state.settings.face_enabled ? 'unknown' : 'disabled',
          match:     state.settings.face_enabled ? null : true,
          score:     null,
          threshold: state.settings.face_enabled ? state.settings.face_threshold : null,
          reason:    null,
        },
        geo:      geoEvidence,
        selfie,
        notes:    opts?.notes || null,
        device,
        novelties,
      }

      // ── 4. Insert attendance.punches (SIEMPRE) ────────────────────────────────
      const payload: any = {
        tenant_id:    profile.tenant_id,
        employee_id:  profile.employee_id,
        punched_at,
        source:       'web',
        serial_no:    null,
        // status omitido → la BD usa su DEFAULT (restricción 428C9)
        verification: getWebPunchVerificationDefault(),
        evidence,
      }

      let punchId: string | null = null

      let { data: punchData, error: punchError } = await attendanceDb
        .from('punches')
        .insert(payload)
        .select('id')
        .single()

      // Fallback: evidence como TEXT
      if (punchError && String(punchError.message || '').toLowerCase().includes('evidence')) {
        const retryPayload = { ...payload, evidence: JSON.stringify(evidence) }
        ;({ data: punchData, error: punchError } = await attendanceDb
          .from('punches').insert(retryPayload).select('id').single())
      }

      // Fallback: columnas opcionales (verification / serial_no / serial)
      if (punchError && String(punchError.code || '') === '42703') {
        const msg = String(punchError.message || '').toLowerCase()
        const { verification, serial_no, serial, ...base } = payload
        if (msg.includes('verification')) {
          ;({ data: punchData, error: punchError } = await attendanceDb
            .from('punches').insert(base).select('id').single())
        } else if (msg.includes('serial_no')) {
          ;({ data: punchData, error: punchError } = await attendanceDb
            .from('punches').insert({ ...base, serial: null }).select('id').single())
        } else if (msg.includes('serial')) {
          ;({ data: punchData, error: punchError } = await attendanceDb
            .from('punches').insert({ ...base, serial_no: null }).select('id').single())
        }
      }

      if (punchError) {
        const reason = `No se pudo registrar: ${punchError.message} (${punchError.code})`
        await recordAttemptBestEffort({
          ok: false, step: 'insert', action, reason,
          meta: { action, selfie, face, geo: geoEvidence, err: punchError },
        })
        setState((prev) => ({ ...prev, loading: false, error: reason }))
        return false
      }

      punchId = (punchData as any)?.id ?? null

      // ── 5a. Insert attendance.punch_evidence (best-effort) ───────────────────
      if (punchId) {
        try {
          const { data: evData, error: evError } = await attendanceDb
            .from('punch_evidence')
            .insert({
              punch_id:            punchId,
              tenant_id:           profile.tenant_id,
              employee_id:         profile.employee_id,
              selfie_bucket:       selfie?.bucket ?? null,
              selfie_path:         selfie?.path ?? null,
              selfie_uploaded_at:  selfie ? new Date().toISOString() : null,
              latitude:            loc?.latitude ?? null,
              longitude:           loc?.longitude ?? null,
              gps_accuracy_m:      loc ? Math.round(loc.accuracy) : null,
              distance_to_fence_m: distanceM ? Math.round(distanceM) : null,
              geofence_ok:         geofenceOk,
              device_info:         device,
              verification_status: 'pending',
            })
            .select('id')
            .single()
          if (evError) {
            console.warn('[ATTENDANCE] punch_evidence insert error (best-effort):', evError.message)
          } else {
            console.info('[ATTENDANCE] punch_evidence insertado:', evData?.id)
          }
        } catch (e) {
          console.warn('[ATTENDANCE] punch_evidence insert excepción (best-effort):', e)
        }
      }

      // ── 5b. Insert attendance.attendance_records (best-effort) ────────────────
      try {
        console.log('[ATTENDANCE] insertando attendance_record...')
        const { error: arError } = await attendanceDb.from('attendance_records').insert({
          employee_id:        profile.employee_id,
          tenant_id:          profile.tenant_id,
          timestamp:          punched_at,
          type:               action,
          face_verified:      faceVerified,
          geofence_ok:        geofenceOk,
          latitude:           loc?.latitude    ?? null,
          longitude:          loc?.longitude   ?? null,
          gps_accuracy:       loc ? Math.round(loc.accuracy) : null,
          distance_meters:    distanceM,
          photo_capture_path: selfie?.path     ?? null,
          device_info:        device,
        })
        console.log('[ATTENDANCE] attendance_record resultado:', arError)
      } catch (e) {
        console.warn('[ATTENDANCE] attendance_records insert excepción (best-effort):', e)
      }

      // ── 6. Registrar novedades en punch_attempts ──────────────────────────────
      for (const nov of novelties) {
        await recordAttemptBestEffort({
          ok:     false,
          step:   nov.step as PunchAttempt['step'],
          action,
          reason: nov.reason,
          meta:   { punch_id: punchId, face, geo: geoEvidence },
        })
      }
      // Siempre registrar el insert exitoso
      await recordAttemptBestEffort({
        ok:     true,
        step:   'insert',
        action,
        reason: null,
        meta:   { punch_id: punchId },
      })

      // ── 7. Mensaje UX ─────────────────────────────────────────────────────────
      const successMsg = novelties.length > 0
        ? `Marcación registrada con ${novelties.length} novedad${novelties.length > 1 ? 'es' : ''}.`
        : 'Marcación registrada.'

      setState((prev) => ({
        ...prev,
        loading: false,
        success: successMsg,
        biometricStatus: 'idle',
        biometricResult: null,
      }))
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
      state.settings.selfie_required,
      deviceId,
      loadTodayPunches,
      loadTodayAttempts,
      uploadAndVerifySelfie,
      recordAttemptBestEffort,
      validateSequence,
    ]
  )

  // === registerPunchForced — marcar aunque el rostro no coincida ===============
  // Llamado desde ClockInPage cuando el empleado elige "Marcar de todas formas"
  const registerPunchForced = useCallback(
    async (
      action: PunchAttempt['action'],
      opts?: { notes?: string; selfieBlob?: Blob | null }
    ) => {
      if (!profile) {
        setState((prev) => ({ ...prev, error: 'No hay perfil cargado.' }))
        return false
      }

      setState((prev) => ({ ...prev, loading: true, error: null, success: null, biometricStatus: 'uploading', biometricResult: null }))

      const punched_at = new Date().toISOString()
      const novelties: Array<{ step: string; ok: boolean; reason: string }> = []

      let selfie: { bucket: string; path: string } | null = null
      let face: FaceResult | null = null

      if (opts?.selfieBlob) {
        try {
          const prefix = todayPathPrefix(profile.tenant_id, profile.employee_id)
          const path = `${prefix}/${crypto.randomUUID()}.jpg`
          await uploadSelfie({ bucket: SELFIE_BUCKET as any, path, blob: opts.selfieBlob })
          selfie = { bucket: SELFIE_BUCKET, path }
          face = { match: false, score: null, threshold: null, provider: 'forced_by_employee', reason: 'Marcado forzado tras rechazo facial' }
          novelties.push({ step: 'face', ok: false, reason: 'Rostro no coincide — marcado forzado por empleado (requiere revision del supervisor)' })
        } catch (e: any) {
          novelties.push({ step: 'face', ok: false, reason: `Error subiendo selfie: ${e?.message}` })
        }
      } else {
        novelties.push({ step: 'face', ok: false, reason: 'Sin selfie — marcado forzado por empleado' })
      }

      let loc: GeoLocation | null = null
      let geoEvidence: any = null
      let geofenceOk: boolean | null = null
      let distanceM: number | null = null

      if (state.settings.geo_enabled) {
        try {
          loc = await getCurrentPosition()
          const lat0 = (profile as any).geofence_lat as number | null | undefined
          const lng0 = (profile as any).geofence_lng as number | null | undefined
          if (lat0 != null && lng0 != null) {
            const { status, distance } = validateGeofence(loc.latitude, loc.longitude, lat0, lng0, state.settings.geo_max_m)
            geofenceOk = status === 'inside'
            distanceM = distance
          }
          geoEvidence = { lat: loc.latitude, lng: loc.longitude, accuracy_m: Math.round(loc.accuracy), in_range: geofenceOk, distance_m: distanceM }
          setState((prev) => ({ ...prev, location: loc, geofenceStatus: geofenceOk === false ? 'outside' : geofenceOk === true ? 'inside' : 'no_geofence', geofenceDistance: distanceM }))
        } catch (err: any) {
          novelties.push({ step: 'gps', ok: false, reason: `GPS no disponible: ${err?.message}` })
        }
      }

      const device = { device_id: deviceId, ua: navigator.userAgent, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
      const evidence: any = {
        action,
        face: face ?? { provider: 'forced_by_employee', match: false, score: null, threshold: null, reason: 'Marcado forzado' },
        geo: geoEvidence, selfie, notes: opts?.notes || null, device, novelties, forced: true,
      }

      const payload: any = {
        tenant_id: profile.tenant_id, employee_id: profile.employee_id,
        punched_at, source: 'web', serial_no: null,
        verification: getWebPunchVerificationDefault(), evidence,
      }

      let punchId: string | null = null
      let { data: punchData, error: punchError } = await attendanceDb.from('punches').insert(payload).select('id').single()

      if (punchError && String(punchError.message || '').toLowerCase().includes('evidence')) {
        ;({ data: punchData, error: punchError } = await attendanceDb.from('punches').insert({ ...payload, evidence: JSON.stringify(evidence) }).select('id').single())
      }

      if (punchError) {
        setState((prev) => ({ ...prev, loading: false, error: `No se pudo registrar: ${punchError!.message}` }))
        return false
      }

      punchId = (punchData as any)?.id ?? null

      if (punchId && selfie) {
        try {
          await attendanceDb.from('punch_evidence').insert({
            punch_id: punchId, tenant_id: profile.tenant_id, employee_id: profile.employee_id,
            selfie_bucket: selfie.bucket, selfie_path: selfie.path,
            selfie_uploaded_at: new Date().toISOString(),
            latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null,
            gps_accuracy_m: loc ? Math.round(loc.accuracy) : null,
            distance_to_fence_m: distanceM ? Math.round(distanceM) : null,
            geofence_ok: geofenceOk, device_info: device,
            verification_status: 'rejected',
            verification_notes: 'Marcado forzado por empleado — requiere revision del supervisor',
            verified_at: new Date().toISOString(),
          }).select('id').single()
        } catch (e) { console.warn('[ATTENDANCE] punch_evidence forced insert error:', e) }
      }

      for (const nov of novelties) {
        await recordAttemptBestEffort({ ok: false, step: nov.step as PunchAttempt['step'], action, reason: nov.reason, meta: { punch_id: punchId } })
      }
      await recordAttemptBestEffort({ ok: true, step: 'insert', action, reason: 'Forzado por empleado tras rechazo facial', meta: { punch_id: punchId } })

      setState((prev) => ({ ...prev, loading: false, success: 'Marcacion registrada como novedad. El supervisor revisara la fotografia.', biometricStatus: 'idle', biometricResult: null }))
      await loadTodayPunches()
      await loadTodayAttempts()
      return true
    },
    [profile, state.settings.geo_enabled, state.settings.geo_max_m, deviceId, loadTodayPunches, loadTodayAttempts, recordAttemptBestEffort]
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
    registerPunchForced,
    // ui helpers
    clearMessages: () => setState((p) => ({ ...p, error: null, success: null })),
    resetBiometric: () => setState((p) => ({ ...p, biometricStatus: 'idle', biometricResult: null })),
  }
}

