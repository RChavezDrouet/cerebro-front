// supabase/functions/admin-create-tenant/index.ts
// CEREBRO v4.9.1 — Corrección: user_roles lookup por email (schema real)
//
// CAMBIOS v4.9.1:
//   - verifyCallerIsAdmin ahora usa .from('user_roles') SIN .schema('cerebro')
//     → la tabla está en public, no en un schema cerebro
//   - Busca por email del caller (columna siempre existente en el schema real)
//     en lugar de user_id (que no existía hasta la migración v4.9.0)
//   - is_active se verifica solo si la columna existe (null/undefined = activo)
//   - Eliminado global.headers del cliente admin (causaba CORS issues)
//   - audit_logs usa .from() directo (tabla en public, no en cerebro)
//
// PREREQUISITO: Ejecutar migration_v4.9.0_fix_user_roles_rls.sql primero
//
// Deploy:
//   supabase functions deploy admin-create-tenant --no-verify-jwt

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
// emailExistsInAuth: listUsers falla con 500 en plan Free (unexpected_failure).
// getUserByEmail no disponible en Edge runtime.
// Solucion: no pre-verificar — createUser retorna error claro si el email ya existe.
async function emailExistsInAuth(
  _admin: ReturnType<typeof createClient>,
  _email: string
): Promise<{ exists: boolean; userId?: string; error?: string }> {
  return { exists: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyCallerIsAdmin: verifica rol en public.user_roles por EMAIL
//
// Schema real de public.user_roles:
//   id uuid, email text UNIQUE, role text, created_at timestamptz
//   + is_active boolean  (agregado por migration_v4.9.0)
//   + user_id uuid       (agregado por migration_v4.9.0)
//
// Buscar por email es el método más robusto porque:
//   - email siempre existió en la tabla
//   - user_id puede no haberse sincronizado para registros antiguos
// ─────────────────────────────────────────────────────────────────────────────
async function verifyCallerIsAdmin(
  admin: ReturnType<typeof createClient>,
  callerEmail: string
): Promise<{ authorized: boolean; error?: string }> {
  try {
    const { data: row, error: roleErr } = await admin
      .from('user_roles')          // public.user_roles — NO usar .schema('cerebro')
      .select('role, is_active')
      .eq('email', callerEmail)    // buscar por email, no por user_id
      .maybeSingle()

    if (roleErr) {
      return {
        authorized: false,
        error: `Error consultando user_roles: ${roleErr.message}`,
      }
    }

    if (!row) {
      return {
        authorized: false,
        error: `Usuario "${callerEmail}" no tiene registro en user_roles`,
      }
    }

    // is_active puede ser null si la migración no se ejecutó aún → asumimos activo
    if (row.is_active === false) {
      return {
        authorized: false,
        error: `Usuario "${callerEmail}" está marcado como inactivo`,
      }
    }

    if (String(row.role) !== 'admin') {
      return {
        authorized: false,
        error: `Se requiere rol "admin", el usuario tiene "${row.role}"`,
      }
    }

    return { authorized: true }
  } catch (e: any) {
    return { authorized: false, error: e?.message ?? 'Excepción desconocida' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Faltan variables de entorno del servidor' })
  }

  // Cliente admin con service_role — SIN global.headers (causa CORS en Edge)
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  // ── 1. Token ────────────────────────────────────────────────────────────────
  const token = getBearerToken(req)
  if (!token) return jsonResponse(401, { error: 'Token de autorización ausente' })

  // ── 2. Verificar JWT ────────────────────────────────────────────────────────
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return jsonResponse(401, {
      error: 'Token inválido o expirado',
      details: userErr?.message ?? 'unknown',
    })
  }
  const caller      = userData.user
  const callerEmail = normalizeEmail(caller.email ?? '')

  if (!callerEmail) {
    return jsonResponse(401, { error: 'No se pudo determinar el email del usuario autenticado' })
  }

  // ── 3. Parse body ────────────────────────────────────────────────────────────
  let body: any = null
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Cuerpo JSON inválido' })
  }

  const business_name         = String(body?.business_name ?? '').trim()
  const ruc                   = String(body?.ruc ?? '').trim()
  const admin_email           = normalizeEmail(String(body?.admin_email ?? ''))
  const temp_password         = String(body?.temp_password ?? '')
  const plan_type             = String(body?.plan_type ?? '').trim().toLowerCase()
  const status                = String(body?.status ?? 'active').trim()
  const legal_rep_name        = String(body?.legal_rep_name ?? '').trim() || null
  const legal_rep_email       = normalizeEmail(String(body?.legal_rep_email ?? '')) || null
  const contact_name          = String(body?.contact_name ?? '').trim() || null
  const contact_email         = normalizeEmail(String(body?.contact_email ?? '')) || admin_email
  const contact_phone         = String(body?.contact_phone ?? '').trim() || null
  const notes                 = String(body?.notes ?? '').trim() || null
  const billing_period        = String(body?.billing_period ?? 'monthly').trim()
  const serial_numbers        = safeStringArray(body?.serial_numbers)
  const auto_suspend          = asBool(body?.auto_suspend, false)
  const grace_days            = asInt(body?.grace_days, null)
  const pause_after_grace     = asBool(body?.pause_after_grace, true)
  const courtesy_discount_pct = asInt(body?.courtesy_discount_pct, 0) ?? 0
  const courtesy_duration     = String(body?.courtesy_duration ?? 'one_time').trim()
  const courtesy_periods      = asInt(body?.courtesy_periods, 1) ?? 1
  const invite_redirect_to    = String(body?.invite_redirect_to ?? '').trim() || null

  // ── 4. Validaciones ──────────────────────────────────────────────────────────
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
  if (auto_suspend && (grace_days == null || grace_days < 1 || grace_days > 90))
    return jsonResponse(400, { error: 'grace_days debe ser 1–90 cuando auto_suspend=true' })

  // ── 5. Verificar rol admin (public.user_roles por email) ─────────────────────
  {
    const { authorized, error: authErr } = await verifyCallerIsAdmin(supabaseAdmin, callerEmail)
    if (!authorized) {
      return jsonResponse(403, {
        error: 'Error verificando rol admin',
        details: authErr ?? 'Acceso denegado',
      })
    }
  }

  // ── 6. Validar plan_type en public.subscription_plans ────────────────────────
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
        error: `plan_type "${plan_type}" no existe en subscription_plans`,
      })
  }

  // ── 7. Verificar RUC único ───────────────────────────────────────────────────
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

  // ── 8. Verificar email único en auth.users ───────────────────────────────────
  {
    const check = await emailExistsInAuth(supabaseAdmin, admin_email)
    if (check.error)
      return jsonResponse(500, { error: 'Error verificando admin_email', details: check.error })
    if (check.exists)
      return jsonResponse(409, {
        error: 'admin_email ya existe en Auth',
        user_id: check.userId,
      })
  }

  // ── 9. Crear tenant ──────────────────────────────────────────────────────────
  const { data: tenantRow, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({
      business_name,
      name: business_name,
      ruc,
      plan_type,
      plan: plan_type,
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
      pause_after_grace: auto_suspend ? pause_after_grace : null,
      courtesy_pct: courtesy_discount_pct,
      courtesy_period: courtesy_duration,
      courtesy_times: courtesy_periods,
      courtesy_duration,
      bio_sold_by_us: false,
      updated_at: new Date().toISOString(),
      notes,
    })
    .select('*')
    .single()

  if (tenantErr || !tenantRow) {
    return jsonResponse(500, {
      error: 'Error creando tenant',
      details: tenantErr?.message ?? 'unknown',
    })
  }

  const tenant_id = tenantRow.id as string

  // ── 10. Registrar biométricos ────────────────────────────────────────────────
  if (serial_numbers.length > 0) {
    const { error: bioErr } = await supabaseAdmin
      .schema('attendance')
      .from('biometric_devices')
      .insert(
        serial_numbers.map((sn) => ({
          tenant_id,
          serial_no: sn,
          name: `Biométrico ${sn}`,
          is_active: true,
        }))
      )

    if (bioErr) {
      await supabaseAdmin.from('audit_logs').insert({
        user_email: callerEmail,
        action: 'CREATE_TENANT_BIOMETRICS_FAILED',
        details: JSON.stringify({ tenant_id, serial_numbers, error: bioErr.message }),
      })
    }
  }

  // ── 11. Crear usuario admin en auth.users ────────────────────────────────────
  const { data: createdUser, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
    email: admin_email,
    password: temp_password,
    email_confirm: true,
    user_metadata: { tenant_id, role: 'tenant_admin', business_name, first_login_pending: true },
  })

  if (createUserErr || !createdUser?.user) {
    const errMsg = createUserErr?.message ?? 'unknown'
    const isDuplicate = /already|duplicate|exists|registered/i.test(errMsg)

    if (isDuplicate) {
      await supabaseAdmin.from('tenants').delete().eq('id', tenant_id)
      return jsonResponse(409, {
        error: 'admin_email ya existe en Auth. Use un correo diferente.',
        details: errMsg,
      })
    }

    await supabaseAdmin
      .from('tenants')
      .update({
        status: 'paused',
        notes: `${notes ?? ''}\n[SYS] createUser failed: ${errMsg}`.trim(),
      })
      .eq('id', tenant_id)

    await supabaseAdmin.from('audit_logs').insert({
      user_email: callerEmail,
      action: 'CREATE_TENANT_USER_FAILED',
      details: JSON.stringify({ tenant_id, admin_email, error: errMsg }),
    })

    return jsonResponse(500, {
      error: 'Error creando usuario admin. Tenant pausado.',
      details: errMsg,
    })
  }

  const admin_user_id = createdUser.user.id

  // ── 12. Upsert public.profiles ───────────────────────────────────────────────
  {
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        { id: admin_user_id, tenant_id, role: 'tenant_admin', first_login_pending: true, is_active: true },
        { onConflict: 'id' }
      )
    if (profErr) {
      await supabaseAdmin.from('audit_logs').insert({
        user_email: callerEmail,
        action: 'CREATE_TENANT_PROFILE_FAILED',
        details: JSON.stringify({ tenant_id, admin_user_id, error: profErr.message }),
      })
    }
  }

  // ── 13. Upsert attendance.memberships ────────────────────────────────────────
  {
    const { error: memErr } = await supabaseAdmin
      .schema('attendance')
      .from('memberships')
      .upsert(
        { tenant_id, user_id: admin_user_id, role: 'tenant_admin' },
        { onConflict: 'tenant_id,user_id' }
      )
    if (memErr) {
      await supabaseAdmin.from('audit_logs').insert({
        user_email: callerEmail,
        action: 'CREATE_TENANT_MEMBERSHIP_FAILED',
        details: JSON.stringify({ tenant_id, admin_user_id, error: memErr.message }),
      })
    }
  }

  // ── 14. Magic link ───────────────────────────────────────────────────────────
  let invite_link: string | null = null
  try {
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: admin_email,
      options: invite_redirect_to ? { redirectTo: invite_redirect_to } : undefined,
    })
    if (!linkErr) {
      invite_link =
        (linkData as any)?.properties?.action_link ?? (linkData as any)?.action_link ?? null
    }
  } catch { /* no crítico */ }

  // ── 15. Audit log de éxito ───────────────────────────────────────────────────
  await supabaseAdmin.from('audit_logs').insert({
    user_email: callerEmail,
    action: 'CREATE_TENANT',
    details: JSON.stringify({
      tenant_id, business_name, ruc, plan_type, admin_email, admin_user_id,
      serial_numbers, auto_suspend, grace_days: auto_suspend ? grace_days : null,
      billing_period, by_user_email: callerEmail, by_user_id: caller.id,
    }),
  })

  // ── 16. Respuesta ────────────────────────────────────────────────────────────
  return jsonResponse(200, {
    success: true,
    tenant_id,
    admin_user_id,
    invite_link,
    message: 'Tenant y administrador creados. El admin debe cambiar su clave en el primer ingreso a Base.',
  })
})

