import React from 'react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/config/supabase'
import { fetchTenantGate, resolveTenantId } from '@/lib/tenant'
import { ENV } from '@/lib/env'

const DISABLE_LOGIN = String(import.meta.env.VITE_DISABLE_LOGIN || '0') === '1'

export function TenantGate({ children }: { children: React.ReactNode }) {
  // ✅ Modo temporal de pruebas: no aplicar gate (ni llamadas) cuando el login está deshabilitado
  if (DISABLE_LOGIN) return <>{children}</>

  // ✅ Fase actual: si el gate está deshabilitado por configuración, no bloquea ni consulta nada.
  if (!ENV.TENANT_GATE_ENABLED) return <>{children}</>

  const [blocked, setBlocked] = React.useState(false)
  const [message, setMessage] = React.useState<string>('')
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!alive) return

        // Si no hay sesión, no aplica gate (evita bloquear login screen / pantallas públicas)
        if (error || !data?.session) {
          setChecked(true)
          return
        }

        const session = data.session
        const tenantId = await resolveTenantId(session.user.id)

        if (!alive) return

        if (!tenantId) {
          // En modo gate activo, por seguridad se bloquea si no se resuelve el tenant
          setBlocked(true)
          setMessage('No se pudo resolver la empresa del usuario. Contacte al administrador.')
          setChecked(true)
          return
        }

        const gate = await fetchTenantGate(tenantId)
        if (!alive) return

        if (gate && gate.status === 'paused') {
          setBlocked(true)
          setMessage(gate.paused_message ?? 'El servicio está temporalmente pausado para esta empresa.')
        }

        setChecked(true)
      } catch {
        // No exponer detalles internos (OWASP)
        if (!alive) return
        setBlocked(true)
        setMessage('No se pudo validar el estado de la empresa. Intente nuevamente.')
        setChecked(true)
      }
    }

    void run()

    return () => {
      alive = false
    }
  }, [])

  if (!checked) return <div className="text-sm text-gray-400">Validando empresa…</div>

  return (
    <>
      <Modal open={blocked} title="Empresa pausada" dismissible={false}>
        <div className="space-y-3 text-sm text-gray-200">
          <p>{message}</p>
          <p className="text-xs text-gray-400">Si crees que es un error, comunícate con tu proveedor.</p>
        </div>
      </Modal>
      {children}
    </>
  )
}

