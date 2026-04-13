// HRCloud PWA — FaceCaptureModal v2.1
// Unificado: reemplaza tanto FaceCaptureModal.tsx (componente PWA)
// como FacialCaptureModal.tsx (versión Base con lucide-react).
//
// Compatible con:
//   iOS Safari 15+  — HTTPS obligatorio, facingMode 'user', playsInline
//   Android Chrome  — getUserMedia estándar
//   Desktop Chrome/Firefox — fallback completo
//
// NOTAS iOS:
//   - Sin autoplay ni muted en <video> puede fallar → ambos son required en iOS
//   - El stream DEBE detenerse en cleanup o el ícono de cámara queda activo
//   - toBlob con 'image/jpeg' funciona mejor que PNG en dispositivos con memoria limitada

import React, { useEffect, useRef, useState, useCallback } from 'react'

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type Props = {
  open: boolean
  onClose: () => void
  onCaptured: (blob: Blob) => void
  /** Calidad JPEG 0–1. Default: 0.88 */
  quality?: number
  /** Resolución objetivo. Default: 720 */
  targetSize?: number
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/** Detección robusta de iOS (incluye iPadOS en modo desktop) */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ en modo desktop no incluye "iPad" en el UA
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Traduce errores de getUserMedia a mensajes en español */
function translateCameraError(e: unknown): string {
  const name = (e as any)?.name || ''
  const msg = String((e as any)?.message || '').toLowerCase()

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return isIOS()
      ? 'Permiso de cámara denegado. Ve a Ajustes → Safari → Cámara y permite el acceso.'
      : 'Permiso de cámara denegado. Permite el acceso en la configuración del navegador.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No se encontró cámara en este dispositivo.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.'
  }
  if (name === 'OverconstrainedError') {
    return 'La cámara no soporta la configuración solicitada.'
  }
  if (msg.includes('https') || msg.includes('secure')) {
    return 'La cámara requiere conexión segura (HTTPS).'
  }
  return `Error al acceder a la cámara: ${name || msg || 'desconocido'}`
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export const FaceCaptureModal: React.FC<Props> = ({
  open,
  onClose,
  onCaptured,
  quality = 0.88,
  targetSize = 720,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)

  // ── Detener stream (cleanup seguro) ───────────────
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop() } catch { /* noop */ }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // ── Iniciar cámara ────────────────────────────────
  const startCamera = useCallback(async () => {
    setError(null)
    setReady(false)
    setCaptured(false)
    setStarting(true)

    // Constraints: iOS requiere facingMode explícito y resolución razonable
    // Nota: ideal vs exact — usamos ideal para mayor compatibilidad
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: 'user',
        width: { ideal: targetSize },
        height: { ideal: targetSize },
      },
      audio: false,
    }

    try {
      // Verificar soporte antes de llamar (evita crash en contextos sin HTTPS)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('getUserMedia no disponible'), { name: 'NotFoundError' })
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (!videoRef.current) {
        stopStream()
        return
      }

      const video = videoRef.current
      video.srcObject = stream

      // iOS: necesita playsInline (ya en el JSX) y play() explícito
      // Android/Desktop: play() también, pero no falla sin él
      await video.play()

      // Esperar primer frame real antes de marcar como listo
      await new Promise<void>((resolve) => {
        const check = () => {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            resolve()
          } else {
            requestAnimationFrame(check)
          }
        }
        check()
      })

      setReady(true)
    } catch (e) {
      setError(translateCameraError(e))
      stopStream()
    } finally {
      setStarting(false)
    }
  }, [targetSize, stopStream])

  // ── Abrir / cerrar modal ──────────────────────────
  useEffect(() => {
    if (open) {
      void startCamera()
    } else {
      stopStream()
      setReady(false)
      setCaptured(false)
      setCountdown(null)
      setError(null)
    }
    return () => {
      stopStream()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Captura con countdown ─────────────────────────
  const startCapture = useCallback(() => {
    if (!ready || captured || countdown !== null) return
    let c = 3
    setCountdown(c)
    const interval = setInterval(() => {
      c -= 1
      if (c === 0) {
        clearInterval(interval)
        setCountdown(null)
        doCapture()
      } else {
        setCountdown(c)
      }
    }, 1000)
  }, [ready, captured, countdown]) // eslint-disable-line react-hooks/exhaustive-deps

  const doCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      setError('Error interno: no hay referencia al video.')
      return
    }

    const w = video.videoWidth || targetSize
    const h = video.videoHeight || targetSize

    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('Error al procesar la imagen.')
      return
    }

    // Efecto espejo (selfie natural)
    ctx.save()
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, w, h)
    ctx.restore()

    // toBlob es asíncrono; en iOS puede tardar más
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('No se pudo generar la imagen. Intenta de nuevo.')
          return
        }
        setCaptured(true)
        // Pequeño delay para mostrar el flash verde al usuario
        setTimeout(() => {
          onCaptured(blob)
          onClose()
        }, 700)
      },
      'image/jpeg',
      quality
    )
  }, [targetSize, quality, onCaptured, onClose])

  if (!open) return null

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4,6,16,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: 20,
        // iOS safe-area
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
      // No usar onTouchMove preventDefault — bloquea permisos en Android Chrome
    >
      <div
        className="nova-card"
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 20,
          animation: 'scale-in 0.25s ease both',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--nova-cyan)"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--nova-text)' }}>
                Validación Biométrica
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--nova-cyan)',
                  opacity: 0.7,
                }}
              >
                RECONOCIMIENTO FACIAL
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              stopStream()
              onClose()
            }}
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
            }}
            aria-label="Cerrar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            className="nova-toast error"
            style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ flexShrink: 0 }}
            >
              <path d="M12 3 22 21H2L12 3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Viewport de la cámara */}
        <div
          style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(0,212,255,0.20)',
            background: '#000',
            // Aspect ratio 1:1. Usamos padding-bottom trick para máxima compat.
            paddingBottom: '100%',
            width: '100%',
            marginBottom: 16,
          }}
        >
          {/* Contenedor interior absolute */}
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Video —
                playsInline: obligatorio iOS (sin esto entra en fullscreen nativo)
                muted: necesario para autoplay en iOS
                autoPlay: hint para Android/Desktop; en iOS usamos video.play()
            */}
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // espejo visual
                display: 'block',
              }}
              playsInline
              muted
              autoPlay
              disablePictureInPicture
              disableRemotePlayback
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Guías de esquinas */}
            <CornerGuides />

            {/* Guía oval */}
            <div
              style={{
                position: 'absolute',
                top: '10%',
                left: '18%',
                right: '18%',
                bottom: '10%',
                border: '2px dashed rgba(0,212,255,0.3)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />

            {/* Beam de escaneo */}
            {ready && !captured && countdown === null && (
              <div className="scan-beam" />
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.45)',
                }}
              >
                <div
                  style={{
                    fontSize: 80,
                    fontWeight: 800,
                    color: 'var(--nova-cyan)',
                    textShadow: '0 0 40px var(--nova-cyan)',
                  }}
                >
                  {countdown}
                </div>
              </div>
            )}

            {/* Flash de captura */}
            {captured && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,255,163,0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--nova-green)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            )}

            {/* Cargando cámara */}
            {starting && !ready && !error && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.5)',
                }}
              >
                <svg
                  style={{ animation: 'spin 1s linear infinite' }}
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--nova-cyan)"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </div>
            )}

            {/* Estado label */}
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 100,
                padding: '4px 12px',
                fontSize: 10,
                fontFamily: 'JetBrains Mono',
                color: 'var(--nova-cyan)',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              {starting
                ? 'INICIANDO CÁMARA...'
                : error
                ? 'ERROR DE CÁMARA'
                : captured
                ? 'CAPTURADO ✓'
                : ready
                ? 'CENTRAR ROSTRO'
                : 'ESPERANDO...'}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          {error ? (
            <button
              onClick={startCamera}
              className="btn-nova-primary"
              style={{ flex: 1 }}
            >
              🔄 Reintentar
            </button>
          ) : (
            <button
              onClick={startCapture}
              disabled={!ready || captured || countdown !== null}
              className="btn-nova-primary"
              style={{ flex: 1 }}
            >
              {countdown !== null
                ? `Capturando en ${countdown}...`
                : captured
                ? '✓ Capturado'
                : '📸 Capturar'}
            </button>
          )}
          <button
            onClick={() => {
              stopStream()
              onClose()
            }}
            className="btn-nova-ghost"
          >
            Cancelar
          </button>
        </div>

        <p
          style={{
            fontSize: 11,
            color: 'var(--nova-muted)',
            marginTop: 12,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {isIOS()
            ? 'Asegúrate de permitir la cámara en Ajustes → Safari'
            : 'Asegúrate de tener buena iluminación y el rostro centrado'}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────
// Sub-componente: guías de esquina estilo scanner
// ─────────────────────────────────────────
const CornerGuides: React.FC = () => {
  const size = 22
  const thick = 3
  const color = 'rgba(0,212,255,0.7)'
  const pos = 10 // px desde el borde

  const corner = (
    top?: number | string,
    left?: number | string,
    right?: number | string,
    bottom?: number | string,
    borderTop?: string,
    borderLeft?: string,
    borderBottom?: string,
    borderRight?: string
  ) => (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        borderTop,
        borderLeft,
        borderBottom,
        borderRight,
        pointerEvents: 'none',
      }}
    />
  )

  const b = `${thick}px solid ${color}`

  return (
    <>
      {corner(pos, pos, undefined, undefined, b, b, undefined, undefined)}
      {corner(pos, undefined, pos, undefined, b, undefined, undefined, b)}
      {corner(undefined, pos, undefined, pos, undefined, b, b, undefined)}
      {corner(undefined, undefined, pos, pos, undefined, undefined, b, b)}
    </>
  )
}

export default FaceCaptureModal
