/**
 * LoginPage.tsx — Base PWA v4.3.5
 *
 * FIXES v4.3.5:
 *  - checkTenantStatus: eliminada consulta a public.app_settings (error 42501
 *    para usuarios de Base — tabla exclusiva de CEREBRO admin). Mensaje fijo.
 *  - checkTenantStatus: si tenant es null (fallo RLS) → NO marcar como pausado.
 *    Antes: `!tenant || tenant.status === 'paused'` bloqueaba cuando la consulta
 *    fallaba aunque la empresa estuviera activa.
 *  - FASE 4: navega con window.location.replace('/') en vez de esperar
 *    onAuthStateChange, que tiene un race condition con ProtectedRoute.
 *
 * Funcionalidades mantenidas:
 *  - Detecta primer login via attendance.employees.first_login_pending
 *  - Si first_login_pending = true → redirige a /auth/set-password
 *  - BrandingProvider, forgot password, OWASP anti-enum, estilos intactos
 */
import React, { useEffect, useState } from 'react'
import { supabase } from '@/config/supabase'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, AlertTriangle, X } from 'lucide-react'
import { useBranding } from '@/components/branding/BrandingProvider'

type Mode = 'login' | 'forgot'

// ─── Helper: verificar primer login ──────────────────────────────────────────
async function checkFirstLoginPending(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .schema('attendance')
      .from('employees')
      .select('first_login_pending')
      .eq('user_id', userId)
      .maybeSingle()
    return data?.first_login_pending === true
  } catch {
    return false
  }
}

// ─── Helper: verificar estado del tenant ─────────────────────────────────────
// ✅ FIX v4.3.5:
//   - Si tenant es null (fallo RLS) → NO marcar como pausado
//   - Eliminada consulta a app_settings (error 42501 para usuarios de Base)
//   - Mensaje de suspensión ahora es texto fijo
async function checkTenantStatus(userId: string): Promise<{
  paused: boolean
  title: string
  body: string
}> {
  const ok = { paused: false, title: '', body: '' }

  try {
    // 1. Obtener tenant_id del perfil del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle()

    // ✅ FIX: sin tenant_id → NO bloquear (puede ser tenant_admin sin empleado)
    if (!profile?.tenant_id) return ok

    // 2. Verificar estado del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('status')
      .eq('id', profile.tenant_id)
      .maybeSingle()

    // ✅ FIX: tenant null (fallo de lectura RLS) → NO bloquear
    // Antes: `!tenant || tenant.status === 'paused'` bloqueaba incorrectamente
    if (!tenant) return ok
    if (tenant.status !== 'paused') return ok

    // 3. ✅ FIX: Mensaje fijo — ya NO consultar app_settings
    // app_settings tiene RLS exclusivo para admins de CEREBRO (error 42501 para Base)
    return {
      paused: true,
      title: 'Empresa suspendida',
      body:  'Tu empresa está temporalmente suspendida. Contacta al soporte para más información.',
    }
  } catch {
    // En caso de error inesperado → NO bloquear
    return ok
  }
}

// ─── Banner inline de empresa suspendida ─────────────────────────────────────
function TenantSuspendedBanner({
  title,
  body,
  onClose,
}: {
  title: string
  body: string
  onClose: () => void
}) {
  return (
    <div
      className="rounded-xl p-4 border flex gap-3 animate-fade-in"
      style={{
        background:   'rgba(245,158,11,0.10)',
        borderColor:  'rgba(245,158,11,0.35)',
      }}
    >
      <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-1" style={{ color: '#F59E0B' }}>
          {title}
        </p>
        <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-muted)' }}>
          {body}
        </p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 mt-0.5 transition"
        style={{ color: 'var(--color-muted)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LoginPage() {
  const { logoUrl, branding } = useBranding()
  const [mode,     setMode]  = useState<Mode>('login')
  const [email,    setEmail] = useState('')
  const [password, setPwd]   = useState('')
  const [show,     setShow]  = useState(false)
  const [loading,  setLoad]  = useState(false)
  const [sent,     setSent]  = useState(false)

  const [tenantPaused, setTenantPaused] = useState<{ title: string; body: string } | null>(null)

  // Prefill email desde ?email=...
  useEffect(() => {
    const u  = new URLSearchParams(window.location.search)
    const em = u.get('email')
    if (em) setEmail(em)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Complete todos los campos'); return }

    setLoad(true)
    setTenantPaused(null)

    try {
      // FASE 1: Autenticación Supabase Auth
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error || !authData.user) {
        if (error?.message.includes('Invalid')) toast.error('Correo o contraseña incorrectos')
        else toast.error(error?.message ?? 'Error de autenticación')
        return
      }

      const userId = authData.user.id

      // FASE 2: ¿Primer login?
      const isFirstLogin = await checkFirstLoginPending(userId)
      if (isFirstLogin) {
        window.location.href = '/auth/set-password'
        return
      }

      // FASE 3: Verificar estado del tenant
      const tenantStatus = await checkTenantStatus(userId)
      if (tenantStatus.paused) {
        await supabase.auth.signOut()
        setTenantPaused({ title: tenantStatus.title, body: tenantStatus.body })
        return
      }

      // ✅ FIX FASE 4: Navegar con window.location.replace en vez de esperar
      // onAuthStateChange. El navigate() de React Router tiene un race condition
      // con ProtectedRoute.getSession() y la app quedaba bloqueada en /login.
      window.location.replace('/')

    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoad(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) { toast.error('Ingrese un correo válido'); return }
    setLoad(true)
    try {
      await supabase.functions.invoke('base-reset-password', {
        body: { email, action: 'request_reset' }
      })
      setSent(true)
    } catch {
      setSent(true) // Anti-enumeración OWASP A07
    } finally { setLoad(false) }
  }

  const inputStyle = {
    background:  'rgba(0,0,0,0.2)',
    borderColor: 'var(--color-border)',
    color:       'var(--color-text)',
  }

  // ── Vista: Forgot password ────────────────────────────────────────────────
  if (mode === 'forgot') return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="rounded-2xl p-8 border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {!sent ? (
            <>
              <button onClick={() => { setMode('login'); setSent(false) }}
                className="flex items-center gap-2 text-sm mb-6 transition"
                style={{ color: 'var(--color-muted)' }}>
                <ArrowLeft size={16} /> Volver al login
              </button>
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center border"
                  style={{ background: 'rgba(0,86,230,0.15)', borderColor: 'rgba(0,86,230,0.3)' }}>
                  <Mail size={26} style={{ color: 'var(--color-primary)' }} />
                </div>
              </div>
              <h2 className="text-xl font-bold text-center mb-1" style={{ color: 'var(--color-text)' }}>
                Recuperar contraseña
              </h2>
              <p className="text-sm text-center mb-6" style={{ color: 'var(--color-muted)' }}>
                Ingrese su correo corporativo y le enviaremos un enlace para restablecer su contraseña.
              </p>
              <form onSubmit={handleForgot} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="su-correo@empresa.com"
                  autoComplete="email"
                  className="w-full border rounded-xl px-4 py-3 outline-none transition focus:ring-2"
                  style={inputStyle}
                />
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="text-5xl mb-4">✉️</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                Revise su correo
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
                Si el correo está registrado en el sistema, recibirá un enlace para restablecer su contraseña.
              </p>
              <p className="text-xs mb-6" style={{ color: 'var(--color-muted)' }}>
                Revise también su carpeta de spam o correo no deseado.
              </p>
              <button onClick={() => { setMode('login'); setSent(false); setEmail('') }}
                className="w-full py-3 rounded-xl font-medium border transition"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                Volver al login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Vista: Login principal ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--color-bg)' }}>

      {/* Decoración de fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'var(--color-primary)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'var(--color-secondary)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo de la empresa */}
        <div className="flex flex-col items-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 object-contain mb-3" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center border mb-3"
              style={{ background: `${branding.color_primary}20`, borderColor: `${branding.color_primary}50` }}>
              <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>HR</span>
            </div>
          )}
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {branding.company_name || 'HRCloud Base'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>Sistema de Asistencia</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

          {/* Banner empresa suspendida */}
          {tenantPaused && (
            <div className="mb-5">
              <TenantSuspendedBanner
                title={tenantPaused.title}
                body={tenantPaused.body}
                onClose={() => setTenantPaused(null)}
              />
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>
                Correo corporativo
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="usuario@empresa.com"
                className="w-full border rounded-xl px-4 py-3 outline-none transition focus:ring-2"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>
                Contraseña / Clave temporal
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPwd(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full border rounded-xl px-4 py-3 pr-12 outline-none transition focus:ring-2"
                  style={inputStyle}
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                  style={{ color: 'var(--color-muted)' }}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setMode('forgot')}
                className="text-sm transition hover:underline"
                style={{ color: 'var(--color-primary)' }}>
                Se me olvidó la contraseña
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
          Si es tu primer acceso, usa la contraseña temporal enviada por tu empresa.
        </p>
      </div>
    </div>
  )
}

