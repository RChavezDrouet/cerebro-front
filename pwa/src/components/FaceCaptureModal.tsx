// HRCloud PWA — Nova UI Face Capture Modal
import React, { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onCaptured: (blob: Blob) => void
}

export const FaceCaptureModal: React.FC<Props> = ({ open, onClose, onCaptured }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setCaptured(false)
    setError(null)
    setReady(false)

    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        })
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          await videoRef.current.play()
          setReady(true)
        }
      } catch (e: any) {
        setError(e?.message || 'No se pudo acceder a la cámara.')
      }
    }

    start()
    return () => {
      try { stream?.getTracks().forEach(t => t.stop()) } catch {}
      setStream(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startCapture = () => {
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
  }

  const doCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const w = video.videoWidth || 720
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror effect
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, w, h)

    canvas.toBlob(
      (blob) => {
        if (!blob) { setError('No se pudo capturar la imagen.'); return }
        setCaptured(true)
        setTimeout(() => {
          onCaptured(blob)
          onClose()
        }, 600)
      },
      'image/jpeg', 0.9
    )
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,6,16,0.85)', backdropFilter: 'blur(16px)',
      padding: 20
    }}>
      <div className="nova-card anim-scale-in" style={{ width: '100%', maxWidth: 360, padding: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--nova-cyan)" strokeWidth="2" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--nova-text)' }}>Validación Biométrica</div>
              <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-cyan)', opacity: 0.7 }}>RECONOCIMIENTO FACIAL</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--nova-border)',
            color: 'var(--nova-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && (
          <div className="nova-toast error" style={{ marginBottom: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3 22 21H2L12 3Z"/><line x1="12" y1="9" x2="12" y2="14"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {error}
          </div>
        )}

        {/* Camera viewport */}
        <div style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(0,212,255,0.20)',
          background: 'black', aspectRatio: '1',
          marginBottom: 16
        }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            playsInline muted
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Face corners */}
          <div className="face-corner tl" />
          <div className="face-corner tr" />
          <div className="face-corner bl" />
          <div className="face-corner br" />

          {/* Oval face guide */}
          <div style={{
            position: 'absolute', top: '10%', left: '20%', right: '20%', bottom: '10%',
            border: '2px dashed rgba(0,212,255,0.25)', borderRadius: '50%',
            pointerEvents: 'none'
          }} />

          {/* Scan beam */}
          {ready && !captured && <div className="scan-beam" />}

          {/* Countdown */}
          {countdown !== null && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)'
            }}>
              <div style={{
                fontSize: 72, fontWeight: 800, color: 'var(--nova-cyan)',
                textShadow: '0 0 30px var(--nova-cyan)',
                animation: 'scale-in 0.3s ease both'
              }}>
                {countdown}
              </div>
            </div>
          )}

          {/* Captured flash */}
          {captured && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,255,163,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'fade-up 0.3s ease both'
            }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--nova-green)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          )}

          {/* Status label */}
          <div style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            borderRadius: 100, padding: '4px 12px',
            fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-cyan)', letterSpacing: '0.08em'
          }}>
            {!ready ? 'INICIANDO CÁMARA...' : captured ? 'CAPTURADO ✓' : 'CENTRAR ROSTRO'}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={startCapture}
            disabled={!ready || captured || countdown !== null}
            className="btn-nova-primary"
            style={{ flex: 1 }}
          >
            {countdown !== null ? `Capturando en ${countdown}...` : '📸 Capturar'}
          </button>
          <button onClick={onClose} className="btn-nova-ghost" style={{ flex: 0 }}>
            Cancelar
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--nova-muted)', marginTop: 12, textAlign: 'center' }}>
          Asegúrate de tener buena iluminación y el rostro centrado
        </p>
      </div>
    </div>
  )
}
