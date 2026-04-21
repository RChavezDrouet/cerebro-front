import React from 'react'

type Option = { value: string; label: string }

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccione...',
  error,
  disabled = false,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  error?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      {label ? <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label> : null}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full min-h-11 appearance-none rounded-2xl border bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text-primary)] transition-colors duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ' +
          (error ? 'border-[var(--danger)]' : 'border-[var(--border-subtle)]')
        }
      >
        <option value="" className="bg-[var(--color-header)] text-white">
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--color-header)] text-white">
            {o.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
