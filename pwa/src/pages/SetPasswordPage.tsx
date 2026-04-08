/**
 * SetPasswordPage.tsx — Base PWA v4.2.1
 *
 * Pantalla de establecimiento de contraseña para el primer ingreso.
 * Se accede via /auth/set-password cuando LoginPage detecta first_login_pending=true.
 *
 * Flujo:
 *  1. El usuario ingresa nueva contraseña + confirmación
 *  2. Se actualiza la contraseña en Supabase Auth (supabase.auth.updateUser)
 *  3. Se actualiza attendance.employees.first_login_pending = false
 *  4. Cierra sesión y fuerza re-login
 *
 * FIXES v4.2.1-patch:
 *  - Agregado estado userEmail (faltaba declaración, causaba TS error)
 *  - Corregida sintaxis onChange/onPaste malformada en inputs
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { clearFirstLoginPending } from '@/lib/tenant'
import toast from 'react-hot-toast'
import {
  Eye, EyeOff, Loader2, KeyRound, ShieldCheck, CheckCircle2, AlertTriangle,
} from 'lucide-react'

// ─── Reglas de contraseña ─────────────────────────────────────────────────────

const RULES = [
  { test: (p: string) => p.length >= 8,          label: 'Mínimo 8 caracteres' },
  { test: (p: string) => /[A-Z]/.test(p),        label: 'Al menos una mayúscula' },
  { test: (p: string) => /[0-9]/.test(p),        label: 'Al menos un número' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Al menos un carácter especial (!@#$...)' },
]

// ─── Barra de fortaleza ───────────────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const passed = RULES.filter(r => r.test(password)).length
  const colors  = ['#EF4444', '#F59E0B', '#EAB308', '#22C55E']
  const labels  = ['Muy débil', 'Débil', 'Aceptable', 'Segura']

  if (!password) return null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < passed ? colors[passed - 1] : 'var(--color-border)' }} />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: passed >= 3 ? '#22C55E' : 'var(--color-muted)' }}>
        {labels[Math.max(0, passed - 1)]}
      </p>
      <ul className="space-y-1">
        {RULES.map(rule => (
          <li key={rule.label}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: rule.test(password) ? '#22C55E' : 'var(--color-muted)' }}>
            <CheckCircle2 size={11} style={{ opacity: rule.test(password) ? 1 : 0.3 }} />
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SetPasswordPage() {
  const navigate = useNavigate()

  const [newPwd,    setNewPwd]    = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showNew,   setShowNew]   = useState(false)
  const [showConf,  setShowConf]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [userId,    setUserId]    = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')   // ✅ FIX: declaración faltante

  const allOk     = RULES.every(r => r.test(newPwd))
  const match     = newPwd === confirm && confirm !== ''
  const canSubmit = allOk && match && !loading

  // Verificar sesión activa
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        setUserEmail(data.user.email ?? '')
      } else {
        toast.error('Sesión no encontrada. Inicia sesión primero.')
        navigate('/login', { replace: true })
      }
    })
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allOk) { toast.error('La contraseña no cumple los requisitos de seguridad'); return }
    if (!match)  { toast.error('Las contraseñas no coinciden'); return }

    setLoading(true)

    try {
      // ── PASO 1: Actualizar contraseña en Supabase Auth ───────────────────
      const { error: updateError } = await supabase.auth.updateUser({ password: newPwd })
      if (updateError) {
        toast.error('No se pudo actualizar la contraseña: ' + updateError.message)
        setLoading(false)
        return
      }

      // ── PASO 2: Marcar first_login_pending = false en attendance.employees
      if (userId) await clearFirstLoginPending(userId)

      toast.success('¡Contraseña actualizada! Ahora inicia sesión con tu nueva contraseña.')

      // ── PASO 3: Cerrar sesión y forzar re-login (requisito del negocio)
      await supabase.auth.signOut()
      const q = userEmail ? `?email=${encodeURIComponent(userEmail)}` : ''
      navigate(`/login${q}`, { replace: true })

    } catch {
      toast.error('Error inesperado. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // ✅ FIX: blockClipboard como handler independiente (no mezclado en onChange)
  const blockClipboard = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    toast.error('Por seguridad, no se permite copiar/pegar en este campo.')
  }

  const inputStyle = {
    background: 'rgba(0,0,0,0.2)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--color-bg)' }}>

      {/* Decoración fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'var(--color-primary)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'var(--color-secondary)' }} />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center border mb-3"
            style={{ background: 'rgba(0,86,230,0.15)', borderColor: 'rgba(0,86,230,0.3)' }}>
            <KeyRound size={28} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Crea tu contraseña
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--color-muted)' }}>
            Primer acceso detectado. Establece una contraseña segura y personal.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

          {/* Banner informativo */}
          <div className="flex items-start gap-3 p-4 rounded-xl mb-6 border"
            style={{ background: 'rgba(0,86,230,0.08)', borderColor: 'rgba(0,86,230,0.25)' }}>
            <ShieldCheck size={17} className="flex-shrink-0 mt-0.5"
              style={{ color: 'var(--color-primary)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Contraseña temporal activa
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                Tu empresa te asignó una contraseña inicial. Debes crear una contraseña personal antes de continuar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Nueva contraseña */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}   // ✅ FIX: sintaxis correcta
                  onPaste={blockClipboard}
                  onCopy={blockClipboard}
                  onCut={blockClipboard}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full border rounded-xl px-4 py-3 pr-12 outline-none transition focus:ring-2"
                  style={inputStyle}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                  style={{ color: 'var(--color-muted)' }}>
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <StrengthBar password={newPwd} />
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showConf ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}  // ✅ FIX: sintaxis correcta
                  onPaste={blockClipboard}
                  onCopy={blockClipboard}
                  onCut={blockClipboard}
                  placeholder="Repite tu contraseña"
                  className="w-full border rounded-xl px-4 py-3 pr-12 outline-none transition focus:ring-2"
                  style={{
                    ...inputStyle,
                    borderColor: confirm && !match
                      ? 'rgba(239,68,68,0.5)'
                      : confirm && match
                      ? 'rgba(34,197,94,0.5)'
                      : 'var(--color-border)',
                  }}
                />
                <button type="button" onClick={() => setShowConf(!showConf)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                  style={{ color: 'var(--color-muted)' }}>
                  {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirm && !match && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#EF4444' }}>
                  <AlertTriangle size={11} /> Las contraseñas no coinciden
                </p>
              )}
              {confirm && match && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#22C55E' }}>
                  <CheckCircle2 size={11} /> Las contraseñas coinciden
                </p>
              )}
            </div>

            {/* Botón */}
            <button type="submit" disabled={!canSubmit}
              className="w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {loading ? 'Guardando...' : 'Guardar contraseña y continuar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
          Tu contraseña se almacena cifrada de forma segura. HRCloud no la conoce.
        </p>
      </div>
    </div>
  )
}
