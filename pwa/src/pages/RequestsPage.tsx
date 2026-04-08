// HRCloud PWA — Nova UI Requests Page (Solicitudes)
import React, { useEffect, useMemo, useState } from 'react'
import { attendanceDb } from '../lib/supabase'
import type { EmployeeRequest, UserProfile } from '../types'

const statusStyle = (status: string) => {
  switch (status) {
    case 'approved':
      return { bg: 'rgba(0,255,163,0.10)', br: 'rgba(0,255,163,0.25)', fg: 'var(--nova-green)' }
    case 'rejected':
      return { bg: 'rgba(255,69,96,0.10)', br: 'rgba(255,69,96,0.25)', fg: 'var(--nova-red)' }
    case 'in_review':
      return { bg: 'rgba(255,184,0,0.10)', br: 'rgba(255,184,0,0.25)', fg: 'var(--nova-amber)' }
    case 'closed':
      return { bg: 'rgba(255,255,255,0.06)', br: 'rgba(255,255,255,0.14)', fg: 'var(--nova-muted)' }
    default:
      return { bg: 'rgba(0,212,255,0.08)', br: 'rgba(0,212,255,0.20)', fg: 'var(--nova-cyan)' }
  }
}

const prettyStatus = (s: string) =>
  ({ open: 'Abierta', in_review: 'En revisión', approved: 'Aprobada', rejected: 'Rechazada', closed: 'Cerrada' } as any)[s] || s

const RequestsPage: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const [items, setItems] = useState<EmployeeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form
  const [type, setType] = useState('Corrección de marcación')
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')

  const types = useMemo(
    () => ['Corrección de marcación', 'Permiso', 'Soporte', 'Otro'],
    []
  )

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await attendanceDb
        .from('employee_requests')
        .select('id,tenant_id,employee_id,type,subject,detail,status,created_at,updated_at')
        .eq('tenant_id', profile.tenant_id)
        .eq('employee_id', profile.employee_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems((data || []) as any)
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar solicitudes (verifica tabla/permiso).')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.tenant_id, profile.employee_id])

  const submit = async () => {
    if (!subject.trim() || !detail.trim()) {
      setError('Completa asunto y detalle.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        tenant_id: profile.tenant_id,
        employee_id: profile.employee_id,
        type,
        subject: subject.trim(),
        detail: detail.trim(),
        status: 'open',
      }

      const { error } = await attendanceDb.from('employee_requests').insert(payload)
      if (error) throw error

      setSubject('')
      setDetail('')
      setSuccess('Solicitud enviada.')
      await load()

      setTimeout(() => setSuccess(null), 3500)
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar la solicitud (verifica tabla/permiso).')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '12px 16px 100px' }}>
      {success && (
        <div className="nova-toast success" style={{ marginTop: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          {success}
        </div>
      )}
      {error && (
        <div className="nova-toast error" style={{ marginTop: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="anim-fade-up" style={{ paddingTop: 12, paddingBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--nova-cyan)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', marginBottom: 2, opacity: 0.8 }}>
          {profile.tenant_name}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--nova-text)', margin: 0 }}>Solicitudes</h1>
        <div style={{ fontSize: 12, color: 'var(--nova-muted)', marginTop: 6 }}>
          Crea una solicitud y revisa el estado (seguimiento).
        </div>
      </div>

      {/* Form */}
      <div className="nova-card anim-fade-up" style={{ padding: 16, marginTop: 10, animationDelay: '60ms' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', marginBottom: 6, letterSpacing: '0.12em' }}>TIPO</div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="nova-input"
              style={{ height: 44, fontSize: 13 }}
              disabled={loading}
            >
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', marginBottom: 6, letterSpacing: '0.12em' }}>ASUNTO</div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="nova-input"
              placeholder="Ej: Olvidé marcar salida"
              disabled={loading}
            />
          </div>

          <div>
            <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)', marginBottom: 6, letterSpacing: '0.12em' }}>DETALLE</div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="nova-input"
              placeholder="Describe el caso: fecha/hora, motivo, evidencia…"
              style={{ height: 110, resize: 'none', fontSize: 13 }}
              maxLength={2000}
              disabled={loading}
            />
          </div>

          <button
            className="btn-nova-primary"
            onClick={submit}
            disabled={loading}
            style={{ height: 46, fontSize: 14 }}
          >
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="nova-card anim-fade-up" style={{ marginTop: 14, animationDelay: '100ms' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, color: 'var(--nova-text)' }}>Mis solicitudes</div>
          <button
            onClick={load}
            className="btn-nova-ghost"
            style={{ fontSize: 12, padding: '8px 12px' }}
            disabled={loading}
          >
            Actualizar
          </button>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          {loading && items.length === 0 ? (
            <div style={{ padding: '14px 0', color: 'var(--nova-muted)', textAlign: 'center' }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '14px 0', color: 'var(--nova-muted)', textAlign: 'center' }}>Sin solicitudes</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((it) => {
                const st = statusStyle(it.status)
                return (
                  <div key={it.id} style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--nova-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)' }}>{it.type}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--nova-text)', marginTop: 2 }}>{it.subject}</div>
                      </div>
                      <div style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: st.bg,
                        border: `1px solid ${st.br}`,
                        color: st.fg,
                        fontSize: 11,
                        fontFamily: 'JetBrains Mono',
                        whiteSpace: 'nowrap'
                      }}>
                        {prettyStatus(it.status)}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--nova-muted)', marginTop: 8, lineHeight: 1.35 }}>
                      {it.detail}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-muted)' }}>
                      <span>Creada: {new Date(it.created_at).toLocaleString('es-EC')}</span>
                      <span>Actualizada: {new Date(it.updated_at).toLocaleString('es-EC')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RequestsPage
