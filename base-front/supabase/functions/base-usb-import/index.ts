// HRCloud Base — USB Import Edge Function
// Name: base-usb-import
// Auth: Bearer <JWT> (supabase session access_token)
// Permissions: tenant admin/assistant only (attendance.memberships)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

type UsbPunch = {
  employee_code: string
  punched_at: string // ISO 8601 (UTC recommended)
  method?: 'USB' | 'FINGER' | 'FACE' | 'PIN' | 'UNKNOWN'
  device_serial?: string | null
  raw?: Record<string, unknown> | null
}

type UsbImportRequest = {
  tenant_id: string
  device_serial?: string | null
  source_file?: {
    filename: string
    sha256?: string
  } | null
  punches: UsbPunch[]
  options?: {
    dry_run?: boolean
    // if true, allow creating unknown employees (NOT recommended) — default false
    allow_unknown_employee?: boolean
    // ignore punches that are older than X days (default 365)
    max_age_days?: number
  }
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

function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m?.[1] ?? null
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      return json(500, { error: 'Missing env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY' })
    }

    const token = getBearerToken(req)
    if (!token) return json(401, { error: 'Missing Bearer token' })

    // 1) Validate JWT (end-user)
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })

    const { data: userRes, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userRes?.user) return json(401, { error: 'Invalid session', details: userErr?.message })
    const userId = userRes.user.id

    // 2) Parse body
    let body: UsbImportRequest
    try {
      body = (await req.json()) as UsbImportRequest
    } catch {
      return json(400, { error: 'Invalid JSON body' })
    }

    if (!body?.tenant_id || !isUuid(body.tenant_id)) return json(400, { error: 'tenant_id must be a UUID' })
    if (!Array.isArray(body?.punches) || body.punches.length < 1) return json(400, { error: 'punches[] is required' })
    if (body.punches.length > 5000) return json(413, { error: 'Too many punches (max 5000 per request)' })

    const dryRun = Boolean(body.options?.dry_run)
    const allowUnknown = Boolean(body.options?.allow_unknown_employee)
    const maxAgeDays = Number.isFinite(body.options?.max_age_days) ? Number(body.options?.max_age_days) : 365

    // 3) Authorize against tenant membership (service role)
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: membership, error: memErr } = await svc
      .schema('attendance')
      .from('memberships')
      .select('role')
      .eq('tenant_id', body.tenant_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (memErr) return json(500, { error: 'membership lookup failed', details: memErr.message })
    const role = membership?.role ?? 'employee'
    const allowed = ['tenant_admin', 'hr_admin', 'admin', 'assistant']
    if (!allowed.includes(role)) return json(403, { error: 'Forbidden', role })

    // 4) Create batch (staging)
    const { data: batch, error: batchErr } = await svc
      .schema('attendance')
      .from('usb_import_batches')
      .insert({
        tenant_id: body.tenant_id,
        requested_by: userId,
        device_serial: body.device_serial ?? body.source_file?.filename ?? null,
        source_filename: body.source_file?.filename ?? null,
        source_sha256: body.source_file?.sha256 ?? null,
        status: dryRun ? 'validated' : 'received',
        total_rows: body.punches.length,
      })
      .select('id')
      .single()

    if (batchErr) return json(500, { error: 'batch insert failed', details: batchErr.message })

    const batchId = batch.id as string

    // 5) Normalize + validate punches
    const now = Date.now()
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000

    const normalized = body.punches
      .map((p, idx) => ({ ...p, _idx: idx }))
      .filter((p) => typeof p.employee_code === 'string' && p.employee_code.trim().length > 0)
      .map((p) => ({
        _idx: p._idx,
        employee_code: p.employee_code.trim(),
        punched_at: p.punched_at,
        method: p.method ?? 'USB',
        device_serial: (p.device_serial ?? body.device_serial ?? null) as string | null,
        raw: p.raw ?? null,
      }))

    const invalid: Array<{ idx: number; reason: string }> = []
    const toStage: any[] = []

    for (const p of normalized) {
      const dt = Date.parse(p.punched_at)
      if (!Number.isFinite(dt)) {
        invalid.push({ idx: p._idx, reason: 'punched_at invalid ISO string' })
        continue
      }
      if (now - dt > maxAgeMs) {
        invalid.push({ idx: p._idx, reason: `punched_at older than ${maxAgeDays} days` })
        continue
      }
      toStage.push({
        tenant_id: body.tenant_id,
        batch_id: batchId,
        employee_code: p.employee_code,
        punched_at: new Date(dt).toISOString(),
        method: p.method,
        device_serial: p.device_serial,
        raw: p.raw,
      })
    }

    if (toStage.length === 0) {
      // mark batch failed
      await svc.schema('attendance').from('usb_import_batches').update({ status: 'failed', error_summary: 'No valid rows' }).eq('id', batchId)
      return json(400, { error: 'No valid punches to import', invalid })
    }

    // 6) Insert staging rows (chunked)
    // (PostgREST payload limits) — chunk at 1000
    const chunkSize = 1000
    let staged = 0
    for (let i = 0; i < toStage.length; i += chunkSize) {
      const chunk = toStage.slice(i, i + chunkSize)
      const { error: stgErr } = await svc.schema('attendance').from('usb_import_staging').insert(chunk)
      if (stgErr) {
        await svc
          .schema('attendance')
          .from('usb_import_batches')
          .update({ status: 'failed', error_summary: stgErr.message })
          .eq('id', batchId)
        return json(500, { error: 'staging insert failed', details: stgErr.message, batch_id: batchId })
      }
      staged += chunk.length
    }

    // 7) Optionally process (dedupe + insert)
    if (dryRun) {
      await svc
        .schema('attendance')
        .from('usb_import_batches')
        .update({ status: 'validated', valid_rows: staged, invalid_rows: invalid.length })
        .eq('id', batchId)

      return json(200, {
        ok: true,
        dry_run: true,
        batch_id: batchId,
        staged_rows: staged,
        invalid_rows: invalid.length,
        invalid,
      })
    }

    const { data: proc, error: procErr } = await svc
      .schema('attendance')
      .rpc('process_usb_import', { p_batch_id: batchId, p_allow_unknown_employee: allowUnknown })

    if (procErr) {
      await svc
        .schema('attendance')
        .from('usb_import_batches')
        .update({ status: 'failed', error_summary: procErr.message, valid_rows: staged, invalid_rows: invalid.length })
        .eq('id', batchId)

      return json(500, { error: 'process_usb_import failed', details: procErr.message, batch_id: batchId })
    }

    await svc
      .schema('attendance')
      .from('usb_import_batches')
      .update({
        status: 'completed',
        valid_rows: staged,
        invalid_rows: invalid.length,
        inserted_rows: (proc as any)?.inserted_rows ?? null,
        duplicate_rows: (proc as any)?.duplicate_rows ?? null,
        unknown_employee_rows: (proc as any)?.unknown_employee_rows ?? null,
      })
      .eq('id', batchId)

    return json(200, {
      ok: true,
      batch_id: batchId,
      staged_rows: staged,
      invalid_rows: invalid.length,
      invalid,
      result: proc,
    })
  } catch (e) {
    console.error(e)
    return json(500, { error: 'Unhandled error', details: (e as any)?.message ?? String(e) })
  }
})
