// HRCloud PWA — Nova UI Header
import React from 'react'
import type { UserProfile } from '../types'

interface HeaderProps {
  profile: UserProfile | null
  onSignOut: () => void
}

const Header: React.FC<HeaderProps> = ({ profile, onSignOut }) => {
  const initials = profile
    ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '?'

  return (
    <header className="nova-header" style={{ position: 'relative', zIndex: 40 }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 50%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0,212,255,0.3)',
            flexShrink: 0
          }}>
            {/* Clock icon inline */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15 14"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--nova-text)', lineHeight: 1.1, letterSpacing: '0.02em' }}>HRCLOUD</div>
            <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: 'var(--nova-cyan)', letterSpacing: '0.15em', opacity: 0.8 }}>
              TELETRABAJO
            </div>
          </div>
        </div>

        {/* User */}
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right', display: 'none' }} className="sm-show">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)', lineHeight: 1.2 }}>
                {profile.full_name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--nova-muted)', letterSpacing: '0.05em' }}>
                {profile.tenant_name}
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: 'white',
              border: '2px solid rgba(99,179,237,0.2)',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(124,58,237,0.3)'
            }}>
              {initials}
            </div>
          </div>
        )}
      </div>
      <style>{`@media(min-width:400px){.sm-show{display:block!important}}`}</style>
    </header>
  )
}

export default Header
