import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AppErrorBoundary } from '../components/AppErrorBoundary'
import { TenantPausedModal } from '../components/TenantPausedModal'
import { useTenantGate } from '../hooks/useTenantGate'
import { AttendanceSettingsPage } from './AttendanceSettingsPage'
import { AttendanceReportsPage } from './AttendanceReportsPage'

export function BootstrapExample({ supabase }: { supabase: SupabaseClient }) {
  const gate = useTenantGate(supabase)

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <TenantPausedModal open={!gate.loading && !gate.allowed && gate.status !== 'unknown'} message={gate.message} />
        {!gate.loading && gate.allowed && (
          <Routes>
            <Route path="/attendance/settings" element={<AttendanceSettingsPage supabase={supabase} />} />
            <Route path="/attendance/reports" element={<AttendanceReportsPage supabase={supabase} />} />
          </Routes>
        )}
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
