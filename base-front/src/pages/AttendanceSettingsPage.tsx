import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AttendanceService } from '../services/attendanceService'
import { AttendanceRulesForm } from '../components/AttendanceRulesForm'
import type { AttendanceRuleV2 } from '../types/attendance'

export function AttendanceSettingsPage({ supabase }: { supabase: SupabaseClient }) {
  const service = useMemo(() => new AttendanceService(supabase), [supabase])
  const [rules, setRules] = useState<AttendanceRuleV2 | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    service.getRules().then((rs) => setRules((rs as any).data ?? null))
  }, [service])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Configuración avanzada de asistencia</h1>
        <p className="mt-2 text-sm text-slate-400">Reglas multi-tenant v2: tolerancias, geocerca, biometría, IA y límites operativos.</p>
      </div>
      {message && <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-emerald-200">{message}</div>}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
        <AttendanceRulesForm
          initialValue={rules}
          onSave={async (input) => {
            const rs = await service.saveRules(input)
            if ((rs as any).error) throw (rs as any).error
            setMessage('Configuración guardada correctamente')
            setRules((rs as any).data ?? input)
          }}
        />
      </div>
    </div>
  )
}
