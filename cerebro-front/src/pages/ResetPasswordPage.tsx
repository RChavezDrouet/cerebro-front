import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '@/config/supabase'

export default function ResetPasswordPage() {
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== password2) {
      toast.error('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      // En flujo recovery, Supabase ya setea una sesión temporal al abrir el link
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast.success('Contraseña actualizada. Ya puedes iniciar sesión.')
      await supabase.auth.signOut()
      nav('/login', { replace: true })
    } catch (err: any) {
      toast.error(err?.message ?? 'No se pudo actualizar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md p-6 rounded-2xl bg-white/5 border border-white/10"
      >
        <div className="text-white text-2xl font-semibold">Restablecer contraseña</div>
        <div className="text-slate-300 text-sm mt-1">
          Ingresa tu nueva contraseña para CEREBRO.
        </div>

        <div className="mt-6">
          <label className="block text-xs text-slate-300 mb-2">Nueva contraseña</label>
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="mínimo 8 caracteres"
          />
        </div>

        <div className="mt-4">
          <label className="block text-xs text-slate-300 mb-2">Repetir contraseña</label>
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="repite la contraseña"
          />
        </div>

        <button
          className="mt-6 w-full rounded-xl bg-blue-600 hover:bg-blue-500 transition text-white py-3 font-semibold disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Guardando…' : 'Actualizar contraseña'}
        </button>

        <button
          type="button"
          onClick={() => nav('/login')}
          className="mt-3 w-full text-xs text-slate-300 hover:text-white underline"
        >
          Volver al login
        </button>
      </form>
    </div>
  )
}