/**
 * ==============================================
 * CEREBRO SaaS - Ruta Protegida
 * ==============================================
 * 
 * Componente para proteger rutas que requieren autenticación
 * y verificación de roles.
 */

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../App'

/**
 * Componente de carga para verificación
 */
const LoadingVerification = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
      <p className="mt-4 text-slate-600 font-medium">Verificando acceso...</p>
    </div>
  </div>
)

/**
 * Componente de acceso denegado
 */
const AccessDenied = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="text-center max-w-md">
      <div className="w-20 h-20 mx-auto bg-danger-100 rounded-full flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-danger-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        Acceso Denegado
      </h2>
      <p className="text-slate-600 mb-6">
        No tiene permisos para acceder a esta sección. 
        Contacte al administrador si cree que esto es un error.
      </p>
      
      <a
        href="/dashboard"
        className="btn-primary inline-flex"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        Volver al Dashboard
      </a>
    </div>
  </div>
)

/**
 * Componente de Ruta Protegida
 * 
 * @param {object} props
 * @param {React.ReactNode} props.children - Contenido a renderizar si está autorizado
 * @param {string[]} props.allowedRoles - Roles permitidos para acceder (opcional)
 * @param {string} props.requiredPermission - Permiso requerido (opcional)
 * @param {string} props.redirectTo - Ruta de redirección si no está autenticado
 */
const ProtectedRoute = ({
  children,
  allowedRoles = null,
  requiredPermission = null,
  redirectTo = '/login',
}) => {
  const { isAuthenticated, userRole, loading, initialized, can } = useAuth()
  const location = useLocation()

  // Mientras se verifica la autenticación
  if (!initialized || loading) {
    return <LoadingVerification />
  }

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location }}
      />
    )
  }

  // Verificar roles permitidos
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <AccessDenied />
  }

  // TODO: Implementar verificación de permisos específicos
  // cuando se integre con la matriz de permisos del backend
  // if (requiredPermission) {
  //   const hasPermission = await checkPermission(requiredPermission)
  //   if (!hasPermission) return <AccessDenied />
  // }

  // Usuario autorizado, renderizar contenido
  return children
}

export default ProtectedRoute
