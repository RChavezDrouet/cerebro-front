/**
 * attendance-usb-import — Edge Function (Base) v4.2.1
 *
 * Objetivo:
 *  - Recibir archivo CSV/XLSX (base64) exportado por biométrico/USB
 *  - Validar + normalizar filas
 *  - Estrategia staging → dedupe → insert (atomicidad por lotes)
 *  - Inserta en attendance.punches usando service role (sin exponer llaves)
 *
 * OWASP:
 *  - A01: authZ fuerte (valida JWT + rol/tenant)
 *  - A03: validaciones de entrada (tamano, filas, formato)
 *  - A05: hardening (limites; CORS; no filtrar stacktrace)
 *  - A07: auditabilidad (audit_logs + batch)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SVC  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ImportBody = {
  tenant_id: string
  filename: string
  mime?: string
  content_b64: string
  options?: {
    timezone?: string
    dry_run?: boolean
    max_rows?: number
  }
}

type NormalizedRow = {
  employee_code: string
  punched_at: string // ISO
  type: 'in' | 'out' | 'break_start' | 'break_end'
  device_location?: string
  method?: string
  raw: Record<string, unknown>
  hash: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('authorization') || ''
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : ''
    if (!jwt) return jerr('Missing Bearer token', 401)

    const anon = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const admin = createClient(URL_, SVC)

    // 1) Autenticacion
    const { data: u, error: ue } = await anon.auth.getUser()
    if (ue || !u?.user) return jerr('Unauthorized', 401)

    // 2) Payload
    const body = (await req.json()) as ImportBody
    if (!body?.tenant_id || !body?.filename || !body?.content_b64) return jerr('Bad request', 400)

    // 3) Autorizacion por tenant
    const userId = u.user.id
    const tenantId = body.tenant_id

    // Acepta admin/asistente/auditor/jefe_area (segun matriz). Ajustable.
    const { data: roleRow, error: re } = await admin
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (re || !roleRow?.role) return jerr('Forbidden', 403)
    const allowed = new Set(['admin', 'assistant', 'auditor', 'department_head'])
    if (!allowed.has(String(roleRow.role))) return jerr('Forbidden', 403)

    // 4) Tenant activo
    const { data: t, error: te } = await admin.from('tenants').select('status,is_suspended').eq('id', tenantId).maybeSingle()
    if (te || !t) return jerr('Tenant not found', 404)
    if (t.status !== 'active' || t.is_suspended) return jerr('Tenant paused', 423)

    // 5) Limites
    const bytes = b64ToBytes(body.content_b64)
    const maxBytes = 3 * 1024 * 1024 // 3MB
    if (bytes.length > maxBytes) return jerr('Archivo demasiado grande (max 3MB)', 413)

    const maxRows = clamp(body.options?.max_rows ?? 5000, 100, 20000)

    // 6) Crear batch
    const { data: batch, error: be } = await admin
      .schema('attendance')
      .from('usb_import_batches')
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        filename: body.filename,
        mime: body.mime || null,
        status: 'received',
      })
      .select('id')
      .single()

    if (be || !batch?.id) return jerr('No se pudo crear el batch', 500)
    const batchId = batch.id as string

    // 7) Parse
    const ext = (body.filename.split('.').pop() || '').toLowerCase()
    const isCsv = (body.mime || '').includes('csv') || ext === 'csv'
    const isXlsx = (body.mime || '').includes('spreadsheet') || ext === 'xlsx' || ext === 'xls'
    if (!isCsv && !isXlsx) {
      await markBatch(admin, batchId, 'failed', { reason: 'unsupported_format' })
      return jerr('Formato no soportado. Use CSV/XLSX', 415)
    }

    const rawRows = isCsv ? parseCsv(bytesToText(bytes)) : parseXlsx(bytes)
    if (rawRows.length === 0) {
      await markBatch(admin, batchId, 'failed', { reason: 'empty_file' })
      return jerr('Archivo vacío', 400)
    }

    if (rawRows.length > maxRows) {
      await markBatch(admin, batchId, 'failed', { reason: 'too_many_rows', max_rows: maxRows })
      return jerr(`Demasiadas filas (max ${maxRows})`, 413)
    }

    // 8) Normalizar + validar
    const norm: NormalizedRow[] = []
    const rejects: any[] = []

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i]
      const n = normalizeRow(r, tenantId)
      if (!n.ok) {
        rejects.push({ row: i + 1, error: n.error, sample: n.sample })
        continue
      }
      norm.push(n.value)
    }

    // 9) Staging con dedupe (hash unique)
    // Insert masivo por chunks para evitar timeouts
    const chunks = chunk(norm, 500)
    let staged = 0

    for (const c of chunks) {
      const { error: se, count } = await admin
        .schema('attendance')
        .from('usb_import_staging')
        .insert(
          c.map((x) => ({
            batch_id: batchId,
            tenant_id: tenantId,
            employee_code: x.employee_code,
            punched_at: x.punched_at,
            punch_type: x.type,
            source: 'usb',
            device_location: x.device_location || null,
            meta: {
              method: x.method || null,
              raw: x.raw,
              filename: body.filename,
              imported_by: userId,
            },
            hash: x.hash,
          })),
          { count: 'exact' }
        )

      // Si hay conflicto por unique(hash), Supabase puede devolver error 409.
      // Preferimos reintentar con upsert-ignore:
      if (se) {
        // Intento "upsert" ignorando conflictos
        const { error: se2, count: count2 } = await admin
          .schema('attendance')
          .from('usb_import_staging')
          .upsert(
            c.map((x) => ({
              batch_id: batchId,
              tenant_id: tenantId,
              employee_code: x.employee_code,
              punched_at: x.punched_at,
              punch_type: x.type,
              source: 'usb',
              device_location: x.device_location || null,
              meta: {
                method: x.method || null,
                raw: x.raw,
                filename: body.filename,
                imported_by: userId,
              },
              hash: x.hash,
            })),
            { onConflict: 'hash', ignoreDuplicates: true, count: 'exact' }
          )
        if (se2) {
          await markBatch(admin, batchId, 'failed', { reason: 'staging_insert_failed', message: se2.message })
          return jerr('No se pudo insertar staging', 500)
        }
        staged += count2 ?? 0
      } else {
        staged += count ?? c.length
      }
    }

    // 10) Insert final (solo filas staging del batch)
    await markBatch(admin, batchId, 'staged', {
      received_rows: rawRows.length,
      valid_rows: norm.length,
      rejected_rows: rejects.length,
    })

    if (body.options?.dry_run) {
      await markBatch(admin, batchId, 'dry_run', { staged })
      return jok({
        batch_id: batchId,
        status: 'dry_run',
        totals: {
          received: rawRows.length,
          valid: norm.length,
          staged,
          inserted: 0,
          rejected: rejects.length,
        },
        rejects: rejects.slice(0, 50),
      })
    }

    // Resolver employee_id por employee_code de forma set-based
    //  - insert a punches con join employees
    //  - on conflict do nothing usando indice unico en punches
    const { data: ins, error: ie } = await admin.rpc('attendance_usb_import_apply', {
      p_batch_id: batchId,
      p_tenant_id: tenantId,
      p_user_id: userId,
    })

    if (ie) {
      await markBatch(admin, batchId, 'failed', { reason: 'apply_failed', message: ie.message })
      return jerr('No se pudo aplicar el batch (insert final)', 500)
    }

    // 11) Audit log
    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'USB_IMPORT',
      table_name: 'attendance.punches',
      record_id: batchId,
      new_value: { tenant_id: tenantId, filename: body.filename, totals: ins },
    })

    await markBatch(admin, batchId, 'done', { ...ins, rejects: rejects.length })

    return jok({
      batch_id: batchId,
      status: 'done',
      totals: {
        received: rawRows.length,
        valid: norm.length,
        staged,
        inserted: ins?.inserted ?? 0,
        duplicates_skipped: ins?.duplicates_skipped ?? 0,
        missing_employee: ins?.missing_employee ?? 0,
        rejected: rejects.length,
      },
      rejects: rejects.slice(0, 50),
    })
  } catch (e: any) {
    console.error('[attendance-usb-import]', e?.message)
    return jerr('Internal error', 500)
  }
})

// ─────────────────────────────────────────────────────────────────────────────

function jok(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

function jerr(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

function parseCsv(text: string): Record<string, unknown>[] {
  // Heuristica de separador
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || ''
  const delim = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ','

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0], delim).map((h) => normKey(h))
  const rows: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delim)
    const r: Record<string, unknown> = {}
    headers.forEach((h, idx) => (r[h] = (cols[idx] ?? '').trim()))
    rows.push(r)
  }
  return rows
}

function splitCsvLine(line: string, delim: string): string[] {
  // Parser simple: soporta comillas
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      q = !q
      continue
    }
    if (!q && ch === delim) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseXlsx(bytes: Uint8Array): Record<string, unknown>[] {
  const wb = XLSX.read(bytes, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
  // Normalizar keys
  return json.map((r) => {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r)) o[normKey(k)] = typeof v === 'string' ? v.trim() : v
    return o
  })
}

function normKey(s: string): string {
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeRow(r: Record<string, unknown>, tenantId: string):
  | { ok: true; value: NormalizedRow }
  | { ok: false; error: string; sample: Record<string, unknown> } {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const kk = normKey(k)
      if (kk in r) return r[kk]
    }
    return undefined
  }

  const employee_code = String(get('employee_code', 'codigo', 'cod_empleado', 'empleado_codigo', 'employee', 'empleado') ?? '').trim()
  if (!employee_code) return { ok: false, error: 'employee_code requerido', sample: r }

  const rawType = String(get('type', 'punch_type', 'evento', 'event', 'estado', 'accion') ?? '').trim()
  const type = mapType(rawType)
  if (!type) return { ok: false, error: 'type/evento inválido', sample: r }

  // Fecha y hora
  const punchedAt =
    String(get('punched_at', 'fecha_hora', 'datetime', 'timestamp') ?? '').trim() ||
    buildDateTime(String(get('fecha', 'date') ?? '').trim(), String(get('hora', 'time') ?? '').trim())

  const iso = toIso(punchedAt)
  if (!iso) return { ok: false, error: 'punched_at inválido', sample: r }

  const device_location = String(get('ubicacion', 'location', 'device_location', 'terminal') ?? '').trim() || undefined
  const method = String(get('metodo', 'method', 'capture_method') ?? '').trim() || undefined

  const raw = r
  // Hash determinístico para dedupe (no criptográfico; suficiente para clave única)
  const hash = fnv1a(`${tenantId}|${employee_code}|${iso}|${type}|usb`)

  return {
    ok: true,
    value: { employee_code, punched_at: iso, type, device_location, method, raw, hash },
  }
}

function buildDateTime(d: string, t: string): string {
  if (!d) return ''
  if (!t) return d
  return `${d} ${t}`
}

function toIso(s: string): string | null {
  if (!s) return null
  // Intenta parsear ISO directo
  const d1 = new Date(s)
  if (!isNaN(d1.getTime())) return d1.toISOString()

  // Formatos comunes: DD/MM/YYYY HH:mm:ss, DD-MM-YYYY HH:mm
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yyyy = Number(m[3])
    const HH = Number(m[4] || '0')
    const MI = Number(m[5] || '0')
    const SS = Number(m[6] || '0')
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd, HH, MI, SS))
    if (!isNaN(dt.getTime())) return dt.toISOString()
  }
  return null
}

function mapType(raw: string): NormalizedRow['type'] | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (['in', 'entrada', 'e', '0', 'checkin', 'clock_in'].includes(v)) return 'in'
  if (['out', 'salida', 's', '1', 'checkout', 'clock_out'].includes(v)) return 'out'
  if (['break_start', 'inicio_comida', 'breakin', 'almuerzo_inicio'].includes(v)) return 'break_start'
  if (['break_end', 'fin_comida', 'breakout', 'almuerzo_fin'].includes(v)) return 'break_end'
  return null
}

function fnv1a(input: string): string {
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function markBatch(admin: any, batchId: string, status: string, summary: Record<string, unknown>) {
  await admin
    .schema('attendance')
    .from('usb_import_batches')
    .update({ status, summary, updated_at: new Date().toISOString() })
    .eq('id', batchId)
}
