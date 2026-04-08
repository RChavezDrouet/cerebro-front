// HRCloud PWA — Nova UI App.tsx
import React, { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useAttendance } from './hooks/useAttendance'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import LoginPage from './pages/LoginPage'
import ClockInPage from './pages/ClockInPage'
import HistoryPage from './pages/HistoryPage'
import RequestsPage from './pages/RequestsPage'
import ProfilePage from './pages/ProfilePage'

// PWA Install prompt hook (Android/Chromium) + hint iOS Safari
const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [isIOSHint, setIsIOSHint] = useState(false)

  const isStandalone = () => {
    // display-mode: standalone (Android/desktop)
    const mql = window.matchMedia?.('(display-mode: standalone)')?.matches
    // iOS Safari
    // @ts-ignore
    const iosStandalone = (window.navigator as any).standalone === true
    return Boolean(mql || iosStandalone)
  }

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

  const dismissedRecently = () => {
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    return dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000
  }

  useEffect(() => {
    // iOS: no beforeinstallprompt. Mostramos hint si NO está instalada.
    if (isIOS() && !isStandalone() && !dismissedRecently()) {
      setTimeout(() => setIsIOSHint(true), 2500)
    }
  }, [])

  useEffect(() => {
    const handler = (e: any) => {
      // Android/Chromium
      e.preventDefault()
      setDeferredPrompt(e)
      if (!dismissedRecently() && !isStandalone()) {
        setTimeout(() => setShowInstall(true), 2500)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (isStandalone()) return

    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      setShowInstall(false)
      setIsIOSHint(false)
      return
    }

    // iOS: mostrar instrucciones
    if (isIOS()) {
      alert('En iPhone/iPad: toca “Compartir” (⬆️) y luego “Añadir a pantalla de inicio”.')
      setIsIOSHint(false)
    }
  }

  const dismiss = () => {
    setShowInstall(false)
    setIsIOSHint(false)
    localStorage.setItem('pwa_install_dismissed', String(Date.now()))
  }

  const shouldShow = !isStandalone() && !dismissedRecently() && (showInstall || isIOSHint)

  return {
    showInstall: shouldShow,
    install,
    dismiss,
  }
}

// PWA Install Banner
const InstallBanner: React.FC<{ onInstall: () => void; onDismiss: () => void }> = ({ onInstall, onDismiss }) => (
  <div style={{
    position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 16, right: 16, zIndex: 50,
    background: 'rgba(8, 13, 28, 0.95)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(0,212,255,0.25)', borderRadius: 16, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 8px 40px rgba(0,212,255,0.15), 0 2px 12px rgba(0,0,0,0.5)',
    animation: 'toast-in 0.3s ease both'
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      background: 'linear-gradient(135deg, #00d4ff, #3b82f6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 20px rgba(0,212,255,0.3)'
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)' }}>
        Instalar HRCloud
      </div>
      <div style={{ fontSize: 11, color: 'var(--nova-muted)', marginTop: 1 }}>
        Acceso rápido desde tu pantalla de inicio
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      <button
        onClick={onDismiss}
        style={{
          padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--nova-border)', color: 'var(--nova-muted)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif'
        }}
      >
        No
      </button>
      <button
        onClick={onInstall}
        style={{
          padding: '6px 14px', borderRadius: 8,
          background: 'linear-gradient(135deg, #00d4ff, #3b82f6)',
          border: 'none', color: 'white',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif'
        }}
      >
        Instalar
      </button>
    </div>
  </div>
)

// Loading spinner
const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Cargando...' }) => (
  <div style={{
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 20
  }}>
    {/* Animated logo */}
    <div style={{
      width: 72, height: 72, borderRadius: 20,
      background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #7c3aed 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 40px rgba(0,212,255,0.35)',
      animation: 'logo-pulse 2s ease-in-out infinite'
    }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
      </svg>
    </div>
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--nova-text)' }}>HRCLOUD</div>
      <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', letterSpacing: '0.1em' }}>{label}</div>
    </div>
    <div style={{
      width: 40, height: 2, borderRadius: 2, overflow: 'hidden',
      background: 'rgba(255,255,255,0.05)'
    }}>
      <div style={{
        height: '100%', borderRadius: 2,
        background: 'linear-gradient(90deg, transparent, var(--nova-cyan), transparent)',
        animation: 'loading-bar 1.5s ease-in-out infinite'
      }} />
    </div>
    <style>{`
      @keyframes logo-pulse { 0%,100%{box-shadow:0 0 30px rgba(0,212,255,0.3)} 50%{box-shadow:0 0 60px rgba(0,212,255,0.5)} }
      @keyframes loading-bar { 0%{width:0;margin-left:0} 50%{width:100%;margin-left:0} 100%{width:0;margin-left:100%} }
    `}</style>
  </div>
)

const App: React.FC = () => {
  const auth = useAuth()
  const attendance = useAttendance(auth.profile)
  const [activeTab, setActiveTab] = useState<Tab>('clock')
  const { showInstall, install, dismiss } = usePWAInstall()

  // IMPORTANTE:
  // La autogestión de ficha/GPS NO debe ocultar las opciones existentes de marcación.
  // Se mantienen siempre las pestañas principales y la lógica fina queda en cada pantalla/RPC.
  const visibleTabs: Tab[] = ['clock', 'history', 'requests', 'profile']

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab('clock')
    }
  }, [activeTab])

  // Global loading
  if (auth.loading && !auth.user) return <LoadingScreen />

  // Not authenticated
  if (!auth.session || !auth.user) {
    return <LoginPage onLogin={auth.signIn} loading={auth.loading} error={auth.error} />
  }

  // Loading profile
  if (!auth.profile) {
    if (auth.error) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="nova-card" style={{ padding: 28, maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--nova-text)', marginBottom: 8 }}>
              Error de configuración
            </div>
            <div style={{ fontSize: 13, color: 'var(--nova-muted)', marginBottom: 20 }}>{auth.error}</div>
            <button onClick={auth.signOut} style={{
              padding: '12px 24px', borderRadius: 12, background: 'rgba(255,69,96,0.1)',
              border: '1px solid rgba(255,69,96,0.25)', color: 'var(--nova-red)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif'
            }}>
              Cerrar Sesión
            </button>
          </div>
        </div>
      )
    }
    return <LoadingScreen label="Cargando perfil..." />
  }



  // Tenant gate: bloquear si el tenant NO está activo o está suspendido
  const tenantStatus = String(auth.profile.tenant_status ?? '').toLowerCase()
  const isSuspended = Boolean((auth.profile as any).tenant_is_suspended)
  if (tenantStatus !== 'active' || isSuspended) {
    const msg =
      auth.profile.tenant_paused_message ||
      (import.meta.env.VITE_TENANT_PAUSED_MESSAGE as string) ||
      'Tu empresa se encuentra temporalmente suspendida. Por favor contacta a RRHH o al administrador del sistema.'

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background:
            'radial-gradient(circle at 30% 20%, rgba(0,212,255,0.12), transparent 55%), radial-gradient(circle at 70% 80%, rgba(124,58,237,0.12), transparent 55%), #040610',
        }}
      >
        <div className="nova-card" style={{ padding: 28, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>⏸️</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--nova-text)', marginBottom: 8 }}>Acceso restringido</div>
          <div style={{ fontSize: 13, color: 'var(--nova-muted)', lineHeight: 1.4, marginBottom: 18 }}>{msg}</div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={auth.signOut} className="btn-nova-primary" style={{ padding: '10px 18px' }}>
              Cerrar sesión
            </button>

            <a
              href="mailto:soporte@hrcloud.ec"
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--nova-border)',
                color: 'var(--nova-text)',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                fontFamily: 'Syne, sans-serif',
              }}
            >
              Contactar soporte
            </a>
          </div>

          <div style={{ fontSize: 11, color: 'var(--nova-muted)', marginTop: 14 }}>Empresa: {auth.profile.tenant_name}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* PWA Install Banner */}
      {showInstall && <InstallBanner onInstall={install} onDismiss={dismiss} />}

      <Header profile={auth.profile} onSignOut={auth.signOut} />

      <main style={{ flex: 1 }}>
        {activeTab === 'clock' && (
          <ClockInPage
            profile={auth.profile}
            settings={attendance.settings}
            clockStatus={attendance.clockStatus}
            lastPunch={attendance.lastPunch}
            todayPunches={attendance.todayPunches}
            todayAttempts={attendance.todayAttempts}
            location={attendance.location}
            geofenceStatus={attendance.geofenceStatus}
            geofenceDistance={attendance.geofenceDistance}
            loading={attendance.loading}
            error={attendance.error}
            success={attendance.success}
            onClockIn={attendance.clockIn}
            onClockOut={attendance.clockOut}
            onBreakStart={attendance.breakStart}
            onBreakEnd={attendance.breakEnd}
            onRefreshLocation={attendance.refreshLocation}
            onClearMessages={attendance.clearMessages}
          />
        )}
        {activeTab === 'history' && <HistoryPage profile={auth.profile} />}
        {activeTab === 'requests' && <RequestsPage profile={auth.profile} />}
        {activeTab === 'profile' && <ProfilePage profile={auth.profile} onSignOut={auth.signOut} onRefreshProfile={auth.refreshProfile} />}
      </main>

      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} visibleTabs={visibleTabs} />
    </div>
  )
}

export default App
