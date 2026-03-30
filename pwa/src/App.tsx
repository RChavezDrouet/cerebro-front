import React from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import BottomNav, { Tab } from './components/BottomNav'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import AttendanceHomePage from './pages/attendance/AttendanceHomePage'
import RequestsHomePage from './pages/requests/RequestsHomePage'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import SetPasswordPage from './pages/auth/SetPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

function HistoryRoute() {
  const { profile } = useAuth()
  if (!profile) return null
  return <HistoryPage profile={profile} />
}

function ProfileRoute() {
  const { profile, signOut } = useAuth()
  if (!profile) return null
  return <ProfilePage profile={profile} onSignOut={signOut} />
}

function ProtectedLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!profile) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--nova-muted)',
        }}
      >
        Cargando perfil...
      </div>
    )
  }

  const currentTab: Tab =
    location.pathname === '/history'
      ? 'history'
      : location.pathname === '/requests'
      ? 'requests'
      : location.pathname === '/profile'
      ? 'profile'
      : 'clock'

  const goToTab = (tab: Tab) => {
    const map: Record<Tab, string> = {
      clock: '/',
      history: '/history',
      requests: '/requests',
      profile: '/profile',
    }
    navigate(map[tab])
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header profile={profile} onSignOut={signOut} />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <BottomNav activeTab={currentTab} onChangeTab={goToTab} />
    </div>
  )
}

function AppRoutes() {
  const { mustChangePassword, session } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/set-password" element={<SetPasswordPage />} />

      <Route
        element={
          <ProtectedRoute>
            <ProtectedLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AttendanceHomePage />} />
        <Route path="/history" element={<HistoryRoute />} />
        <Route path="/requests" element={<RequestsHomePage />} />
        <Route path="/profile" element={<ProfileRoute />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={mustChangePassword ? '/auth/set-password' : '/'} replace />}
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}