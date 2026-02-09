/**
 * ==============================================
 * HRCloud - CEREBRO (Front)
 * ==============================================
 * - React + Vite + Supabase
 * - Diseño dark / neon (parametrizable desde Brand)
 * - Auth seguro (sin "loading infinito")
 * - Persistencia de ruta (evita perder pantalla al recargar)
 */

import React, { useEffect, useRef, useState, createContext, useContext } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase, getUserRole, getAppSettings, getRolePermissions } from './config/supabase'
import { applyBranding } from './theme/appTheme'

// Páginas
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TenantsPage from './pages/TenantsPage'
import TenantCreatePage from './pages/TenantCreatePage'
import InvoicesPage from './pages/InvoicesPage'
import SettingsPage from './pages/SettingsPage'
import AuditPage from './pages/AuditPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'

// Componentes
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'

type AuthContextValue = {
  permissions: Record<string, boolean>
  can: (permission: string) => boolean
  session: any
  user: any
  userRole: string | null
  loading: boolean
  initialized: boolean
  signOut: () => Promise<void>
  isAuthenticated: boolean
  isAdmin: boolean
  isAssistant: boolean
  isMaintenance: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

const LoadingScreen = ({ message = 'Cargando...' }: { message?: string }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="relative mx-auto w-20 h-20 rounded-3xl bg-[rgba(15,23,42,0.55)] border border-[rgba(148,163,184,0.12)] backdrop-blur-xl">
        <div className="absolute inset-0 rounded-3xl glow-border" />
        <div className="relative w-full h-full flex items-center justify-center">
          <div
            className="w-10 h-10 rounded-2xl"
            style={{ background: 'linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))' }}
          />
        </div>
      </div>
      <h2 className="mt-8 text-lg font-semibold text-slate-100">{import.meta.env.VITE_APP_NAME || 'HRCloud • Cerebro'}</h2>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
    </div>
  </div>
)

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [initialized, setInitialized] = useState<boolean>(false)
  const initializedRef = useRef<boolean>(false)

  // Branding global (Login + App). No bloquea el render.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await getAppSettings()
        if (!mounted) return
        applyBranding({
          primary_color: s?.primary_color,
          secondary_color: (s as any)?.secondary_color,
          accent_color: (s as any)?.accent_color,
        })
      } catch {
        applyBranding({})
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const resolveRoleSafe = async (email?: string | null) => {
      try {
        const role = await getUserRole({ email: email ?? null })
        return role || null
      } catch (e) {
        console.error('Error obteniendo rol:', e)
        return null
      }
    }

    const applySession = async (nextSession: any, source: string) => {
      try {
        if (!mounted) return
        const coldStart = !initializedRef.current
        if (coldStart) setLoading(true)

        setSession(nextSession ?? null)


        if (nextSession?.user) {
          setUser(nextSession.user)
          // Evitar mostrar un rol anterior (race logout/login o refresh rápido)
          setUserRole(null)
      setPermissions({})
            setPermissions({})

          const role = await resolveRoleSafe(nextSession.user?.email ?? null)
          if (!mounted) return

          if (!role) {
            console.error(`Usuario sin rol (${source}). Cerrando sesión (política segura).`)
            await supabase.auth.signOut()
            if (!mounted) return
            setSession(null)
            setUser(null)
            setUserRole(null)
          } else {
            setUserRole(role)

            // Cargar permisos por rol (role_permissions.permissions jsonb)
            try {
              const perms = await getRolePermissions(role)
              if (!mounted) return
              setPermissions(perms || {})
            } catch {
              setPermissions({})
            }
          }
        } else {
          setUser(null)
          setUserRole(null)
          setPermissions({})
        }
      } finally {
        if (!mounted) return
        if (!initializedRef.current) {
          initializedRef.current = true
          setInitialized(true)
        }
        setLoading(false)
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data?.session ?? null, 'getSession'))
      .catch((e) => {
        console.error('Error getSession:', e)
        applySession(null, 'getSession_error')
      })

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (import.meta.env.DEV) console.log('[Auth event]', event)
      applySession(nextSession ?? null, `onAuthStateChange:${event}`)
    })

    return () => {
      mounted = false
      data?.subscription?.unsubscribe?.()
    }
  }, [])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      setSession(null)
      setUser(null)
      setUserRole(null)
    }
  }

  const value: AuthContextValue = {
    session,
    user,
    userRole,
    permissions,
can: (permission: string) => {
  const p = String(permission || '').trim()
  if (!p) return true
  if (userRole === 'admin') return true
  if ((permissions as any)?.__all === true) return true
  return (permissions as any)?.[p] === true
},
    loading,
    initialized,
    signOut,
    isAuthenticated: !!session,
    isAdmin: userRole === 'admin',
    isAssistant: userRole === 'assistant',
    isMaintenance: userRole === 'maintenance',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const AppRoutes = () => {
  const { isAuthenticated, loading, userRole, initialized } = useAuth()
  const location = useLocation()

  const getStoredPath = () => '/dashboard'

  // Persistir ruta actual (reduce el problema de perder la pantalla)
  useEffect(() => {
    if (!isAuthenticated) return
    if (location.pathname === '/login') return
    try {
      window.localStorage.setItem('cerebro:last_path', location.pathname + location.search)
    } catch {}
  }, [isAuthenticated, location.pathname, location.search])

  const lastPath = getStoredPath()

  if (!initialized || loading) return <LoadingScreen message="Inicializando sesión..." />
  if (isAuthenticated && !userRole) return <LoadingScreen message="Cargando permisos..." />

  const enableAudit = String(import.meta.env.VITE_ENABLE_AUDIT_LOGS ?? 'true').toLowerCase() === 'true'

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace state={{ from: location }} /> : <LoginPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Navigate to="/dashboard" replace />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tenants"
        element={
          <ProtectedRoute requiredPermission="clients.view">
            <Layout>
              <TenantsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tenants/create"
        element={
          <ProtectedRoute requiredPermission="clients.view">
            <Layout>
              <TenantCreatePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoices"
        element={
          <ProtectedRoute requiredPermission="clients.view">
            <Layout>
              <InvoicesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredPermission="settings.view">
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit"
        element={
          enableAudit ? (
            <ProtectedRoute requiredPermission="audit.view">
              <Layout>
                <AuditPage />
              </Layout>
            </ProtectedRoute>
          ) : isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Layout>
              <NotFoundPage />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen">
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App

