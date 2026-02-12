import React from 'react'
import { Button } from './Button'

type Props = {
  open: boolean
  title: string
  children: React.ReactNode
  onClose?: () => void
  dismissible?: boolean
}

export function Modal({ open, title, children, onClose, dismissible = true }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1020] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="text-base font-semibold">{title}</div>
          {dismissible ? (
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          ) : null}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
