import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import TenantGate from './TenantGate'

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const { loading, session, mustChangePassword } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--nova-muted)',
        }}
      >
        Validando sesión...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (mustChangePassword && location.pathname !== '/auth/set-password') {
    return <Navigate to="/auth/set-password" replace />
  }

  return <TenantGate>{children}</TenantGate>
}