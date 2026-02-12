import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import TurnsPage from '@/pages/attendance/TurnsPage'
import SchedulesPage from '@/pages/attendance/SchedulesPage'
import AttendanceReportPage from '@/pages/attendance/AttendanceReportPage'
import EmployeesPage from '@/pages/employees/EmployeesPage'
import EmployeeFormPage from '@/pages/employees/EmployeeFormPage'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { TenantGate } from '@/components/TenantGate'
import { AppShell } from '@/components/AppShell'

const AUTH_BYPASS = String(import.meta.env.VITE_AUTH_BYPASS || '0') === '1'

export default function App() {
  // ✅ MODO PRUEBAS: sin login / sin tenant gate / sin protected route
  if (AUTH_BYPASS) {
    return (
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/config/turnos" element={<TurnsPage />} />
          <Route path="/config/horarios" element={<SchedulesPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/new" element={<EmployeeFormPage mode="create" />} />
          <Route path="/employees/:id" element={<EmployeeFormPage mode="edit" />} />
          <Route path="/attendance/report" element={<AttendanceReportPage />} />

          {/* Si alguien entra a /login, lo mandamos al reporte */}
          <Route path="/login" element={<Navigate to="/attendance/report" replace />} />
          <Route path="*" element={<Navigate to="/attendance/report" replace />} />
        </Routes>
      </AppShell>
    )
  }

  // 🔒 MODO NORMAL (con login)
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <TenantGate>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/config/turnos" element={<TurnsPage />} />
                  <Route path="/config/horarios" element={<SchedulesPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/employees/new" element={<EmployeeFormPage mode="create" />} />
                  <Route path="/employees/:id" element={<EmployeeFormPage mode="edit" />} />
                  <Route path="/attendance/report" element={<AttendanceReportPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </TenantGate>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
