// supabase/functions/admin-invite-staff/index.ts
// Edge Function: crea usuario en auth.users + fila en cerebro.user_roles
// Requiere service_role key  →  SOLO llamable desde CEREBRO con sesión admin
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── 1. Verificar sesión del llamante ──────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    // Cliente con la sesión del usuario (para verificar su rol)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Sesión inválida' }, 401)

    // Verificar que el llamante es admin en cerebro.user_roles
    const { data: callerRole } = await userClient
      .schema('cerebro')
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!callerRole || callerRole.role !== 'admin' || callerRole.is_active === false) {
      return json({ error: 'Permisos insuficientes — se requiere rol admin activo' }, 403)
    }

    // ── 2. Leer body ──────────────────────────────────────
    const { email, password, full_name, role } = await req.json() as {
      email: string; password: string; full_name: string; role: string
    }

    // Validaciones básicas
    if (!email || !password || !full_name || !role) return json({ error: 'Faltan campos requeridos' }, 400)
    if (!['admin','assistant','maintenance'].includes(role)) return json({ error: 'Rol inválido' }, 400)
    if (password.length < 8) return json({ error: 'Contraseña muy corta (mínimo 8)' }, 400)

    // ── 3. Crear usuario con service_role ────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,        // confirma email automáticamente
      user_metadata: { full_name, role },
    })

    if (createErr) {
      // Mensaje amigable para email ya existente
      if (createErr.message?.toLowerCase().includes('already registered')) {
        return json({ error: 'El email ya está registrado en Supabase Auth' }, 409)
      }
      return json({ error: createErr.message }, 400)
    }

    const newUserId = newUser.user!.id

    // ── 4. Insertar en cerebro.user_roles ────────────────
    const { error: roleErr } = await adminClient
      .schema('cerebro')
      .from('user_roles')
      .insert({
        user_id:   newUserId,
        email:     email.toLowerCase(),
        full_name: full_name.trim(),
        role,
        is_active: true,
      })

    if (roleErr) {
      // Rollback: eliminar usuario creado si falla inserción del rol
      await adminClient.auth.admin.deleteUser(newUserId)
      return json({ error: 'Error al asignar rol: ' + roleErr.message }, 500)
    }

    // ── 5. Registrar en auditoría ────────────────────────
    await adminClient.schema('cerebro').from('audit_logs').insert({
      user_id:    user.id,
      user_email: user.email,
      action:     'INSERT',
      table_name: 'user_roles',
      record_id:  newUserId,
      new_value:  { email, role, full_name },
    }).then(() => {}) // ignorar error en audit

    return json({ success: true, user_id: newUserId, email, role })

  } catch (e: any) {
    console.error('[admin-invite-staff]', e)
    return json({ error: e.message ?? 'Error interno del servidor' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
