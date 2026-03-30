import express from 'express'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ override: true })

/* ================================
   ENV VALIDATION
================================ */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PORT = 3005,
  REJECT_UNKNOWN_SN = 'true',
  DEFAULT_TENANT_ID
} = process.env

function maskKey(k) {
  if (!k) return '(empty)'
  return k.slice(0, 10) + '...' + k.slice(-6)
}

function hardFail(msg) {
  console.error(`❌ [ENV] ${msg}`)
  process.exit(1)
}

if (!SUPABASE_URL) hardFail('SUPABASE_URL missing')
if (!SUPABASE_SERVICE_ROLE_KEY) hardFail('SUPABASE_SERVICE_ROLE_KEY missing')

console.log('🧩 [ENV] SUPABASE_URL =', SUPABASE_URL)
console.log('🧩 [ENV] SERVICE_ROLE_KEY =', maskKey(SUPABASE_SERVICE_ROLE_KEY))
console.log('🧩 [ENV] DEFAULT_TENANT_ID =', DEFAULT_TENANT_ID || '(null)')
console.log('🧩 [ENV] REJECT_UNKNOWN_SN =', REJECT_UNKNOWN_SN)

/* ================================
   SUPABASE CLIENT
================================ */

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

/* ================================
   EXPRESS APP
================================ */

const app = express()

app.use(express.text({ type: '*/*', limit: '512kb' }))

/* ================================
   HEALTH CHECK
================================ */

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'adms-gateway',
    uptime_s: process.uptime(),
    now: new Date().toISOString()
  })
})

/* ================================
   RESOLVE TENANT BY SN
================================ */

async function resolveTenantBySN(sn) {
  const { data, error } = await supabase
    .schema('attendance')
    .from('biometric_devices')
    .select('tenant_id')
    .eq('serial_no', sn)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[TENANT LOOKUP ERROR]', error)
    return null
  }

  if (data?.tenant_id) return data.tenant_id

  if (DEFAULT_TENANT_ID) return DEFAULT_TENANT_ID

  return null
}

/* ================================
   ICLOCK HANDLER
================================ */

app.all('/iclock/cdata', async (req, res) => {
  try {
    const sn = req.query.SN
    const table = req.query.table

    if (!sn) {
      return res.status(400).send('MISSING_SN')
    }

    const tenantId = await resolveTenantBySN(sn)

    if (!tenantId) {
      console.warn(`[UNKNOWN_DEVICE] SN=${sn}`)
      if (REJECT_UNKNOWN_SN === 'true') {
        return res.status(403).send('UNKNOWN_DEVICE')
      }
    }

    // Handshake GET
    if (req.method === 'GET') {
      console.log(`🤝 /iclock/cdata handshake SN=${sn}`)
      return res.status(200).send('OK')
    }

    // ATTLOG Processing
    if (table === 'ATTLOG') {
      const rawBody = req.body?.trim()

      if (!rawBody) return res.status(200).send('OK')

      const lines = rawBody.split('\n')

      for (const line of lines) {
        const parts = line.split('\t')

        if (parts.length < 2) continue

        const biometricCode = parts[0]
        const timestampStr = parts[1]

        const punchedAt = new Date(timestampStr)

        // Insert RAW
        await supabase
          .schema('attendance')
          .from('biometric_raw')
          .insert({
            tenant_id: tenantId,
            serial_no: sn,
            payload: line
          })

        // Resolve employee
        const { data: employee, error: empErr } = await supabase
          .schema('attendance')
          .from('employees')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('biometric_employee_code', biometricCode)
          .eq('status', 'active')
          .maybeSingle()

        if (empErr) {
          console.error('[EMPLOYEE LOOKUP ERROR]', empErr)
        }

        const employeeId = employee?.id ?? null

        if (!employeeId) {
          console.warn(`[ATTLOG] Employee not found tenant=${tenantId} pin=${biometricCode}`)
        }

        // Insert Punch
        const { error: punchErr } = await supabase
          .schema('attendance')
          .from('punches')
          .insert({
            tenant_id: tenantId,
            employee_id: employeeId,
            biometric_employee_code: biometricCode,
            punched_at: punchedAt.toISOString(),
            source: 'biometric'
          })

        if (punchErr) {
          console.error('[PUNCH INSERT ERROR]', punchErr)
        }
      }

      return res.status(200).send('OK')
    }

    return res.status(200).send('OK')

  } catch (err) {
    console.error('[GATEWAY ERROR]', err)
    return res.status(500).send('ERROR')
  }
})

/* ================================
   START SERVER
================================ */

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HRCloud ADMS Gateway listening on 0.0.0.0:${PORT}`)
})

