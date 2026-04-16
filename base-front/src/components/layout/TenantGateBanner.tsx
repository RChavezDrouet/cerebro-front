import React from 'react'
import { supabase } from '@/config/supabase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

type Props = {
  title: string
  body:  string
}

export function TenantGateBanner({ title, body }: Props) {
  const nav = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1220] px-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-white/60 leading-relaxed">{body}</p>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium border border-white/10 text-white/70 hover:bg-white/5 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
