import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type PunchRequest = {
  type: 'in' | 'out' | 'break_start' | 'break_end'
  source: 'web' | 'biometric' | 'import'
  geo?: { lat?: number; lng?: number; accuracy_m?: number }
  device_id?: string
  face_verified?: boolean
  face_similarity_pct?: number
  meta?: Record<string, unknown>
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing bearer token' }, 401)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY } },
  })
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const [{ data: userInfo }, payload] = await Promise.all([
    admin.auth.getUser(token),
    req.json() as Promise<PunchRequest>,
  ])

  const user = userInfo.user
  if (!user) return json({ error: 'Invalid token' }, 401)

  const { data: profile } = await admin
    .from('profiles')
    .select('tenant_id, is_active, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return json({ error: 'Tenant no resuelto' }, 403)

  const tenantId = profile.tenant_id as string

  const [tenantRs, employeeRs, rulesRs, recentAttemptsRs] = await Promise.all([
    admin.from('tenants').select('id,status,is_suspended').eq('id', tenantId).single(),
    admin.from('employees').select('id,tenant_id,status,employee_code,full_name,user_id').eq('tenant_id', tenantId).eq('user_id', user.id).single(),
    admin.from('attendance_rules_v2').select('*').eq('tenant_id', tenantId).single(),
    admin.from('punch_attempts').select('id,requested_at').eq('tenant_id', tenantId).eq('employee_id', user.id).order('requested_at', { ascending: false }).limit(5),
  ])

  if (tenantRs.data?.status === 'paused' || tenantRs.data?.is_suspended) {
    await admin.from('punch_attempts').insert({
      tenant_id: tenantId,
      employee_id: employeeRs.data?.id ?? null,
      requested_type: payload.type,
      source: payload.source,
      success: false,
      failure_reason: 'TENANT_PAUSED',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      device_id: payload.device_id,
      geo_lat: payload.geo?.lat,
      geo_lng: payload.geo?.lng,
      geo_accuracy_m: payload.geo?.accuracy_m,
      meta: payload.meta ?? {},
    })
    return json({ error: 'Tenant pausado' }, 423)
  }

  if (!employeeRs.data || employeeRs.data.status !== 'active') {
    await admin.from('punch_attempts').insert({
      tenant_id: tenantId,
      employee_id: employeeRs.data?.id ?? null,
      requested_type: payload.type,
      source: payload.source,
      success: false,
      failure_reason: 'EMPLOYEE_INACTIVE',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      device_id: payload.device_id,
      meta: payload.meta ?? {},
    })
    return json({ error: 'Colaborador inactivo o no vinculado' }, 403)
  }

  const employeeId = employeeRs.data.id as string
  const rules = rulesRs.data
  const nowIso = new Date().toISOString()

  const duplicateWindow = Number(rules?.duplicate_window_seconds ?? 60)
  const tooFast = (recentAttemptsRs.data ?? []).some((row) => {
    const diff = (Date.now() - new Date(row.requested_at).getTime()) / 1000
    return diff < duplicateWindow
  })

  if (tooFast && !rules?.allow_duplicates) {
    await admin.from('punch_attempts').insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      requested_type: payload.type,
      source: payload.source,
      success: false,
      failure_reason: 'RATE_LIMIT',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      device_id: payload.device_id,
      meta: payload.meta ?? {},
    })
    return json({ error: 'Demasiados intentos consecutivos' }, 429)
  }

  if (rules?.face_required && !payload.face_verified && payload.source === 'web') {
    await admin.from('punch_attempts').insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      requested_type: payload.type,
      source: payload.source,
      success: false,
      failure_reason: 'FACE_REQUIRED',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      device_id: payload.device_id,
      meta: payload.meta ?? {},
    })
    return json({ error: 'Se requiere verificación facial' }, 412)
  }

  if (rules?.device_required && !payload.device_id) {
    await admin.from('punch_attempts').insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      requested_type: payload.type,
      source: payload.source,
      success: false,
      failure_reason: 'DEVICE_REQUIRED',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      meta: payload.meta ?? {},
    })
    return json({ error: 'Debe informar device_id' }, 412)
  }

  const geoViolation = Boolean(
    rules?.geo_enabled &&
      rules?.geo_point_lat != null &&
      rules?.geo_point_lng != null &&
      payload.geo?.accuracy_m != null &&
      rules?.geo_radius_m != null &&
      Number(payload.geo.accuracy_m) > Number(rules.geo_radius_m)
  )

  const attemptPayload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    requested_type: payload.type,
    source: payload.source,
    success: true,
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    device_id: payload.device_id,
    geo_lat: payload.geo?.lat,
    geo_lng: payload.geo?.lng,
    geo_accuracy_m: payload.geo?.accuracy_m,
    meta: { ...payload.meta, face_similarity_pct: payload.face_similarity_pct, geo_violation: geoViolation },
  }

  await admin.from('punch_attempts').insert(attemptPayload)

  const punchInsert = await admin.from('punches').insert({
    tenant_id: tenantId,
    employee_id: employeeId,
    punched_at: nowIso,
    type: payload.type,
    source: payload.source,
    meta: {
      ...payload.meta,
      ip: req.headers.get('x-forwarded-for'),
      ua: req.headers.get('user-agent'),
      device_id: payload.device_id,
      geo: payload.geo ?? null,
      face_verified: payload.face_verified ?? false,
      face_similarity_pct: payload.face_similarity_pct ?? null,
      geo_violation: geoViolation,
    },
  }).select('*').single()

  if (punchInsert.error) return json({ error: punchInsert.error.message }, 400)

  if (geoViolation) {
    await admin.from('attendance_novelties').insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      punch_id: punchInsert.data.id,
      work_date: new Date().toISOString().slice(0, 10),
      type: 'FUERA_GEOFENCE',
      severity: 'high',
      detected_by: 'rules',
      title: 'Marcación fuera de geocerca',
      description: 'La precisión reportada excede el radio configurado del tenant.',
      confidence_score: 95,
      evidence: { geo: payload.geo, radius: rules?.geo_radius_m },
    })
  }

  await admin.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    actor_email: user.email,
    module: 'attendance',
    action: 'PUNCH_CREATE',
    entity_name: 'attendance.punches',
    entity_id: String(punchInsert.data.id),
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    metadata: { source: payload.source, type: payload.type, punched_at: nowIso },
  })

  return json({ ok: true, tenant_id: tenantId, employee_id: employeeId, punch: punchInsert.data })
})
