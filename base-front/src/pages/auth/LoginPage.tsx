import React from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, AlertTriangle, Mail } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { checkTenantStatus } from '@/lib/tenantGate'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

async function checkFirstLoginPending(userId: string): Promise<boolean> {
  const { data } = await supabase
    .schema(ATT_SCHEMA)
    .from('employees')
    .select('first_login_pending')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.first_login_pending === true
}

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPwd, setShowPwd] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [paused, setPaused] = React.useState<{ title: string; body: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setPaused(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return toast.error('Credenciales inválidas')

      const uid = data.user?.id
      if (!uid) return toast.error('Sesión inválida')

      const gate = await checkTenantStatus(uid)
      if (gate.paused) {
        setPaused({ title: gate.title, body: gate.body })
        await supabase.auth.signOut()
        return
      }

      const first = await checkFirstLoginPending(uid)
      if (first) return nav('/auth/set-password', { replace: true })

      nav('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const forgot = async () => {
    const e = email.trim()
    if (!e) return toast.error('Ingresa tu correo')
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: `${window.location.origin}/auth/reset-password` })
    if (error) return toast.error('No se pudo enviar el correo')
    toast.success('Revisa tu correo para recuperar tu contraseña')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-xs text-white/50">HRCloud</div>
          <h1 className="text-2xl font-bold">Base</h1>
          <p className="mt-1 text-sm text-white/60">Asistencia y RR.HH.</p>
        </div>

        {paused ? (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-amber-200" size={18} />
              <div>
                <div className="font-semibold text-amber-100">{paused.title}</div>
                <div className="mt-1 text-sm text-amber-100/80">{paused.body}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="card glass p-5">
          <form onSubmit={submit} className="space-y-4">
            <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} right={<Mail size={16} className="text-white/40" />} required />
            <Input
              label="Contraseña"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              right={
                <button type="button" className="text-white/55 hover:text-white" onClick={() => setShowPwd((v) => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
            />

            <Button type="submit" className="w-full" disabled={busy} leftIcon={busy ? <Loader2 size={16} className="animate-spin" /> : undefined}>
              Ingresar
            </Button>

            <div className="flex items-center justify-between">
              <button type="button" className="text-xs text-white/60 hover:text-white" onClick={forgot}>¿Olvidaste tu contraseña?</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
