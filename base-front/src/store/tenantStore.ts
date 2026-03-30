import { create } from 'zustand'

export type UserRole = 'admin' | 'assistant' | 'maintenance' | 'user' | string

interface TenantState {
  tenantId: string | null
  role: UserRole | null
  primaryColor: string
  companyName?: string

  setTenant: (args: { tenantId: string; role?: UserRole | null; primaryColor?: string; companyName?: string }) => void
  clear: () => void
}

export const useTenantStore = create<TenantState>((set) => ({
  tenantId: null,
  role: null,
  primaryColor: '#2563eb',
  companyName: undefined,

  setTenant: ({ tenantId, role, primaryColor, companyName }) =>
    set((s) => ({
      tenantId,
      role: role ?? s.role,
      primaryColor: primaryColor ?? s.primaryColor,
      companyName: companyName ?? s.companyName,
    })),

  clear: () => set({ tenantId: null, role: null, companyName: undefined }),
}))
