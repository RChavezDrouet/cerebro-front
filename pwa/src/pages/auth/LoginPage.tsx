import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn, loading, error, session } = useAuth()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch {
      // el error ya sube al contexto
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="nova-card" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--nova-text)' }}>HRCloud</div>
          <div style={{ fontSize: 13, color: 'var(--nova-muted)' }}>PWA de empleados</div>
        </div>

        {error && (
          <div className="nova-toast error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--nova-muted)', fontSize: 12 }}>
              Correo electrónico
            </label>
            <input
              className="nova-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="empleado@empresa.com"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--nova-muted)', fontSize: 12 }}>
              Contraseña
            </label>
            <input
              className="nova-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button className="btn-nova-primary" type="submit" disabled={loading || submitting}>
            {loading || submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <Link to="/auth/forgot-password" style={{ color: 'var(--nova-cyan)' }}>
            ¿Olvidé mi contraseña?
          </Link>
        </div>
      </div>
    </div>
  )
}
