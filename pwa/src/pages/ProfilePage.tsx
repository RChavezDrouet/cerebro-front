// HRCloud PWA — Nova UI Profile Page
import React from 'react'
import type { GeoLocation, UserProfile } from '../types'
import { getCurrentPosition } from '../lib/geolocation'
import { supabase } from '../lib/supabase'

interface ProfilePageProps {
  profile: UserProfile
  onSignOut: () => void
  onRefreshProfile: () => Promise<void> | void
}

const ProfilePage: React.FC<ProfilePageProps> = ({ profile, onSignOut, onRefreshProfile }) => {
  const initials = profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  const isMobile = navigator.userAgent.includes('Mobile')
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [location, setLocation] = React.useState<GeoLocation | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [capturing, setCapturing] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const selfServiceVisible = Boolean(profile.pwa_self_service_enabled || profile.pwa_self_service_locked || profile.pwa_self_service_completed_at)
  const selfServiceLocked = Boolean(profile.pwa_self_service_locked || profile.pwa_self_service_completed_at)

  React.useEffect(() => {
    const parts = (profile.full_name || '').trim().split(/\s+/)
    setFirstName(parts.slice(0, Math.max(1, parts.length - 1)).join(' ') || profile.full_name || '')
    setLastName(parts.length > 1 ? parts.slice(-1).join(' ') : '')
    setEmail(profile.email || '')
    setPhone(profile.phone || '')
    setAddress(profile.address || '')
    if (profile.geofence_lat != null && profile.geofence_lng != null) {
      setLocation({
        latitude: Number(profile.geofence_lat),
        longitude: Number(profile.geofence_lng),
        accuracy: 0,
        timestamp: Date.now(),
      })
    }
  }, [profile])

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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--nova-border)', color: 'var(--nova-text)', fontSize: 14, outline: 'none',
  }

  const captureLocation = async () => {
    try {
      setCapturing(true)
      setError(null)
      setMessage(null)
      const pos = await getCurrentPosition()
      setLocation(pos)
      setMessage('GPS capturado correctamente. Revisa los datos y guarda para bloquear la edición.')
    } catch (err: any) {
      setError(err?.message || 'No se pudo capturar el GPS del puesto de trabajo.')
    } finally {
      setCapturing(false)
    }
  }

  const saveSelfService = async () => {
    try {
      setSaving(true)
      setError(null)
      setMessage(null)

      if (!location) {
        throw new Error('Primero debes capturar la georreferenciación del puesto de trabajo.')
      }
      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        throw new Error('Completa nombres, apellidos y correo antes de guardar.')
      }
      const confirm = window.confirm('¿Está seguro de guardar los cambios? Después de grabar ya no podrá editar ni cambiar estos datos desde PWA hasta que Base vuelva a habilitar la opción.')
      if (!confirm) return

      const { error } = await supabase.schema('attendance').rpc('save_my_pwa_self_service_profile', {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_email: email.trim(),
        p_phone: phone.trim() || null,
        p_address: address.trim() || null,
        p_geofence_lat: location.latitude,
        p_geofence_lng: location.longitude,
        p_geofence_accuracy_m: location.accuracy ?? null,
      })

      if (error) throw error

      await onRefreshProfile()
      setMessage('Tus datos y la georreferenciación del puesto fueron guardados. La edición quedó deshabilitada.')
    } catch (err: any) {
      setError(err?.message || 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 100px', position: 'relative', zIndex: 1 }}>
      <div className="anim-fade-up" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--nova-cyan)', letterSpacing: '0.15em', marginBottom: 4, opacity: 0.8 }}>
          CUENTA
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--nova-text)', margin: 0 }}>Mi Perfil</h2>
      </div>

      <div className="nova-card anim-fade-up" style={{ padding: '28px 20px', textAlign: 'center', marginBottom: 16, animationDelay: '50ms' }}>
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
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
              borderRadius: '50% 50% 0 0 / 30% 30% 0 0'
            }} />
            <span style={{ position: 'relative', zIndex: 1 }}>{initials}</span>
          </div>
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--nova-green)', border: '2px solid var(--nova-bg)',
            boxShadow: '0 0 8px var(--nova-green)'
          }} />
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--nova-text)', margin: '0 0 4px' }}>{profile.full_name}</h3>
        <p style={{ fontSize: 13, color: 'var(--nova-muted)', margin: '0 0 12px' }}>{profile.email}</p>
        <span className="status-pill cyan">🛡️ Empleado Activo</span>
      </div>

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

      {selfServiceVisible && (
        <div className="nova-card anim-fade-up" style={{ padding: '18px 16px', marginBottom: 16, animationDelay: '95ms' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--nova-text)', marginBottom: 12 }}>Revisión y actualización de datos / GPS del puesto</div>
          <div style={{ fontSize: 12, color: 'var(--nova-muted)', marginBottom: 14 }}>
            Esta opción fue habilitada desde Base. Debes revisar tus datos, capturar la georreferenciación del puesto de trabajo y guardar una sola vez.
          </div>

          {message && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', color: '#bbf7d0', fontSize: 12 }}>{message}</div>}
          {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.25)', color: '#fecaca', fontSize: 12 }}>{error}</div>}

          {selfServiceLocked ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--nova-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--nova-text)', marginBottom: 6 }}>Edición deshabilitada</div>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>Tus cambios ya fueron grabados. Solo Base puede volver a habilitar la edición.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>Nombre: <span style={{ color: 'var(--nova-text)', fontWeight: 700 }}>{profile.full_name}</span></div>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>Correo: <span style={{ color: 'var(--nova-text)', fontWeight: 700 }}>{profile.email}</span></div>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>Teléfono: <span style={{ color: 'var(--nova-text)', fontWeight: 700 }}>{profile.phone || '—'}</span></div>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>Dirección: <span style={{ color: 'var(--nova-text)', fontWeight: 700 }}>{profile.address || '—'}</span></div>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>GPS registrado: <span style={{ color: 'var(--nova-text)', fontWeight: 700 }}>{profile.geofence_lat != null && profile.geofence_lng != null ? `${Number(profile.geofence_lat).toFixed(6)}, ${Number(profile.geofence_lng).toFixed(6)}` : '—'}</span></div>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>Rango permitido: <span style={{ color: 'var(--nova-text)', fontWeight: 700 }}>{profile.geofence_radius_m != null ? `${Number(profile.geofence_radius_m).toFixed(0)} m` : '—'}</span></div>
                {profile.pwa_self_service_completed_at && <div style={{ fontSize: 12, color: 'var(--nova-muted)' }}>Fecha de cierre: <span style={{ color: 'var(--nova-text)', fontWeight: 700 }}>{new Date(profile.pwa_self_service_completed_at).toLocaleString()}</span></div>}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--nova-muted)', marginBottom: 6 }}>Nombres</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--nova-muted)', marginBottom: 6 }}>Apellidos</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--nova-muted)', marginBottom: 6 }}>Correo</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--nova-muted)', marginBottom: 6 }}>Teléfono</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--nova-muted)', marginBottom: 6 }}>Dirección</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--nova-border)' }}>
                <div style={{ fontSize: 12, color: 'var(--nova-muted)', marginBottom: 8 }}>Georreferenciación del puesto de trabajo</div>
                <div style={{ fontSize: 12, color: 'var(--nova-text)', marginBottom: 8 }}>Rango configurado desde Base: <strong>{profile.geofence_radius_m != null ? `${Number(profile.geofence_radius_m).toFixed(0)} m` : 'No configurado'}</strong></div>
                <button onClick={captureLocation} disabled={capturing || saving} style={{
                  padding: '10px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.16)', border: '1px solid rgba(59,130,246,0.30)',
                  color: '#bfdbfe', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}>
                  {capturing ? 'Capturando GPS...' : 'Capturar GPS del puesto de trabajo'}
                </button>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--nova-muted)' }}>
                  {location ? `GPS actual: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} · precisión ${Math.round(location.accuracy || 0)} m` : 'Aún no se ha capturado un GPS para guardar.'}
                </div>
              </div>
              <button onClick={saveSelfService} disabled={saving || capturing} style={{
                width: '100%', padding: '14px 20px', borderRadius: 14,
                background: 'linear-gradient(135deg, #00d4ff, #3b82f6)', border: 'none', color: 'white',
                fontSize: 14, fontWeight: 800, cursor: 'pointer'
              }}>
                {saving ? 'Guardando...' : 'Guardar datos y bloquear edición'}
              </button>
            </div>
          )}
        </div>
      )}

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
