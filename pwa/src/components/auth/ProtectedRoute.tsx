import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import TenantGate from './TenantGate'

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const { loading, session, mustChangePassword, error, signOut } = useAuth()
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

  // Sesión válida pero perfil no resolvió — mostrar error con opción de cerrar sesión
  if (error) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <div
          className="nova-card"
          style={{ maxWidth: 420, width: '100%', padding: 24, textAlign: 'center' }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
          <h2 style={{ margin: 0, color: 'var(--nova-text)' }}>Acceso denegado</h2>
          <p style={{ color: 'var(--nova-muted)', marginTop: 12 }}>{error}</p>
          <button className="btn-nova-primary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <TenantGate>{children}</TenantGate>
}