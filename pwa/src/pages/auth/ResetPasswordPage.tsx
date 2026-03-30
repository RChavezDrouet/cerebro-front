import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Stage = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [stage, setStage] = React.useState<Stage>('checking')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        }
        const { data } = await supabase.auth.getSession()
        setStage(data.session ? 'ready' : 'invalid')
      } catch {
        setStage('invalid')
      }
    }
    void run()
  }, [])

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
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (stage === 'checking') {
    return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>Validando enlace…</div>
  }

  if (stage === 'invalid') {
    return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>Enlace inválido o expirado.</div>
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="nova-card" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <h1 style={{ marginTop: 0, color: 'var(--nova-text)' }}>Restablecer contraseña</h1>

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
            {busy ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}