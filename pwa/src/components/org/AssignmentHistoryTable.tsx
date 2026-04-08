import React from 'react'

type Row = {
  effective_from?: string | null
  effective_to?: string | null
  label: string
}

export function AssignmentHistoryTable({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return <div className="text-sm text-white/50">Sin historial adicional.</div>
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/50 border-b border-white/10">
            <th className="py-2 text-left">Desde</th>
            <th className="py-2 text-left">Hasta</th>
            <th className="py-2 text-left">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.label}-${idx}`} className="border-b border-white/5">
              <td className="py-2">{row.effective_from ?? '—'}</td>
              <td className="py-2">{row.effective_to ?? 'Actual'}</td>
              <td className="py-2">{row.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
