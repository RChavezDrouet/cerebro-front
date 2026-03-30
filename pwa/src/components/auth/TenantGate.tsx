import React from 'react'
import { publicDb, safeSelect } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type GateState = {
  checking: boolean
  blocked: boolean
  title: string
  body: string
}

export default function TenantGate({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, signOut } = useAuth()
  const [state, setState] = React.useState<GateState>({
    checking: true,
    blocked: false,
    title: '',
    body: '',
  })

  React.useEffect(() => {
    let mounted = true

    const run = async () => {
      if (!profile?.tenant_id) {
        if (!mounted) return
        setState({
          checking: false,
          blocked: true,
          title: 'Empresa no asignada',
          body: 'La cuenta no tiene tenant asignado.',
        })
        return
      }

      const [tenant, appSettings] = await Promise.all([
        safeSelect<any>(() =>
          publicDb
            .from('tenants')
            .select('status,is_suspended')
            .eq('id', profile.tenant_id)
            .maybeSingle()
        ),
        safeSelect<any>(() =>
          publicDb
            .from('app_settings')
            .select('paused_message_title,paused_message_body')
            .eq('id', 1)
            .maybeSingle()
        ),
      ])

      const blocked =
        !tenant || tenant.status !== 'active' || tenant.is_suspended === true

      if (!mounted) return

      setState({
        checking: false,
        blocked,
        title: appSettings?.paused_message_title || 'Acceso restringido',
        body:
          appSettings?.paused_message_body ||
          'Tu empresa está pausada o suspendida. Contacta a RR.HH. o al proveedor del servicio.',
      })
    }

    void run()

    return () => {
      mounted = false
    }
  }, [profile?.tenant_id])

  if (state.checking) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--nova-muted)',
        }}
      >
        Verificando acceso...
      </div>
    )
  }

  if (state.blocked) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <div
          className="nova-card"
          style={{ maxWidth: 420, width: '100%', padding: 24, textAlign: 'center' }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>⏸️</div>
          <h2 style={{ margin: 0, color: 'var(--nova-text)' }}>{state.title}</h2>
          <p style={{ color: 'var(--nova-muted)', marginTop: 12 }}>{state.body}</p>
          <button className="btn-nova-primary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}