/**
 * ResetPasswordPage.tsx — Base PWA v4.2.0
 * Página destino del link de recuperación (forgot password).
 *
 * Flujo:
 *  1) base-reset-password Edge Function genera link tipo 'recovery' con redirectTo a esta ruta.
 *  2) Supabase redirige con ?code=... (o tokens en hash, según configuración).
 *  3) Se intercambia por sesión y se permite supabase.auth.updateUser({ password }).
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import zxcvbn from 'zxcvbn'
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'

function preventPasteAndCopy(e: React.ClipboardEvent) {
  e.preventDefault()
  toast.error('Por seguridad no se permite copiar/pegar contraseñas', { id: 'no-paste' })
}

type Stage = 'checking' | 'ready' | 'done' | 'invalid'

export default function ResetPasswordPage() {
  const nav = useNavigate()
  const [stage, setStage] = useState<Stage>('checking')
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showCon, setShowCon] = useState(false)
  const [busy, setBusy] = useState(false)

  const strength = useMemo(() => zxcvbn(pwd).score, [pwd])
  const match = pwd !== '' && confirm !== '' && pwd === confirm

  useEffect(() => {
    const run = async () => {
      try {
        // 1) Exchange code for session (email recovery)
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) console.warn('[reset-password] exchangeCodeForSession:', error.message)
        } else {
          // 2) Fallback: tokens in hash (legacy / some configs)
          const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
          const access_token = hash.get('access_token')
          const refresh_token = hash.get('refresh_token')
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (error) console.warn('[reset-password] setSession:', error.message)
          }
        }

        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          setStage('invalid')
          return
        }
        setStage('ready')
      } catch (e: any) {
        console.error(e)
        setStage('invalid')
      }
    }
    run()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!match) return toast.error('Las contraseñas no coinciden')
    if (pwd.length < 8) return toast.error('Mínimo 8 caracteres')
    if (strength < 3) return toast.error('Contraseña débil: use mayúsculas, números y símbolos')

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setBusy(false)

    if (error) return toast.error(error.message)

    toast.success('Contraseña actualizada. Inicie sesión.')
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  if (stage === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background:'#0D1B2A' }}>
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:'#00B3FF', borderTopColor:'transparent' }} />
      </div>
    )
  }

  if (stage === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background:'#0D1B2A' }}>
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-700/60 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-slate-100 mb-2">Enlace inválido</h1>
          <p className="text-slate-300 text-sm leading-6">
            El enlace de recuperación no es válido o ya expiró. Vuelva a solicitar el restablecimiento desde el login.
          </p>
          <button className="mt-6 w-full rounded-xl py-3 font-semibold bg-blue-600 text-white"
            onClick={() => nav('/login', { replace:true })}>
            Ir al login
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'done') return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background:'#0D1B2A' }}>
      <div className="max-w-md w-full bg-slate-900/60 border border-slate-700/60 rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="text-sky-400" size={18} />
          <h1 className="text-xl font-bold text-slate-100">Restablecer contraseña</h1>
        </div>
        <p className="text-slate-300 text-sm leading-6">
          Defina una nueva contraseña. Por seguridad no se permite copiar/pegar.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                onPaste={preventPasteAndCopy}
                onCopy={preventPasteAndCopy}
                onCut={preventPasteAndCopy}
                className="w-full rounded-xl bg-black/30 border border-slate-700 px-4 py-3 pr-10 text-slate-100 outline-none"
                autoComplete="new-password"
                required
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                onClick={() => setShowPwd(v => !v)} aria-label="toggle password">
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="mt-2 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${(strength+1)*20}%`, background: strength >= 3 ? '#22C55E' : (strength === 2 ? '#FACC15' : '#F97316') }} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Repetir contraseña</label>
            <div className="relative">
              <input
                type={showCon ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onPaste={preventPasteAndCopy}
                onCopy={preventPasteAndCopy}
                onCut={preventPasteAndCopy}
                className="w-full rounded-xl bg-black/30 border border-slate-700 px-4 py-3 pr-10 text-slate-100 outline-none"
                autoComplete="new-password"
                required
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                onClick={() => setShowCon(v => !v)} aria-label="toggle password">
                {showCon ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!match && confirm !== '' && (
              <p className="text-xs mt-2 text-red-400">Las contraseñas no coinciden</p>
            )}
          </div>

          <button type="submit"
            className="w-full rounded-xl py-3 font-semibold bg-blue-600 text-white flex items-center justify-center gap-2 disabled:opacity-60"
            disabled={!match || strength < 3 || busy}>
            <KeyRound size={16} />
            {busy ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
