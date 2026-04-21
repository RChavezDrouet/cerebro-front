import React from 'react'

export function Drawer({ open, children, onClose }: { open: boolean; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-[min(360px,90vw)] overflow-y-auto border-r border-white/10 bg-[#0b1220] shadow-soft sm:w-[min(400px,88vw)]">
        {children}
      </div>
    </div>
  )
}
