import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { chunk, isValidEmail, sendEmail } from '../_shared/smtp.ts'

type Payload = {
  title?: string
  body?: string
  priority?: 'normal' | 'urgent'
  send_to_tenants?: boolean
  send_to_internal?: boolean
  internal_roles?: string[]
}

async function loadRecipients(p: Payload) {
  const supabase = getAdminClient()

  const recipients = new Set<string>()

  if (p.send_to_tenants) {
    const { data, error } = await supabase.from('tenants').select('contact_email')
    if (error) throw error
    for (const r of data || []) {
      if (r?.contact_email) recipients.add(String(r.contact_email).trim())
    }
  }

  if (p.send_to_internal) {
    const roles = Array.isArray(p.internal_roles) && p.internal_roles.length ? p.internal_roles : ['admin','assistant','maintenance']
    const { data, error } = await supabase.from('user_roles').select('email,role').in('role', roles)
    if (error) throw error
    for (const r of data || []) {
      if (r?.email) recipients.add(String(r.email).trim())
    }
  }

  return Array.from(recipients).filter((e) => isValidEmail(e))
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const payload = (await req.json()) as Payload
    const title = String(payload.title || '').trim()
    const body = String(payload.body || '').trim()
    const priority = (payload.priority || 'normal') as 'normal' | 'urgent'

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title/body requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipients = await loadRecipients(payload)
    if (!recipients.length) {
      return new Response(JSON.stringify({ error: 'No hay destinatarios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subject = priority === 'urgent' ? `🚨 ${title}` : `Cerebro | ${title}`
    const html = `<div style="font-family:system-ui;line-height:1.4">
      <h2 style="margin:0 0 8px 0">${escapeHtml(title)}</h2>
      <p style="white-space:pre-wrap;margin:0 0 12px 0">${escapeHtml(body)}</p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0"/>
      <p style="font-size:12px;color:#64748b;margin:0">Cerebro (HRCloud) - notificación automática</p>
    </div>`

    // Envío en chunks para no saturar el SMTP
    const groups = chunk(recipients, 40)
    let sent = 0
    for (const g of groups) {
      for (const to of g) {
        await sendEmail({ to, subject, html })
        sent += 1
      }
    }

    return new Response(JSON.stringify({ ok: true, recipients: recipients.length, sent }), {
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
