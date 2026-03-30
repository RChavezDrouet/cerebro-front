import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const rawBody = await req.json()
    const payload = rawBody.tenant ?? rawBody

    const {
      name, business_name, ruc, contact_email,
      contact_name, plan, plan_type,
      bio_serial, bio_location,
      billing_period, grace_days, pause_after_grace,
      admin_email, temp_password,
    } = payload

    const tenantName = (business_name || name || '').trim()
    if (!tenantName)            throw new Error('Razon social requerida')
    if (!/^\d{13}$/.test(ruc))  throw new Error('RUC invalido (debe tener 13 digitos)')
    if (!contact_email?.trim()) throw new Error('Email de contacto requerido')

    const finalPlan = (plan_type || plan || 'basic').trim()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No autorizado: sesion requerida')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token)
    if (callerErr || !caller) throw new Error('No autorizado: token invalido')

    const { data: callerRole, error: roleErr } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('email', caller.email)
      .maybeSingle()

    if (roleErr) throw new Error('Error verificando permisos: ' + roleErr.message)
    if (!callerRole || callerRole.role !== 'admin') {
      throw new Error('No autorizado: se requiere rol admin en CEREBRO')
    }

    const { data: existing } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('ruc', ruc.trim())
      .maybeSingle()

    if (existing) throw new Error('Ya existe una empresa con RUC ' + ruc)

    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .insert({
        name:              tenantName,
        ruc:               ruc.trim(),
        contact_email:     contact_email.trim().toLowerCase(),
        plan:              finalPlan,
        status:            'active',
        bio_serial:        bio_serial?.trim()   || null,
        bio_location:      bio_location?.trim() || null,
        billing_period:    billing_period       || 'monthly',
        grace_days:        grace_days           ?? 0,
        pause_after_grace: pause_after_grace    ?? true,
      })
      .select('id, name, ruc, contact_email, plan, status')
      .single()

    if (tenantErr) throw new Error('Error creando empresa: ' + tenantErr.message)
    const tenantId = tenant.id

    if (bio_serial?.trim()) {
      const { error: bioErr } = await supabaseAdmin
        .from('biometric_devices')
        .insert({
          serial_number: bio_serial.trim(),
          tenant_id:     tenantId,
          is_active:     true,
          name:          'Biometrico principal - ' + tenantName,
        })
      if (bioErr) console.warn('[admin-create-tenant] biometric_devices:', bioErr.message)
    }

    let adminUserId: string | null = null
    let inviteLink:  string | null = null

    if (admin_email?.trim() && temp_password && temp_password.length >= 8) {
      const { data: newUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email:         admin_email.trim().toLowerCase(),
        password:      temp_password,
        email_confirm: true,
        user_metadata: {
          full_name: contact_name?.trim() || admin_email.split('@')[0],
          tenant_id: tenantId,
          role:      'tenant_admin',
        },
      })

      if (userErr) {
        await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
        throw new Error('Error creando usuario admin: ' + userErr.message)
      }

      adminUserId = newUser.user!.id

      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .insert({ id: adminUserId, tenant_id: tenantId, role: 'tenant_admin', is_active: true })

      if (profileErr) console.warn('[admin-create-tenant] profiles:', profileErr.message)

      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink', email: admin_email.trim().toLowerCase(),
      })
      if (!linkErr) inviteLink = linkData.properties.action_link
    }

    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_email: caller.email,
        action:     'CREATE_TENANT',
        details:    JSON.stringify({
          tenant_id:     tenantId,
          business_name: tenantName,
          ruc:           ruc.trim(),
          plan:          finalPlan,
          admin_email:   admin_email || null,
        }),
      })

    return new Response(
      JSON.stringify({
        success:       true,
        tenant_id:     tenantId,
        tenant,
        admin_user_id: adminUserId,
        invite_link:   inviteLink,
        message:       'Empresa creada correctamente.',
      }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[admin-create-tenant] ERROR:', err.message)
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
