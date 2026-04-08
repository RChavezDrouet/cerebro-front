/**
 * base-send-email — Edge Function Base PWA v4.2.1
 * Prioridad SMTP: tenant propio (smtp_verified) → CEREBRO global fallback
 *
 * Acciones:
 *  - template: 'welcome'   → email de bienvenida a empleado nuevo
 *  - template: 'reset'     → link de recuperacion de contraseña
 *  - action:   'test'      → email de prueba para verificar SMTP
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SVC  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(URL_, SVC)
    const body  = await req.json()
    const { tenant_id, to_email, template, variables, action } = body

const authHeader = req.headers.get('Authorization') || ''
const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
const internal = Boolean(bearer && bearer === SVC)

// Autorización:
//  - reset: SOLO internal (service_role) para evitar relay público
//  - welcome/test: tenant_admin del tenant o internal
let callerUserId: string | null = null
if (!internal) {
  const { data: u, error: ue } = await admin.auth.getUser(bearer)
  if (ue || !u?.user) return err('Unauthorized', 401)
  callerUserId = u.user.id
}

    if (!tenant_id) return err('tenant_id requerido', 400)
if (template === 'reset' && !internal) return err('Forbidden', 403)

if (!internal) {
  const { data: ua, error: uae } = await admin.schema('attendance').from('user_accounts')
    .select('tenant_id,role,is_active')
    .eq('user_id', callerUserId)
    .maybeSingle()

  if (uae || !ua?.is_active) return err('Forbidden', 403)
  if (ua.tenant_id !== tenant_id) return err('Forbidden', 403)

  const needsAdmin = action === 'test' || template === 'welcome'
  if (needsAdmin && ua.role !== 'tenant_admin') return err('Forbidden', 403)

  // reset se atiende únicamente vía base-reset-password (internal)
  if (template === 'reset') return err('Forbidden', 403)
}


    // 1. Intentar SMTP propio del tenant
    const { data: cfg } = await admin.schema('attendance').from('base_tenant_config')
      .select('smtp_host,smtp_port,smtp_user,smtp_password,smtp_from_name,smtp_from_email,smtp_verified,company_name')
      .eq('tenant_id', tenant_id).single()

    // 2. Fallback: SMTP global de CEREBRO
    const { data: globalCfg } = await admin.from('app_settings')
      .select('smtp_host,smtp_port,smtp_user,smtp_password,smtp_from_name,smtp_from_email,base_pwa_url')
      .eq('id', 1).single()

    const smtp = (cfg?.smtp_verified && cfg?.smtp_host) ? cfg : globalCfg
    if (!smtp?.smtp_host) return err('No hay configuración SMTP disponible', 503)

    const companyName = cfg?.company_name || 'HRCloud'
    const baseUrl     = globalCfg?.base_pwa_url || 'https://base.hrcloud.app'

    // Test de conexión
    if (action === 'test') {
      const result = await sendMail({
        smtp,
        to:      smtp.smtp_from_email || smtp.smtp_user || '',
        subject: `Test SMTP — ${companyName}`,
        html:    `<div style="font-family:Arial;padding:24px;background:#0D1B2A;color:#F1F5F9;border-radius:12px">
          <h2 style="color:#00B3FF">✅ SMTP configurado correctamente</h2>
          <p>Este es un email de prueba para verificar la configuración SMTP de <strong>${escapeHtml(companyName)}</strong>.</p>
          <p style="color:#94A3B8;font-size:13px">Fecha: ${new Date().toLocaleString('es-EC')}</p>
        </div>`
      })

      // Marcar smtp_verified = true
      await admin.schema('attendance').from('base_tenant_config')
        .update({ smtp_verified: true }).eq('tenant_id', tenant_id)

      return ok({ success: true, ...result })
    }

    // Email de bienvenida
    if (template === 'welcome') {
      if (!to_email) return err('to_email requerido', 400)
      await sendMail({
        smtp,
        to: to_email,
        subject: `Bienvenido a ${companyName} — HRCloud Base`,
        html: buildWelcomeEmail(companyName, variables?.name || '', variables?.email || to_email, baseUrl, variables?.temp_password),
      })
      return ok({ success: true })
    }

    // Email de reset de contraseña
    if (template === 'reset') {
      if (!to_email || !variables?.link) return err('Faltan datos para el reset', 400)
      await sendMail({
        smtp,
        to: to_email,
        subject: `Recuperación de contraseña — ${companyName}`,
        html: buildResetEmail(companyName, variables.name || '', variables.link),
      })
      return ok({ success: true })
    }

    return err('Accion desconocida', 400)

  } catch (e: any) {
    console.error('[base-send-email]', e.message)
    return err(e.message || 'Internal error', 500)
  }
})

// ── Email sender (produccion: usar Resend / SendGrid / Brevo) ─
async function sendMail(opts: { smtp:any; to:string; subject:string; html:string; text?:string }) {
  // En Edge Functions NO hay TCP saliente (SMTP directo). Se usa un Mail Relay HTTP.
  // Configurar secrets:
  //   supabase secrets set MAILER_URL="https://<tu-relay>/api" MAILER_TOKEN="<token>"
  const MAILER_URL   = Deno.env.get('MAILER_URL')
  const MAILER_TOKEN = Deno.env.get('MAILER_TOKEN')

  if (MAILER_URL && MAILER_TOKEN) {
    const res = await fetch(`${MAILER_URL.replace(/\/$/, '')}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MAILER_TOKEN}`,
      },
      body: JSON.stringify({
        smtp: {
          host: opts.smtp.smtp_host,
          port: opts.smtp.smtp_port,
          user: opts.smtp.smtp_user,
          pass: opts.smtp.smtp_password,
          secure: Boolean(opts.smtp.smtp_secure ?? false),
          fromName: opts.smtp.smtp_from_name,
          fromEmail: opts.smtp.smtp_from_email,
        },
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      })
    })
    if (!res.ok) throw new Error('Mailer relay error: ' + await res.text())
    return await res.json()
  }

  // Fallback DEV: log
  console.log(`[MAIL:DEV] To:${opts.to} | Subject:${opts.subject} | SMTP:${opts.smtp.smtp_host}`)
  return { provider: 'console', to: opts.to }
}


// ── HTML Templates ────────────────────────────────────────────
function buildWelcomeEmail(company:string, name:string, email:string, baseUrl:string, tempPassword?: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#0D1B2A;margin:0;padding:32px}
  .c{background:#0F2744;border-radius:16px;padding:40px;max-width:560px;margin:0 auto;border:1px solid rgba(0,179,255,0.2)}
  h1{color:#00B3FF;margin:0 0 8px} p{color:#CBD5E1;line-height:1.7}
  .btn{display:inline-block;background:#0056E6;color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;margin:20px 0}
  .footer{color:#475569;font-size:12px;margin-top:24px}
  </style></head><body><div class="c">
  <h1>🧠 Bienvenido a HRCloud Base</h1>
  <p>Hola <strong style="color:#F1F5F9">${escapeHtml(name)}</strong>,</p>
  <p>Ha sido registrado en el sistema de asistencia de <strong style="color:#00B3FF">${escapeHtml(company)}</strong>.</p>
  <p>Su correo de acceso es: <strong style="color:#F1F5F9">${escapeHtml(email)}</strong></p>
  <p>Al ingresar por primera vez, el sistema le pedirá establecer una nueva contraseña.</p>
  ${tempPassword ? `<p><strong style="color:#F1F5F9">Contraseña temporal:</strong> <span style="display:inline-block;background:rgba(0,0,0,0.25);padding:6px 10px;border-radius:8px;color:#F1F5F9;font-family:monospace">${escapeHtml(tempPassword)}</span></p><p style="color:#94A3B8;font-size:13px">Por seguridad, cambie esta contraseña al primer ingreso y no la comparta.</p>` : ``}
  <div style="text-align:center"><a href="${baseUrl}/login?email=${encodeURIComponent(email)}" class="btn">Acceder al sistema</a></div>
  <p class="footer">Si tiene problemas para acceder, contacte al administrador de su empresa.</p>
  </div></body></html>`
}

function buildResetEmail(company:string, name:string, link:string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#0D1B2A;margin:0;padding:32px}
  .c{background:#0F2744;border-radius:16px;padding:40px;max-width:560px;margin:0 auto;border:1px solid rgba(245,158,11,0.2)}
  h1{color:#F59E0B;margin:0 0 8px} p{color:#CBD5E1;line-height:1.7}
  .btn{display:inline-block;background:#0056E6;color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;margin:20px 0}
  .warn{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:12px 16px;margin-top:16px}
  .footer{color:#475569;font-size:12px;margin-top:24px}
  </style></head><body><div class="c">
  <h1>🔑 Recuperar contraseña</h1>
  <p>Hola <strong style="color:#F1F5F9">${escapeHtml(name)}</strong>,</p>
  <p>Recibimos una solicitud para restablecer tu contraseña en <strong style="color:#00B3FF">${escapeHtml(company)}</strong>.</p>
  <div style="text-align:center"><a href="${link}" class="btn">Restablecer contraseña</a></div>
  <div class="warn"><p style="color:#FCD34D;margin:0">⚠️ Este enlace expira en <strong>1 hora</strong>. Si no solicitaste este cambio, ignora este correo.</p></div>
  <p class="footer">Por seguridad, nunca compartas este enlace.</p>
  </div></body></html>`
}

function escapeHtml(s:string):string {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

const ok  = (d:unknown) => new Response(JSON.stringify(d), { headers:{...cors,'Content-Type':'application/json'} })
const err = (m:string,s=400) => new Response(JSON.stringify({error:m}), { status:s, headers:{...cors,'Content-Type':'application/json'} })
