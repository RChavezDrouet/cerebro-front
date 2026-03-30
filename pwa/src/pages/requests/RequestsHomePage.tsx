import React from 'react'
import { supabase, attendanceDb } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type Tab = 'permissions' | 'justifications' | 'history'
type PermissionScope = 'day' | 'hour'
type JustificationType = 'late' | 'absence'

type HistoryRow = {
  kind: 'permission' | 'justification'
  id: string
  subtype: string
  status: string
  summary: string
  affected_date: string
  created_at: string
}

export default function RequestsHomePage() {
  const { profile } = useAuth()

  const [tab, setTab] = React.useState<Tab>('permissions')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const [permissionScope, setPermissionScope] = React.useState<PermissionScope>('day')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [dateAt, setDateAt] = React.useState('')
  const [timeFrom, setTimeFrom] = React.useState('')
  const [timeTo, setTimeTo] = React.useState('')
  const [permissionReason, setPermissionReason] = React.useState('')
  const [permissionObservations, setPermissionObservations] = React.useState('')

  const [justificationType, setJustificationType] = React.useState<JustificationType>('late')
  const [affectedDate, setAffectedDate] = React.useState('')
  const [justificationReason, setJustificationReason] = React.useState('')
  const [justificationObservations, setJustificationObservations] = React.useState('')
  const [evidenceFile, setEvidenceFile] = React.useState<File | null>(null)

  const [statusFilter, setStatusFilter] = React.useState('')
  const [kindFilter, setKindFilter] = React.useState('')
  const [historyRows, setHistoryRows] = React.useState<HistoryRow[]>([])

  const loadHistory = React.useCallback(async () => {
    if (!profile) return

    setLoading(true)
    setError(null)

    try {
      const [permissions, justifications] = await Promise.all([
        attendanceDb
          .from('permission_requests')
          .select('id,request_scope,status,date_from,date_to,request_date,time_from,time_to,reason,created_at')
          .eq('tenant_id', profile.tenant_id)
          .eq('employee_id', profile.employee_id)
          .order('created_at', { ascending: false }),
        attendanceDb
          .from('justifications')
          .select('id,justification_type,status,affected_date,reason,created_at')
          .eq('tenant_id', profile.tenant_id)
          .eq('employee_id', profile.employee_id)
          .order('created_at', { ascending: false }),
      ])

      if (permissions.error) throw permissions.error
      if (justifications.error) throw justifications.error

      const permissionRows: HistoryRow[] = (permissions.data || []).map((row: any) => ({
        kind: 'permission',
        id: row.id,
        subtype: row.request_scope === 'day' ? 'Permiso por día' : 'Permiso por hora',
        status: row.status,
        summary:
          row.request_scope === 'day'
            ? `${row.reason} · ${row.date_from}${row.date_to ? ` a ${row.date_to}` : ''}`
            : `${row.reason} · ${row.request_date} ${row.time_from}-${row.time_to}`,
        affected_date: row.request_scope === 'day' ? row.date_from : row.request_date,
        created_at: row.created_at,
      }))

      const justificationRows: HistoryRow[] = (justifications.data || []).map((row: any) => ({
        kind: 'justification',
        id: row.id,
        subtype: row.justification_type === 'late' ? 'Justificación de atraso' : 'Justificación de inasistencia',
        status: row.status,
        summary: row.reason,
        affected_date: row.affected_date,
        created_at: row.created_at,
      }))

      let merged = [...permissionRows, ...justificationRows]

      if (statusFilter) merged = merged.filter((r) => r.status === statusFilter)
      if (kindFilter) merged = merged.filter((r) => r.kind === kindFilter)

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setHistoryRows(merged)
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }, [kindFilter, profile, statusFilter])

  React.useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  if (!profile) return null

  const submitPermission = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (!permissionReason.trim()) throw new Error('El motivo es obligatorio.')

      const payload =
        permissionScope === 'day'
          ? {
              tenant_id: profile.tenant_id,
              employee_id: profile.employee_id,
              request_scope: 'day',
              date_from: dateFrom,
              date_to: dateTo || dateFrom,
              request_date: null,
              time_from: null,
              time_to: null,
              reason: permissionReason.trim(),
              observations: permissionObservations.trim() || null,
              status: 'pending',
            }
          : {
              tenant_id: profile.tenant_id,
              employee_id: profile.employee_id,
              request_scope: 'hour',
              date_from: null,
              date_to: null,
              request_date: dateAt,
              time_from: timeFrom,
              time_to: timeTo,
              reason: permissionReason.trim(),
              observations: permissionObservations.trim() || null,
              status: 'pending',
            }

      const { error } = await attendanceDb.from('permission_requests').insert(payload)
      if (error) throw error

      setSuccess('Permiso registrado.')
      setDateFrom('')
      setDateTo('')
      setDateAt('')
      setTimeFrom('')
      setTimeTo('')
      setPermissionReason('')
      setPermissionObservations('')
      await loadHistory()
    } catch (err: any) {
      setError(err?.message || 'No se pudo registrar el permiso.')
    } finally {
      setLoading(false)
    }
  }

  const submitJustification = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (!affectedDate) throw new Error('La fecha afectada es obligatoria.')
      if (!justificationReason.trim()) throw new Error('El motivo es obligatorio.')

      let evidencePath: string | null = null

      if (evidenceFile) {
        const path = `${profile.tenant_id}/${profile.employee_id}/justifications/${crypto.randomUUID()}-${evidenceFile.name}`

        const { error: uploadError } = await supabase.storage
          .from('request-evidence')
          .upload(path, evidenceFile, { upsert: false })

        if (uploadError) throw uploadError
        evidencePath = path
      }

      const { error } = await attendanceDb.from('justifications').insert({
        tenant_id: profile.tenant_id,
        employee_id: profile.employee_id,
        justification_type: justificationType,
        affected_date: affectedDate,
        reason: justificationReason.trim(),
        observations: justificationObservations.trim() || null,
        evidence_path: evidencePath,
        status: 'pending',
      })

      if (error) throw error

      setSuccess('Justificación registrada.')
      setAffectedDate('')
      setJustificationReason('')
      setJustificationObservations('')
      setEvidenceFile(null)
      await loadHistory()
    } catch (err: any) {
      setError(err?.message || 'No se pudo registrar la justificación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 16px 100px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ color: 'var(--nova-text)', margin: 0 }}>Permisos y justificaciones</h1>
        <div style={{ color: 'var(--nova-muted)', marginTop: 6 }}>
          Solicita permisos, registra justificaciones y consulta el estado de cada caso.
        </div>
      </div>

      {error && <div className="nova-toast error">{error}</div>}
      {success && <div className="nova-toast success">{success}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={tab === 'permissions' ? 'btn-nova-primary' : 'btn-nova-ghost'} onClick={() => setTab('permissions')}>
          Permiso
        </button>
        <button className={tab === 'justifications' ? 'btn-nova-primary' : 'btn-nova-ghost'} onClick={() => setTab('justifications')}>
          Justificación
        </button>
        <button className={tab === 'history' ? 'btn-nova-primary' : 'btn-nova-ghost'} onClick={() => setTab('history')}>
          Historial
        </button>
      </div>

      {tab === 'permissions' && (
        <div className="nova-card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <select className="nova-input" value={permissionScope} onChange={(e) => setPermissionScope(e.target.value as PermissionScope)}>
              <option value="day">Por día</option>
              <option value="hour">Por hora</option>
            </select>

            {permissionScope === 'day' ? (
              <>
                <input className="nova-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input className="nova-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </>
            ) : (
              <>
                <input className="nova-input" type="date" value={dateAt} onChange={(e) => setDateAt(e.target.value)} />
                <input className="nova-input" type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
                <input className="nova-input" type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
              </>
            )}

            <input
              className="nova-input"
              value={permissionReason}
              onChange={(e) => setPermissionReason(e.target.value)}
              placeholder="Motivo"
            />

            <textarea
              className="nova-input"
              value={permissionObservations}
              onChange={(e) => setPermissionObservations(e.target.value)}
              placeholder="Observaciones"
              style={{ minHeight: 100 }}
            />

            <button className="btn-nova-primary" onClick={submitPermission} disabled={loading}>
              {loading ? 'Guardando...' : 'Enviar permiso'}
            </button>
          </div>
        </div>
      )}

      {tab === 'justifications' && (
        <div className="nova-card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <select
              className="nova-input"
              value={justificationType}
              onChange={(e) => setJustificationType(e.target.value as JustificationType)}
            >
              <option value="late">Atraso</option>
              <option value="absence">Inasistencia</option>
            </select>

            <input className="nova-input" type="date" value={affectedDate} onChange={(e) => setAffectedDate(e.target.value)} />

            <input
              className="nova-input"
              value={justificationReason}
              onChange={(e) => setJustificationReason(e.target.value)}
              placeholder="Motivo"
            />

            <textarea
              className="nova-input"
              value={justificationObservations}
              onChange={(e) => setJustificationObservations(e.target.value)}
              placeholder="Observaciones"
              style={{ minHeight: 100 }}
            />

            <input
              className="nova-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            />

            <button className="btn-nova-primary" onClick={submitJustification} disabled={loading}>
              {loading ? 'Guardando...' : 'Enviar justificación'}
            </button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="nova-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <select className="nova-input" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="permission">Permisos</option>
              <option value="justification">Justificaciones</option>
            </select>

            <select className="nova-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobado</option>
              <option value="rejected">Rechazado</option>
            </select>

            <button className="btn-nova-ghost" onClick={() => void loadHistory()}>
              Filtrar
            </button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--nova-muted)' }}>Cargando...</div>
          ) : historyRows.length === 0 ? (
            <div style={{ color: 'var(--nova-muted)' }}>No hay registros para los filtros seleccionados.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {historyRows.map((row) => (
                <div key={`${row.kind}-${row.id}`} style={{ border: '1px solid var(--nova-border)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--nova-text)' }}>{row.subtype}</strong>
                    <span style={{ color: 'var(--nova-cyan)', fontSize: 12 }}>{row.status}</span>
                  </div>
                  <div style={{ color: 'var(--nova-muted)', marginTop: 6 }}>{row.summary}</div>
                  <div style={{ color: 'var(--nova-muted)', fontSize: 12, marginTop: 8 }}>
                    Fecha afectada: {row.affected_date} · Registrado: {new Date(row.created_at).toLocaleString('es-EC')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
