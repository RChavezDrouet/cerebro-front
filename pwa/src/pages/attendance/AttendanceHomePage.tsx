import React from 'react'
import { FaceCaptureModal } from '../../components/FaceCaptureModal'
import { useAuth } from '../../contexts/AuthContext'
import { useAttendance } from '../../hooks/useAttendance'

type PunchAction = 'clock_in' | 'break_start' | 'break_end' | 'clock_out'

const ACTION_LABEL: Record<PunchAction, string> = {
  clock_in: 'Entrada',
  break_start: 'Salida a Comer',
  break_end: 'Regreso de Comer',
  clock_out: 'Salida de Turno',
}

export default function AttendanceHomePage() {
  const { profile } = useAuth()
  const attendance = useAttendance(profile)
  const [pendingAction, setPendingAction] = React.useState<PunchAction | null>(null)
  const [notes, setNotes] = React.useState('')

  if (!profile) return null

  const requiresSelfie =
    attendance.settings.selfie_required || attendance.settings.face_enabled

  const runAction = async (action: PunchAction, blob: Blob | null) => {
    attendance.clearMessages()

    if (action === 'clock_in') {
      await attendance.clockIn(notes || undefined, blob)
      return
    }
    if (action === 'clock_out') {
      await attendance.clockOut(notes || undefined, blob)
      return
    }
    if (action === 'break_start') {
      await attendance.breakStart(blob)
      return
    }
    await attendance.breakEnd(blob)
  }

  const requestAction = async (action: PunchAction) => {
    if (requiresSelfie) {
      setPendingAction(action)
      return
    }
    await runAction(action, null)
  }

  const canClockIn = attendance.clockStatus === 'idle'
  const canBreakStart = attendance.clockStatus === 'clocked_in'
  const canBreakEnd = attendance.clockStatus === 'on_break'
  const canClockOut =
    attendance.clockStatus === 'clocked_in' || attendance.clockStatus === 'on_break'

  const statusText =
    attendance.clockStatus === 'idle'
      ? 'Sin jornada abierta'
      : attendance.clockStatus === 'clocked_in'
      ? 'En jornada'
      : 'En descanso'

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 100px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--nova-cyan)', opacity: 0.8 }}>
          {profile.tenant_name}
        </div>
        <h1 style={{ margin: '4px 0 0', color: 'var(--nova-text)' }}>
          Marcación remota
        </h1>
        <div style={{ color: 'var(--nova-muted)', marginTop: 6 }}>{statusText}</div>
      </div>

      {attendance.error && <div className="nova-toast error">{attendance.error}</div>}
      {attendance.success && <div className="nova-toast success">{attendance.success}</div>}

      <div className="nova-card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--nova-muted)', marginBottom: 8 }}>
          Observación
        </div>
        <textarea
          className="nova-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Comentario opcional para entrada o salida"
          style={{ minHeight: 90, resize: 'vertical' }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 16,
        }}
      >
        <button
          className="btn-nova-primary"
          disabled={!canClockIn || attendance.loading}
          onClick={() => requestAction('clock_in')}
        >
          {ACTION_LABEL.clock_in}
        </button>

        <button
          className="btn-nova-ghost"
          disabled={!canBreakStart || attendance.loading}
          onClick={() => requestAction('break_start')}
        >
          {ACTION_LABEL.break_start}
        </button>

        <button
          className="btn-nova-ghost"
          disabled={!canBreakEnd || attendance.loading}
          onClick={() => requestAction('break_end')}
        >
          {ACTION_LABEL.break_end}
        </button>

        <button
          className="btn-nova-primary"
          disabled={!canClockOut || attendance.loading}
          onClick={() => requestAction('clock_out')}
        >
          {ACTION_LABEL.clock_out}
        </button>
      </div>

      <div className="nova-card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>GPS</div>
        <div style={{ marginTop: 6, color: 'var(--nova-text)' }}>
          {attendance.location
            ? `${attendance.location.latitude.toFixed(5)}, ${attendance.location.longitude.toFixed(5)}`
            : 'Sin captura aún'}
        </div>
        <div style={{ marginTop: 4, color: 'var(--nova-muted)', fontSize: 12 }}>
          Estado: {attendance.geofenceStatus}
          {attendance.geofenceDistance != null
            ? ` · distancia ${attendance.geofenceDistance}m`
            : ''}
        </div>
        <button
          className="btn-nova-ghost"
          style={{ marginTop: 10 }}
          onClick={() => attendance.refreshLocation()}
        >
          Revalidar ubicación
        </button>
      </div>

      <div className="nova-card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--nova-muted)', marginBottom: 10 }}>
          Marcaciones de hoy
        </div>
        {attendance.todayPunches.length === 0 ? (
          <div style={{ color: 'var(--nova-muted)' }}>Aún no hay marcaciones.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {attendance.todayPunches.map((row) => (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  border: '1px solid var(--nova-border)',
                  borderRadius: 12,
                }}
              >
                <div>
                  <div style={{ color: 'var(--nova-text)', fontWeight: 700 }}>
                    {String((row.evidence as any)?.action || 'punch')}
                  </div>
                  <div style={{ color: 'var(--nova-muted)', fontSize: 12 }}>
                    {String((row.evidence as any)?.notes || '')}
                  </div>
                </div>
                <div style={{ color: 'var(--nova-cyan)', fontFamily: 'JetBrains Mono' }}>
                  {new Date(row.punched_at).toLocaleTimeString('es-EC', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FaceCaptureModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onCaptured={async (blob) => {
          if (!pendingAction) return
          const action = pendingAction
          setPendingAction(null)
          await runAction(action, blob)
        }}
      />
    </div>
  )
}