// src/lib/permissions.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { cerebro } from '@/config/supabase'

type PermUser = { email: string; role: string }

type PermissionsContextValue = {
  loading: boolean
  user: PermUser | null
  permissions: string[]
  can: (perm: string) => boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

type ProviderProps = {
  userEmail: string
  role: string
  children: React.ReactNode
}

/**
 * Provider de permisos granulares.
 * - Admin: bypass total
 * - Otros roles: carga permisos desde cerebro.role_permissions (string[])
 */
export function PermissionsProvider({ userEmail, role, children }: ProviderProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<PermUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const u: PermUser = { email: userEmail, role }
      setUser(u)

      // Admin bypass
      if (role === 'admin') {
        setPermissions(['*'])
        return
      }

      const { data, error } = await cerebro
        .from('role_permissions')
        .select('permissions')
        .eq('role', role)
        .maybeSingle()

      if (error) {
        console.warn('[PermissionsProvider] role_permissions error:', error)
        setPermissions([])
        return
      }

      const perms = (data as any)?.permissions
      setPermissions(Array.isArray(perms) ? perms : [])
    } catch (e) {
      console.warn('[PermissionsProvider] load failed:', e)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [userEmail, role])

  useEffect(() => {
    load()
  }, [load])

  const can = useCallback(
    (perm: string) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return permissions.includes('*') || permissions.includes(perm)
    },
    [user, permissions]
  )

  const value = useMemo<PermissionsContextValue>(
    () => ({
      loading,
      user,
      permissions,
      can,
      refresh: load,
    }),
    [loading, user, permissions, can, load]
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions() must be used inside <PermissionsProvider>')
  return ctx
}
