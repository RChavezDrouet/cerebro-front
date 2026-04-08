/**
 * base-reset-password — Edge Function Base PWA v4.2.1
 * Dos acciones:
 *  - action='request_reset': valida email, genera link, envía email (anti-enumeracion)
 *  - action='set' con token: valida invite_token de tenant_admin_setup y cambia password
 *
 * OWASP A07: No se revela si el email existe o no
 * OWASP A01: El token es de un solo uso y expira
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
    const { action, email, token, new_password } = body

    // ── Solicitar reset (olvidé contraseña) ──────────────────
    if (action === 'request_reset') {
      if (!email?.includes('@')) return ok({ success:true }) // anti-enumeracion

      // Buscar empleado por email
      const { data: emp } = await admin.schema('attendance').from('employees')
        .select('user_id, tenant_id, first_name, last_name, email')
        .eq('email', email).maybeSingle()

      if (!emp?.user_id) return ok({ success:true }) // no revelar existencia

      // Verificar tenant activo
      const { data: tenant } = await admin.from('tenants')
        .select('status,is_suspended').eq('id', emp.tenant_id).single()
      if (!tenant || tenant.status !== 'active' || tenant.is_suspended) return ok({ success:true })

      
      // Obtener URL Base desde app_settings (fallback a env)
      const { data: app } = await admin.from('app_settings')
        .select('base_pwa_url').eq('id', 1).single()
      const baseUrl = app?.base_pwa_url || Deno.env.get('BASE_PWA_URL') || 'https://base.hrcloud.app'

// Generar magic link via Supabase Auth
      const { data: link, error: le } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${baseUrl}/auth/reset-password` }
      })
      if (le || !link) { console.error('[reset] generateLink:', le?.message); return ok({ success:true }) }

      // Enviar email via base-send-email
      await admin.functions.invoke('base-send-email', {
        body: {
          tenant_id: emp.tenant_id,
          to_email: email,
          template: 'reset',
          variables: {
            name: `${emp.first_name} ${emp.last_name}`,
            link: link.properties?.action_link || '',
          }
        }
      })

      // Audit (sin revelar el email en la respuesta)
      await admin.from('audit_logs').insert({
        action: 'PASSWORD_RESET_REQUESTED',
        user_email: email,
        new_value: { tenant_id: emp.tenant_id }
      })

      return ok({ success:true })
    }



// ── Validar invite_token (SetPasswordPage) ───────────────
if (action === 'validate_invite') {
  if (!token) return err('Token requerido', 400)

  const { data: setup } = await admin.from('tenant_admin_setup')
    .select('id, tenant_id, admin_email, invite_expires_at, password_changed')
    .eq('invite_token', token).maybeSingle()

  if (!setup) return err('Token inválido', 404)
  if (setup.password_changed) return err('Este enlace ya fue utilizado', 409)
  if (new Date(setup.invite_expires_at) < new Date()) return err('Token expirado', 410)

  // Company name (prefer base_tenant_config → fallback tenants.business_name)
  const { data: cfg } = await admin.schema('attendance').from('base_tenant_config')
    .select('company_name').eq('tenant_id', setup.tenant_id).maybeSingle()
  const { data: t } = await admin.from('tenants')
    .select('business_name').eq('id', setup.tenant_id).maybeSingle()

  return ok({
    success: true,
    tenant_id: setup.tenant_id,
    email: setup.admin_email,
    company: cfg?.company_name || t?.business_name || 'Su empresa',
  })
}


    // ── Activar cuenta via invite_token (set-password page) ──
    if (token && new_password) {
      if (new_password.length < 8) return err('Password muy corto', 400)

      // Buscar el setup por token
      const { data: setup } = await admin.from('tenant_admin_setup')
        .select('*').eq('invite_token', token).single()

      if (!setup) return err('Token inválido', 404)
      if (setup.password_changed) return err('Este enlace ya fue utilizado', 409)
      if (new Date(setup.invite_expires_at) < new Date()) return err('Token expirado', 410)

      // Cambiar contraseña via service_role
      const { error: ue } = await admin.auth.admin.updateUserById(setup.user_id, {
        password: new_password,
      })
      if (ue) throw new Error('Error al cambiar contraseña: ' + ue.message)

      // Marcar como usado + first_login_pending=false
      await admin.from('tenant_admin_setup').update({
        password_changed: true,
      }).eq('invite_token', token)

      await admin.schema('attendance').from('employees').update({
        first_login_pending: false,
      }).eq('user_id', setup.user_id)

      // Audit log
      await admin.from('audit_logs').insert({
        user_id: setup.user_id,
        user_email: setup.admin_email,
        action: 'ACCOUNT_ACTIVATED',
        table_name: 'tenant_admin_setup',
        record_id: setup.id,
      })

      return ok({ success:true })
    }

    return err('Accion desconocida', 400)

  } catch (e: any) {
    console.error('[base-reset-password]', e.message)
    return err(e.message || 'Internal error', 500)
  }
})

const ok  = (d:unknown) => new Response(JSON.stringify(d), { headers:{...cors,'Content-Type':'application/json'} })
const err = (m:string,s=400) => new Response(JSON.stringify({error:m}), { status:s, headers:{...cors,'Content-Type':'application/json'} })
