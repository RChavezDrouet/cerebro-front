// deno-lint-ignore-file no-explicit-any
// =============================================
// HRCloud Base - Supabase Edge Function
// attendance-punch
// =============================================
// Inserta una marcación de PWA de forma atómica y segura:
// - Verifica JWT
// - Resuelve employee + tenant
// - Valida tenant active (si existe tabla tenants)
// - Anti-abuso (rate limit) en punch_attempts
// - Valida GPS accuracy + geofence
// - (Opcional) requiere selfie y prepara integración de liveness/face-match
// - Inserta attendance_punches con ip/user-agent server-side

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type PunchType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for')
  if (!xf) return null
  return xf.split(',')[0].trim()
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, reason: 'Method not allowed' })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { ok: false, reason: 'Missing Supabase env vars' })
  }

  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return json(401, { ok: false, reason: 'Missing bearer token' })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !userData?.user) return json(401, { ok: false, reason: 'Invalid token' })

  const body = await req.json().catch(() => null)
  if (!body) return json(400, { ok: false, reason: 'Invalid JSON body' })

  const punch_type = body.punch_type as PunchType
  const location = body.location as { latitude: number; longitude: number; accuracy: number; timestamp?: number }
  const notes = typeof body.notes === 'string' ? body.notes : null
  const device_id = typeof body.device_id === 'string' ? body.device_id : null
  const selfie_path = typeof body.selfie_path === 'string' ? body.selfie_path : null

  if (!['clock_in', 'clock_out', 'break_start', 'break_end'].includes(punch_type)) {
    return json(400, { ok: false, reason: 'Invalid punch_type' })
  }
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number' || typeof location.accuracy !== 'number') {
    return json(400, { ok: false, reason: 'Missing/invalid location' })
  }

  const ip = getIp(req)
  const ua = req.headers.get('user-agent')

  // Resolver empleado (preferible: employees.user_id; fallback: email)
  const user = userData.user
  let employee: any = null
  {
    // Intento 1: user_id
    const { data } = await supabase
      .from('employees')
      .select('id, tenant_id, status, telework_enabled, geofence_lat, geofence_lng, geofence_radius')
      .eq('user_id', user.id)
      .maybeSingle()
    employee = data
  }
  if (!employee) {
    const { data } = await supabase
      .from('employees')
      .select('id, tenant_id, status, telework_enabled, geofence_lat, geofence_lng, geofence_radius')
      .eq('email', user.email)
      .maybeSingle()
    employee = data
  }
  if (!employee) {
    return json(403, { ok: false, reason: 'Employee not found for user' })
  }
  if (employee.status !== 'active') {
    return json(403, { ok: false, reason: 'Employee inactive' })
  }
  if (!employee.telework_enabled) {
    return json(403, { ok: false, reason: 'Telework not enabled for employee' })
  }

  const tenant_id = employee.tenant_id as string
  const employee_id = employee.id as string

  // Tenant gate (si existe tabla tenants con status)
  try {
    const { data: tenantRow } = await supabase.from('tenants').select('status').eq('id', tenant_id).maybeSingle()
    if (tenantRow?.status && tenantRow.status !== 'active') {
      return json(403, { ok: false, reason: 'Tenant paused' })
    }
  } catch {
    // Si no existe tabla, no bloquea
  }

  // Cargar config + seguridad
  const { data: cfg } = await supabase
    .from('attendance_config')
    .select('*')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  const { data: sec } = await supabase
    .from('attendance_security_settings')
    .select('*')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  const maxAcc = (cfg?.max_gps_accuracy ?? 50) as number
  if (location.accuracy > maxAcc) {
    await supabase.from('punch_attempts').insert({
      tenant_id,
      employee_id,
      success: false,
      reason: 'gps_accuracy_insufficient',
      ip_address: ip,
      user_agent: ua,
      device_id,
      details: { accuracy: location.accuracy, max: maxAcc },
    })
    return json(400, { ok: false, reason: `Precisión GPS insuficiente (${Math.round(location.accuracy)}m)` })
  }

  // Anti-abuso simple: >10 intentos en 60s
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await supabase
    .from('punch_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('employee_id', employee_id)
    .gte('attempted_at', since)

  if ((count ?? 0) > 10) {
    return json(429, { ok: false, reason: 'Rate limit: demasiados intentos' })
  }

  // Geofence (si configurado en employee)
  let geofence_status: 'inside' | 'outside' | 'unknown' = 'unknown'
  let distance_m: number | null = null
  if (employee.geofence_lat && employee.geofence_lng && employee.geofence_radius) {
    distance_m = haversineMeters(location.latitude, location.longitude, employee.geofence_lat, employee.geofence_lng)
    geofence_status = distance_m <= employee.geofence_radius ? 'inside' : 'outside'
    if (geofence_status === 'outside' && (cfg?.geofence_enabled ?? true)) {
      await supabase.from('punch_attempts').insert({
        tenant_id,
        employee_id,
        success: false,
        reason: 'outside_geofence',
        ip_address: ip,
        user_agent: ua,
        device_id,
        details: { distance_m, radius_m: employee.geofence_radius },
      })
      return json(403, { ok: false, reason: 'Fuera del área permitida' })
    }
  }

  // Verificación facial (MVP: evidencia obligatoria si face_enabled o liveness_enabled)
  const face_required = Boolean(sec?.face_enabled || sec?.liveness_enabled)
  if (face_required && !selfie_path) {
    await supabase.from('punch_attempts').insert({
      tenant_id,
      employee_id,
      success: false,
      reason: 'selfie_required',
      ip_address: ip,
      user_agent: ua,
      device_id,
    })
    return json(400, { ok: false, reason: 'Se requiere selfie para marcar (configuración del tenant)' })
  }

  // TODO(Enterprise): Integrar proveedor real.
  // - aws_rekognition: CompareFaces (foto enrolada vs selfie) + FaceLiveness
  // - azure_face: verify/identify + liveness (si aplica)
  // Por ahora, registramos la evidencia y marcamos como válido.
  const face_match_score = null
  const liveness_score = null
  const validation_details = {
    face_required,
    provider: sec?.provider ?? 'none',
    distance_m,
    maxAcc,
  }

  const punched_at = new Date().toISOString()

  const { data: inserted, error: insErr } = await supabase
    .from('attendance_punches')
    .insert({
      tenant_id,
      employee_id,
      punch_type,
      punched_at,
      source: 'web_pwa',
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      ip_address: ip,
      user_agent: ua,
      device_id,
      geofence_status,
      is_valid: true,
      invalidation_reason: null,
      notes,
      selfie_path,
      face_match_score,
      liveness_score,
      face_required,
      validation_details,
    })
    .select('id')
    .single()

  if (insErr) {
    await supabase.from('punch_attempts').insert({
      tenant_id,
      employee_id,
      success: false,
      reason: 'db_insert_failed',
      ip_address: ip,
      user_agent: ua,
      device_id,
      details: { message: insErr.message },
    })
    return json(500, { ok: false, reason: 'DB insert failed' })
  }

  await supabase.from('punch_attempts').insert({
    tenant_id,
    employee_id,
    success: true,
    reason: null,
    ip_address: ip,
    user_agent: ua,
    device_id,
    details: { punch_id: inserted.id },
  })

  return json(200, { ok: true, punch_id: inserted.id, is_valid: true })
})
