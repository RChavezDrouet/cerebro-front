// HRCloud PWA — Nova UI Clock In Page
// v2.1 — Control robusto ENTRADA/SALIDA + reset manual + iOS/Android safe
import React, { useState, useEffect, useCallback } from 'react'
import type {
  UserProfile,
  ClockStatus,
  GeofenceStatus,
  AttendancePunch,
  GeoLocation,
} from '../types'
import { formatCoordinates, formatDistance } from '../lib/geolocation'
import { FaceCaptureModal } from '../components/FaceCaptureModal'
import type { WebSettings } from '../hooks/useAttendance'

interface ClockInPageProps {
  profile: UserProfile
  settings: WebSettings
  clockStatus: ClockStatus
  lastPunch: AttendancePunch | null
  todayPunches: AttendancePunch[]
  todayAttempts?: any[]
  location: GeoLocation | null
  geofenceStatus: GeofenceStatus
  geofenceDistance: number | null
  loading: boolean
  error: string | null
  success: string | null
  onClockIn: (notes?: string, selfieBlob?: Blob | null) => Promise<boolean | 'face_rejected'>
  onClockOut: (notes?: string, selfieBlob?: Blob | null) => Promise<boolean | 'face_rejected'>
  onBreakStart: (selfieBlob?: Blob | null) => Promise<boolean | 'face_rejected'>
  onBreakEnd: (selfieBlob?: Blob | null) => Promise<boolean | 'face_rejected'>
  onClockInForced: (notes?: string, selfieBlob?: Blob | null) => Promise<boolean>
  onClockOutForced: (notes?: string, selfieBlob?: Blob | null) => Promise<boolean>
  onBreakStartForced: (selfieBlob?: Blob | null) => Promise<boolean>
  onBreakEndForced: (selfieBlob?: Blob | null) => Promise<boolean>
  onRefreshLocation: () => Promise<GeoLocation | null | undefined>
  onClearMessages: () => void
}

// ─────────────────────────────────────────────────────
// Helper: detecta la acción lógica del último punch
// ─────────────────────────────────────────────────────
function getPunchAction(punch: AttendancePunch | null): string {
  if (!punch) return ''
  // evidence.action es la fuente canónica para marcaciones web
  const evAction = (punch as any)?.evidence?.action
  if (evAction) return String(evAction)
  return ''
}

// ─────────────────────────────────────────────────────
// Clave de localStorage para el estado override
// (solo para reset manual "volver a ENTRADA")
// ─────────────────────────────────────────────────────
const RESET_KEY_PREFIX = 'hrcloud_pwa_status_reset_'
function getResetKey(tenantId: string, employeeId: string, date: string) {
  return `${RESET_KEY_PREFIX}${tenantId}_${employeeId}_${date}`
}
function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

const ClockInPage: React.FC<ClockInPageProps> = ({
  profile,
  settings,
  clockStatus,
  lastPunch,
  todayPunches,
  todayAttempts = [],
  location,
  geofenceStatus,
  geofenceDistance,
  loading,
  error,
  success,
  onClockIn,
  onClockOut,
  onBreakStart,
  onBreakEnd,
  onClockInForced,
  onClockOutForced,
  onBreakStartForced,
  onBreakEndForced,
  onRefreshLocation,
  onClearMessages,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showHistory, setShowHistory] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [showFaceModal, setShowFaceModal] = useState(false)
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
  const [faceReady, setFaceReady] = useState(false)
  const [pendingAction, setPendingAction] = useState<
    'clock_in' | 'clock_out' | 'break_start' | 'break_end' | null
  >(null)
  // Modal de advertencia facial — cuando el rostro no coincide
  const [showFaceWarning, setShowFaceWarning] = useState(false)
  const [faceWarningAction, setFaceWarningAction] = useState<
    'clock_in' | 'clock_out' | 'break_start' | 'break_end' | null
  >(null)
  const [faceWarningBlob, setFaceWarningBlob] = useState<Blob | null>(null)
  // Override local: cuando el operador fuerza "volver a ENTRADA"
  const [statusOverride, setStatusOverride] = useState<'idle' | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const requiresFace = Boolean(settings?.face_enabled)

  // ── Reloj ──────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Limpiar mensaje de éxito ───────────────────────
  useEffect(() => {
    if (success) {
      const t = setTimeout(onClearMessages, 4000)
      return () => clearTimeout(t)
    }
  }, [success, onClearMessages])

  // ── Restaurar override desde localStorage ─────────
  useEffect(() => {
    const key = getResetKey(profile.tenant_id, profile.employee_id, getTodayStr())
    const stored = localStorage.getItem(key)
    if (stored === 'idle') setStatusOverride('idle')
    else setStatusOverride(null)
  }, [profile.tenant_id, profile.employee_id])

  // ── Limpiar override cuando llega un punch nuevo ──
  useEffect(() => {
    if (todayPunches.length > 0 && statusOverride === 'idle') {
      // Si ya hay un punch hoy el override deja de tener sentido
      const key = getResetKey(profile.tenant_id, profile.employee_id, getTodayStr())
      localStorage.removeItem(key)
      setStatusOverride(null)
    }
  }, [todayPunches.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Estado efectivo del botón ──────────────────────
  // Prioridad: 1) override manual  2) clockStatus del hook
  const effectiveStatus: ClockStatus =
    statusOverride === 'idle' ? 'idle' : clockStatus

  // ── Formatos ───────────────────────────────────────
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

  const formatDate = (d: Date) =>
    d.toLocaleDateString('es-EC', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

  const formatPunchTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

  // ── GPS info ───────────────────────────────────────
  const getGeoInfo = () => {
    switch (geofenceStatus) {
      case 'inside':
        return {
          label: `En área · ${formatDistance(geofenceDistance || 0)}`,
          color: 'var(--nova-green)',
          dot: '#00ffa3',
        }
      case 'outside':
        return {
          label: `Fuera del área · ${formatDistance(geofenceDistance || 0)}`,
          color: 'var(--nova-red)',
          dot: '#ff4560',
        }
      case 'checking':
        return { label: 'Verificando GPS...', color: 'var(--nova-cyan)', dot: 'var(--nova-cyan)' }
      case 'no_geofence':
        return { label: 'Sin geocerca · GPS activo', color: 'var(--nova-cyan)', dot: 'var(--nova-cyan)' }
      case 'error':
        return { label: 'Error de ubicación', color: 'var(--nova-amber)', dot: 'var(--nova-amber)' }
      default:
        return { label: 'Esperando GPS...', color: 'var(--nova-muted)', dot: 'gray' }
    }
  }

  const getPunchLabel = (action: string) =>
    ({
      clock_in: 'Entrada',
      clock_out: 'Salida',
      break_start: 'Descanso',
      break_end: 'Fin Desc.',
    }[action] || action)

  const getPunchColor = (action: string) =>
    ({
      clock_in: 'var(--nova-green)',
      clock_out: 'var(--nova-red)',
      break_start: 'var(--nova-amber)',
      break_end: 'var(--nova-cyan)',
    }[action] || 'var(--nova-muted)')

  // ── Configuración del botón principal ─────────────
  const getButtonConfig = () => {
    if (effectiveStatus === 'clocked_in') {
      return { label: 'SALIDA', sub: 'Clock Out', cls: 'exit', wrapCls: 'is-out' }
    }
    if (effectiveStatus === 'on_break') {
      return { label: 'REGRESAR', sub: 'End Break', cls: 'break', wrapCls: '' }
    }
    // idle o loading inicial
    return { label: 'ENTRADA', sub: 'Clock In', cls: 'entry', wrapCls: 'is-clocked-in' }
  }

  const btnCfg = getButtonConfig()

  // ── Reset manual "volver a ENTRADA" ───────────────
  // Usar cuando el empleado no marcó salida ayer/antes
  // y el estado quedó trabado en "SALIDA".
  const handleResetToEntry = useCallback(() => {
    const key = getResetKey(profile.tenant_id, profile.employee_id, getTodayStr())
    localStorage.setItem(key, 'idle')
    setStatusOverride('idle')
    setShowResetConfirm(false)
    setSelfieBlob(null)
    setFaceReady(false)
  }, [profile.tenant_id, profile.employee_id])

  // ── Captura facial ─────────────────────────────────
  const afterPunchResetEvidence = () => {
    setFaceReady(false)
    setSelfieBlob(null)
  }

  const handleSelfieCaptured = async (blob: Blob) => {
    setSelfieBlob(blob)
    setFaceReady(true)
    if (pendingAction) {
      const action = pendingAction
      setPendingAction(null)
      await performAction(action, blob)
    }
  }

  const ensureFaceIfRequired = async (
    actionToRun?: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  ): Promise<boolean> => {
    if (!requiresFace) return true
    if (actionToRun) {
      setPendingAction(actionToRun)
      setShowFaceModal(true)
      return false
    }
    setPendingAction(null)
    setShowFaceModal(true)
    return false
  }

  // ── Ejecutar acción ────────────────────────────────
  const performAction = async (
    action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end',
    blob: Blob | null
  ) => {
    let result: boolean | 'face_rejected' = false
    if (action === 'clock_in') result = await onClockIn(notes || undefined, blob)
    else if (action === 'clock_out') result = await onClockOut(notes || undefined, blob)
    else if (action === 'break_start') result = await onBreakStart(blob)
    else if (action === 'break_end') result = await onBreakEnd(blob)

    // Rostro no coincide — mostrar modal de advertencia
    if (result === 'face_rejected') {
      setFaceWarningAction(action)
      setFaceWarningBlob(blob)
      setShowFaceWarning(true)
      return false
    }

    if (result === true) {
      afterPunchResetEvidence()
      if (action === 'clock_in' && statusOverride === 'idle') {
        const key = getResetKey(profile.tenant_id, profile.employee_id, getTodayStr())
        localStorage.removeItem(key)
        setStatusOverride(null)
      }
    }
    return result === true
  }

  // ── Acción principal (botón grande) ───────────────
  const handleMainAction = async () => {
    let action: 'clock_in' | 'clock_out' | 'break_end'
    if (effectiveStatus === 'idle') action = 'clock_in'
    else if (effectiveStatus === 'clocked_in') action = 'clock_out'
    else action = 'break_end'

    if (!(await ensureFaceIfRequired(action))) return
    await performAction(action, selfieBlob)
  }

  // ── Marcar de todas formas tras rechazo facial ─────────────────
  const handleForceAction = async () => {
    if (!faceWarningAction) return
    setShowFaceWarning(false)
    const action = faceWarningAction
    const blob = faceWarningBlob
    setFaceWarningAction(null)
    setFaceWarningBlob(null)

    let ok = false
    if (action === 'clock_in') ok = await onClockInForced(notes || undefined, blob)
    else if (action === 'clock_out') ok = await onClockOutForced(notes || undefined, blob)
    else if (action === 'break_start') ok = await onBreakStartForced(blob)
    else if (action === 'break_end') ok = await onBreakEndForced(blob)

    if (ok) {
      afterPunchResetEvidence()
      if (action === 'clock_in' && statusOverride === 'idle') {
        const key = getResetKey(profile.tenant_id, profile.employee_id, getTodayStr())
        localStorage.removeItem(key)
        setStatusOverride(null)
      }
    }
  }

  const canPunch = !loading && geofenceStatus !== 'error'
  const geoInfo = getGeoInfo()

  // ── ¿Mostrar botón de reset? ──────────────────────
  // Solo cuando el estado efectivo es SALIDA (clocked_in)
  // y el override NO está activo todavía.
  const showResetButton = effectiveStatus === 'clocked_in' && statusOverride === null

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <>
      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '0 16px 100px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Toasts */}
        {success && (
          <div className="nova-toast success" style={{ marginTop: 12 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {success}
          </div>
        )}
        {error && (
          <div className="nova-toast error" style={{ marginTop: 12 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Greeting */}
        <div className="anim-fade-up" style={{ paddingTop: 20, paddingBottom: 4 }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--nova-cyan)',
              fontFamily: 'JetBrains Mono',
              letterSpacing: '0.1em',
              marginBottom: 2,
              opacity: 0.8,
            }}
          >
            {profile.tenant_name}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--nova-text)', margin: 0 }}>
            Hola, {profile.full_name.split(' ')[0]} 👋
          </h1>
        </div>

        {/* Big Clock */}
        <div
          className="anim-fade-up"
          style={{ textAlign: 'center', padding: '20px 0 8px', animationDelay: '50ms' }}
        >
          <div
            style={{
              fontSize: 58,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono',
              background: 'linear-gradient(135deg, #00d4ff, #ffffff, #00ffa3)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {formatTime(currentTime)}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--nova-muted)',
              marginTop: 6,
              textTransform: 'capitalize',
            }}
          >
            {formatDate(currentTime)}
          </div>
        </div>

        {/* GPS Status */}
        <div
          className="nova-card anim-fade-up"
          style={{ padding: '12px 16px', marginBottom: 16, animationDelay: '80ms' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: geoInfo.dot,
                  boxShadow: `0 0 8px ${geoInfo.dot}`,
                  flexShrink: 0,
                  transition: 'background 0.3s',
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: geoInfo.color,
                    transition: 'color 0.3s',
                  }}
                >
                  {geoInfo.label}
                </div>
                {location && (
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'JetBrains Mono',
                      color: 'var(--nova-muted)',
                      marginTop: 2,
                    }}
                  >
                    {formatCoordinates(location.latitude, location.longitude)} · ±
                    {Math.round(location.accuracy)}m
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: navigator.onLine ? 1 : 0.3,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--nova-cyan)"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>
              <button
                onClick={() => onRefreshLocation()}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--nova-border)',
                  color: 'var(--nova-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                title="Actualizar GPS"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CLOCK BUTTON */}
        <div
          className="anim-fade-up"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 0 8px',
            animationDelay: '120ms',
          }}
        >
          <div className={`clock-btn-wrap ${btnCfg.wrapCls}`}>
            <button
              className={`clock-btn ${btnCfg.cls}`}
              onClick={handleMainAction}
              disabled={!canPunch || clockStatus === 'loading'}
            >
              {clockStatus === 'loading' ? (
                <svg
                  style={{ animation: 'spin 1s linear infinite' }}
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              ) : btnCfg.label === 'ENTRADA' ? (
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              ) : btnCfg.label === 'SALIDA' ? (
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              ) : (
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                  <line x1="6" y1="1" x2="6" y2="4" />
                  <line x1="10" y1="1" x2="10" y2="4" />
                  <line x1="14" y1="1" x2="14" y2="4" />
                </svg>
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  marginTop: clockStatus === 'loading' ? 8 : 4,
                }}
              >
                {clockStatus === 'loading' ? 'REGISTRANDO' : btnCfg.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'JetBrains Mono',
                  opacity: 0.7,
                  letterSpacing: '0.12em',
                }}
              >
                {clockStatus === 'loading' ? '...' : btnCfg.sub}
              </span>
            </button>
          </div>

          {/* Break button */}
          {effectiveStatus === 'clocked_in' && (
            <button
              onClick={async () => {
                if (!(await ensureFaceIfRequired('break_start'))) return
                const ok = await onBreakStart(selfieBlob)
                if (ok) afterPunchResetEvidence()
              }}
              disabled={!canPunch}
              className="btn-break"
              style={{ marginTop: 20 }}
            >
              ☕ Iniciar Descanso
            </button>
          )}
        </div>

        {/* ── RESET MANUAL: volver a ENTRADA ────────────── */}
        {showResetButton && (
          <div
            className="anim-fade-up"
            style={{ marginBottom: 12, animationDelay: '140ms' }}
          >
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,165,0,0.06)',
                  border: '1px solid rgba(255,165,0,0.25)',
                  color: 'var(--nova-amber)',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                ¿No marcaste salida? Volver a ENTRADA
              </button>
            ) : (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,165,0,0.08)',
                  border: '1px solid rgba(255,165,0,0.35)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--nova-text)',
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  ¿Confirmas que no marcaste salida y deseas registrar una nueva ENTRADA?
                </div>
                <div style={{ fontSize: 11, color: 'var(--nova-muted)', marginBottom: 12 }}>
                  Esto solo cambia el botón en esta sesión. El historial de marcaciones no se
                  modifica.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleResetToEntry}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 10,
                      background: 'rgba(255,165,0,0.15)',
                      border: '1px solid rgba(255,165,0,0.4)',
                      color: 'var(--nova-amber)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Sí, volver a ENTRADA
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--nova-border)',
                      color: 'var(--nova-muted)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Biometric Panel */}
        {false && requiresFace && (
          <div
            className="nova-card anim-fade-up"
            style={{
              padding: '14px 16px',
              marginBottom: 16,
              animationDelay: '150ms',
              borderLeft: '3px solid var(--nova-cyan)',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(0,212,255,0.08)',
                    border: '1px solid rgba(0,212,255,0.20)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  🤳
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)' }}>
                    Validación biométrica
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: faceReady ? 'var(--nova-green)' : 'var(--nova-amber)',
                      marginTop: 2,
                    }}
                  >
                    {faceReady
                      ? '✓ Selfie capturada — listo para marcar'
                      : '⚠ Se requiere selfie'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setPendingAction(null)
                  setShowFaceModal(true)
                }}
                className="btn-nova-ghost"
                style={{ fontSize: 12, padding: '8px 14px' }}
              >
                {faceReady ? 'Re-capturar' : 'Capturar'}
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="anim-fade-up" style={{ marginBottom: 16, animationDelay: '180ms' }}>
          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--nova-muted)',
              fontSize: 12,
              fontFamily: 'JetBrains Mono',
              letterSpacing: '0.06em',
              padding: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {showNotes ? 'OCULTAR NOTA' : 'AGREGAR NOTA'}
          </button>
          {showNotes && (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Trabajo desde casa, reunión con cliente..."
                className="nova-input"
                style={{ marginTop: 10, height: 80, resize: 'none', fontSize: 13 }}
                maxLength={255}
              />
              {notes.trim().length > 0 && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--nova-green)',
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'JetBrains Mono',
                }}>
                  ✓ Nota incluida — se enviará con la marcación
                </div>
              )}
            </>
          )}
        </div>

        {/* Marcaciones del día */}
        <div className="nova-card anim-fade-up" style={{ animationDelay: '220ms' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--nova-text)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="live-dot" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Marcaciones de Hoy</span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--nova-muted)',
                }}
              >
                (OK: {todayPunches.length} · Fallidas: {todayAttempts.length})
              </span>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--nova-muted)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {showHistory ? (
                <polyline points="18 15 12 9 6 15" />
              ) : (
                <polyline points="6 9 12 15 18 9" />
              )}
            </svg>
          </button>

          {showHistory && (
            <div style={{ padding: '0 16px 16px' }}>
              {/* OK */}
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 10,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--nova-muted)',
                }}
              >
                OK
              </div>
              {todayPunches.length === 0 ? (
                <div
                  style={{
                    padding: '10px 0 18px',
                    textAlign: 'center',
                    color: 'var(--nova-muted)',
                    fontSize: 13,
                  }}
                >
                  Sin marcaciones OK hoy
                </div>
              ) : (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}
                >
                  {todayPunches.map((punch) => {
                    const action = getPunchAction(punch) || 'punch'
                    const color = getPunchColor(action)
                    const inRange = (punch as any).evidence?.geo?.in_range
                    return (
                      <div
                        key={punch.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--nova-border)',
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: color,
                            boxShadow: `0 0 6px ${color}`,
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--nova-text)',
                          }}
                        >
                          {getPunchLabel(action)}
                          {inRange === false && (
                            <span
                              style={{
                                fontSize: 10,
                                color: 'var(--nova-red)',
                                marginLeft: 8,
                              }}
                            >
                              Fuera de área
                            </span>
                          )}
                          {inRange === true && (
                            <span
                              style={{
                                fontSize: 10,
                                color: 'var(--nova-green)',
                                marginLeft: 8,
                              }}
                            >
                              GPS ✓
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontFamily: 'JetBrains Mono',
                            color: 'var(--nova-text)',
                            fontWeight: 600,
                          }}
                        >
                          {formatPunchTime(punch.punched_at)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Fallidas */}
              <div
                style={{
                  marginTop: 6,
                  marginBottom: 10,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--nova-muted)',
                }}
              >
                FALLIDAS
              </div>
              {todayAttempts.length === 0 ? (
                <div
                  style={{
                    padding: '10px 0',
                    textAlign: 'center',
                    color: 'var(--nova-muted)',
                    fontSize: 13,
                  }}
                >
                  Sin intentos fallidos
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayAttempts.map((a: any) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: 'rgba(255,69,96,0.06)',
                        border: '1px solid rgba(255,69,96,0.22)',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--nova-red)',
                          boxShadow: '0 0 8px var(--nova-red)',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)' }}
                        >
                          {getPunchLabel(a.action)}
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--nova-muted)',
                              marginLeft: 8,
                            }}
                          >
                            ({a.step})
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--nova-red)', marginTop: 2 }}>
                          {a.reason || 'Intento fallido'}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono',
                          color: 'var(--nova-text)',
                          fontWeight: 600,
                        }}
                      >
                        {formatPunchTime(a.attempted_at || a.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Última marca */}
        {lastPunch && (
          <div
            style={{
              textAlign: 'center',
              marginTop: 12,
              fontSize: 11,
              color: 'var(--nova-muted)',
              fontFamily: 'JetBrains Mono',
            }}
          >
            Última: {getPunchLabel(getPunchAction(lastPunch) || 'punch')} ·{' '}
            {formatPunchTime(lastPunch.punched_at)}
          </div>
        )}
      </div>

      <FaceCaptureModal
        open={showFaceModal}
        onClose={() => {
          setShowFaceModal(false)
          setPendingAction(null)
        }}
        onCaptured={handleSelfieCaptured}
      />

      {/* ── Modal: Rostro no coincide ─────────────────────────────── */}
      {showFaceWarning && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4,6,16,0.92)', backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)', padding: 20,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          }}
        >
          <div
            className="nova-card"
            style={{ width: '100%', maxWidth: 380, padding: 24, animation: 'scale-in 0.25s ease both' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: 'rgba(255,69,96,0.12)', border: '1px solid rgba(255,69,96,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                ⚠️
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--nova-text)' }}>
                  Rostro no coincide
                </div>
                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-red)', marginTop: 2 }}>
                  VERIFICACIÓN BIOMÉTRICA FALLIDA
                </div>
              </div>
            </div>

            {/* Mensaje */}
            <div style={{
              background: 'rgba(255,69,96,0.06)', border: '1px solid rgba(255,69,96,0.22)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 13, color: 'var(--nova-text)', margin: 0, lineHeight: 1.6 }}>
                La fotografía capturada no corresponde al empleado registrado en el sistema.
              </p>
              <p style={{ fontSize: 12, color: 'var(--nova-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
                Si decides marcar de todas formas, la marcación quedará registrada como <strong style={{ color: 'var(--nova-amber)' }}>novedad</strong> y el supervisor recibirá una alerta para revisión.
              </p>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  setShowFaceWarning(false)
                  setFaceWarningAction(null)
                  setFaceWarningBlob(null)
                  setSelfieBlob(null)
                  setFaceReady(false)
                  // Reabrir cámara para reintentar
                  if (faceWarningAction) {
                    setPendingAction(faceWarningAction)
                    setShowFaceModal(true)
                  }
                }}
                className="btn-nova-primary"
                style={{ padding: '14px', fontSize: 14, fontWeight: 700 }}
              >
                📸 Reintentar captura
              </button>
              <button
                onClick={handleForceAction}
                style={{
                  padding: '14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.35)',
                  color: 'var(--nova-amber)', cursor: 'pointer',
                }}
              >
                ⚡ Marcar de todas formas (queda como novedad)
              </button>
              <button
                onClick={() => {
                  setShowFaceWarning(false)
                  setFaceWarningAction(null)
                  setFaceWarningBlob(null)
                }}
                className="btn-nova-ghost"
                style={{ padding: '12px', fontSize: 13 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  )
}

export default ClockInPage
