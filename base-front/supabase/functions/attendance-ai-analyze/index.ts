import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AnalyzeRequest = {
  tenant_id?: string
  work_date: string
  dry_run?: boolean
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function callLLM(provider: string, model: string, prompt: string) {
  if (provider === 'openai' && OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Devuelve JSON válido sin markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? '{}'
  }

  if (provider === 'gemini' && GEMINI_API_KEY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    })
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  }

  return JSON.stringify({ insights: [], anomalies: [] })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const body = (await req.json()) as AnalyzeRequest
  if (!body.work_date) return json({ error: 'work_date es requerido' }, 400)

  let tenantId = body.tenant_id
  if (!tenantId) {
    return json({ error: 'tenant_id es requerido en esta implementación' }, 400)
  }

  const [rulesRs, recordsRs, noveltiesRs] = await Promise.all([
    admin.from('attendance_rules_v2').select('tenant_id, ai_enabled, ai_provider, ai_model, ai_sensitivity_level').eq('tenant_id', tenantId).single(),
    admin.from('attendance_records').select('*').eq('tenant_id', tenantId).eq('work_date', body.work_date),
    admin.from('attendance_novelties').select('*').eq('tenant_id', tenantId).eq('work_date', body.work_date),
  ])

  const rules = rulesRs.data
  if (!rules?.ai_enabled) {
    return json({ ok: false, reason: 'AI deshabilitada para el tenant' }, 412)
  }

  const records = recordsRs.data ?? []
  const novelties = noveltiesRs.data ?? []

  const lateCount = records.filter((r) => r.entry_status === 'ATRASADO').length
  const absentCount = records.filter((r) => r.day_status === 'AUSENTE').length
  const suspiciousCandidates = novelties.filter((n) => ['SOSPECHOSO', 'FUERA_GEOFENCE', 'DOBLE_MARCACION'].includes(n.type))

  const prompt = `
Analiza estos datos de asistencia de HRCloud para ${body.work_date}. Responde JSON con claves insights[] y anomalies[].
Cada anomaly debe tener: employee_code, type, severity, title, description, confidence_score.
Resumen calculado:
- registros: ${JSON.stringify(records)}
- novedades existentes: ${JSON.stringify(novelties)}
- métricas: ${JSON.stringify({ lateCount, absentCount, suspiciousCount: suspiciousCandidates.length, sensitivity: rules.ai_sensitivity_level })}
Detecta:
1) posible suplantación
2) patrón irregular
3) empleado con alta tasa de tardanza
4) combinaciones improbables de entrada/salida
No inventes empleados inexistentes.
  `.trim()

  const raw = await callLLM(rules.ai_provider ?? 'openai', rules.ai_model ?? 'gpt-4.1-mini', prompt)
  let parsed: { insights?: string[]; anomalies?: Array<Record<string, unknown>> } = {}

  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = { insights: ['No se pudo parsear respuesta IA'], anomalies: [] }
  }

  const generated: unknown[] = []
  for (const anomaly of parsed.anomalies ?? []) {
    const employeeCode = String(anomaly.employee_code ?? '')
    if (!employeeCode) continue
    const employee = records.find((r) => r.employee_code === employeeCode)
    if (!employee) continue

    const noveltyPayload = {
      tenant_id: tenantId,
      employee_id: employee.employee_id,
      work_date: body.work_date,
      type: String(anomaly.type ?? 'PATRON_IRREGULAR'),
      severity: String(anomaly.severity ?? 'medium'),
      detected_by: 'ai',
      title: String(anomaly.title ?? 'Anomalía detectada por IA'),
      description: String(anomaly.description ?? 'Sin detalle'),
      confidence_score: Number(anomaly.confidence_score ?? 70),
      evidence: { model: rules.ai_model, provider: rules.ai_provider, prompt_version: 'attendance-ai-analyze/v1' },
    }

    if (!body.dry_run) {
      const { data } = await admin.from('attendance_novelties').insert(noveltyPayload).select('*').single()
      generated.push(data)
    } else {
      generated.push(noveltyPayload)
    }
  }

  await admin.from('audit_logs').insert({
    tenant_id: tenantId,
    module: 'attendance_ai',
    action: 'ATTENDANCE_AI_ANALYZE',
    entity_name: 'attendance.attendance_novelties',
    metadata: {
      work_date: body.work_date,
      dry_run: body.dry_run ?? false,
      insights: parsed.insights ?? [],
      generated_count: generated.length,
      ai_provider: rules.ai_provider,
      ai_model: rules.ai_model,
    },
  })

  return json({ ok: true, tenant_id: tenantId, work_date: body.work_date, insights: parsed.insights ?? [], generated })
})
