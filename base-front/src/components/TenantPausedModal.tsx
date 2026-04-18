import React from 'react'

export function TenantPausedModal({ open, message }: { open: boolean; message: string | null }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-300">
          Tenant pausado
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-white">Acceso temporalmente bloqueado</h2>
        <p className="text-sm leading-6 text-slate-300">{message}</p>
      </div>
    </div>
  )
}
