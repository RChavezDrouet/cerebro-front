/**
 * ==============================================
 * CEREBRO SaaS - Página de Login
 * ==============================================
 * 
 * Página de autenticación con diseño moderno y UX mejorado.
 * Incluye validaciones, estados de carga y manejo de errores.
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, getAppSettings } from '../config/supabase'
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { isValidEmail } from '../utils/validators'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const [branding, setBranding] = useState({
    company_name: import.meta.env.VITE_APP_NAME || 'CEREBRO',
    company_logo: null,
    login_message_title: 'Sistema de Gestión Empresarial Inteligente',
    login_message_body:
      'Administra tu organización de forma eficiente con herramientas diseñadas para el crecimiento de tu negocio.',
    primary_color: '#2563eb',
    secondary_color: '#14b8a6',
    accent_color: '#a855f7',
  })

  const navigate = useNavigate()
  const location = useLocation()

  // Verificar si hay mensaje de error en el state (ej: sesión expirada)
  useEffect(() => {
    if (location.state?.message) {
      toast.error(location.state.message)
    }
  }, [location.state])

  // Cargar branding (para que el login use logo/mensaje/gradiente configurado)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const settings = await getAppSettings()
      if (!mounted || !settings) return

      setBranding(prev => ({
        ...prev,
        company_name: settings.company_name || prev.company_name,
        company_logo: settings.company_logo || prev.company_logo,
        primary_color: settings.primary_color || prev.primary_color,
        secondary_color: settings.secondary_color || prev.secondary_color,
        accent_color: settings.accent_color || prev.accent_color,
        login_message_title: settings.login_message_title || prev.login_message_title,
        login_message_body: settings.login_message_body || prev.login_message_body,
      }))
    })()

    return () => {
      mounted = false
    }
  }, [])

  // Validar formulario
  const validateForm = () => {
    if (!email.trim()) {
      setError('Ingrese su correo electrónico')
      return false
    }
    
    if (!isValidEmail(email)) {
      setError('Ingrese un correo electrónico válido')
      return false
    }
    
    if (!password) {
      setError('Ingrese su contraseña')
      return false
    }
    
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return false
    }
    
    return true
  }

  // Manejar login
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!validateForm()) return
    
    setLoading(true)

    try {
      console.log('🔐 Intentando login con:', email)

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (authError) {
        throw authError
      }

      if (data?.user) {
        console.log('✅ Login exitoso')
        toast.success('¡Bienvenido a CEREBRO SaaS!')
        
        // Redirigir a la página solicitada o al dashboard
        const stored = (() => {
          try {
            const v = window.localStorage.getItem('cerebro:last_path')
            return v && v.startsWith('/') && v !== '/login' ? v : null
          } catch {
            return null
          }
        })()

        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      console.error('❌ Error de login:', err)

      // Mapear mensajes de error de Supabase a español
      if (err.message?.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.')
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Por favor, confirma tu correo electrónico antes de iniciar sesión.')
      } else if (err.message?.includes('User not found')) {
        setError('Usuario no encontrado. Verifica tu correo electrónico.')
      } else if (err.message?.includes('Too many requests')) {
        setError('Demasiados intentos. Por favor, espera unos minutos.')
      } else {
        setError(err.message || 'Error al iniciar sesión. Intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Manejar recuperación de contraseña
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Ingresa tu correo electrónico primero')
      return
    }

    if (!isValidEmail(email)) {
      toast.error('Ingresa un correo electrónico válido')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      toast.success('Te hemos enviado un correo para restablecer tu contraseña')
    } catch (err) {
      toast.error('Error al enviar el correo de recuperación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo - Decorativo */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.secondary_color}, ${branding.accent_color})` }}>
        {/* Patrón de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Círculos decorativos */}
        <div className="absolute top-20 -left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl" />
        
        {/* Contenido */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                {branding.company_logo ? (<img src={branding.company_logo} alt="Logo" className="w-9 h-9 object-contain" />) : (<span className="text-2xl font-bold">C</span>)}
              </div>
              <div>
                <h1 className="text-xl font-bold">{branding.company_name}</h1>
                <p className="text-xs text-white/70">SaaS Multi-Tenant</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold leading-tight">
                {branding.login_message_title}
              </h2>
              <p className="mt-4 text-lg text-white/80 max-w-md">
                {branding.login_message_body}
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {[
                'Dashboard con KPIs en tiempo real',
                'Gestión de clientes multi-tenant',
                'Facturación y cobranzas automatizadas',
                'Reportes y auditoría completa',
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-primary-400/30 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-white/90">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-white/60">
            <span>HRCloud</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>ProyectoRLeon</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>v3.0.0</span>
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-glow-primary mb-4" style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.secondary_color})` }}>
              <span className="text-white text-2xl font-bold">C</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{branding.company_name}</h1>
            <p className="text-slate-500 mt-1">Sistema de Gestión Multi-Tenant</p>
          </div>

          {/* Card de login */}
          <div className="bg-white rounded-2xl shadow-soft-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">
                Bienvenido de nuevo
              </h2>
              <p className="text-slate-500 mt-2">
                Ingresa tus credenciales para acceder
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 bg-danger-50 border-2 border-danger-200 rounded-xl flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-danger-500 mt-0.5 flex-shrink-0" />
                <p className="text-danger-700 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="input-label" htmlFor="email">
                  Correo electrónico
                </label>
                <div className="input-group">
                  <Mail className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError('')
                    }}
                    className={`input-field input-with-icon ${error && !email ? 'error' : ''}`}
                    placeholder="tu@email.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="input-label" htmlFor="password">
                  Contraseña
                </label>
                <div className="input-group">
                  <Lock className="input-icon" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    className={`input-field input-with-icon pr-12 ${error && !password ? 'error' : ''}`}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-600">Recordarme</span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  disabled={loading}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-12 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Help */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                ¿Problemas para ingresar?{' '}
                <a
                  href="mailto:soporte@cerebro.com"
                  className="font-medium text-primary-600 hover:text-primary-700"
                >
                  Contacta al soporte
                </a>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} CEREBRO SaaS. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
