// Supabase Edge Function: face-verify
// =============================================================
// Propósito:
// - Validar que el rostro capturado (selfie) corresponde al empleado.
// - Debe ejecutarse ANTES de capturar GPS y antes de insertar el punch.
//
// NOTA:
// - Implementación recomendada: este Edge Function llama a un microservicio
//   (Node/Python) que use AWS Rekognition / Azure Face / Face++ / etc.
// - Aquí dejamos un “proxy” production-ready (auth + validaciones + contrato).
//
// Variables de entorno (Supabase → Functions → Secrets):
// - FACE_VERIFY_API_URL            (URL del microservicio)
// - FACE_VERIFY_API_KEY            (opcional)
// - FACE_VERIFY_ALLOW_FALLBACK     ('true'|'false')
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

type Payload = {
  tenant_id: string
  employee_id: string
  selfie: { bucket: string; path: string }
  threshold?: number
}

type Result = {
  match: boolean
  score: number | null
  threshold: number | null
  provider: string
  reason?: string | null
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
    }

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return json(401, { error: 'Missing Authorization bearer token' })
    }

    // Client para validar JWT del usuario
    const supabaseAuth = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    if (userErr || !userData?.user) {
      return json(401, { error: 'Invalid token' })
    }

    const body = (await req.json()) as Payload
    if (!body?.tenant_id || !body?.employee_id || !body?.selfie?.bucket || !body?.selfie?.path) {
      return json(400, { error: 'Invalid payload' })
    }

    // Validación anti-impersonation: el tenant/employee deben coincidir con public.profiles
    const uid = userData.user.id
    const { data: prof, error: profErr } = await supabaseAuth
      .from('profiles')
      .select('tenant_id, employee_id')
      .eq('id', uid)
      .maybeSingle()

    if (profErr || !prof?.tenant_id || !prof?.employee_id) {
      return json(403, { error: 'Profile mapping missing (public.profiles)' })
    }

    if (prof.tenant_id !== body.tenant_id || prof.employee_id !== body.employee_id) {
      return json(403, { error: 'tenant_id/employee_id mismatch' })
    }

    // 1) Si existe microservicio, lo llamamos.
    const apiUrl = Deno.env.get('FACE_VERIFY_API_URL')
    const apiKey = Deno.env.get('FACE_VERIFY_API_KEY')
    const threshold = typeof body.threshold === 'number' ? body.threshold : null

    if (apiUrl) {
      const r = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          tenant_id: body.tenant_id,
          employee_id: body.employee_id,
          selfie: body.selfie,
          threshold,
        }),
      })

      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        return json(502, { error: 'Face verify upstream error', detail: txt })
      }

      const data = (await r.json()) as Result
      if (typeof data?.match !== 'boolean') {
        return json(502, { error: 'Invalid upstream response' })
      }

      return json(200, {
        match: data.match,
        score: data.score ?? null,
        threshold: data.threshold ?? threshold,
        provider: data.provider || 'upstream',
        reason: data.reason ?? null,
      })
    }

    // 2) Fallback controlado (solo para DEV / emergencia)
    const allowFallback = String(Deno.env.get('FACE_VERIFY_ALLOW_FALLBACK') || 'false').toLowerCase() === 'true'
    if (allowFallback) {
      return json(200, {
        match: true,
        score: null,
        threshold,
        provider: 'fallback_allow',
        reason: 'FACE_VERIFY_API_URL not configured',
      })
    }

    return json(503, {
      match: false,
      score: null,
      threshold,
      provider: 'not_configured',
      reason: 'FACE_VERIFY_API_URL not configured',
    })
  } catch (e) {
    return json(500, { error: 'Unhandled error', detail: String(e) })
  }
})
