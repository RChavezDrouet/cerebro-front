import { AlertTriangle, CheckCircle2, Clock3, UserX } from 'lucide-react'

export function AttendanceDashboard({ metrics }: { metrics: { present: number; late: number; absent: number; novelties: number } }) {
  const cards = [
    { label: 'Presentes', value: metrics.present, Icon: CheckCircle2 },
    { label: 'Tardanzas', value: metrics.late, Icon: Clock3 },
    { label: 'Ausentes', value: metrics.absent, Icon: UserX },
    { label: 'Novedades', value: metrics.novelties, Icon: AlertTriangle },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, Icon }) => (
        <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-slate-950/40">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">{label}</span>
            <Icon className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-semibold text-white">{value}</div>
        </div>
      ))}
    </div>
  )
}
