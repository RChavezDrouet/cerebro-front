import React from 'react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/config/supabase'
import { fetchTenantGate, resolveTenantId } from '@/lib/tenant'

// Helpers de env (Vite inyecta VITE_* en build-time)
const asBool = (v: unknown, def = false) => {
  if (v === undefined || v === null) return def
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

const DISABLE_LOGIN = asBool(import.meta.env.VITE_DISABLE_LOGIN, false)
const AUTH_BYPASS = asBool(import.meta.env.VITE_AUTH_BYPASS, false)
const TENANT_GATE_ENABLED = asBool(import.meta.env.VITE_TENANT_GATE_ENABLED, true)

export function TenantGate({ children }: { children: React.ReactNode }) {
  // ✅ Modo pruebas / bypass: no aplicar gate (evita bloquear navegación sin sesión real)
  if (DISABLE_LOGIN || AUTH_BYPASS) return <>{children}</>

  // ✅ Si el gate está deshabilitado por env, no consulta ni bloquea
  if (!TENANT_GATE_ENABLED) return <>{children}</>

  const [blocked, setBlocked] = React.useState(false)
  const [message, setMessage] = React.useState<string>('')
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!alive) return

        // Si no hay sesión, no aplicar gate (no bloquea login/páginas públicas)
        if (error || !data?.session) {
          setChecked(true)
          return
        }

        const userId = data.session.user.id
        const tenantId = await resolveTenantId(userId)
        if (!alive) return

        if (!tenantId) {
          // Gate activo: por seguridad bloquea si no se puede resolver tenant
          setBlocked(true)
          setMessage('No se pudo resolver la empresa del usuario. Contacte al administrador.')
          setChecked(true)
          return
        }

        const gate = await fetchTenantGate(tenantId)
        if (!alive) return

        // Si no se pudo leer gate, bloquea (evita bypass por fallo de consulta)
        if (!gate) {
          setBlocked(true)
          setMessage('No se pudo validar el estado de la empresa. Intente nuevamente.')
          setChecked(true)
          return
        }

        if (gate.status === 'paused') {
          setBlocked(true)
          // ✅ Ya NO usamos paused_message (no existe en public.tenants)
          setMessage('El servicio está temporalmente pausado para esta empresa. Contacte a su proveedor.')
        }

        setChecked(true)
      } catch {
        if (!alive) return
        // No exponer detalles internos
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

