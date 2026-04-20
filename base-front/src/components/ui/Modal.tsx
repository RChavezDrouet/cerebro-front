import React, { useId } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  title?: string
  children: React.ReactNode
  onClose: () => void
}

export function Modal({ open, title, children, onClose }: Props) {
  const titleId = useId()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="relative w-[min(720px,92vw)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 text-[var(--text-primary)] shadow-soft"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>{title ? <h3 id={titleId} className="text-base font-semibold text-[var(--text-primary)]">{title}</h3> : null}</div>
          <button
            type="button"
            aria-label="Cerrar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--text-secondary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
