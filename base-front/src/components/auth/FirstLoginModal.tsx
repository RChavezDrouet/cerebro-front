/**
 * FirstLoginModal.tsx — Base PWA v4.1.0
 * Modal bloqueante para cambio de contraseña obligatorio en el primer acceso.
 *
 * Seguridad (OWASP A07):
 *  - No permite copy/paste en campos de contraseña
 *  - Verificacion de coincidencia 100% en tiempo real
 *  - Evaluacion de fortaleza con zxcvbn (minimo 3/4)
 *  - No puede cerrarse sin cambiar la contraseña
 *  - Llama a supabase.auth.updateUser() (no hay endpoint propio)
 *  - clearFirstLoginPending() actualiza attendance.employees
 */
import React, { useState, useCallback } from 'react'
import { supabase } from '@/config/supabase'
import { clearFirstLoginPending } from '@/lib/tenant'
import toast from 'react-hot-toast'
import zxcvbn from 'zxcvbn'
import { Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react'

interface Props {
  userId: string
  onComplete: () => void
}

const S_LABEL = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Excelente']
const S_COLOR = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500']
const S_TEXT  = ['text-red-400','text-orange-400','text-yellow-400','text-blue-400','text-green-400']

function preventPasteAndCopy(e: React.ClipboardEvent) {
  e.preventDefault()
  toast.error('Por seguridad no se permite pegar contraseñas', { id: 'no-paste' })
}

export function FirstLoginModal({ userId, onComplete }: Props) {
  const [pwd, setPwd]       = useState('')
  const [confirm, setConf]  = useState('')
  const [showPwd, setShowP] = useState(false)
  const [showCon, setShowC] = useState(false)
  const [strength, setStr]  = useState(0)
  const [loading, setLoad]  = useState(false)
  const [shake, setShake]   = useState(false)

  const match    = pwd !== '' && confirm !== '' && pwd === confirm
  const mismatch = confirm !== '' && pwd !== confirm

  const handlePwd = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPwd(e.target.value)
    setStr(zxcvbn(e.target.value).score)
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (pwd.length < 8) {
      toast.error('La contraseña debe tener mínimo 8 caracteres')
      triggerShake(); return
    }
    if (strength < 3) {
      toast.error('La contraseña es muy débil. Use mayúsculas, números y símbolos')
      triggerShake(); return
    }
    if (!match) {
      toast.error('Las contraseñas no coinciden')
      triggerShake(); return
    }

    setLoad(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) throw error

      await clearFirstLoginPending(userId)

      toast.success('¡Contraseña establecida correctamente!')
      onComplete()
    } catch (e: any) {
      toast.error(e.message || 'Error al cambiar contraseña')
    } finally {
      setLoad(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className={`w-full max-w-md animate-slide-up ${shake ? 'animate-shake' : ''}`}>
        <div className="rounded-2xl border border-blue-500/30 p-8 shadow-2xl"
          style={{ background: 'var(--color-surface)' }}>

          {/* Header */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center border"
              style={{ background: 'rgba(0,86,230,0.15)', borderColor: 'rgba(0,86,230,0.3)' }}>
              <KeyRound className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
            </div>
          </div>

          <h2 className="text-xl font-bold text-center mb-1" style={{ color: 'var(--color-text)' }}>
            Primer Acceso al Sistema
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--color-muted)' }}>
            Por seguridad, debe establecer una nueva contraseña antes de continuar.
          </p>

          <div className="rounded-xl px-4 py-3 mb-5 border"
            style={{ background: 'rgba(0,86,230,0.08)', borderColor: 'rgba(0,86,230,0.2)' }}>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              📋 Requisitos: mínimo 8 caracteres, al menos una mayúscula, un número y un símbolo especial.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nueva contraseña */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>
                Nueva contraseña *
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={pwd}
                  onChange={handlePwd}
                  onPaste={preventPasteAndCopy}
                  onCopy={preventPasteAndCopy}
                  onCut={preventPasteAndCopy}
                  data-no-paste="true"
                  autoComplete="new-password"
                  placeholder="Ingrese su nueva contraseña"
                  className="w-full border rounded-xl px-4 py-3 pr-12 outline-none transition focus:ring-2"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <button type="button" onClick={() => setShowP(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                  style={{ color: 'var(--color-muted)' }}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Medidor de fortaleza */}
              {pwd && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? S_COLOR[strength] : 'opacity-20'}`}
                        style={{ background: i > strength ? 'var(--color-border)' : undefined }} />
                    ))}
                  </div>
                  <p className={`text-xs ${S_TEXT[strength]}`}>{S_LABEL[strength]}</p>
                </div>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>
                Confirmar contraseña *
              </label>
              <div className="relative">
                <input
                  type={showCon ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConf(e.target.value)}
                  onPaste={preventPasteAndCopy}
                  onCopy={preventPasteAndCopy}
                  onCut={preventPasteAndCopy}
                  data-no-paste="true"
                  autoComplete="new-password"
                  placeholder="Repita su nueva contraseña"
                  className="w-full border rounded-xl px-4 py-3 pr-12 outline-none transition focus:ring-2"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderColor: mismatch ? '#EF4444' : match ? '#22C55E' : 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <button type="button" onClick={() => setShowC(!showCon)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                  style={{ color: 'var(--color-muted)' }}>
                  {showCon ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Indicador de coincidencia */}
              {confirm && (
                <p className={`text-xs mt-1.5 flex items-center gap-1 ${mismatch ? 'text-red-400' : 'text-green-400'}`}>
                  {mismatch ? '✗ Las contraseñas no coinciden' : '✓ Las contraseñas coinciden'}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading || !match || strength < 3}
              className="w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              {loading
                ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Cambiando...</>
                : <><ShieldCheck size={18} />Establecer contraseña</>
              }
            </button>
          </form>

          <p className="text-xs text-center mt-4" style={{ color: 'var(--color-muted)' }}>
            🔒 Por seguridad, no se permiten operaciones de copiar/pegar en los campos de contraseña.
          </p>
        </div>
      </div>
    </div>
  )
}
