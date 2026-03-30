import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ForgotPasswordPage() {
  const { sendResetEmail } = useAuth()
  const [email, setEmail] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)

    try {
      await sendResetEmail(email)
      setMessage('Si el correo existe, recibirás un enlace para restablecer la contraseña.')
    } catch (err: any) {
      setError(err?.message || 'No se pudo procesar la solicitud.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="nova-card" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <h1 style={{ marginTop: 0, color: 'var(--nova-text)' }}>Olvidé mi contraseña</h1>
        <p style={{ color: 'var(--nova-muted)' }}>
          Ingresa tu correo corporativo y te enviaremos el enlace de recuperación.
        </p>

        {message && <div className="nova-toast success">{message}</div>}
        {error && <div className="nova-toast error">{error}</div>}

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <input
            className="nova-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="empleado@empresa.com"
            required
          />
          <button className="btn-nova-primary" type="submit" disabled={busy}>
            {busy ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>

        <div style={{ marginTop: 14 }}>
          <Link to="/login" style={{ color: 'var(--nova-cyan)', fontSize: 12 }}>
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}
