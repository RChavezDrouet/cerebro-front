// HRCloud PWA — Nova UI Login Page
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>
  loading: boolean
  error: string | null
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, loading, error }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    await onLogin(email, password)
  }

  const handleForgot = async () => {
    setResetMsg(null)
    const e = (email || '').trim()
    if (!e || !e.includes('@')) {
      setResetMsg('Ingresa tu correo y pulsa “Olvidé mi contraseña”.')
      return
    }

    try {
      setResetLoading(true)
      await supabase.functions.invoke('base-reset-password', {
        body: { action: 'request_reset', email: e, app: 'pwa' },
      })
      // Anti-enumeración: mismo mensaje siempre
      setResetMsg('Si el correo está registrado, te enviaremos un enlace para cambiar tu contraseña.')
    } catch {
      setResetMsg('No se pudo procesar la solicitud. Intenta de nuevo en unos minutos.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px', position: 'relative', zIndex: 1
    }}>
      {/* Animated orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          animation: 'orb-float 8s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', left: '20%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
          animation: 'orb-float 10s ease-in-out infinite 2s'
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '10%',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 70%)',
          animation: 'orb-float 12s ease-in-out infinite 4s'
        }} />
      </div>

      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translateX(-50%) translateY(0) scale(1); }
          50% { transform: translateX(-50%) translateY(-20px) scale(1.05); }
        }
        @keyframes logo-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(0,212,255,0.3), 0 0 60px rgba(59,130,246,0.2); }
          50% { box-shadow: 0 0 50px rgba(0,212,255,0.5), 0 0 80px rgba(59,130,246,0.3); }
        }
      `}</style>

      {/* Logo */}
      <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 22, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #7c3aed 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'logo-glow 3s ease-in-out infinite',
          position: 'relative',
        }}>
          {/* inner highlight */}
          <div style={{
            position: 'absolute', top: 3, left: 3, right: 3,
            height: '40%', borderRadius: '18px 18px 60% 60%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)'
          }} />
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" style={{ position: 'relative', zIndex: 1 }}>
            <circle cx="12" cy="12" r="9"/>
            <polyline points="12 7 12 12 15 14"/>
          </svg>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--nova-text)', letterSpacing: '0.04em' }}>
          HRCloud
        </div>
        <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-cyan)', letterSpacing: '0.20em', opacity: 0.8, marginTop: 4 }}>
          MARCACIÓN REMOTA
        </div>
      </div>

      {/* Card */}
      <div className="nova-card anim-fade-up" style={{
        width: '100%', maxWidth: 380, padding: 28,
        position: 'relative', zIndex: 1,
        animationDelay: '100ms'
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--nova-text)', marginBottom: 4 }}>
            Iniciar Sesión
          </div>
          <div style={{ fontSize: 13, color: 'var(--nova-muted)' }}>
            Ingresa con tu cuenta corporativa
          </div>
        </div>

        {error && (
          <div className="nova-toast error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {resetMsg && (
          <div className="nova-toast" style={{ marginTop: 10 }}>
            {resetMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--nova-muted)', marginBottom: 8, letterSpacing: '0.06em' }}>
              CORREO ELECTRÓNICO
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="tu@empresa.com"
                className="nova-input"
                style={{ paddingLeft: 44 }}
                autoComplete="email"
                autoFocus
                required
              />
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--nova-cyan)" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={handleForgot}
            disabled={resetLoading}
            style={{
              marginTop: -6,
              alignSelf: 'flex-end',
              background: 'none',
              border: 'none',
              color: 'var(--nova-cyan)',
              fontSize: 12,
              fontWeight: 700,
              cursor: resetLoading ? 'default' : 'pointer',
              opacity: resetLoading ? 0.7 : 1,
              fontFamily: 'Syne, sans-serif',
              padding: 0,
            }}
          >
            {resetLoading ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
          </button>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--nova-muted)', marginBottom: 8, letterSpacing: '0.06em' }}>
              CONTRASEÑA
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('pass')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                className="nova-input"
                style={{ paddingLeft: 44, paddingRight: 44 }}
                autoComplete="current-password"
                required
              />
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--nova-cyan)" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nova-muted)',
                  padding: 4, display: 'flex', alignItems: 'center'
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="btn-nova-primary"
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Verificando...
              </span>
            ) : '→ Ingresar'}
          </button>
        </form>
      </div>

      {/* Feature badges */}
      <div className="anim-fade-up" style={{
        marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap',
        justifyContent: 'center', position: 'relative', zIndex: 1,
        animationDelay: '200ms'
      }}>
        {[
          { icon: '📍', label: 'GPS Verificado' },
          { icon: '🛡️', label: 'TLS 1.3' },
          { icon: '🤳', label: 'Biometría' },
        ].map(({ icon, label }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 100,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--nova-border)',
            fontSize: 11, color: 'var(--nova-muted)',
            fontFamily: 'JetBrains Mono'
          }}>
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

export default LoginPage
