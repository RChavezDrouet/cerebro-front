// HRCloud PWA — Nova UI Clock In Page
import React, { useState, useEffect } from 'react'
import type { UserProfile, ClockStatus, GeofenceStatus, AttendancePunch, GeoLocation } from '../types'
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
  onClockIn: (notes?: string, selfieBlob?: Blob | null) => Promise<boolean>
  onClockOut: (notes?: string, selfieBlob?: Blob | null) => Promise<boolean>
  onBreakStart: (selfieBlob?: Blob | null) => Promise<boolean>
  onBreakEnd: (selfieBlob?: Blob | null) => Promise<boolean>
  onRefreshLocation: () => Promise<GeoLocation | null | undefined>
  onClearMessages: () => void
}

const ClockInPage: React.FC<ClockInPageProps> = ({
  profile, settings, clockStatus, lastPunch, todayPunches,
  todayAttempts = [],
  location, geofenceStatus, geofenceDistance, loading, error, success,
  onClockIn, onClockOut, onBreakStart, onBreakEnd, onRefreshLocation, onClearMessages,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showHistory, setShowHistory] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [showFaceModal, setShowFaceModal] = useState(false)
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
  const [faceReady, setFaceReady] = useState(false)
  const [pendingAction, setPendingAction] = useState<'clock_in' | 'clock_out' | 'break_start' | 'break_end' | null>(null)
  const [pressing, setPressing] = useState(false)

  const requiresFace = Boolean(settings?.face_enabled)

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(onClearMessages, 4000)
      return () => clearTimeout(timer)
    }
  }, [success, onClearMessages])

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  const formatDate = (date: Date) =>
    date.toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const formatPunchTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false })

  const getGeoInfo = () => {
    switch (geofenceStatus) {
      case 'inside': return { label: `En área · ${formatDistance(geofenceDistance || 0)}`, color: 'var(--nova-green)', dot: '#00ffa3' }
      case 'outside': return { label: `Fuera del área · ${formatDistance(geofenceDistance || 0)}`, color: 'var(--nova-red)', dot: '#ff4560' }
      case 'checking': return { label: 'Verificando GPS...', color: 'var(--nova-cyan)', dot: 'var(--nova-cyan)' }
      case 'no_geofence': return { label: 'Sin geocerca · GPS activo', color: 'var(--nova-cyan)', dot: 'var(--nova-cyan)' }
      case 'error': return { label: 'Error de ubicación', color: 'var(--nova-amber)', dot: 'var(--nova-amber)' }
      default: return { label: 'Esperando GPS...', color: 'var(--nova-muted)', dot: 'gray' }
    }
  }

  const getPunchLabel = (action: string) => ({
    clock_in: 'Entrada', clock_out: 'Salida', break_start: 'Descanso', break_end: 'Fin Desc.'
  }[action] || action)

  const getPunchColor = (action: string) => ({
    clock_in: 'var(--nova-green)', clock_out: 'var(--nova-red)',
    break_start: 'var(--nova-amber)', break_end: 'var(--nova-cyan)'
  }[action] || 'var(--nova-muted)')

  const handleSelfieCaptured = async (blob: Blob) => {
    // Guardamos la selfie en memoria. La verificación (backend) y el GPS se ejecutan
    // estrictamente al intentar marcar (flujo: selfie -> backend face -> GPS -> insert)
    setSelfieBlob(blob)
    setFaceReady(true)

    // Si venimos de un intento de marcación, continuamos automáticamente.
    if (pendingAction) {
      const action = pendingAction
      setPendingAction(null)
      await performAction(action, blob)
    }
  }

  const ensureFaceIfRequired = async (actionToRun?: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    if (!requiresFace) return true

    // REQUERIMIENTO: al marcar, lo primero es capturar el rostro.
    // Por eso, si viene un actionToRun, forzamos captura nueva.
    if (actionToRun) {
      setPendingAction(actionToRun)
      setShowFaceModal(true)
      return false
    }

    // Captura manual (sin acción inmediata)
    setPendingAction(null)
    setShowFaceModal(true)
    return false
  }

  const afterPunchResetEvidence = () => { setFaceReady(false); setSelfieBlob(null) }

  const canPunch = !loading && geofenceStatus !== 'error'
  const geoInfo = getGeoInfo()

  const getButtonConfig = () => {
    if (clockStatus === 'clocked_in' || clockStatus === 'loading') {
      return { label: 'SALIDA', sub: 'Clock Out', cls: 'exit', wrapCls: 'is-out' }
    }
    if (clockStatus === 'on_break') {
      return { label: 'REGRESAR', sub: 'End Break', cls: 'break', wrapCls: '' }
    }
    return { label: 'ENTRADA', sub: 'Clock In', cls: 'entry', wrapCls: 'is-clocked-in' }
  }

  const btnCfg = getButtonConfig()

  const performAction = async (action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end', blob: Blob | null) => {
    let ok = false
    if (action === 'clock_in') ok = await onClockIn(notes || undefined, blob)
    else if (action === 'clock_out') ok = await onClockOut(notes || undefined, blob)
    else if (action === 'break_start') ok = await onBreakStart(blob)
    else if (action === 'break_end') ok = await onBreakEnd(blob)
    if (ok) afterPunchResetEvidence()
    return ok
  }

  const handleMainAction = async () => {
    // 1) Determinar acción lógica
    let action: 'clock_in' | 'clock_out' | 'break_end'
    if (clockStatus === 'idle') action = 'clock_in'
    else if (clockStatus === 'clocked_in') action = 'clock_out'
    else action = 'break_end'

    // 2) Requerir selfie ANTES de GPS. Si no hay selfie, abrimos modal.
    if (!(await ensureFaceIfRequired(action))) return

    // 3) Ejecutar flujo (el hook hace: upload selfie -> backend face -> GPS -> insert)
    await performAction(action, selfieBlob)
  }

  return (
    <>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 100px', position: 'relative', zIndex: 1 }}>

        {/* Toasts */}
        {success && (
          <div className="nova-toast success" style={{ marginTop: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {success}
          </div>
        )}
        {error && (
          <div className="nova-toast error" style={{ marginTop: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Greeting */}
        <div className="anim-fade-up" style={{ paddingTop: 20, paddingBottom: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--nova-cyan)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', marginBottom: 2, opacity: 0.8 }}>
            {profile.tenant_name}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--nova-text)', margin: 0 }}>
            Hola, {profile.full_name.split(' ')[0]} 👋
          </h1>
        </div>

        {/* Big Clock */}
        <div className="anim-fade-up" style={{ textAlign: 'center', padding: '20px 0 8px', animationDelay: '50ms' }}>
          <div style={{
            fontSize: 58, fontWeight: 800, fontFamily: 'JetBrains Mono',
            background: 'linear-gradient(135deg, #00d4ff, #ffffff, #00ffa3)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', letterSpacing: '-0.02em',
            lineHeight: 1
          }}>
            {formatTime(currentTime)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--nova-muted)', marginTop: 6, textTransform: 'capitalize' }}>
            {formatDate(currentTime)}
          </div>
        </div>

        {/* GPS Status */}
        <div className="nova-card anim-fade-up" style={{ padding: '12px 16px', marginBottom: 16, animationDelay: '80ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: geoInfo.dot, boxShadow: `0 0 8px ${geoInfo.dot}`, flexShrink: 0, transition: 'background 0.3s' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: geoInfo.color, transition: 'color 0.3s' }}>{geoInfo.label}</div>
                {location && (
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', marginTop: 2 }}>
                    {formatCoordinates(location.latitude, location.longitude)} · ±{Math.round(location.accuracy)}m
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* online indicator */}
              <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: navigator.onLine ? 1 : 0.3 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--nova-cyan)" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                  <line x1="12" y1="20" x2="12.01" y2="20"/>
                </svg>
              </div>
              <button
                onClick={() => onRefreshLocation()}
                style={{
                  width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--nova-border)', color: 'var(--nova-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                title="Actualizar GPS"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CLOCK BUTTON */}
        <div className="anim-fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 24px', animationDelay: '120ms' }}>
          <div className={`clock-btn-wrap ${btnCfg.wrapCls}`}>
            <button
              className={`clock-btn ${btnCfg.cls}`}
              onClick={handleMainAction}
              disabled={!canPunch || clockStatus === 'loading'}
              onMouseDown={() => setPressing(true)}
              onMouseUp={() => setPressing(false)}
              onTouchStart={() => setPressing(true)}
              onTouchEnd={() => setPressing(false)}
            >
              {clockStatus === 'loading' ? (
                <svg style={{ animation: 'spin 1s linear infinite' }} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              ) : btnCfg.label === 'ENTRADA' ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
              ) : btnCfg.label === 'SALIDA' ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
              )}
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', marginTop: clockStatus === 'loading' ? 8 : 4 }}>
                {clockStatus === 'loading' ? 'REGISTRANDO' : btnCfg.label}
              </span>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', opacity: 0.7, letterSpacing: '0.12em' }}>
                {clockStatus === 'loading' ? '...' : btnCfg.sub}
              </span>
            </button>
          </div>

          {/* Break button */}
          {clockStatus === 'clocked_in' && (
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

        {/* Biometric Panel */}
        {requiresFace && (
          <div className="nova-card anim-fade-up" style={{ padding: '14px 16px', marginBottom: 16, animationDelay: '150ms', borderLeft: '3px solid var(--nova-cyan)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  🤳
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)' }}>Validación biométrica</div>
                  <div style={{ fontSize: 11, color: faceReady ? 'var(--nova-green)' : 'var(--nova-amber)', marginTop: 2 }}>
                    {faceReady ? '✓ Selfie capturada — listo para marcar' : '⚠ Se requiere selfie'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setPendingAction(null); setShowFaceModal(true) }}
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
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--nova-muted)', fontSize: 12, fontFamily: 'JetBrains Mono',
              letterSpacing: '0.06em', padding: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {showNotes ? 'OCULTAR NOTA' : 'AGREGAR NOTA'}
          </button>
          {showNotes && (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Trabajo desde casa, reunión con cliente..."
              className="nova-input"
              style={{ marginTop: 10, height: 80, resize: 'none', fontSize: 13 }}
              maxLength={255}
            />
          )}
        </div>

        {/* Marcaciones (OK y fallidas) */}
        <div className="nova-card anim-fade-up" style={{ animationDelay: '220ms' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--nova-text)', textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="live-dot" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Marcaciones de Hoy</span>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)' }}>
                (OK: {todayPunches.length} · Fallidas: {todayAttempts.length})
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--nova-muted)" strokeWidth="2" strokeLinecap="round">
              {showHistory
                ? <polyline points="18 15 12 9 6 15"/>
                : <polyline points="6 9 12 15 18 9"/>
              }
            </svg>
          </button>

          {showHistory && (
            <div style={{ padding: '0 16px 16px' }}>
              {/* OK */}
              <div style={{ marginTop: 8, marginBottom: 10, fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)' }}>
                OK
              </div>
              {todayPunches.length === 0 ? (
                <div style={{ padding: '10px 0 18px', textAlign: 'center', color: 'var(--nova-muted)', fontSize: 13 }}>
                  Sin marcaciones OK
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {todayPunches.map((punch) => {
                    const action = (punch as any).evidence?.action || 'punch'
                    const color = getPunchColor(action)
                    const inRange = (punch as any).evidence?.geo?.in_range
                    return (
                      <div key={punch.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--nova-border)'
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--nova-text)' }}>
                          {getPunchLabel(action)}
                          {inRange === false && <span style={{ fontSize: 10, color: 'var(--nova-red)', marginLeft: 8 }}>Fuera de área</span>}
                          {inRange === true && <span style={{ fontSize: 10, color: 'var(--nova-green)', marginLeft: 8 }}>GPS ✓</span>}
                        </div>
                        <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono', color: 'var(--nova-text)', fontWeight: 600 }}>
                          {formatPunchTime(punch.punched_at)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Fallidas */}
              <div style={{ marginTop: 6, marginBottom: 10, fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)' }}>
                FALLIDAS
              </div>
              {todayAttempts.length === 0 ? (
                <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--nova-muted)', fontSize: 13 }}>
                  Sin intentos fallidos
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayAttempts.map((a: any) => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 12,
                      background: 'rgba(255,69,96,0.06)',
                      border: '1px solid rgba(255,69,96,0.22)'
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--nova-red)', boxShadow: '0 0 8px var(--nova-red)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)' }}>
                          {getPunchLabel(a.action)}
                          <span style={{ fontSize: 10, color: 'var(--nova-muted)', marginLeft: 8 }}>
                            ({a.step})
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--nova-red)', marginTop: 2 }}>
                          {a.reason || 'Intento fallido'}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--nova-text)', fontWeight: 600 }}>
                        {formatPunchTime(a.attempted_at || a.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Last punch note */}
        {lastPunch && (
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--nova-muted)', fontFamily: 'JetBrains Mono' }}>
            Última: {getPunchLabel((lastPunch as any).evidence?.action || 'punch')} · {formatPunchTime(lastPunch.punched_at)}
          </div>
        )}
      </div>

      <FaceCaptureModal
        open={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onCaptured={handleSelfieCaptured}
      />

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </>
  )
}

export default ClockInPage
