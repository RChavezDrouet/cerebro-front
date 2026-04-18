import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AttendanceService } from '../services/attendanceService'
import { AttendanceDashboard } from '../components/AttendanceDashboard'

export function AttendanceReportsPage({ supabase }: { supabase: SupabaseClient }) {
  const service = useMemo(() => new AttendanceService(supabase), [supabase])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dailyRows, setDailyRows] = useState<any[]>([])
  const [novelties, setNovelties] = useState<any[]>([])
  const [ranking, setRanking] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      service.getDailyAttendance(date, date),
      service.getNovelties(date),
      service.getPunctualityRanking(),
    ]).then(([daily, nov, rank]) => {
      setDailyRows((daily as any).data ?? [])
      setNovelties((nov as any).data ?? [])
      setRanking((rank as any).data ?? [])
    })
  }, [service, date])

  const metrics = {
    present: dailyRows.filter((r) => r.day_status === 'PRESENTE').length,
    late: dailyRows.filter((r) => r.entry_status === 'ATRASADO').length,
    absent: dailyRows.filter((r) => r.day_status === 'AUSENTE').length,
    novelties: novelties.length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Reportes profesionales</h1>
          <p className="mt-2 text-sm text-slate-400">Asistencia diaria, novedades, ranking de puntualidad y dataset listo para exportación real.</p>
        </div>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
        </label>
      </div>

      <AttendanceDashboard metrics={metrics} />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Novedades del día</h2>
          <div className="space-y-3">
            {novelties.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="text-sm text-slate-400">{item.employee_name} · {item.type} · {item.detected_by}</div>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">{item.severity}</span>
                </div>
                {item.description && <p className="mt-2 text-sm text-slate-300">{item.description}</p>}
              </div>
            ))}
            {novelties.length === 0 && <div className="text-sm text-slate-400">No existen novedades para la fecha seleccionada.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Ranking de puntualidad</h2>
          <div className="space-y-3">
            {ranking.slice(0, 10).map((item, index) => (
              <div key={item.employee_id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                <div>
                  <div className="font-medium text-white">#{index + 1} {item.employee_name}</div>
                  <div className="text-sm text-slate-400">{item.department_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-cyan-300">{item.punctuality_pct}%</div>
                  <div className="text-xs text-slate-400">{item.on_time_days} en tiempo</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
