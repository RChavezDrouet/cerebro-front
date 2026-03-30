/**
 * BrandingProvider.tsx — Base PWA v4.1.0
 * Carga branding del tenant (logo + 5 colores + tema) y lo aplica via CSS variables.
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { loadBranding, DEFAULT_BRANDING } from '@/lib/branding'
import type { BaseTenantConfig } from '@/types'

interface BrandingContext {
  branding: BaseTenantConfig
  logoUrl: string | null
  refresh: () => Promise<void>
}

const Ctx = createContext<BrandingContext>({
  branding: DEFAULT_BRANDING,
  logoUrl: null,
  refresh: async () => {},
})

export function useBranding() { return useContext(Ctx) }

export function BrandingProvider({ tenantId, children }: {
  tenantId: string | null
  children: React.ReactNode
}) {
  const [branding, setBranding] = useState<BaseTenantConfig>(DEFAULT_BRANDING)
  const [logoUrl,  setLogoUrl]  = useState<string | null>(null)

  const refresh = async () => {
    if (!tenantId) return
    const data = await loadBranding(tenantId)
    if (data) {
      setBranding(data)
      if (data.company_logo_path) {
        // Construir URL publica del logo en Supabase Storage
        const base = import.meta.env.VITE_SUPABASE_URL
        setLogoUrl(`${base}/storage/v1/object/public/tenant-assets/${data.company_logo_path}`)
      }
    }
  }

  useEffect(() => { refresh() }, [tenantId])

  return (
    <Ctx.Provider value={{ branding, logoUrl, refresh }}>
      {children}
    </Ctx.Provider>
  )
}
