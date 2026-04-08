import React from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function SetPasswordPage() {
  const nav = useNavigate()
  const { user } = useAuth()

  const [pwd, setPwd] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [show, setShow] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.length < 8) return toast.error('Mínimo 8 caracteres')
    if (pwd !== confirm) return toast.error('Las contraseñas no coinciden')

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) {
      setBusy(false)
      return toast.error(error.message)
    }

    if (user?.id) {
      await supabase.schema(ATT_SCHEMA).from('employees').update({ first_login_pending: false }).eq('user_id', user.id)
    }

    setBusy(false)
    toast.success('Contraseña establecida')
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-5"><h1 className="text-2xl font-bold">Primer ingreso</h1></div>
        <div className="card glass p-5">
          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Nueva contraseña"
              type={show ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              right={
                <button type="button" className="text-white/55 hover:text-white" onClick={() => setShow((v) => !v)}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
            />
            <Input label="Confirmación" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={busy} leftIcon={busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}>
              Guardar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
