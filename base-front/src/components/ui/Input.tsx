import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  hint?: string
  right?: React.ReactNode
}

export function Input({ label, error, hint, right, className = '', ...rest }: Props) {
  return (
    <div className="space-y-1">
      {label ? <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label> : null}
      <div className="relative">
        <input
          {...rest}
          className={
            'w-full min-h-11 rounded-2xl border bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ' +
            (error ? 'border-[var(--danger)]' : 'border-[var(--border-subtle)]') +
            ' ' +
            className
          }
        />
        {right ? <div className="absolute inset-y-0 right-3 flex items-center">{right}</div> : null}
      </div>
      {hint ? <p className="text-xs text-[var(--text-muted)]">{hint}</p> : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
