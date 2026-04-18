import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AttendanceService } from '../services/attendanceService'
import type { EmployeeEnterpriseProfile } from '../types/attendance'

export function EmployeeProfileEnterprisePage({ supabase, employeeId }: { supabase: SupabaseClient; employeeId: string }) {
  const service = useMemo(() => new AttendanceService(supabase), [supabase])
  const [profile, setProfile] = useState<EmployeeEnterpriseProfile>({ work_modality: 'presencial' })

  useEffect(() => {
    service.getEmployeeProfile(employeeId).then((rs) => {
      if ((rs as any).data) setProfile((rs as any).data)
    })
  }, [service, employeeId])

  const setField = <K extends keyof EmployeeEnterpriseProfile>(key: K, value: EmployeeEnterpriseProfile[K]) => setProfile((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Ficha de colaborador enterprise</h1>
        <p className="mt-2 text-sm text-slate-400">Pestañas ERP: personales, emergencia, salud, geocerca, biometría e historial.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Datos personales</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Email personal" value={profile.personal_email ?? ''} onChange={(e) => setField('personal_email', e.target.value)} />
            <input className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Móvil" value={profile.mobile_phone ?? ''} onChange={(e) => setField('mobile_phone', e.target.value)} />
            <select className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={profile.work_modality} onChange={(e) => setField('work_modality', e.target.value as EmployeeEnterpriseProfile['work_modality'])}>
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
              <option value="mixto">Mixto</option>
            </select>
            <input className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Código biométrico" value={profile.biometric_code ?? ''} onChange={(e) => setField('biometric_code', e.target.value)} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Emergencia y salud</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Contacto emergencia" value={profile.emergency_contact_name ?? ''} onChange={(e) => setField('emergency_contact_name', e.target.value)} />
            <input className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Relación" value={profile.emergency_contact_relationship ?? ''} onChange={(e) => setField('emergency_contact_relationship', e.target.value)} />
            <input className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Teléfono emergencia" value={profile.emergency_contact_phone ?? ''} onChange={(e) => setField('emergency_contact_phone', e.target.value)} />
            <textarea className="min-h-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Notas médicas" value={profile.medical_notes ?? ''} onChange={(e) => setField('medical_notes', e.target.value)} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <input type="number" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Latitud geofence" value={profile.geofence_lat ?? ''} onChange={(e) => setField('geofence_lat', Number(e.target.value))} />
          <input type="number" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Longitud geofence" value={profile.geofence_lng ?? ''} onChange={(e) => setField('geofence_lng', Number(e.target.value))} />
          <input type="number" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Radio geofence" value={profile.geofence_radius_m ?? ''} onChange={(e) => setField('geofence_radius_m', Number(e.target.value))} />
        </div>
        <div className="mt-4">
          <button
            className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950"
            onClick={async () => {
              await service.upsertEmployeeProfile(employeeId, profile)
              alert('Ficha enterprise actualizada')
            }}
          >
            Guardar ficha
          </button>
        </div>
      </section>
    </div>
  )
}
