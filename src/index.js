import 'dotenv/config'
import express from 'express'
import morgan from 'morgan'
import { getSupabaseAdmin } from './supabase.js'
import { parseAttlogLines } from './zkParser.js'

const PORT = Number(process.env.PORT || 3005)
const TRUST_PROXY = String(process.env.TRUST_PROXY || '0') === '1'
const DEVICE_TZ_DEFAULT = process.env.DEVICE_TIMEZONE || 'America/Guayaquil'
const REJECT_UNKNOWN_SN = String(process.env.REJECT_UNKNOWN_SN || '1') === '1'
const MAX_BODY_KB = Number(process.env.MAX_BODY_KB || 256) // protect memory / abuse

const app = express()
if (TRUST_PROXY) app.set('trust proxy', true)

// Raw text body (ZKTeco often sends text/plain)
app.use(
  express.text({
    type: '*/*',
    limit: `${MAX_BODY_KB}kb`
  })
)

app.use(morgan('combined'))

const supabase = getSupabaseAdmin()

function q(req, key) {
  // Accept both ?SN= and ?sn=
  const v = req.query?.[key] ?? req.query?.[key.toLowerCase()] ?? req.query?.[key.toUpperCase()]
  return Array.isArray(v) ? v[0] : v
}

async function resolveDeviceBySN(sn) {
  if (!sn) return null
  const { data, error } = await supabase
    .from('attendance_biometric_devices')
    .select('id, tenant_id, serial_no, device_timezone, is_active')
    .eq('serial_no', sn)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  if (!data.is_active) return null
  return data
}

async function upsertRaw({ sn, path, method, query, headers, bodyText, deviceId, tenantId }) {
  // Best-effort logging, ignore failures
  try {
    await supabase.from('attendance_biometric_raw').insert({
      tenant_id: tenantId,
      device_id: deviceId,
      serial_no: sn,
      method,
      path,
      query,
      headers,
      body: bodyText
    })
  } catch {
    // ignore
  }
}

app.get('/iclock/cdata', async (req, res) => {
  // handshake: device hits this first
  res.type('text/plain').send('OK')
})

app.post('/iclock/cdata', async (req, res) => {
  const sn = String(q(req, 'SN') || '')
  const table = String(q(req, 'table') || '')

  let device = null
  try {
    device = await resolveDeviceBySN(sn)
  } catch (e) {
    console.error('resolveDeviceBySN error', e)
    return res.status(500).type('text/plain').send('ERROR')
  }

  if (!device && REJECT_UNKNOWN_SN) {
    await upsertRaw({
      sn,
      path: req.path,
      method: req.method,
      query: req.query ?? {},
      headers: req.headers ?? {},
      bodyText: req.body,
      deviceId: null,
      tenantId: null
    })
    return res.status(403).type('text/plain').send('UNKNOWN_DEVICE')
  }

  const tenantId = device?.tenant_id ?? null
  const deviceId = device?.id ?? null
  const deviceTz = device?.device_timezone || DEVICE_TZ_DEFAULT

  // Always log raw (debugging ADMS protocol)
  await upsertRaw({
    sn,
    path: req.path,
    method: req.method,
    query: req.query ?? {},
    headers: req.headers ?? {},
    bodyText: req.body,
    deviceId,
    tenantId
  })

  // ATTLOG is the attendance log table
  if (String(table).toUpperCase() === 'ATTLOG') {
    const events = parseAttlogLines(req.body, deviceTz)

    if (events.length > 0 && tenantId) {
      // Resolve employees by biometric_employee_code (PIN)
      const pins = [...new Set(events.map((e) => e.device_employee_code))]
      // Mapear PIN del dispositivo -> employee_id.
      // Preferimos biometric_employee_code, pero soportamos también employee_code
      // (muy común usar el mismo número de empleado en el biométrico).
      const inList = `(${pins.join(',')})`
      const { data: emps, error: empErr } = await supabase
        .from('employees')
        .select('id, biometric_employee_code, employee_code')
        .eq('tenant_id', tenantId)
        .or(`biometric_employee_code.in.${inList},employee_code.in.${inList}`)

      if (empErr) {
        console.error('employee lookup error', empErr)
      }

      const map = new Map()
      for (const e of emps || []) {
        if (e.biometric_employee_code) map.set(String(e.biometric_employee_code), e.id)
        if (e.employee_code) map.set(String(e.employee_code), e.id)
      }

      const rows = events.map((e) => ({
        tenant_id: tenantId,
        employee_id: map.get(String(e.device_employee_code)) ?? null,
        device_employee_code: String(e.device_employee_code),
        punched_at: e.punched_at_utc,
        source: 'biometric',
        device_id: deviceId,
        raw: { sn, table, device_tz: deviceTz }
      }))

      const { error: insErr } = await supabase.from('attendance_punches').insert(rows)
      if (insErr) {
        console.error('insert attendance_punches error', insErr)
      } else {
        // Update last seen
        await supabase
          .from('attendance_biometric_devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', deviceId)
      }
    }

    // Device expects OK (plain text)
    return res.type('text/plain').send('OK')
  }

  // For other tables/handshakes, just ACK
  return res.type('text/plain').send('OK')
})

app.get('/iclock/getrequest', async (req, res) => {
  // Device polls commands; for MVP we have none.
  res.type('text/plain').send('OK')
})

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`HRCloud ADMS Gateway listening on :${PORT}`)
})
