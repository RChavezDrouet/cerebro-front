import React from 'react'

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

export function Select({ label, error, className = '', children, ...props }: Props) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm text-gray-300">{label}</div> : null}
      <select
        className={`w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-500 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? <div className="mt-1 text-xs text-rose-300">{error}</div> : null}
    </label>
  )
}
