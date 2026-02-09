import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { isValidEmail, sendEmail } from '../_shared/smtp.ts'

type Payload = {
  name?: string
  ruc?: string
  contact_email?: string
  plan?: string
  status?: 'active' | 'trial' | 'paused'
  bio_serial?: string
  bio_location?: string
  billing_period?: string
  grace_days?: number
  pause_after_grace?: boolean
  courtesy_users?: number
  courtesy_discount_pct?: number
  courtesy_duration?: string
  courtesy_periods?: number
  create_auth_user?: boolean
}

function randPassword(len = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*_-'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const p = (await req.json()) as Payload
    const name = String(p.name || '').trim()
    const ruc = String(p.ruc || '').trim()
    const contact_email = String(p.contact_email || '').trim().toLowerCase()
    const plan = String(p.plan || 'basic').trim()
    const status = (p.status || 'active') as any

    if (!name || !ruc) {
      return new Response(JSON.stringify({ error: 'name/ruc requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!isValidEmail(contact_email)) {
      return new Response(JSON.stringify({ error: 'contact_email inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getAdminClient()

    const { data: inserted, error: insErr } = await supabase
      .from('tenants')
      .insert({
        name,
        ruc,
        contact_email,
        plan,
        status,
        bio_serial: p.bio_serial ?? null,
        bio_location: p.bio_location ?? null,
        billing_period: p.billing_period ?? 'monthly',
        grace_days: Number(p.grace_days || 0),
        pause_after_grace: Boolean(p.pause_after_grace ?? true),
        courtesy_users: Number(p.courtesy_users || 0),
        courtesy_discount_pct: Number(p.courtesy_discount_pct || 0),
        courtesy_duration: p.courtesy_duration ?? 'one_time',
        courtesy_periods: Number(p.courtesy_periods || 1),
      })
      .select('id')
      .maybeSingle()
    if (insErr) throw insErr

    const tenant_id = inserted?.id

    // Opcional: crea un usuario Auth para el contacto (NO es interno, no se inserta en user_roles)
    let temp_password: string | null = null
    if (p.create_auth_user !== false) {
      temp_password = randPassword()
      await supabase.auth.admin.createUser({
        email: contact_email,
        password: temp_password,
        email_confirm: true,
        user_metadata: { tenant_id, tenant_name: name, type: 'tenant_contact' },
      })

      // Email de credenciales (requiere SMTP global configurado)
      try {
        await sendEmail({
          to: contact_email,
          subject: `Cerebro | Alta de inquilino (${name})`,
          html: `<div style="font-family:system-ui;line-height:1.4">
            <h2>Tenant creado</h2>
            <p>Se creó el inquilino <b>${escapeHtml(name)}</b> con RUC <b>${escapeHtml(ruc)}</b>.</p>
            <p><b>Usuario:</b> ${escapeHtml(contact_email)}<br/>
               <b>Password temporal:</b> ${escapeHtml(temp_password)}</p>
            <p style="color:#64748b;font-size:12px">Si no corresponde, ignore este correo.</p>
          </div>`,
        })
      } catch {
        // no bloquea la creación
      }
    }

    return new Response(JSON.stringify({ ok: true, tenant_id, temp_password }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function escapeHtml(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
