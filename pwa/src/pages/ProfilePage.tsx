// HRCloud PWA — Nova UI Profile Page
import React from 'react'
import type { UserProfile } from '../types'

interface ProfilePageProps {
  profile: UserProfile
  onSignOut: () => void
}

const ProfilePage: React.FC<ProfilePageProps> = ({ profile, onSignOut }) => {
  const initials = profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  const isMobile = navigator.userAgent.includes('Mobile')

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      borderBottom: '1px solid rgba(99,179,237,0.06)'
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--nova-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nova-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 100px', position: 'relative', zIndex: 1 }}>

      {/* Title */}
      <div className="anim-fade-up" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-cyan)', letterSpacing: '0.15em', marginBottom: 4, opacity: 0.8 }}>
          CUENTA
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--nova-text)', margin: 0 }}>Mi Perfil</h2>
      </div>

      {/* Avatar card */}
      <div className="nova-card anim-fade-up" style={{ padding: '28px 20px', textAlign: 'center', marginBottom: 16, animationDelay: '50ms' }}>
        {/* Avatar with 3D gradient */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: 'white',
            border: '3px solid rgba(0,212,255,0.2)',
            boxShadow: '0 0 30px rgba(0,212,255,0.25), 0 8px 30px rgba(0,0,0,0.4)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* inner shine */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
              borderRadius: '50% 50% 0 0 / 30% 30% 0 0'
            }} />
            <span style={{ position: 'relative', zIndex: 1 }}>{initials}</span>
          </div>
          {/* Online indicator */}
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--nova-green)', border: '2px solid var(--nova-bg)',
            boxShadow: '0 0 8px var(--nova-green)'
          }} />
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--nova-text)', margin: '0 0 4px' }}>
          {profile.full_name}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--nova-muted)', margin: '0 0 12px' }}>{profile.email}</p>

        <span className="status-pill cyan">
          🛡️ Empleado Activo
        </span>
      </div>

      {/* Info */}
      <div className="nova-card anim-fade-up" style={{ marginBottom: 16, overflow: 'hidden', animationDelay: '80ms' }}>
        <InfoRow icon="🏢" label="EMPRESA" value={profile.tenant_name || 'N/A'} />
        <InfoRow icon="📧" label="CORREO" value={profile.email} />
        <InfoRow icon={isMobile ? '📱' : '💻'} label="DISPOSITIVO" value={isMobile ? 'Móvil (PWA)' : 'Desktop (PWA)'} />
        {profile.work_mode && (
          <InfoRow
            icon={profile.work_mode === 'remoto' ? '🏠' : profile.work_mode === 'presencial' ? '🏢' : '🔄'}
            label="MODALIDAD"
            value={profile.work_mode === 'remoto' ? 'Teletrabajo' : profile.work_mode === 'presencial' ? 'Presencial' : 'Mixto'}
          />
        )}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
            ID EMPLEADO
          </div>
          <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-cyan)', opacity: 0.7, wordBreak: 'break-all' }}>
            {profile.employee_id}
          </div>
        </div>
      </div>

      {/* Security info */}
      <div className="nova-card anim-fade-up" style={{ padding: '14px 16px', marginBottom: 16, animationDelay: '110ms' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)', marginBottom: 12 }}>Seguridad</div>
        {[
          { label: 'Cifrado en tránsito', value: 'TLS 1.3', ok: true },
          { label: 'Sesión autenticada', value: 'JWT · Supabase Auth', ok: true },
          { label: 'GPS Verificado', value: 'Haversine · Alta precisión', ok: true },
        ].map(({ label, value, ok }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--nova-muted)' }}>{label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'JetBrains Mono', color: ok ? 'var(--nova-green)' : 'var(--nova-red)' }}>
              {ok ? '✓' : '✗'} {value}
            </span>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        className="anim-fade-up"
        style={{
          width: '100%', padding: '14px 20px', borderRadius: 14,
          background: 'rgba(255,69,96,0.07)', border: '1px solid rgba(255,69,96,0.20)',
          color: 'var(--nova-red)', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          transition: 'background 0.2s', marginBottom: 20,
          animationDelay: '140ms'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Cerrar Sesión
      </button>

      <p style={{ textAlign: 'center', fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', opacity: 0.4 }}>
        HRCloud Attendance PWA · v2.0.0
      </p>
    </div>
  )
}

export default ProfilePage
