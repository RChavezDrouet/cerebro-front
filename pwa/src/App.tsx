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

// ─────────────────────────────────────────────────────────────────────────────
// PWA Install Hook
// ─────────────────────────────────────────────────────────────────────────────
const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)

  const isStandalone = (): boolean => {
    const mql = window.matchMedia?.('(display-mode: standalone)')?.matches
    const iosStandalone = (window.navigator as any).standalone === true
    return Boolean(mql || iosStandalone)
  }

  const isMobile = (): boolean =>
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    window.innerWidth <= 768

  const isIOS = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent)

  const dismissedRecently = (): boolean => {
    const ts = localStorage.getItem('pwa_install_dismissed')
    return Boolean(ts && Date.now() - Number(ts) < 7 * 24 * 60 * 60 * 1000)
  }

  // iOS: mostrar modal después de 3 segundos
  useEffect(() => {
    if (!isMobile() || isStandalone() || dismissedRecently() || !isIOS()) return
    const t = setTimeout(() => setShowIOSModal(true), 3000)
    return () => clearTimeout(t)
  }, [])

  // Android/Chromium: capturar beforeinstallprompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!isMobile() || isStandalone() || dismissedRecently()) return
      setTimeout(() => setShowBanner(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Detectar instalación exitosa
  useEffect(() => {
    const handler = () => { setShowBanner(false); setShowIOSModal(false); setDeferredPrompt(null) }
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  const installAndroid = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowBanner(false)
  }

  const dismiss = () => {
    setShowBanner(false)
    setShowIOSModal(false)
    localStorage.setItem('pwa_install_dismissed', String(Date.now()))
  }

  return {
    showBanner: showBanner && !isStandalone(),
    showIOSModal: showIOSModal && !isStandalone(),
    installAndroid,
    dismiss,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HRCloud App Icon
// ─────────────────────────────────────────────────────────────────────────────
const HRCloudIcon: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <div style={{
    width: size, height: size, borderRadius: Math.round(size * 0.22), flexShrink: 0,
    background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #7c3aed 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,212,255,0.35)',
  }}>
    <svg width={Math.round(size * 0.52)} height={Math.round(size * 0.52)} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9" strokeWidth="2.5"/>
    </svg>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Banner Android
// ─────────────────────────────────────────────────────────────────────────────
const InstallBannerAndroid: React.FC<{ onInstall: () => void; onDismiss: () => void }> = ({ onInstall, onDismiss }) => (
  <div style={{
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    left: 16, right: 16, zIndex: 200,
    background: 'rgba(6,10,24,0.97)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(0,212,255,0.30)', borderRadius: 18,
    padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 8px 40px rgba(0,212,255,0.18), 0 2px 16px rgba(0,0,0,0.6)',
    animation: 'pwa-slide-down 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
  }}>
    <HRCloudIcon size={46} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Instalar HRCloud</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
        Añadir a pantalla de inicio para acceso rápido
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      <button onClick={onDismiss} style={{
        padding: '7px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)',
        fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 600,
      }}>Ahora no</button>
      <button onClick={onInstall} style={{
        padding: '7px 16px', borderRadius: 9,
        background: 'linear-gradient(135deg, #00d4ff, #3b82f6)',
        border: 'none', color: 'white', fontSize: 12, fontWeight: 800,
        cursor: 'pointer', fontFamily: 'Syne, sans-serif',
        boxShadow: '0 2px 12px rgba(0,212,255,0.4)',
      }}>Instalar</button>
    </div>
    <style>{`
      @keyframes pwa-slide-down {
        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `}</style>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Modal iOS — instrucciones paso a paso
// ─────────────────────────────────────────────────────────────────────────────
const IOSInstallModal: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => (
  <div onClick={onDismiss} style={{
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    animation: 'ios-fade-in 0.25s ease both',
  }}>
    <div onClick={(e) => e.stopPropagation()} style={{
      width: '100%', maxWidth: 420,
      background: 'rgba(8,12,28,0.98)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: '24px 24px 32px',
      animation: 'ios-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
    }}>
      {/* Handle */}
      <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 20px' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <HRCloudIcon size={52} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Instalar HRCloud</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>En tu pantalla de inicio</div>
        </div>
      </div>

      {/* Pasos */}
      {[
        {
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          ),
          color: '#3b82f6', num: '1',
          title: 'Toca el botón "Compartir"',
          sub: 'Ícono de flecha hacia arriba en la barra inferior de Safari',
        },
        {
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          ),
          color: '#00d4ff', num: '2',
          title: 'Selecciona "Añadir a pantalla de inicio"',
          sub: 'Desplaza hacia abajo en el menú de opciones',
        },
        {
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ),
          color: '#22c55e', num: '3',
          title: 'Toca "Añadir"',
          sub: 'Esquina superior derecha de la pantalla de confirmación',
        },
      ].map(({ icon, color, num, title, sub }) => (
        <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}40`, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sub}</div>
          </div>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono',
          }}>{num}</div>
        </div>
      ))}

      {/* Nota Safari */}
      <div style={{
        background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.2)',
        borderRadius: 12, padding: '10px 14px', margin: '16px 0 20px',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 15 }}>💡</span>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
          Solo funciona desde <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Safari</strong>. Si usas Chrome u otro navegador, ábrela en Safari primero.
        </div>
      </div>

      <button onClick={onDismiss} style={{
        width: '100%', padding: '14px', borderRadius: 14,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'Syne, sans-serif',
      }}>Entendido</button>
    </div>
    <style>{`
      @keyframes ios-fade-in { from{opacity:0} to{opacity:1} }
      @keyframes ios-slide-up { from{opacity:0;transform:translateY(60px)} to{opacity:1;transform:translateY(0)} }
    `}</style>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Loading Screen
// ─────────────────────────────────────────────────────────────────────────────
const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Cargando...' }) => (
  <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
    <div style={{
      width: 72, height: 72, borderRadius: 20,
      background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #7c3aed 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 40px rgba(0,212,255,0.35)', animation: 'logo-pulse 2s ease-in-out infinite'
    }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--nova-text)' }}>HRCLOUD</div>
      <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', letterSpacing: '0.1em' }}>{label}</div>
    </div>
    <div style={{ width: 40, height: 2, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
      <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, transparent, var(--nova-cyan), transparent)', animation: 'loading-bar 1.5s ease-in-out infinite' }} />
    </div>
    <style>{`
      @keyframes logo-pulse { 0%,100%{box-shadow:0 0 30px rgba(0,212,255,0.3)} 50%{box-shadow:0 0 60px rgba(0,212,255,0.5)} }
      @keyframes loading-bar { 0%{width:0;margin-left:0} 50%{width:100%;margin-left:0} 100%{width:0;margin-left:100%} }
    `}</style>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const auth = useAuth()
  const attendance = useAttendance(auth.profile)
  const [activeTab, setActiveTab] = useState<Tab>('clock')
  const { showBanner, showIOSModal, installAndroid, dismiss } = usePWAInstall()
  const visibleTabs: Tab[] = ['clock', 'history', 'requests', 'profile']

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab('clock')
  }, [activeTab])

  if (auth.loading && !auth.user) return <LoadingScreen />
  if (!auth.session || !auth.user) return <LoginPage onLogin={auth.signIn} loading={auth.loading} error={auth.error} />

  if (!auth.profile) {
    if (auth.error) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="nova-card" style={{ padding: 28, maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--nova-text)', marginBottom: 8 }}>Error de configuración</div>
            <div style={{ fontSize: 13, color: 'var(--nova-muted)', marginBottom: 20 }}>{auth.error}</div>
            <button onClick={auth.signOut} style={{
              padding: '12px 24px', borderRadius: 12, background: 'rgba(255,69,96,0.1)',
              border: '1px solid rgba(255,69,96,0.25)', color: 'var(--nova-red)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif'
            }}>Cerrar Sesión</button>
          </div>
        </div>
      )
    }
    return <LoadingScreen label="Cargando perfil..." />
  }

  const tenantStatus = auth.profile.tenant_status
  const isSuspended = (auth.profile as any).tenant_is_suspended
  if ((tenantStatus != null && tenantStatus !== 'active') || isSuspended === true) {
    const msg = auth.profile.tenant_paused_message || (import.meta.env.VITE_TENANT_PAUSED_MESSAGE as string) || 'Tu empresa se encuentra temporalmente suspendida. Por favor contacta a RRHH o al administrador del sistema.'
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'radial-gradient(circle at 30% 20%, rgba(0,212,255,0.12), transparent 55%), radial-gradient(circle at 70% 80%, rgba(124,58,237,0.12), transparent 55%), #040610' }}>
        <div className="nova-card" style={{ padding: 28, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>⏸️</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--nova-text)', marginBottom: 8 }}>Acceso restringido</div>
          <div style={{ fontSize: 13, color: 'var(--nova-muted)', lineHeight: 1.4, marginBottom: 18 }}>{msg}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={auth.signOut} className="btn-nova-primary" style={{ padding: '10px 18px' }}>Cerrar sesión</button>
            <a href="mailto:soporte@hrcloud.ec" style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--nova-border)', color: 'var(--nova-text)', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'Syne, sans-serif' }}>Contactar soporte</a>
          </div>
          <div style={{ fontSize: 11, color: 'var(--nova-muted)', marginTop: 14 }}>Empresa: {auth.profile.tenant_name}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Banner Android/Chromium */}
      {showBanner && <InstallBannerAndroid onInstall={installAndroid} onDismiss={dismiss} />}

      {/* Modal iOS */}
      {showIOSModal && <IOSInstallModal onDismiss={dismiss} />}

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
            onClockInForced={(notes, blob) => attendance.registerPunchForced('clock_in', { notes, selfieBlob: blob })}
            onClockOutForced={(notes, blob) => attendance.registerPunchForced('clock_out', { notes, selfieBlob: blob })}
            onBreakStartForced={(blob) => attendance.registerPunchForced('break_start', { selfieBlob: blob })}
            onBreakEndForced={(blob) => attendance.registerPunchForced('break_end', { selfieBlob: blob })}
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
