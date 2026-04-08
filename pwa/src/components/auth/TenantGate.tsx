/**
 * TenantGate.tsx — Base PWA v4.2.1
 * 
 * Componente guard que envuelve toda la aplicación autenticada.
 * Verifica que la empresa del usuario esté activa en public.tenants.
 * Si está pausada/suspendida, muestra un modal bloqueante con el mensaje
 * configurado en public.app_settings (paused_message_title / paused_message_body).
 * 
 * IMPORTANTE: Este componente cierra la sesión del usuario cuando detecta
 * que el tenant está pausado, dejando la pantalla de alerta visible.
 * El usuario no puede interactuar con la app hasta cerrar el modal y volver al login.
 * 
 * Integración en App.tsx:
 *   <BrandingProvider tenantId={tenantId}>
 *     <TenantGate>           ← aquí
 *       <FirstLoginModal ... />
 *       <AppShell ...>...</AppShell>
 *     </TenantGate>
 *   </BrandingProvider>
 */
import React, { useEffect, useState } from 'react'
import { supabase } from '@/config/supabase'
import { resolveTenantId } from '@/lib/tenant'
import { AlertOctagon } from 'lucide-react'

interface TenantGateProps {
  children: React.ReactNode
}

interface SuspendedState {
  title: string
  body: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getTenantStatus(userId: string): Promise<SuspendedState | null> {
  const tenantId = await resolveTenantId(userId)
  if (!tenantId) return null

  const { data: tenant } = await supabase
    .from('tenants')
    .select('status')
    .eq('id', tenantId)
    .maybeSingle()

  const isPaused = !tenant || tenant.status === 'paused'
  if (!isPaused) return null

  // Obtener mensaje desde app_settings
  const { data: settings } = await supabase
    .from('app_settings')
    .select('paused_message_title, paused_message_body')
    .limit(1)
    .maybeSingle()

  return {
    title: settings?.paused_message_title ?? 'Empresa suspendida',
    body:
      settings?.paused_message_body ??
      'Tu empresa está temporalmente suspendida. Contacta al administrador o al soporte de HRCloud.',
  }
}

// ─── Modal bloqueante ─────────────────────────────────────────────────────────

function SuspendedModal({ title, body }: SuspendedState) {
  const handleClose = async () => {
    await supabase.auth.signOut()
    // onAuthStateChange en App.tsx redirigirá al login automáticamente
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Banda amber superior */}
        <div style={{ height: '4px', background: '#F59E0B' }} />

        <div className="p-8">
          {/* Icono */}
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.4)' }}
            >
              <AlertOctagon size={30} style={{ color: '#F59E0B' }} />
            </div>
          </div>

          {/* Título */}
          <h2 className="text-xl font-bold text-center mb-3" style={{ color: 'var(--color-text)' }}>
            {title}
          </h2>

          {/* Mensaje */}
          <p
            className="text-sm text-center leading-relaxed whitespace-pre-line"
            style={{ color: 'var(--color-muted)' }}
          >
            {body}
          </p>

          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs text-center mb-4" style={{ color: 'var(--color-muted)' }}>
              Si crees que esto es un error, contacta al administrador de tu empresa.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl font-medium transition"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TenantGate ───────────────────────────────────────────────────────────────

export function TenantGate({ children }: TenantGateProps) {
  const [checking,  setChecking]  = useState(true)
  const [suspended, setSuspended] = useState<SuspendedState | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setChecking(false); return }

      const status = await getTenantStatus(data.user.id)
      setSuspended(status)
      setChecking(false)
    })
  }, [])

  // Mientras verifica, mostrar los children (ya hay un Spinner en AuthenticatedApp)
  if (checking) return <>{children}</>

  // Tenant suspendido → modal bloqueante encima de los children
  return (
    <>
      {children}
      {suspended && <SuspendedModal title={suspended.title} body={suspended.body} />}
    </>
  )
}
