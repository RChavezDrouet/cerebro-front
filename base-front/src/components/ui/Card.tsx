import React from 'react'

type CardVariant = 'default' | 'elevated' | 'glass'

type Props = {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  variant?: CardVariant
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-[var(--surface)] border border-[var(--border-subtle)]',
  elevated: 'bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-soft',
  glass: 'bg-[var(--surface-glass)] border border-[var(--border-subtle)] glass',
}

export function Card({ title, subtitle, actions, children, className = '', variant = 'default' }: Props) {
  return (
    <div className={`min-w-0 rounded-2xl p-5 ${variantStyles[variant]} ${className}`.trim()}>
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="min-w-0 shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </div>
  )
}
