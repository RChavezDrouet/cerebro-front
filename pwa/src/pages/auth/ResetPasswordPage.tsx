import React from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'

import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Stage = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const nav = useNavigate()
  const [stage, setStage] = React.useState<Stage>('checking')
  const [pwd, setPwd] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [showPwd, setShowPwd] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        if (code) await supabase.auth.exchangeCodeForSession(code)
        const { data } = await supabase.auth.getSession()
        if (!data.session) return setStage('invalid')
        setStage('ready')
      } catch {
        setStage('invalid')
      }
    }
    run()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.length < 8) return toast.error('Mínimo 8 caracteres')
    if (pwd !== confirm) return toast.error('Las contraseñas no coinciden')

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setBusy(false)

    if (error) return toast.error(error.message)

    toast.success('Contraseña actualizada')
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  if (stage === 'checking') return <div className="min-h-screen flex items-center justify-center text-white/70">Validando…</div>
  if (stage === 'invalid') return <div className="min-h-screen flex items-center justify-center text-white/70">Enlace inválido</div>

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-5"><h1 className="text-2xl font-bold">Restablecer contraseña</h1></div>
        <div className="card glass p-5">
          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Nueva contraseña"
              type={showPwd ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              right={
                <button type="button" className="text-white/55 hover:text-white" onClick={() => setShowPwd((v) => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
            />
            <Input label="Confirmación" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={busy} leftIcon={busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}>
              Actualizar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
