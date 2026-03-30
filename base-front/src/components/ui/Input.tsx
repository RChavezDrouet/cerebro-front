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
      {label ? <label className="text-sm font-medium text-white/80">{label}</label> : null}
      <div className="relative">
        <input
          {...rest}
          className={
            'w-full rounded-2xl border bg-white/5 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/20 ' +
            (error ? 'border-red-500/50' : 'border-white/10') +
            ' ' +
            className
          }
        />
        {right ? <div className="absolute inset-y-0 right-3 flex items-center">{right}</div> : null}
      </div>
      {hint ? <p className="text-xs text-white/50">{hint}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
