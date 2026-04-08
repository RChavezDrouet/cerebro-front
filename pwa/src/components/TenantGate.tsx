/**
 * ============================================================
 * Base PWA â€” TenantGate.tsx
 * ============================================================
 * Guard que se ejecuta DESPUÃ‰S del login exitoso de Supabase.
 *
 * Responsabilidades:
 *  1. Resolver el tenant_id del empleado logueado.
 *  2. Consultar en CEREBRO (schema public) si la empresa estÃ¡ activa.
 *  3. Si estÃ¡ pausada/suspendida â†’ obtener el mensaje configurado en
 *     CEREBRO (app_settings.paused_message_title/body) y mostrarlo
 *     en un modal bloqueante sin dejar pasar.
 *  4. Si estÃ¡ activa â†’ renderizar children normalmente.
 *
 * Puntos de contacto con CEREBRO (solo lectura):
 *  - public.tenants         â†’ status, is_suspended
 *  - public.app_settings    â†’ paused_message_title, paused_message_body
 *
 * Base NUNCA escribe en tablas de CEREBRO.
 * ============================================================
 */

import React from 'react'
import { supabase } from '@/config/supabase'
import { resolveTenantId } from '@/lib/tenant'

// â”€â”€â”€ Helpers de entorno (Vite inyecta VITE_* en build-time) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const asBool = (v: unknown, def = false): boolean => {
  if (v === undefined || v === null) return def
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

const DISABLE_LOGIN        = asBool(import.meta.env.VITE_DISABLE_LOGIN,        false)
const AUTH_BYPASS          = asBool(import.meta.env.VITE_AUTH_BYPASS,          false)
const TENANT_GATE_ENABLED  = asBool(import.meta.env.VITE_TENANT_GATE_ENABLED,  true)

// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type GateStatus = 'checking' | 'ok' | 'blocked'

interface BlockedContent {
  title: string
  body:  string
}

// Mensajes de fallback si CEREBRO no devuelve configuraciÃ³n
const DEFAULT_BLOCKED: BlockedContent = {
  title: 'Servicio no disponible',
  body:  'El acceso para esta empresa estÃ¡ temporalmente suspendido. Contacte a su proveedor para mÃ¡s informaciÃ³n.',
}

const DEFAULT_ERROR: BlockedContent = {
  title: 'Error de validaciÃ³n',
  body:  'No se pudo verificar el estado de la empresa. Intente nuevamente o contacte al administrador.',
}

// â”€â”€â”€ Consulta cruzada a CEREBRO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Consulta el estado del tenant en CEREBRO (schema public).
 * Retorna null si falla la consulta.
 *
 * Requiere polÃ­tica RLS en public.tenants:
 *   CREATE POLICY "employees can read their tenant status"
 *   ON public.tenants FOR SELECT TO authenticated
 *   USING (id = (
 *     SELECT tenant_id FROM attendance.employees
 *     WHERE user_id = auth.uid() LIMIT 1
 *   ));
 */
async function fetchTenantStatus(tenantId: string): Promise<{
  status:       string
  is_suspended: boolean
} | null> {
  const { data, error } = await supabase
    .from('tenants')                           // schema public (CEREBRO)
    .select('status, is_suspended')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    console.warn('[TenantGate] No se pudo leer public.tenants:', error?.message)
    return null
  }

  return data as { status: string; is_suspended: boolean }
}

/**
 * Obtiene el mensaje de pausa configurado en CEREBRO.
 * Cae en DEFAULT_BLOCKED si no hay configuraciÃ³n.
 *
 * Requiere polÃ­tica RLS en public.app_settings:
 *   CREATE POLICY "authenticated can read app_settings"
 *   ON public.app_settings FOR SELECT TO authenticated
 *   USING (true);
 */
async function fetchPausedMessage(): Promise<BlockedContent> {
  const { data, error } = await supabase
    .from('app_settings')                      // schema public (CEREBRO)
    .select('paused_message_title, paused_message_body')
    .eq('id', 1)
    .single()

  if (error || !data) {
    console.warn('[TenantGate] No se pudo leer app_settings:', error?.message)
    return DEFAULT_BLOCKED
  }

  return {
    title: data.paused_message_title?.trim() || DEFAULT_BLOCKED.title,
    body:  data.paused_message_body?.trim()  || DEFAULT_BLOCKED.body,
  }
}

// â”€â”€â”€ Modal bloqueante â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BlockedModal({ title, body }: BlockedContent) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-red-500/30 bg-gray-900 p-8 shadow-2xl shadow-red-900/40">

        {/* Icono */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/40">
            <svg
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
        </div>

        {/* TÃ­tulo dinÃ¡mico desde CEREBRO */}
        <h2 className="mb-3 text-center text-xl font-bold text-red-300">
          {title}
        </h2>

        {/* Cuerpo dinÃ¡mico desde CEREBRO */}
        <p className="mb-6 text-center text-sm leading-relaxed text-gray-300">
          {body}
        </p>

        {/* Nota fija */}
        <p className="text-center text-xs text-gray-500">
          Si crees que es un error, comunÃ­cate con el proveedor del servicio.
        </p>

        {/* BotÃ³n de logout â€” permite al empleado cerrar sesiÃ³n y probar con otra cuenta */}
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          className="mt-6 w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:text-white"
        >
          Cerrar sesiÃ³n
        </button>
      </div>
    </div>
  )
}

// â”€â”€â”€ Spinner de validaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CheckingScreen() {
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-3 bg-gray-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
      <p className="text-sm text-gray-400">Verificando accesoâ€¦</p>
    </div>
  )
}

// â”€â”€â”€ Componente principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function TenantGate({ children }: { children: React.ReactNode }) {

  // Bypass completo para entornos de prueba
  if (DISABLE_LOGIN || AUTH_BYPASS) return <>{children}</>

  // Gate deshabilitado por variable de entorno
  if (!TENANT_GATE_ENABLED) return <>{children}</>

  const [gateStatus, setGateStatus] = React.useState<GateStatus>('checking')
  const [blocked,    setBlocked]    = React.useState<BlockedContent>(DEFAULT_BLOCKED)

  React.useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        // 1. Verificar sesiÃ³n activa
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (!alive) return

        if (sessionError || !sessionData?.session) {
          // Sin sesiÃ³n â†’ no bloquear (el ProtectedRoute se encarga de redirigir a /login)
          setGateStatus('ok')
          return
        }

        const userId = sessionData.session.user.id

        // 2. Resolver tenant_id del empleado logueado (desde attendance.employees)
        const tenantId = await resolveTenantId(userId)
        if (!alive) return

        if (!tenantId) {
          // Empleado sin empresa asignada â†’ bloquear con mensaje genÃ©rico
          setBlocked({
            title: 'Empresa no asignada',
            body:  'Tu usuario no estÃ¡ vinculado a ninguna empresa. Contacta al administrador.',
          })
          setGateStatus('blocked')
          return
        }

        // 3. Consultar estado del tenant en CEREBRO (public.tenants)
        const tenantData = await fetchTenantStatus(tenantId)
        if (!alive) return

        if (!tenantData) {
          // No se pudo leer â†’ bloquear por seguridad (no permitir bypass por fallo)
          setBlocked(DEFAULT_ERROR)
          setGateStatus('blocked')
          return
        }

        // 4. Evaluar si estÃ¡ activa
        //    Bloqueado si: status != 'active'  OR  is_suspended = true
        const isBlocked = tenantData.status !== 'active' || tenantData.is_suspended === true

        if (isBlocked) {
          // 5. Obtener mensaje configurado en CEREBRO (app_settings)
          const message = await fetchPausedMessage()
          if (!alive) return

          setBlocked(message)
          setGateStatus('blocked')
          return
        }

        // 6. Todo ok â†’ dejar pasar
        setGateStatus('ok')

      } catch (err) {
        if (!alive) return
        console.error('[TenantGate] Error inesperado:', err)
        setBlocked(DEFAULT_ERROR)
        setGateStatus('blocked')
      }
    }

    void run()

    return () => { alive = false }
  }, [])

  // Mientras verifica
  if (gateStatus === 'checking') return <CheckingScreen />

  // Bloqueado: modal encima de children (children NO se renderizan debajo)
  if (gateStatus === 'blocked') {
    return <BlockedModal title={blocked.title} body={blocked.body} />
  }

  // Ok: renderizar normalmente
  return <>{children}</>
}
