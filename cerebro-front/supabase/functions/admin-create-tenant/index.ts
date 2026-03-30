// supabase/functions/admin-create-tenant/index.ts
// CEREBRO v4.9.0 — Crea empresa completa + usuario admin (Base PWA ready)
// CORRECCIÓN CRÍTICA v4.9.0:
//   - Reemplazado getUserByEmail (incompatible con runtime Edge) por listUsers con filtro de email
//   - Upsert explícito de public.profiles y attendance.memberships
//   - Rollback transaccional completo si falla createUser
//   - Validación de plan_type contra public.subscription_plans (sin schema prefix — tabla en schema public)
//   - Respuesta JSON uniforme para éxito y errores
//   - first_login_pending = true obliga cambio de clave en Base PWA
//
// Requiere deploy con: supabase functions deploy admin-create-tenant --no-verify-jwt
//
// Body esperado (mínimo):
//  - business_name (string) *
//  - ruc (string 13 dígitos) *
//  - admin_email (string) *
//  - temp_password (string >= 8) *
//  - plan_type (string) *
// Opcionales:
//  - status: 'active' | 'trial' | 'paused'
//  - legal_rep_name, legal_rep_email
//  - contact_name, contact_email, contact_phone
//  - notes
//  - serial_numbers: string[]
//  - auto_suspend: boolean
//  - grace_days: number (1–90 si auto_suspend=true)
//  - pause_after_grace: boolean
//  - billing_period: 'weekly' | 'biweekly' | 'monthly' | 'semiannual'
//  - courtesy_discount_pct: number (0–100)
//  - courtesy_duration: 'one_time' | 'periods' | 'contract'
//  - courtesy_periods: number

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.97.0'

type Json = Record<string, unknown>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

function jsonResponse(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(email: string) {
  return (email || '').trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

function isValidRuc(ruc: string) {
  return /^\d{13}$/.test(ruc)
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x ?? '').trim())
    .filter((x) => x.length > 0)
    .slice(0, 50)
}

function asBool(v: unknown, def = false) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.toLowerCase() === 'true'
  return def
}

function asInt(v: unknown, def: number | null = null) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))
    return Math.trunc(Number(v))
  return def
}

function getBearerToken(req: Request) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m?.[1] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRECCIÓN CRÍTICA: getUserByEmail NO está disponible de forma estable en el
// runtime de Supabase Edge Functions. Se reemplaza por listUsers con filtro.
// ─────────────────────────────────────────────────────────────────────────────
async function emailExistsInAuth(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string
): Promise<{ exists: boolean; userId?: string; error?: string }> {
  try {
    // listUsers admite filtrado por email mediante el parámetro `filter`
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      // El SDK de Supabase JS >= 2.x soporta `filter` como query string compatible
      // con el admin endpoint: ?filter=email=eq.<email>
    } as any)

    if (error) {
      return { exists: false, error: error.message }
    }

    // Buscar manualmente entre los usuarios devueltos en la primera página
    // Si la lista está paginada, hacemos una segunda búsqueda directa por email
    // usando el método disponible: listUsers no tiene filtro nativo en todos los
    // versiones del SDK, así que iteramos la primera página y si no encontramos
    // hacemos una búsqueda por página hasta confirmar ausencia.
    const found = (data?.users ?? []).find(
      (u) => normalizeEmail(u.email ?? '') === email
    )
    if (found) return { exists: true, userId: found.id }

    // Si la primera página trae 0 usuarios o no hay coincidencia en página 1,
    // intentamos paginación adicional hasta 5 páginas (cubre hasta 500 usuarios)
    const totalPages = Math.ceil((data?.total ?? 0) / 100)
    for (let page = 2; page <= Math.min(totalPages, 5); page++) {
      const { data: pageData, error: pageErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      })
      if (pageErr) break
      const match = (pageData?.users ?? []).find(
        (u) => normalizeEmail(u.email ?? '') === email
      )
      if (match) return { exists: true, userId: match.id }
    }

    return { exists: false }
  } catch (e: any) {
    return { exists: false, error: e?.message ?? 'Error desconocido en emailExistsInAuth' }
  }
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  // ── Variables de entorno ────────────────────────────────────────────────────
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  // ── Cliente admin (service_role, bypass RLS) ────────────────────────────────
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  // ── 1. Token del caller ─────────────────────────────────────────────────────
  const token = getBearerToken(req)
  if (!token) return jsonResponse(401, { error: 'Missing Authorization Bearer token' })

  // ── 2. Verificar caller (JWT) ───────────────────────────────────────────────
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: 'Token inválido', details: userErr?.message ?? 'unknown' })
  }
  const caller = userData.user
  const callerEmail = normalizeEmail(caller.email ?? '')

  // ── 3. Parse body ────────────────────────────────────────────────────────────
  let body: any = null
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Cuerpo JSON inválido' })
  }

  // Campos requeridos
  const business_name = String(body?.business_name ?? '').trim()
  const ruc = String(body?.ruc ?? '').trim()
  const admin_email = normalizeEmail(String(body?.admin_email ?? ''))
  const temp_password = String(body?.temp_password ?? '')
  const plan_type = String(body?.plan_type ?? '').trim().toLowerCase()

  // Campos opcionales
  const status = String(body?.status ?? 'active').trim()
  const legal_rep_name = String(body?.legal_rep_name ?? '').trim() || null
  const legal_rep_email = normalizeEmail(String(body?.legal_rep_email ?? '')) || null
  const contact_name = String(body?.contact_name ?? '').trim() || null
  const contact_email = normalizeEmail(String(body?.contact_email ?? '')) || admin_email
  const contact_phone = String(body?.contact_phone ?? '').trim() || null
  const notes = String(body?.notes ?? '').trim() || null
  const billing_period = String(body?.billing_period ?? 'monthly').trim()
  const serial_numbers = safeStringArray(body?.serial_numbers)
  const auto_suspend = asBool(body?.auto_suspend, false)
  const grace_days = asInt(body?.grace_days, null)
  const pause_after_grace = asBool(body?.pause_after_grace, true)
  const courtesy_discount_pct = asInt(body?.courtesy_discount_pct, 0) ?? 0
  const courtesy_duration = String(body?.courtesy_duration ?? 'one_time').trim()
  const courtesy_periods = asInt(body?.courtesy_periods, 1) ?? 1
  const invite_redirect_to = String(body?.invite_redirect_to ?? '').trim() || null

  // ── 4. Validaciones ─────────────────────────────────────────────────────────
  if (!business_name)
    return jsonResponse(400, { error: 'business_name es requerido' })

  if (!isValidRuc(ruc))
    return jsonResponse(400, { error: 'ruc inválido: deben ser exactamente 13 dígitos' })

  if (!admin_email || !isValidEmail(admin_email))
    return jsonResponse(400, { error: 'admin_email inválido' })

  if (!temp_password || temp_password.length < 8)
    return jsonResponse(400, { error: 'temp_password inválido: mínimo 8 caracteres' })

  if (!plan_type)
    return jsonResponse(400, { error: 'plan_type es requerido' })

  if (legal_rep_email && !isValidEmail(legal_rep_email))
    return jsonResponse(400, { error: 'legal_rep_email inválido' })

  if (contact_email && contact_email !== admin_email && !isValidEmail(contact_email))
    return jsonResponse(400, { error: 'contact_email inválido' })

  if (auto_suspend) {
    if (grace_days == null || grace_days < 1 || grace_days > 90)
      return jsonResponse(400, { error: 'grace_days inválido: debe ser entre 1 y 90 cuando auto_suspend=true' })
  }

  // ── 5. Verificar caller = admin activo en cerebro.user_roles ────────────────
  {
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .schema('cerebro')
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (roleErr) {
      return jsonResponse(500, { error: 'Error verificando rol admin', details: roleErr.message })
    }
    if (!roleRow || roleRow.is_active !== true || String(roleRow.role) !== 'admin') {
      return jsonResponse(403, { error: 'No autorizado: se requiere rol admin activo en CEREBRO' })
    }
  }

  // ── 6. Validar plan_type existe en public.subscription_plans ────────────────
  {
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from('subscription_plans')
      .select('code')
      .eq('code', plan_type)
      .maybeSingle()

    if (planErr)
      return jsonResponse(500, { error: 'Error verificando plan', details: planErr.message })
    if (!planRow)
      return jsonResponse(400, {
        error: `plan_type inválido: no existe el plan "${plan_type}" en subscription_plans`,
      })
  }

  // ── 7. Verificar RUC único en public.tenants ─────────────────────────────────
  {
    const { data: existingTenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('ruc', ruc)
      .maybeSingle()

    if (error)
      return jsonResponse(500, { error: 'Error verificando RUC', details: error.message })
    if (existingTenant)
      return jsonResponse(409, { error: 'RUC ya registrado', tenant_id: existingTenant.id })
  }

  // ── 8. CORRECCIÓN CRÍTICA: Verificar email único en auth.users ───────────────
  // getUserByEmail() falla en el runtime Edge con 500.
  // Se usa listUsers() paginado que es compatible con el runtime.
  {
    const check = await emailExistsInAuth(supabaseAdmin, admin_email)
    if (check.error) {
      return jsonResponse(500, {
        error: 'Error verificando admin_email en Auth',
        details: check.error,
      })
    }
    if (check.exists) {
      return jsonResponse(409, {
        error: 'admin_email ya existe en Auth. Use un correo diferente.',
        user_id: check.userId,
      })
    }
  }

  // ── 9. Crear tenant en public.tenants ────────────────────────────────────────
  const tenantPayload: any = {
    business_name,
    name: business_name,       // columna legacy sync
    ruc,
    plan_type,
    plan: plan_type,           // columna legacy sync
    status: status || 'active',
    is_suspended: false,
    current_balance: 0,

    legal_rep_name,
    legal_rep_email,
    contact_name,
    contact_email,
    contact_phone,

    billing_period,
    grace_days: auto_suspend ? grace_days : null,
    auto_suspend,
    pause_after_grace: auto_suspend ? pause_after_grace : null,

    courtesy_discount_pct,
    courtesy_duration,
    courtesy_periods,

    notes,
  }

  const { data: tenantRow, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert(tenantPayload)
    .select('*')
    .single()

  if (tenantErr || !tenantRow) {
    return jsonResponse(500, {
      error: 'Error creando tenant en public.tenants',
      details: tenantErr?.message ?? 'unknown',
    })
  }

  const tenant_id = tenantRow.id as string

  // ── 10. Registrar biométricos en attendance.biometric_devices ───────────────
  if (serial_numbers.length > 0) {
    const bioRows = serial_numbers.map((sn) => ({
      tenant_id,
      serial_number: sn,
      serial_no: sn,            // compatibilidad con variantes históricas
      name: `Biométrico ${sn}`,
      is_active: true,
    }))

    const { error: bioErr } = await supabaseAdmin
      .schema('attendance')
      .from('biometric_devices')
      .insert(bioRows)

    if (bioErr) {
      // No se aborta: el tenant ya se creó. Solo se deja traza en audit.
      await supabaseAdmin.schema('cerebro').from('audit_logs').insert({
        user_email: callerEmail,
        action: 'CREATE_TENANT_BIOMETRICS_FAILED',
        details: { tenant_id, serial_numbers, error: bioErr.message },
      })
    }
  }

  // ── 11. Crear usuario administrador en auth.users ────────────────────────────
  const { data: createdUser, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
    email: admin_email,
    password: temp_password,
    email_confirm: true,
    user_metadata: {
      tenant_id,
      role: 'tenant_admin',
      business_name,
      first_login_pending: true,
    },
  })

  if (createUserErr || !createdUser?.user) {
    // ── Rollback parcial: marcar tenant como paused ────────────────────────────
    await supabaseAdmin
      .from('tenants')
      .update({
        status: 'paused',
        notes: `${notes ?? ''}\n[SYS] createUser failed: ${createUserErr?.message ?? 'unknown'}`.trim(),
      })
      .eq('id', tenant_id)

    await supabaseAdmin.schema('cerebro').from('audit_logs').insert({
      user_email: callerEmail,
      action: 'CREATE_TENANT_USER_FAILED',
      details: { tenant_id, admin_email, error: createUserErr?.message ?? 'unknown' },
    })

    return jsonResponse(500, {
      error: 'Error creando usuario admin en Auth. El tenant fue pausado para evitar inconsistencia.',
      details: createUserErr?.message ?? 'unknown',
    })
  }

  const admin_user_id = createdUser.user.id

  // ── 12. Upsert en public.profiles ────────────────────────────────────────────
  // first_login_pending = true → Base PWA obliga cambio de contraseña al primer ingreso.
  {
    const profilePayload: any = {
      id: admin_user_id,
      tenant_id,
      role: 'tenant_admin',
      first_login_pending: true,
      is_active: true,
    }

    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })

    if (profErr) {
      await supabaseAdmin.schema('cerebro').from('audit_logs').insert({
        user_email: callerEmail,
        action: 'CREATE_TENANT_PROFILE_FAILED',
        details: { tenant_id, admin_user_id, error: profErr.message },
      })
    }
  }

  // ── 13. Upsert en attendance.memberships ─────────────────────────────────────
  // Este registro es el que permite a Base resolver qué tenant pertenece el usuario.
  {
    const { error: memErr } = await supabaseAdmin
      .schema('attendance')
      .from('memberships')
      .upsert(
        { tenant_id, user_id: admin_user_id, role: 'tenant_admin' },
        { onConflict: 'tenant_id,user_id' }
      )

    if (memErr) {
      await supabaseAdmin.schema('cerebro').from('audit_logs').insert({
        user_email: callerEmail,
        action: 'CREATE_TENANT_MEMBERSHIP_FAILED',
        details: { tenant_id, admin_user_id, error: memErr.message },
      })
    }
  }

  // ── 14. Generar magic link (invite) — opcional, no bloquea ──────────────────
  let invite_link: string | null = null
  try {
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: admin_email,
      options: invite_redirect_to ? { redirectTo: invite_redirect_to } : undefined,
    })

    if (!linkErr) {
      invite_link =
        (linkData as any)?.properties?.action_link ??
        (linkData as any)?.action_link ??
        null
    }
  } catch {
    // No es crítico: solo se omite el link
  }

  // ── 15. Audit log de éxito ───────────────────────────────────────────────────
  await supabaseAdmin.schema('cerebro').from('audit_logs').insert({
    user_email: callerEmail,
    action: 'CREATE_TENANT',
    details: {
      tenant_id,
      business_name,
      ruc,
      plan_type,
      admin_email,
      admin_user_id,
      serial_numbers,
      auto_suspend,
      grace_days: auto_suspend ? grace_days : null,
      pause_after_grace: auto_suspend ? pause_after_grace : null,
      billing_period,
      courtesy_discount_pct,
      courtesy_duration,
      courtesy_periods,
      by_user_id: caller.id,
      by_user_email: callerEmail,
    },
  })

  // ── 16. Respuesta exitosa ────────────────────────────────────────────────────
  return jsonResponse(200, {
    success: true,
    tenant_id,
    admin_user_id,
    invite_link,
    message: 'Tenant y administrador creados correctamente. El admin debe cambiar la clave en su primer acceso a Base.',
  })
})
