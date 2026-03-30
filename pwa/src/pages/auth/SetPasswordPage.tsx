import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function SetPasswordPage() {
  const navigate = useNavigate()
  const { completeFirstLogin, signOut } = useAuth()

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    try {
      await completeFirstLogin(password)
      await signOut()
      navigate('/login', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="nova-card" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <h1 style={{ marginTop: 0, color: 'var(--nova-text)' }}>Primer ingreso</h1>
        <p style={{ color: 'var(--nova-muted)' }}>
          Debes cambiar la contraseña temporal antes de continuar.
        </p>

        {error && <div className="nova-toast error">{error}</div>}

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <input
            className="nova-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña"
            required
          />
          <input
            className="nova-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmar contraseña"
            required
          />
          <button className="btn-nova-primary" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}