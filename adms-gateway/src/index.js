import 'dotenv/config'
import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import { getSupabaseAdmin } from './supabase.js'
import { parseAttlogLines } from './zkParser.js'

/**
 * ==============================================
 * HRCloud - ADMS Gateway (Node)
 * - iClock (ZKTeco) + Ingest JSON (gateway python)
 * - Supabase service role (server-side)
 * - Compatible con DigitalOcean App Platform (PORT dinámico)
 * ==============================================
 */

/** Helpers env */
function envBool(v, def = false) {
  if (v === undefined || v === null || v === '') return def
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on'
}
function envNum(v, def) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

const PORT = envNum(process.env.PORT, 3005) // DO define PORT; local fallback 3005
const HOST = String(process.env.HOST || '0.0.0.0') // DO: 0.0.0.0

const TRUST_PROXY = envBool(process.env.TRUST_PROXY, false)
const DEVICE_TZ_DEFAULT = process.env.DEVICE_TIMEZONE || 'America/Guayaquil'
const REJECT_UNKNOWN_SN = envBool(process.env.REJECT_UNKNOWN_SN, true)
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || null
const MAX_BODY_KB = envNum(process.env.MAX_BODY_KB, 256)
const ENABLE_DEBUG = envBool(process.env.ENABLE_DEBUG, true) // local=true, prod=false

// CORS opcional (ej: "https://base.tudominio.com,https://otro.com")
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '').trim()

const app = express()
if (TRUST_PROXY) app.set('trust proxy', true)

// CORS (solo si lo configuras)
if (CORS_ORIGINS) {
  const allowed = CORS_ORIGINS.split(',').map((x) => x.trim()).filter(Boolean)
  app.use(
    cors({
      origin: allowed,
      credentials: true
    })
  )
}

// Logs HTTP (antes de parsers)
if (!envBool(process.env.DISABLE_HTTP_LOGS, false)) {
  app.use(morgan('combined'))
}

// Parsers por ruta (CRÍTICO):
// - /iclock/* = texto crudo (biométrico)
// - /api/*    = JSON (gateway python u otros integradores)
app.use(
  '/iclock',
  express.text({
    type: '*/*',
    limit: `${MAX_BODY_KB}kb`
  })
)

// JSON parser + handler de JSON inválido
app.use(
  '/api',
  express.json({
    limit: '2mb'
  })
)
app.use('/api', (err, _req, res, next) => {
  // Maneja errores de JSON inválido
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'invalid_json' })
  }
  return next(err)
})

const supabase = getSupabaseAdmin()

function q(req, key) {
  const v = req.query?.[key] ?? req.query?.[key.toLowerCase()] ?? req.query?.[key.toUpperCase()]
  return Array.isArray(v) ? v[0] : v
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj ?? {})
  } catch {
    return '{}'
  }
}

function logSbError(prefix, err) {
  if (!err) return
  console.error(prefix, {
    message: err.message,
    details: err.details,
    hint: err.hint,
    code: err.code,
    status: err.status
  })
}

function clientIp(req) {
  // si TRUST_PROXY=true, req.ip ya toma X-Forwarded-For
  return req.ip || req.socket?.remoteAddress || null
}

// Convierte "YYYY-MM-DD HH:mm:ss" (o "YYYY-MM-DDTHH:mm:ss") en UTC usando timezone IANA
function parseLocalDateTimeToUTC(dateTimeStr, timeZone) {
  if (!dateTimeStr) return null

  // Normaliza
  const s = String(dateTimeStr).trim().replace('T', ' ')
  // Esperado: YYYY-MM-DD HH:mm:ss
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) {
    // fallback (si viene ISO real con Z, Date lo soporta)
    const d = new Date(dateTimeStr)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const second = Number(m[6])

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const parts = dtf.formatToParts(utcGuess).reduce((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {})

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )

  const offsetMs = asUTC - utcGuess.getTime()
  const realUTC = new Date(utcGuess.getTime() - offsetMs)

  return realUTC.toISOString()
}

async function resolveDeviceBySN(sn) {
  if (!sn) return null

  const { data, error } = await supabase
    .schema('attendance')
    .from('biometric_devices')
    .select('id, tenant_id, serial_no, device_timezone, is_active')
    .eq('serial_no', sn)
    .maybeSingle()

  if (error) {
    logSbError('resolveDeviceBySN error:', error)
    return null // NO 500
  }
  if (!data) return null
  if (!data.is_active) return null
  return data
}

async function insertRaw({ sn, path, queryObj, headersObj, bodyText, deviceId, tenantId }) {
  // Tu tabla: query TEXT, headers JSONB NOT NULL
  const payload = {
    tenant_id: tenantId ?? null,
    device_id: deviceId ?? null,
    serial_no: sn || null,
    path: path || null,
    query: safeStringify(queryObj),
    headers: headersObj ?? {}, // jsonb (NOT NULL)
    body: typeof bodyText === 'string' ? bodyText : String(bodyText ?? '')
  }

  const { data, error } = await supabase
    .schema('attendance')
    .from('biometric_raw')
    .insert(payload)
    .select('id')
    .maybeSingle()

  if (error) {
    logSbError('insert biometric_raw error:', error)
    return null
  }
  return data?.id ?? null
}

async function insertPunches(rows) {
  // Tu tabla: meta JSONB NOT NULL, tenant_id NOT NULL, source NOT NULL
  const safeRows = (rows || []).map((r) => ({
    ...r,
    meta: r?.meta ?? {}, // jsonb (NOT NULL)
    source: r?.source ?? 'biometric'
  }))

  const { error } = await supabase.schema('attendance').from('punches').insert(safeRows)
  if (error) logSbError('insert punches error:', error)
  return !error
}

async function updateLastSeen(deviceId) {
  if (!deviceId) return
  try {
    const { error } = await supabase
      .schema('attendance')
      .from('biometric_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', deviceId)
    if (error) logSbError('update last_seen_at error:', error)
  } catch {
    // ignore
  }
}

// ============================
// iClock endpoints (biométrico directo a Node)
// ============================
app.get('/iclock/cdata', async (req, res) => {
  // Handshake simple (muchos ZKTeco aceptan OK)
  if (ENABLE_DEBUG && req.query?.SN) {
    console.log('🤝 /iclock/cdata handshake SN=', req.query.SN)
  }
  return res.type('text/plain').send('OK')
})

app.post('/iclock/cdata', async (req, res) => {
  const sn = String(q(req, 'SN') || '')
  const table = String(q(req, 'table') || '')

  const device = await resolveDeviceBySN(sn)
  const tenantId = device?.tenant_id ?? DEFAULT_TENANT_ID ?? null
  const deviceId = device?.id ?? null
  const deviceTz = device?.device_timezone || DEVICE_TZ_DEFAULT

  // Si no hay tenant, NO podemos insertar punches (tenant_id NOT NULL), pero sí guardamos raw.
  if (!device && REJECT_UNKNOWN_SN) {
    await insertRaw({
      sn,
      path: req.path,
      queryObj: req.query ?? {},
      headersObj: { ...req.headers, _client_ip: clientIp(req) },
      bodyText: req.body,
      deviceId: null,
      tenantId
    })
    return res.status(403).type('text/plain').send('UNKNOWN_DEVICE')
  }

  const rawId = await insertRaw({
    sn,
    path: req.path,
    queryObj: req.query ?? {},
    headersObj: { ...req.headers, _client_ip: clientIp(req) },
    bodyText: req.body,
    deviceId,
    tenantId
  })

  if (ENABLE_DEBUG) {
    console.log(`📥 /iclock/cdata SN=${sn} table=${table} bytes=${String(req.body || '').length}`)
  }

  if (String(table).toUpperCase() === 'ATTLOG') {
    const events = parseAttlogLines(req.body, deviceTz)
    if (ENABLE_DEBUG) console.log('ATTLOG parsed events =', events.length)

    if (events.length > 0 && tenantId) {
      const rows = events.map((e) => ({
        tenant_id: tenantId,
        employee_id: null, // luego resolvemos a employee por biometric_employee_code
        biometric_employee_code: String(e.device_employee_code),
        punched_at: e.punched_at_utc, // viene listo desde tu parser
        source: 'biometric',
        device_id: deviceId,
        serial_no: sn || null,
        raw_id: rawId,
        meta: { sn, table, device_tz: deviceTz }
      }))

      const ok = await insertPunches(rows)
      if (ok) await updateLastSeen(deviceId)
    }

    return res.type('text/plain').send('OK')
  }

  // OPERLOG u otras tablas: solo audit raw
  if (deviceId) await updateLastSeen(deviceId)
  return res.type('text/plain').send('OK')
})

app.get('/iclock/getrequest', async (req, res) => {
  const sn = String(q(req, 'SN') || '')
  if (ENABLE_DEBUG && sn) console.log('📡 /iclock/getrequest SN=', sn)
  // Si quieres enviar comandos al equipo, aquí se devuelve el “command list”.
  return res.type('text/plain').send('OK')
})

// ============================
// Endpoint para Gateway Python (JSON)
// app.py envía: { device_sn: "...", records: [ {user_id, check_time, status, verify_type} ] }
// ============================
app.post('/api/integrations/zkteco/receive', async (req, res) => {
  try {
    const deviceSn = String(req.body?.device_sn || req.body?.sn || '')
    const records = Array.isArray(req.body?.records) ? req.body.records : []

    const device = await resolveDeviceBySN(deviceSn)
    const tenantId = device?.tenant_id ?? DEFAULT_TENANT_ID ?? null
    const deviceId = device?.id ?? null
    const deviceTz = device?.device_timezone || DEVICE_TZ_DEFAULT

    if (!device && REJECT_UNKNOWN_SN) {
      await insertRaw({
        sn: deviceSn,
        path: req.path,
        queryObj: req.query ?? {},
        headersObj: { ...req.headers, _client_ip: clientIp(req) },
        bodyText: safeStringify(req.body),
        deviceId: null,
        tenantId
      })
      return res.status(403).json({ ok: false, error: 'UNKNOWN_DEVICE' })
    }

    const rawId = await insertRaw({
      sn: deviceSn,
      path: req.path,
      queryObj: req.query ?? {},
      headersObj: { ...req.headers, _client_ip: clientIp(req) },
      bodyText: safeStringify(req.body),
      deviceId,
      tenantId
    })

    if (ENABLE_DEBUG) {
      console.log(`📥 /receive SN=${deviceSn} records=${records.length}`)
      if (records[0]) console.log('🔎 first record =', records[0])
    }

    // Si no hay tenant, no insertamos punches (tenant_id NOT NULL)
    if (!tenantId || records.length === 0) {
      if (deviceId) await updateLastSeen(deviceId)
      return res.json({ ok: true, ingested: 0, note: 'no-tenant-or-empty' })
    }

    const rows = records
      .map((r) => {
        const code = String(r.user_id ?? r.userid ?? '').trim()
        const checkTime = String(r.check_time ?? r.time ?? '').trim()
        const punchedAtUtc = parseLocalDateTimeToUTC(checkTime, deviceTz)

        if (!code || !punchedAtUtc) return null

        return {
          tenant_id: tenantId,
          employee_id: null,
          biometric_employee_code: code,
          punched_at: punchedAtUtc,
          source: 'biometric',
          device_id: deviceId,
          serial_no: deviceSn || null,
          raw_id: rawId,
          meta: {
            sn: deviceSn,
            table: 'ATTLOG',
            device_tz: deviceTz,
            status: r.status ?? 0,
            verify_type: r.verify_type ?? 0,
            raw_check_time: checkTime
          }
        }
      })
      .filter(Boolean)

    const ok = await insertPunches(rows)
    if (ok) await updateLastSeen(deviceId)

    return res.json({ ok: true, ingested: rows.length })
  } catch (e) {
    console.error('receive error:', e?.message || e)
    return res.status(500).json({ ok: false, error: 'internal_error' })
  }
})

// Health: útil para DO
app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    service: 'adms-gateway',
    uptime_s: Math.round(process.uptime()),
    now: new Date().toISOString()
  })
)

// Debug LOCAL (desactívalo en producción: ENABLE_DEBUG=false)
if (ENABLE_DEBUG) {
  app.get('/debug/device', async (req, res) => {
    const sn = String(req.query.sn || '')
    const device = await resolveDeviceBySN(sn)
    res.json({ sn, device, has_default_tenant: !!DEFAULT_TENANT_ID })
  })
}

// 404 controlado
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'not_found', path: req.path })
})

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
})

app.listen(PORT, HOST, () => {
  console.log(`HRCloud ADMS Gateway listening on ${HOST}:${PORT}`)
})

