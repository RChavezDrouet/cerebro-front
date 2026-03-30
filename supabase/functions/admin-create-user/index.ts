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

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const p = (await req.json()) as Payload
    const email = String(p.email || '').trim().toLowerCase()
    const password = String(p.password || '')
    const role = (p.role || 'assistant') as any

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password mínimo 8' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!['admin','assistant','maintenance'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getAdminClient()
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: p.full_name || null,
        force_password_change: Boolean(p.force_password_change),
        rotation_days: Number(p.rotation_days || 0) || null,
      },
    })
    if (createErr) throw createErr

    const { error: roleErr } = await supabase.from('user_roles').upsert(
      { email, role },
      { onConflict: 'email' },
    )
    if (roleErr) throw roleErr

    return new Response(JSON.stringify({ ok: true, user_id: created.user?.id, email, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
