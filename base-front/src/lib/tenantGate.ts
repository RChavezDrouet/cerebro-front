import {
  supabase,
  PROFILES_TABLE,
  TENANTS_TABLE,
  TENANT_GATE_ENABLED,
} from '@/config/supabase'

export interface TenantGateState {
  allowed: boolean
  status: 'active' | 'paused' | 'suspended' | 'unknown'
  message: string | null
  tenantId: string | null
}

export async function resolveTenantGate(): Promise<TenantGateState> {
  try {
    if (!TENANT_GATE_ENABLED) {
      return {
        allowed: true,
        status: 'active',
        message: null,
        tenantId: null,
      }
    }

    if (!supabase || !supabase.auth) {
      console.error('[tenantGate] supabase.auth no está disponible')
      return {
        allowed: false,
        status: 'unknown',
        message: 'Cliente de autenticación no disponible',
        tenantId: null,
      }
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        allowed: false,
        status: 'unknown',
        message: 'Sesión no válida',
        tenantId: null,
      }
    }

    const profileRs = await supabase
      .from(PROFILES_TABLE)
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    const tenantId = profileRs.data?.tenant_id ?? null

    if (profileRs.error || !tenantId) {
      return {
        allowed: false,
        status: 'unknown',
        message: 'No se pudo resolver el tenant del usuario',
        tenantId: null,
      }
    }

    const tenantRs = await supabase
      .from(TENANTS_TABLE)
      .select('id, status, is_suspended')
      .eq('id', tenantId)
      .single()

    if (tenantRs.error || !tenantRs.data) {
      return {
        allowed: false,
        status: 'unknown',
        message: 'No se pudo consultar el estado de la empresa',
        tenantId,
      }
    }

    const appSettingsRs = await supabase
      .from('app_settings')
      .select('paused_message_title, paused_message_body')
      .eq('id', 1)
      .maybeSingle()

    const tenantStatus = tenantRs.data.status as 'active' | 'paused' | 'suspended' | null
    const isSuspended = Boolean(tenantRs.data.is_suspended)

    const effectiveStatus: TenantGateState['status'] = isSuspended
      ? 'suspended'
      : tenantStatus === 'active' || tenantStatus === 'paused'
        ? tenantStatus
        : 'unknown'

    if (effectiveStatus !== 'active') {
      const title =
        appSettingsRs.data?.paused_message_title?.trim() || 'Servicio pausado'

      const body =
        appSettingsRs.data?.paused_message_body?.trim() ||
        'Tu empresa se encuentra temporalmente pausada. Contacta al administrador.'

      return {
        allowed: false,
        status: effectiveStatus,
        tenantId,
        message: `${title}: ${body}`,
      }
    }

    return {
      allowed: true,
      status: 'active',
      message: null,
      tenantId,
    }
  } catch (error) {
    console.error('[tenantGate] resolveTenantGate error:', error)

    return {
      allowed: false,
      status: 'unknown',
      message: 'No se pudo validar el estado del tenant',
      tenantId: null,
    }
  }
}

export async function checkTenantStatus(): Promise<TenantGateState> {
  return resolveTenantGate()
}

export default checkTenantStatus