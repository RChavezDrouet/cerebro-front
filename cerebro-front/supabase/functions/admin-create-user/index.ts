import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { isValidEmail } from '../_shared/smtp.ts'

type Payload = {
  email?: string
  password?: string
  full_name?: string
  role?: 'admin' | 'assistant' | 'maintenance'
  rotation_days?: number
  force_password_change?: boolean
}

const normalizeEmail = (value: string) => value.trim().toLowerCase()

async function requireCallerAdmin(req: Request, supabase: ReturnType<typeof getAdminClient>) {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Falta cabecera Authorization Bearer.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user?.email) {
    throw new Response(JSON.stringify({ error: 'Token inválido o expirado.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const email = normalizeEmail(user.email)
  const attempts = [
    () => supabase.schema('cerebro').from('user_roles').select('role,is_active').ilike('email', email).limit(1).maybeSingle(),
    () => supabase.from('user_roles').select('role,is_active').ilike('email', email).limit(1).maybeSingle(),
  ]

  for (const attempt of attempts) {
    try {
      const { data, error: roleError } = await attempt()
      if (!roleError && data?.role === 'admin' && data?.is_active !== false) return user
    } catch {
      // no-op
    }
  }

  throw new Response(JSON.stringify({ error: 'No autorizado. Se requiere un admin activo de CEREBRO.' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function emailExistsInAuth(supabase: ReturnType<typeof getAdminClient>, email: string) {
  const normalized = normalizeEmail(email)
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users || []
    if (users.some((u) => normalizeEmail(u.email || '') === normalized)) return true
    if (users.length < 1000) break
  }
  return false
}

async function upsertRole(supabase: ReturnType<typeof getAdminClient>, row: Record<string, unknown>) {
  const attempts = [
    () => supabase.schema('cerebro').from('user_roles').upsert(row, { onConflict: 'email' }),
    () => supabase.from('user_roles').upsert(row, { onConflict: 'email' }),
  ]

  let lastError: any = null
  for (const attempt of attempts) {
    try {
      const { error } = await attempt()
      if (!error) return
      lastError = error
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) throw lastError
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  let createdUserId: string | null = null

  try {
    const p = (await req.json()) as Payload
    const email = normalizeEmail(String(p.email || ''))
    const password = String(p.password || '')
    const role = (p.role || 'assistant') as Payload['role']
    const fullName = String(p.full_name || '').trim() || null

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password mínimo 8 caracteres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!['admin', 'assistant', 'maintenance'].includes(String(role))) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getAdminClient()
    const caller = await requireCallerAdmin(req, supabase)

    if (await emailExistsInAuth(supabase, email)) {
      return new Response(JSON.stringify({ error: 'Ya existe un usuario con ese email.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        force_password_change: Boolean(p.force_password_change),
        rotation_days: Number(p.rotation_days || 0) || null,
        source: 'admin-create-user',
      },
    })
    if (createErr || !created.user?.id) throw createErr || new Error('No se pudo crear auth.users.')
    createdUserId = created.user.id

    await upsertRole(supabase, {
      user_id: created.user.id,
      email,
      role,
      full_name: fullName,
      is_active: true,
    })

    try {
      await supabase.schema('cerebro').from('audit_logs').insert({
        user_email: normalizeEmail(caller.email || ''),
        action: 'CREATE_CEREBRO_USER',
        details: { created_user_id: created.user.id, email, role },
      })
    } catch {
      // no-op
    }

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id, email, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const response = e instanceof Response ? e : null
    if (response) return response

    if (createdUserId) {
      try {
        const supabase = getAdminClient()
        await supabase.auth.admin.deleteUser(createdUserId)
      } catch {
        // no-op
      }
    }

    return new Response(JSON.stringify({ error: (e as any)?.message || 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
