import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/layout/AppShell'

import LoginPage from '@/pages/auth/LoginPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import SetPasswordPage from '@/pages/auth/SetPasswordPage'

import DashboardPage from '@/pages/dashboard/DashboardPage'

import EmployeesPage from '@/pages/employees/EmployeesPage'
import EmployeeFormPage from '@/pages/employees/EmployeeFormPage'
import EmployeeDetailPage from '@/pages/employees/EmployeeDetailPage'

import AttendanceHomePage from '@/pages/attendance/AttendanceHomePage'
import DailyAttendanceReportPage from '@/pages/attendance/DailyAttendanceReportPage'
import AttendanceNoveltiesPage from '@/pages/attendance/AttendanceNoveltiesPage'
import UsbImportPage from '@/pages/attendance/UsbImportPage'

import ConfigHomePage from '@/pages/config/ConfigHomePage'
import CompanyConfigPage from '@/pages/config/CompanyConfigPage'
import FacialRecognitionPage from '@/pages/config/FacialRecognitionPage'
import MarkingParamsPage from '@/pages/config/MarkingParamsPage'
import SecurityConfigPage from '@/pages/config/SecurityConfigPage'
import EmailConfigPage from '@/pages/config/EmailConfigPage'
import ReportsConfigPage from '@/pages/config/ReportsConfigPage'
import BiometricAliasesPage from '@/pages/config/BiometricAliasesPage'
import RolesPermissionsPage from '@/pages/config/RolesPermissionsPage'
import HolidaysPage from '@/pages/config/HolidaysPage'
import KpiConfigPage from '@/pages/config/KpiConfigPage'
import SchedulesPage from '@/pages/config/SchedulesPage'
import TurnsPage from '@/pages/config/TurnsPage'
import TurnosHorariosPage from '@/pages/config/TurnosHorariosPage'
import OrgStructurePage from '@/pages/config/OrgStructurePage'
import MarcacionConfigPage from '@/pages/config/MarcacionConfigPage'
import LaborRegimeConfigPage from './pages/cira/LaborRegimeConfigPage'
import FineConfigPage from './pages/cira/FineConfigPage'
import OvertimeRequestsPage from './pages/cira/OvertimeRequestsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white/70">Cargando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/set-password" element={<SetPasswordPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />

          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/new" element={<EmployeeFormPage mode="create" />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/employees/:id/edit" element={<EmployeeFormPage mode="edit" />} />

          <Route path="/attendance" element={<AttendanceHomePage />} />
          <Route path="/attendance/daily" element={<DailyAttendanceReportPage />} />
          <Route path="/attendance/novelties" element={<AttendanceNoveltiesPage />} />
          <Route path="/attendance/usb-import" element={<UsbImportPage />} />
          <Route path="/attendance/detail" element={<Navigate to="/attendance/daily" replace />} />

          <Route path="/reports/diario" element={<DailyAttendanceReportPage />} />
          <Route path="/reports/detailed" element={<Navigate to="/attendance/daily" replace />} />

          <Route path="/config" element={<ConfigHomePage />} />
          <Route path="/config/company" element={<CompanyConfigPage />} />
          <Route path="/config/reconocimiento-facial" element={<FacialRecognitionPage />} />
          <Route path="/config/marcacion" element={<MarkingParamsPage />} />
          <Route path="/config/marcacion-avanzada" element={<MarcacionConfigPage />} />
          <Route path="/config/biometricos" element={<BiometricAliasesPage />} />
          <Route path="/config/horarios" element={<SchedulesPage />} />
          <Route path="/config/turnos" element={<TurnsPage />} />
          <Route path="/config/turnos-horarios" element={<TurnosHorariosPage />} />
          <Route path="/config/organizacional" element={<OrgStructurePage />} />
          <Route path="/config/organigrama" element={<Navigate to="/config/organizacional" replace />} />
          <Route path="/config/estructura-organizacional" element={<Navigate to="/config/organizacional" replace />} />
          <Route path="/config/cira/regimen-laboral" element={<LaborRegimeConfigPage />} />
          <Route path="/config/cira/multas" element={<FineConfigPage />} />
          <Route path="/config/cira/horas-extra" element={<OvertimeRequestsPage />} />
          <Route path="/config/roles-permisos" element={<RolesPermissionsPage />} />
          <Route path="/config/feriados" element={<HolidaysPage />} />
          <Route path="/config/holidays" element={<Navigate to="/config/feriados" replace />} />
          <Route path="/config/kpis" element={<KpiConfigPage />} />
          <Route path="/config/seguridad" element={<SecurityConfigPage />} />
          <Route path="/config/correo" element={<EmailConfigPage />} />
          <Route path="/config/reportes" element={<ReportsConfigPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
