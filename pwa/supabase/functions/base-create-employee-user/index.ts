import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function generateTemporaryPassword(email: string) {
  const base = (email.split('@')[0] || 'hrcl').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'hrcl'
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6)
  return `${base}#${suffix}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerId = authData.user.id
    const body = await req.json()

    const tenantId = String(body.tenant_id || '')
    const employeeId = String(body.employee_id || '')
    const email = String(body.email || '').trim().toLowerCase()
    const role = String(body.role || 'employee')
    const tempPassword = String(body.temp_password || '').trim() || generateTemporaryPassword(email)

    if (!tenantId || !employeeId || !email) {
      return new Response(JSON.stringify({ error: 'tenant_id, employee_id y email son obligatorios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: callerProfile }, { data: callerMembership }] = await Promise.all([
      supabaseAdmin.from('profiles').select('tenant_id,role').eq('id', callerId).maybeSingle(),
      supabaseAdmin.schema('attendance').from('memberships').select('tenant_id,role').eq('user_id', callerId).maybeSingle(),
    ])

    const isGlobalAdmin = callerProfile?.role === 'admin'
    const isTenantAdmin = callerMembership?.role === 'tenant_admin' && callerMembership?.tenant_id === tenantId

    if (!isGlobalAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const usersPage = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    let existingUser = usersPage.data.users.find((u) => (u.email || '').toLowerCase() === email)

    if (!existingUser) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { tenant_id: tenantId, role },
      })

      if (created.error || !created.data.user) {
        return new Response(JSON.stringify({ error: created.error?.message || 'No se pudo crear auth user' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      existingUser = created.data.user
    } else {
      const updated = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          tenant_id: tenantId,
          role,
        },
      })

      if (updated.error || !updated.data.user) {
        return new Response(JSON.stringify({ error: updated.error?.message || 'No se pudo actualizar auth user' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      existingUser = updated.data.user
    }

    const userId = existingUser.id

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      tenant_id: tenantId,
      role,
      first_login_pending: true,
      is_active: true,
    })

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: membershipError } = await supabaseAdmin
      .schema('attendance')
      .from('memberships')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        role,
      })

    if (membershipError) {
      return new Response(JSON.stringify({ error: membershipError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: employeeError } = await supabaseAdmin
      .schema('attendance')
      .from('employees')
      .update({ user_id: userId, first_login_pending: true })
      .eq('id', employeeId)
      .eq('tenant_id', tenantId)

    if (employeeError) {
      return new Response(JSON.stringify({ error: employeeError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email,
        temporary_password: tempPassword,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
