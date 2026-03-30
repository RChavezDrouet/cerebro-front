import React from 'react'
import { X } from 'lucide-react'

export function Modal({ open, title, children, onClose }: { open: boolean; title?: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[min(720px,92vw)] rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>{title ? <h3 className="text-base font-semibold">{title}</h3> : null}</div>
          <button className="rounded-xl p-2 hover:bg-white/10" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
