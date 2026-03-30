// HRCloud PWA — Nova UI History Page
import React, { useState, useEffect } from 'react'
import { attendanceDb } from '../lib/supabase'
import type { UserProfile, AttendancePunch } from '../types'

interface HistoryPageProps {
  profile: UserProfile
}

const HistoryPage: React.FC<HistoryPageProps> = ({ profile }) => {
  const [punches, setPunches] = useState<AttendancePunch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { loadHistory() }, [selectedDate])

  const loadHistory = async () => {
    setLoading(true)
    const { data, error } = await attendanceDb
      .from('punches')
      .select('id,tenant_id,employee_id,punched_at,source,serial,status,verification,evidence,created_at')
      .eq('employee_id', profile.employee_id)
      .eq('tenant_id', profile.tenant_id)
      .gte('punched_at', `${selectedDate}T00:00:00.000Z`)
      .lte('punched_at', `${selectedDate}T23:59:59.999Z`)
      .order('punched_at', { ascending: true })
    if (!error && data) setPunches(data as AttendancePunch[])
    setLoading(false)
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  const calculateHours = () => {
    const ins = punches.filter(p => p.evidence?.action === 'clock_in')
    const outs = punches.filter(p => p.evidence?.action === 'clock_out')
    if (ins.length === 0) return '0:00'
    let totalMs = 0
    for (let i = 0; i < Math.min(ins.length, outs.length); i++) {
      totalMs += new Date(outs[i].punched_at).getTime() - new Date(ins[i].punched_at).getTime()
    }
    if (ins.length > outs.length) totalMs += Date.now() - new Date(ins[ins.length - 1].punched_at).getTime()
    const hours = Math.floor(totalMs / 3600000)
    const mins = Math.floor((totalMs % 3600000) / 60000)
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate); d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  const getPunchConfig = (action: string) => ({
    clock_in: { label: 'Entrada', color: 'var(--nova-green)', bg: 'rgba(0,255,163,0.10)' },
    clock_out: { label: 'Salida', color: 'var(--nova-red)', bg: 'rgba(255,69,96,0.10)' },
    break_start: { label: 'Descanso', color: 'var(--nova-amber)', bg: 'rgba(255,184,0,0.10)' },
    break_end: { label: 'Fin Desc.', color: 'var(--nova-cyan)', bg: 'rgba(0,212,255,0.10)' },
  }[action] || { label: action, color: 'var(--nova-muted)', bg: 'rgba(255,255,255,0.04)' })

  const hours = calculateHours()
  const hasWorked = punches.some(p => p.evidence?.action === 'clock_in')

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 100px', position: 'relative', zIndex: 1 }}>

      {/* Title */}
      <div className="anim-fade-up" style={{ paddingTop: 20, paddingBottom: 16 }}>
        <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-cyan)', letterSpacing: '0.15em', marginBottom: 4, opacity: 0.8 }}>
          REGISTRO DE ACTIVIDAD
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--nova-text)', margin: 0 }}>Historial</h2>
      </div>

      {/* Date Picker */}
      <div className="nova-card anim-fade-up" style={{ padding: '10px 14px', marginBottom: 16, animationDelay: '50ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => changeDate(-1)}
            style={{
              width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--nova-border)', color: 'var(--nova-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--nova-text)', fontSize: 14, fontWeight: 700,
                fontFamily: 'JetBrains Mono', textAlign: 'center', cursor: 'pointer'
              }}
            />
            {isToday && (
              <span className="status-pill green" style={{ fontSize: 9 }}>HOY</span>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            disabled={isToday}
            style={{
              width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--nova-border)', color: 'var(--nova-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isToday ? 0.3 : 1
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="anim-fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, animationDelay: '80ms' }}>
        <div className="stat-card">
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>HORAS TRABAJADAS</div>
          <div style={{
            fontSize: 30, fontWeight: 800, fontFamily: 'JetBrains Mono',
            background: hasWorked ? 'linear-gradient(135deg, #00d4ff, #00ffa3)' : 'none',
            WebkitBackgroundClip: hasWorked ? 'text' : 'unset',
            WebkitTextFillColor: hasWorked ? 'transparent' : 'var(--nova-muted)',
            backgroundClip: hasWorked ? 'text' : 'unset'
          }}>
            {hours}
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>MARCACIONES</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'var(--nova-text)' }}>
            {punches.length}
          </div>
        </div>
      </div>

      {/* Punch list */}
      <div className="nova-card anim-fade-up" style={{ animationDelay: '120ms', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--nova-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nova-text)' }}>Detalle del día</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <svg style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--nova-cyan)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <div style={{ fontSize: 12, color: 'var(--nova-muted)', fontFamily: 'JetBrains Mono' }}>Cargando...</div>
          </div>
        ) : punches.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📭</div>
            <div style={{ fontSize: 13, color: 'var(--nova-muted)' }}>Sin marcaciones este día</div>
          </div>
        ) : (
          <div>
            {punches.map((punch, i) => {
              const action = punch.evidence?.action || 'punch'
              const cfg = getPunchConfig(action)
              const inRange = punch.evidence?.geo?.in_range
              return (
                <div key={punch.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  borderBottom: i < punches.length - 1 ? '1px solid rgba(99,179,237,0.06)' : 'none',
                }}>
                  {/* Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div className="timeline-dot" style={{ background: cfg.bg, color: cfg.color }}>
                      {action === 'clock_in' ? '↗' : action === 'clock_out' ? '↙' : '☕'}
                    </div>
                    {i < punches.length - 1 && (
                      <div style={{ width: 1, height: 16, background: 'var(--nova-border)', margin: '2px 0' }} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                    {punch.evidence?.notes && (
                      <div style={{ fontSize: 11, color: 'var(--nova-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {punch.evidence.notes}
                      </div>
                    )}
                    {punch.evidence?.geo?.lat && (
                      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', marginTop: 2, opacity: 0.6 }}>
                        📍 {Number(punch.evidence.geo.lat).toFixed(4)}, {Number(punch.evidence.geo.lng).toFixed(4)}
                        {inRange === true && ' · GPS ✓'}
                        {inRange === false && ' · Fuera área'}
                      </div>
                    )}
                  </div>

                  {/* Time */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--nova-text)' }}>
                      {formatTime(punch.punched_at)}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', opacity: 0.6, marginTop: 2 }}>
                      {punch.source === 'web' ? 'PWA' : punch.source}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

export default HistoryPage
