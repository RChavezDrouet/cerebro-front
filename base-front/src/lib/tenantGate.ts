import type { SupabaseClient } from '@supabase/supabase-js'

import {
  supabase,
  PROFILES_TABLE,
  TENANTS_TABLE,
  TENANT_GATE_ENABLED,
} from '@/config/supabase'

export type TenantGateStatus = 'active' | 'paused' | 'suspended' | 'unknown'

export interface TenantGateState {
  allowed: boolean
  status: TenantGateStatus
  message: string | null
  tenantId: string | null
  blocked: boolean
  paused: boolean
  title: string
  body: string
}

type ResolveTenantGateOptions = {
  supabaseClient?: SupabaseClient
  userId?: string
}

const FALLBACK_GATE_COPY: Record<Exclude<TenantGateStatus, 'active' | 'unknown'>, { title: string; body: string }> = {
  paused: {
    title: 'Servicio pausado',
    body: 'Tu empresa se encuentra temporalmente pausada. Contacta al administrador.',
  },
  suspended: {
    title: 'Servicio suspendido',
    body: 'Tu empresa se encuentra temporalmente suspendida. Contacta al administrador.',
  },
}

function buildTenantGateState(input: {
  allowed: boolean
  status: TenantGateStatus
  message?: string | null
  tenantId: string | null
  title?: string | null
  body?: string | null
}): TenantGateState {
  const blocked = !input.allowed && (input.status === 'paused' || input.status === 'suspended')
  const fallbackCopy =
    input.status === 'paused' || input.status === 'suspended'
      ? FALLBACK_GATE_COPY[input.status]
      : { title: '', body: '' }
  const title = input.title?.trim() || fallbackCopy.title
  const body = input.body?.trim() || fallbackCopy.body
  const message = input.message ?? (title && body ? `${title}: ${body}` : body || title || null)

  return {
    allowed: input.allowed,
    status: input.status,
    message,
    tenantId: input.tenantId,
    blocked,
    paused: blocked,
    title,
    body,
  }
}

export const INITIAL_TENANT_GATE_STATE = buildTenantGateState({
  allowed: false,
  status: 'unknown',
  message: null,
  tenantId: null,
})

export async function resolveTenantGate(
  options: ResolveTenantGateOptions = {},
): Promise<TenantGateState> {
  const client = options.supabaseClient ?? supabase

  try {
    if (!TENANT_GATE_ENABLED) {
      return buildTenantGateState({
        allowed: true,
        status: 'active',
        message: null,
        tenantId: null,
      })
    }

    if (!client?.auth) {
      console.error('[tenantGate] supabase.auth is not available')
      return buildTenantGateState({
        allowed: false,
        status: 'unknown',
        message: 'Cliente de autenticacion no disponible',
        tenantId: null,
      })
    }

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    const resolvedUserId = options.userId ?? user?.id ?? null

    if (userError && !resolvedUserId) {
      return buildTenantGateState({
        allowed: false,
        status: 'unknown',
        message: 'Sesion no valida',
        tenantId: null,
      })
    }

    if (!resolvedUserId) {
      return buildTenantGateState({
        allowed: false,
        status: 'unknown',
        message: 'No se pudo resolver el usuario autenticado',
        tenantId: null,
      })
    }

    const profileRs = await client
      .from(PROFILES_TABLE)
      .select('tenant_id')
      .eq('id', resolvedUserId)
      .single()

    const tenantId = profileRs.data?.tenant_id ?? null

    if (profileRs.error || !tenantId) {
      return buildTenantGateState({
        allowed: false,
        status: 'unknown',
        message: 'No se pudo resolver el tenant del usuario',
        tenantId: null,
      })
    }

    const tenantRs = await client
      .from(TENANTS_TABLE)
      .select('id, status, is_suspended')
      .eq('id', tenantId)
      .single()

    if (tenantRs.error || !tenantRs.data) {
      return buildTenantGateState({
        allowed: false,
        status: 'unknown',
        message: 'No se pudo consultar el estado de la empresa',
        tenantId,
      })
    }

    // app_settings puede no estar accesible por RLS; en ese caso se usan copias por defecto.
    const appSettingsRs = await client
      .from('app_settings')
      .select('paused_message_title, paused_message_body')
      .eq('id', 1)
      .maybeSingle()

    const tenantStatus = tenantRs.data.status as TenantGateStatus | null
    const isSuspended = Boolean(tenantRs.data.is_suspended)
    const appSettings = appSettingsRs.error ? null : appSettingsRs.data

    const effectiveStatus: TenantGateStatus = isSuspended
      ? 'suspended'
      : tenantStatus === 'active' || tenantStatus === 'paused'
        ? tenantStatus
        : 'unknown'

    if (effectiveStatus !== 'active') {
      return buildTenantGateState({
        allowed: false,
        status: effectiveStatus,
        tenantId,
        title: appSettings?.paused_message_title ?? null,
        body: appSettings?.paused_message_body ?? null,
      })
    }

    return buildTenantGateState({
      allowed: true,
      status: 'active',
      message: null,
      tenantId,
    })
  } catch (error) {
    console.error('[tenantGate] resolveTenantGate error:', error)

    return buildTenantGateState({
      allowed: false,
      status: 'unknown',
      message: 'No se pudo validar el estado del tenant',
      tenantId: null,
    })
  }
}

export async function checkTenantStatus(
  userId?: string,
  supabaseClient?: SupabaseClient,
): Promise<TenantGateState> {
  return resolveTenantGate({ userId, supabaseClient })
}

export default checkTenantStatus
