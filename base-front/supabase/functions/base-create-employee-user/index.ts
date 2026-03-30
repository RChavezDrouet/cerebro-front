/**
 * base-create-employee-user — alta o actualización de acceso Base/PWA para empleados.
 *
 * Reglas clave:
 *  - Solo tenant_admin del mismo tenant puede operar.
 *  - El rol administrativo es independiente de la jefatura organizacional.
 *  - Solo puede existir un tenant_admin activo por tenant.
 *  - Si el empleado ya tiene usuario, la función actualiza rol / email sin recrearlo.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AccessRole = 'employee' | 'assistant' | 'auditor' | 'tenant_admin'
const ALLOWED_ROLES = new Set<AccessRole>(['employee', 'assistant', 'auditor', 'tenant_admin'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authH = req.headers.get('Authorization') ?? ''
    if (!authH.startsWith('Bearer ')) return err('Unauthorized', 401)

    const admin = createClient(URL_, SVC)
    const jwt = authH.replace('Bearer ', '')
    const { data: { user: caller } } = await admin.auth.getUser(jwt)
    if (!caller) return err('Invalid token', 401)

    const callerAccess = await resolveCallerAccess(admin, caller.id)
    if (!callerAccess || callerAccess.role !== 'tenant_admin') {
      return err('Forbidden: se requiere rol tenant_admin', 403)
    }
    const callerTenantId = callerAccess.tenant_id

    const body = await req.json()
    const employee_id = String(body?.employee_id || '')
    const email = String(body?.email || '').trim().toLowerCase()
    const password = body?.password ? String(body.password) : null
    const requestedRole = normalizeRole(body?.role)
    const send_welcome_email = body?.send_welcome_email === true

    if (!employee_id) return err('employee_id requerido', 400)
    if (!email || !email.includes('@')) return err('Email inválido', 400)
    if (!ALLOWED_ROLES.has(requestedRole)) return err('Rol inválido', 400)

    const { data: emp, error: empErr } = await admin
      .schema('public')
      .from('employees')
      .select('id,tenant_id,user_id,first_name,last_name,email')
      .eq('id', employee_id)
      .single()

    if (empErr || !emp) return err('Empleado no encontrado', 404)
    if (emp.tenant_id !== callerTenantId) return err('Forbidden: empleado de otro tenant', 403)

    if (requestedRole === 'tenant_admin') {
      await ensureSingleTenantAdmin(admin, callerTenantId, employee_id, emp.user_id ?? null)
    }

    let userId = emp.user_id as string | null
    let created = false

    if (!userId) {
      if (!password || password.length < 8) return err('Password muy corto', 400)

      const { data: { user: newUser }, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          tenant_id: callerTenantId,
          employee_id,
          role: requestedRole,
          first_login: true,
        },
      })
      if (createErr || !newUser) return err('Error creando usuario: ' + (createErr?.message ?? 'unknown'), 500)
      userId = newUser.id
      created = true
    } else {
      const updatePayload: Record<string, unknown> = {
        email,
        user_metadata: {
          tenant_id: callerTenantId,
          employee_id,
          role: requestedRole,
          first_login: false,
        },
      }
      if (password && password.length >= 8) updatePayload.password = password
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, updatePayload)
      if (updateErr) return err('No se pudo actualizar el usuario: ' + updateErr.message, 500)
    }

    try {
      await admin
        .schema('public')
        .from('employees')
        .update({ user_id: userId, email })
        .eq('id', employee_id)
    } catch (_) {}

    await upsertUserAccounts(admin, callerTenantId, userId!, employee_id, requestedRole)
    await upsertMembership(admin, callerTenantId, userId!, requestedRole)

    if (send_welcome_email && created && password) {
      try {
        await admin.functions.invoke('base-send-email', {
          body: {
            tenant_id: callerTenantId,
            to_email: email,
            template: 'welcome',
            variables: {
              name: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim(),
              email,
              temp_password: password,
            },
          },
        })
      } catch (emailErr: any) {
        console.error('[EMAIL]', emailErr?.message || emailErr)
      }
    }

    return ok({ success: true, user_id: userId, role: requestedRole, created })
  } catch (e: any) {
    console.error('[base-create-employee-user]', e?.message || e)
    return err(e?.message || 'Internal error', 500)
  }
})

function normalizeRole(role: unknown): AccessRole {
  const value = String(role || '').trim()
  if (value === 'assistant' || value === 'auditor' || value === 'tenant_admin') return value
  return 'employee'
}

async function resolveCallerAccess(admin: ReturnType<typeof createClient>, userId: string): Promise<{ tenant_id: string; role: string } | null> {
  try {
    const { data } = await admin.schema('attendance').from('user_accounts').select('tenant_id,role,is_active').eq('user_id', userId).maybeSingle()
    if ((data as any)?.tenant_id && (data as any)?.is_active !== false) return { tenant_id: (data as any).tenant_id, role: (data as any).role }
  } catch (_) {}

  try {
    const { data } = await admin.schema('attendance').from('memberships').select('tenant_id,role').eq('user_id', userId).maybeSingle()
    if ((data as any)?.tenant_id) return { tenant_id: (data as any).tenant_id, role: (data as any).role }
  } catch (_) {}

  return null
}

async function ensureSingleTenantAdmin(admin: ReturnType<typeof createClient>, tenantId: string, employeeId: string, userId: string | null) {
  try {
    const { data } = await admin.schema('attendance').from('user_accounts').select('employee_id,user_id,role,is_active').eq('tenant_id', tenantId).eq('role', 'tenant_admin')
    const conflict = (data ?? []).find((row: any) => row.is_active !== false && row.employee_id !== employeeId && row.user_id !== userId)
    if (conflict) throw new Error('TENANT_ADMIN_ALREADY_EXISTS')
  } catch (e: any) {
    if (String(e?.message || '') === 'TENANT_ADMIN_ALREADY_EXISTS') throw e
  }

  try {
    const { data } = await admin.schema('attendance').from('memberships').select('user_id,role').eq('tenant_id', tenantId).eq('role', 'tenant_admin')
    const conflict = (data ?? []).find((row: any) => row.user_id !== userId)
    if (conflict) throw new Error('TENANT_ADMIN_ALREADY_EXISTS')
  } catch (e: any) {
    if (String(e?.message || '') === 'TENANT_ADMIN_ALREADY_EXISTS') throw e
  }
}

async function upsertUserAccounts(admin: ReturnType<typeof createClient>, tenantId: string, userId: string, employeeId: string, role: AccessRole) {
  try {
    const { error } = await admin.schema('attendance').from('user_accounts').upsert({
      tenant_id: tenantId,
      user_id: userId,
      employee_id: employeeId,
      role,
      is_active: true,
    }, { onConflict: 'tenant_id,user_id' })
    if (error) console.warn('[user_accounts]', error.message)
  } catch (e: any) {
    console.warn('[user_accounts]', e?.message || e)
  }
}

async function upsertMembership(admin: ReturnType<typeof createClient>, tenantId: string, userId: string, role: AccessRole) {
  try {
    const { error } = await admin.schema('attendance').from('memberships').upsert({
      tenant_id: tenantId,
      user_id: userId,
      role,
    }, { onConflict: 'tenant_id,user_id' })
    if (error) console.warn('[memberships]', error.message)
  } catch (e: any) {
    console.warn('[memberships]', e?.message || e)
  }
}

const ok = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })
const err = (m: string, s = 400) => new Response(JSON.stringify({ error: m }), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
