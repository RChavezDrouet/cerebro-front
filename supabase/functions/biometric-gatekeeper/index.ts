import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function s(v: unknown) {
  return String(v ?? "").trim()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" })
  }

  try {
    let body: any

    try {
      body = await req.json()
    } catch {
      return json(400, { error: "Body inválido: debe ser JSON" })
    }

    const serial_number = s(body.serial_number)
    const employee_id_in = s(body.employee_id)
    const pin = s(body.pin || body.biometric_employee_code)
    const punchType = s(body.type || "in")

    if (!serial_number) {
      return json(400, { error: "serial_number requerido" })
    }

    if (!employee_id_in && !pin) {
      return json(400, {
        error: "Debes enviar employee_id (uuid) o pin/biometric_employee_code",
      })
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SERVICE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SERVICE_ROLE_KEY") ??
      ""

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(500, { error: "Faltan secretos SUPABASE_URL / SERVICE_ROLE" })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: device, error: devErr } = await supabaseAdmin
      .schema("attendance")
      .from("biometric_devices")
      .select("tenant_id, is_active")
      .eq("serial_no", serial_number)
      .maybeSingle()

    if (devErr) {
      return json(500, {
        error: "Error leyendo attendance.biometric_devices",
        details: devErr.message,
      })
    }

    if (!device || device.is_active !== true) {
      return json(403, { error: "No autorizado (dispositivo)" })
    }

    const tenant_id = String(device.tenant_id)
    const nowIso = new Date().toISOString()

    let resolvedEmployeeId: string | null = null
    let unmatched = false
    let unmatchedReason: string | null = null

    if (employee_id_in) {
      resolvedEmployeeId = employee_id_in
    } else if (pin) {
      const { data: employee, error: empErr } = await supabaseAdmin
        .schema("attendance")
        .from("employees")
        .select("id, biometric_employee_code, status")
        .eq("tenant_id", tenant_id)
        .eq("biometric_employee_code", pin)
        .maybeSingle()

      if (empErr) {
        return json(500, {
          error: "Error leyendo attendance.employees",
          details: empErr.message,
        })
      }

      if (employee?.id) {
        resolvedEmployeeId = String(employee.id)
      } else {
        unmatched = true
        unmatchedReason = `PIN ${pin} sin mapeo a empleado`
      }
    }

    const insertRow: Record<string, unknown> = {
      tenant_id,
      punched_at: nowIso,
      source: "biometric",
      serial_no: serial_number,
      biometric_employee_code: pin || null,
      meta: {
        punch_type: punchType,
        employee_id_input: employee_id_in || null,
        pin_input: pin || null,
        received_at: nowIso,
        ...(unmatched ? { unmatched: true, unmatched_reason: unmatchedReason } : {}),
      },
      evidence: {
        ip: req.headers.get("x-forwarded-for") ?? null,
        ua: req.headers.get("user-agent") ?? null,
      },
    }

    if (resolvedEmployeeId) {
      insertRow.employee_id = resolvedEmployeeId
    }

    const { data: punch, error: insErr } = await supabaseAdmin
      .schema("attendance")
      .from("punches")
      .insert(insertRow)
      .select("id, tenant_id, punched_at, employee_id, biometric_employee_code, serial_no")
      .single()

    if (insErr) {
      return json(500, {
        error: "Error insertando attendance.punches",
        details: insErr.message,
        payload: insertRow,
      })
    }

    return json(200, { ok: true, punch })
  } catch (err: any) {
    console.error("UNHANDLED:", err)
    return json(500, { error: err?.message ?? "unknown" })
  }
})
