import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) navigate('/')
    }
    void run()
  }, [navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (authError) {
      // OWASP: mensaje genérico para evitar enumeración
      setError('Credenciales inválidas o acceso no permitido.')
      return
    }

    navigate('/')
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="mb-6">
          <div className="text-lg font-bold">HRCloud Base</div>
          <div className="text-sm text-gray-400">Inicio de sesión</div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm">{error}</div> : null}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>

        <div className="mt-4 text-xs text-gray-400">
          Seguridad: este frontend depende de RLS en Supabase para control de acceso multi-tenant.
        </div>
      </div>
    </div>
  )
}
