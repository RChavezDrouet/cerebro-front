// HRCloud PWA — Nova UI Bottom Navigation
import React from 'react'

type Tab = 'clock' | 'history' | 'requests' | 'profile'

interface BottomNavProps {
  activeTab: Tab
  onChangeTab: (tab: Tab) => void
  visibleTabs?: Tab[]
}

const ClockIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 14"/>
  </svg>
)

const HistoryIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
)

const UserIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const RequestIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7"/>
    <path d="M3 10l9 6 9-6"/>
    <path d="M5 18h14"/>
  </svg>
)

const tabs: { id: Tab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'clock', label: 'MARCAR', Icon: ClockIcon },
  { id: 'history', label: 'HISTORIAL', Icon: HistoryIcon },
  { id: 'requests', label: 'SOLICITUD', Icon: RequestIcon },
  { id: 'profile', label: 'PERFIL', Icon: UserIcon },
]

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, visibleTabs }) => {
  const allowed = visibleTabs?.length ? tabs.filter(tab => visibleTabs.includes(tab.id)) : tabs

  return (
    <nav className="nova-bottom-nav">
      <div style={{
        maxWidth: 520, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '8px 0'
      }}>
        {allowed.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onChangeTab(id)}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '8px 20px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? 'var(--nova-cyan)' : 'var(--nova-muted)',
                transition: 'color 0.2s',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, fontWeight: 500, letterSpacing: '0.12em',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 32, height: 2, borderRadius: 2,
                  background: 'linear-gradient(90deg, transparent, var(--nova-cyan), transparent)',
                  boxShadow: '0 0 8px var(--nova-cyan)',
                }} />
              )}
              <Icon active={isActive} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
export type { Tab }
