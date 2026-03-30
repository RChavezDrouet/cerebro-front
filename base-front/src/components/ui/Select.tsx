import React from 'react'

type Option = { value: string; label: string }

export function Select({ label, value, onChange, options, placeholder = 'Seleccione…', error }: { label?: string; value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; error?: string }) {
  return (
    <div className="space-y-1">
      {label ? <label className="text-sm font-medium text-white/80">{label}</label> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full appearance-none rounded-2xl border bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-white/20 ' +
          (error ? 'border-red-500/50' : 'border-white/10')
        }
      >
        <option value="" className="bg-slate-900 text-white">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-900 text-white">
            {o.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
