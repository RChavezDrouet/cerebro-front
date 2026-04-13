import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function fromBase64(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function importAesKey(secretBase64: string) {
  const raw = fromBase64(secretBase64)

  if (raw.byteLength !== 32) {
    throw new Error('AI_SETTINGS_ENCRYPTION_KEY debe ser base64 de 32 bytes')
  }

  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function decryptText(cipherText: string, secretBase64: string) {
  const [ivB64, dataB64] = String(cipherText || '').split('.')
  if (!ivB64 || !dataB64) {
    throw new Error('Formato de api_key_encrypted inválido')
  }

  const key = await importAesKey(secretBase64)
  const iv = fromBase64(ivB64)
  const cipherBytes = fromBase64(dataB64)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes,
  )

  return new TextDecoder().decode(plainBuffer)
}

function safeString(value: unknown, fallback = '') {
  if (value == null) return fallback
  return String(value)
}

function asDateStart(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString()
}

function asDateEndExclusive(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function stripCodeFences(text: string) {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p: any) => p?.text || '').join('\n').trim()
}

function tryParseJson(text: string) {
  const cleaned = stripCodeFences(text)
  return JSON.parse(cleaned)
}

type AnalysisType =
  | 'attendance_summary'
  | 'novelties_summary'
  | 'attendance_and_novelties'
  | 'employee_risk'
  | 'daily_exceptions'

type PunchRow = {
  id: string
  tenant_id?: string
  employee_id: string | null
  punched_at: string
  type?: string | null
  source?: string | null
  meta?: Record<string, any> | null
  created_at?: string | null
}

type EmployeeRow = {
  id: string
  tenant_id?: string | null
  full_name?: string | null
  employee_code?: string | null
  department_id?: string | null
  status?: string | null
}

type DerivedNovelty = {
  employee_id: string | null
  employee_name: string
  work_date: string
  novelty_type: string
  severity: 'low' | 'medium' | 'high'
  description: string
}

const managerialHrPrompt = `
Actúa como un Gerente Senior de Recursos Humanos, Cumplimiento Laboral y Control de Asistencia, con enfoque ejecutivo, preventivo y ético.

Tu tarea es analizar marcaciones, novedades y riesgos asociados para apoyar decisiones gerenciales dentro de una empresa, sin inventar información y sin emitir sanciones automáticas.

OBJETIVO DEL ANÁLISIS
Debes producir un análisis gerencial claro, priorizado y accionable sobre:
- patrones de asistencia
- inconsistencias de marcación
- novedades relevantes
- concentración de incidencias por empleado, área o fuente de marcación
- riesgos operativos, de cumplimiento y de control interno
- oportunidades de mejora en reglas, supervisión y gestión de personas

ROL Y TONO
- Escribe como gerente de RR.HH. para gerencia general, administración y jefaturas.
- Usa lenguaje ejecutivo, claro, sobrio y profesional.
- Sé analítico, no alarmista.
- Prioriza prevención, regularización, coaching, trazabilidad y mejora operativa.
- No asumas fraude como hecho salvo que la evidencia sea muy consistente; usa términos como “riesgo”, “indicio”, “patrón”, “anomalía” o “caso que requiere revisión”.

REGLAS CRÍTICAS
1. Usa únicamente la información del dataset recibido.
2. No inventes atrasos, faltas, justificaciones, áreas, empleados ni métricas que no estén presentes o no puedan deducirse razonablemente.
3. Si falta contexto para una conclusión, dilo explícitamente.
4. Si el dataset no incluye horarios, turnos o reglas de tolerancia, no concluyas tardanzas exactas salvo que ya vengan calculadas en estadísticas o novedades.
5. Si el dataset incluye estados como pending, justified o rejected, interprétalos gerencialmente.
6. Si el dataset incluye pending_since o antigüedad de pendientes, úsalo para priorizar riesgo de rezago administrativo.
7. Si el dataset no incluye decisiones de novedad, dilo como limitación.
8. No recomiendes despidos, sanciones o medidas disciplinarias definitivas basadas solo en este análisis.
9. Siempre diferencia entre hallazgos confirmados por data y riesgos o patrones que requieren revisión humana.
10. Mantén consistencia numérica entre summary, findings y totals.

PRIORIDADES DEL ANÁLISIS

A. VISIÓN EJECUTIVA
- panorama general del período
- estabilidad o deterioro del control de asistencia
- gravedad general del período, baja, media o alta, expresada narrativamente
- si el problema es aislado, recurrente o sistémico

B. MARCACIONES
- volumen de marcaciones analizadas
- patrones repetitivos por empleado
- duplicados cercanos
- cantidad impar de IN/OUT
- exceso de marcaciones por día
- registros sin evidencia esperada, por ejemplo geo o serial del dispositivo, si consta
- concentración de incidencias por fuente de marcación: web, biometric, import u otras

C. NOVEDADES
- cantidad total de novedades
- principales tipos de novedad
- severidad predominante
- empleados o áreas con recurrencia
- diferencia entre casos justificados, rechazados y pendientes, si existe esa información
- antigüedad de pendientes y riesgo de acumulación administrativa, si existe esa información

D. RIESGO GERENCIAL
Evalúa con criterio ejecutivo:
- riesgo operativo: inconsistencias que afectan continuidad o control del día laboral
- riesgo de cumplimiento: casos no regularizados o pendientes por demasiado tiempo
- riesgo de control interno: patrones atípicos, duplicados, vacíos de evidencia, alta recurrencia
- riesgo de clima o gestión: reiteración de incidencias en una misma área o persona

E. EMPLEADOS CRÍTICOS
Incluye solo empleados realmente prioritarios según la data.
Para cada empleado crítico:
- employee_id
- employee_name
- risk_level: low, medium o high
- reason: motivo concreto, breve y verificable con el dataset

F. RECOMENDACIONES
Deben ser concretas, accionables y gerenciales.
Prioriza recomendaciones como:
- revisar casos pendientes antiguos
- validar evidencia faltante
- auditar reglas o parametrización
- reforzar control de jefaturas
- solicitar regularización documental
- revisar una fuente específica de marcación
- intervenir un área con recurrencia
- mejorar capacitación o comunicación
No des recomendaciones genéricas ni ambiguas.

INSTRUCCIONES PARA EL RESUMEN
El campo summary debe:
- ser un resumen ejecutivo de un párrafo
- indicar situación general del período
- mencionar si predominan marcaciones normales o incidencias
- mencionar si existe riesgo administrativo por pendientes o inconsistencias
- cerrar con una conclusión breve de gestión

INSTRUCCIONES PARA findings
Cada elemento debe ser una frase ejecutiva, breve y útil.

INSTRUCCIONES PARA critical_employees
- Incluye solo los más relevantes.
- No llenes la lista por llenar.
- Si no hay empleados realmente críticos, devuelve [].

INSTRUCCIONES PARA recommendations
- Lista priorizada
- Máximo 6
- Deben poder convertirse en acciones de RR.HH., supervisión o auditoría operativa

INSTRUCCIONES PARA totals
Debes completar:
- employees_analyzed
- late_count
- inconsistent_count
- novelty_count

IMPORTANTE SOBRE late_count
- Usa late_count solo si el dataset lo trae explícitamente o si la data ya contiene tardanzas calculadas.
- Si no existe evidencia suficiente para calcular tardanzas reales, conserva el valor entregado en stats y no lo inventes.

MANEJO DE DATOS INSUFICIENTES
Si la data es limitada:
- indícalo en summary
- produce findings prudentes
- devuelve recommendations enfocadas en mejora de captura y control
- devuelve JSON completo de todos modos

FORMATO DE RESPUESTA
Debes responder SOLO JSON válido.
No uses markdown.
No uses bloques de código.
No agregues texto fuera del JSON.

Contrato exacto de salida:
{
  "summary": "string",
  "findings": ["string"],
  "critical_employees": [
    {
      "employee_id": "string",
      "employee_name": "string",
      "risk_level": "low | medium | high",
      "reason": "string"
    }
  ],
  "recommendations": ["string"],
  "totals": {
    "employees_analyzed": 0,
    "late_count": 0,
    "inconsistent_count": 0,
    "novelty_count": 0
  }
}
`.trim()

async function isCerebroAdmin(supabaseAdmin: ReturnType<typeof createClient>, user: any) {
  const { data: roleCerebro } = await supabaseAdmin
    .schema('cerebro')
    .from('user_roles')
    .select('role, is_active, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (roleCerebro && roleCerebro.is_active !== false && roleCerebro.role === 'admin') {
    return true
  }

  const { data: rolePublic } = await supabaseAdmin
    .from('user_roles')
    .select('role, is_active, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (rolePublic && rolePublic.is_active !== false && rolePublic.role === 'admin') {
    return true
  }

  return false
}

async function resolveTenantIdForUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  user: any,
  requestedTenantId?: string | null,
) {
  const { data: employeeRow } = await supabaseAdmin
    .from('employees')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (employeeRow?.tenant_id) {
    if (requestedTenantId && requestedTenantId !== employeeRow.tenant_id) {
      throw new Error('El tenant solicitado no coincide con el tenant del usuario')
    }
    return employeeRow.tenant_id as string
  }

  const { data: membershipRow } = await supabaseAdmin
    .schema('attendance')
    .from('memberships')
    .select('tenant_id, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipRow?.tenant_id && membershipRow?.is_active !== false) {
    if (requestedTenantId && requestedTenantId !== membershipRow.tenant_id) {
      throw new Error('El tenant solicitado no coincide con el tenant del usuario')
    }
    return membershipRow.tenant_id as string
  }

  const admin = await isCerebroAdmin(supabaseAdmin, user)
  if (admin && requestedTenantId && isUuid(requestedTenantId)) {
    return requestedTenantId
  }

  throw new Error('No se pudo resolver el tenant del usuario')
}

function deriveNoveltyRows(
  punches: PunchRow[],
  employeesById: Map<string, EmployeeRow>,
): DerivedNovelty[] {
  const novelties: DerivedNovelty[] = []
  const byEmployeeDate = new Map<string, PunchRow[]>()

  for (const punch of punches) {
    const workDate = punch.punched_at.slice(0, 10)
    const key = `${punch.employee_id || 'unknown'}::${workDate}`
    if (!byEmployeeDate.has(key)) byEmployeeDate.set(key, [])
    byEmployeeDate.get(key)!.push(punch)

    const employee = punch.employee_id ? employeesById.get(punch.employee_id) : null
    const employeeName = employee?.full_name || 'Empleado no identificado'

    if ((punch.source || '').toLowerCase() === 'web') {
      const meta = punch.meta || {}
      const hasGeo =
        meta?.geo ||
        meta?.lat ||
        meta?.lng ||
        meta?.latitude ||
        meta?.longitude ||
        (meta?.coords && (meta.coords.lat || meta.coords.lng))

      if (!hasGeo) {
        novelties.push({
          employee_id: punch.employee_id,
          employee_name: employeeName,
          work_date: workDate,
          novelty_type: 'missing_geo',
          severity: 'medium',
          description: 'Marcación web sin evidencia geográfica en meta.',
        })
      }
    }

    if ((punch.source || '').toLowerCase() === 'biometric') {
      const meta = punch.meta || {}
      const serialNo = meta?.serial_no || meta?.serial || meta?.device_serial
      if (!serialNo) {
        novelties.push({
          employee_id: punch.employee_id,
          employee_name: employeeName,
          work_date: workDate,
          novelty_type: 'missing_device_serial',
          severity: 'low',
          description: 'Marcación biométrica sin serial del dispositivo en meta.',
        })
      }
    }
  }

  for (const [, rows] of byEmployeeDate) {
    rows.sort((a, b) => a.punched_at.localeCompare(b.punched_at))
    const first = rows[0]
    const employee = first.employee_id ? employeesById.get(first.employee_id) : null
    const employeeName = employee?.full_name || 'Empleado no identificado'
    const workDate = first.punched_at.slice(0, 10)

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const curr = rows[i]

      const sameType = safeString(prev.type).toLowerCase() === safeString(curr.type).toLowerCase()
      const diffMs = new Date(curr.punched_at).getTime() - new Date(prev.punched_at).getTime()
      const diffMin = diffMs / 1000 / 60

      if (sameType && diffMin >= 0 && diffMin <= 3) {
        novelties.push({
          employee_id: curr.employee_id,
          employee_name: employeeName,
          work_date: workDate,
          novelty_type: 'duplicate_punch',
          severity: 'medium',
          description: `Marcaciones duplicadas de tipo ${curr.type || 'desconocido'} con ${diffMin.toFixed(1)} minutos de diferencia.`,
        })
      }
    }

    const inOutRows = rows.filter((r) => ['in', 'out'].includes(safeString(r.type).toLowerCase()))
    if (inOutRows.length % 2 !== 0) {
      novelties.push({
        employee_id: first.employee_id,
        employee_name: employeeName,
        work_date: workDate,
        novelty_type: 'odd_in_out_count',
        severity: 'high',
        description: `Cantidad impar de marcaciones IN/OUT (${inOutRows.length}) en el día.`,
      })
    }

    if (rows.length >= 10) {
      novelties.push({
        employee_id: first.employee_id,
        employee_name: employeeName,
        work_date: workDate,
        novelty_type: 'excessive_punches',
        severity: 'medium',
        description: `Alto volumen de marcaciones en el día (${rows.length}).`,
      })
    }
  }

  return novelties
}

function makePrompt(params: {
  tenantName: string
  analysisType: AnalysisType
  dateFrom: string
  dateTo: string
  stats: Record<string, any>
  punches: any[]
  novelties: DerivedNovelty[]
  systemPrompt?: string | null
}) {
  const {
    tenantName,
    analysisType,
    dateFrom,
    dateTo,
    stats,
    punches,
    novelties,
    systemPrompt,
  } = params

  const baseSystemPrompt = systemPrompt?.trim() || managerialHrPrompt

  return `
${baseSystemPrompt}

CONTEXTO DEL ANÁLISIS
- Tenant: ${tenantName}
- Período: ${dateFrom} a ${dateTo}
- Tipo de análisis solicitado: ${analysisType}

DATASET DISPONIBLE

Estadísticas calculadas:
${JSON.stringify(stats, null, 2)}

Muestra compacta de marcaciones:
${JSON.stringify(punches, null, 2)}

Novedades derivadas:
${JSON.stringify(novelties, null, 2)}

Recuerda:
- responde SOLO JSON válido
- no inventes datos no presentes
- mantén consistencia entre hallazgos y totals
- enfócate en análisis gerencial de RR.HH.
`.trim()
}

async function callGemini(params: {
  apiKey: string
  model: string
  prompt: string
  baseUrl?: string | null
}) {
  const baseUrl = (params.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')
  const endpoint = `${baseUrl}/models/${encodeURIComponent(params.model)}:generateContent`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  })

  const raw = await res.text()
  const parsed = raw ? JSON.parse(raw) : {}

  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${raw.slice(0, 500)}`)
  }

  const text = extractGeminiText(parsed)
  if (!text) {
    throw new Error('Gemini no devolvió texto utilizable')
  }

  return tryParseJson(text)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const AI_SETTINGS_ENCRYPTION_KEY = Deno.env.get('AI_SETTINGS_ENCRYPTION_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Missing Supabase env vars' }, 500)
    }

    if (!AI_SETTINGS_ENCRYPTION_KEY) {
      return json({ error: 'Missing AI_SETTINGS_ENCRYPTION_KEY' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return json({ error: 'Missing bearer token' }, 401)
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return json(
        {
          error: 'Invalid session',
          details: userError?.message || null,
        },
        401,
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const requestedTenantId = body.tenant_id ? String(body.tenant_id).trim() : null
    const analysisType = safeString(body.analysis_type, 'attendance_and_novelties') as AnalysisType
    const dateFrom = safeString(body.date_from)
    const dateTo = safeString(body.date_to)
    const employeeId = body.employee_id ? String(body.employee_id).trim() : null
    const departmentId = body.department_id ? String(body.department_id).trim() : null
    const includeEvidence = body.include_evidence !== false
    const maxRows = clamp(Number(body.max_rows || 300), 1, 1000)

    if (!dateFrom || !dateTo) {
      return json({ error: 'date_from y date_to son requeridos' }, 400)
    }

    const tenantId = await resolveTenantIdForUser(supabaseAdmin, user, requestedTenantId)

    const { data: iaStatus, error: iaStatusError } = await supabaseAdmin
      .from('v_tenant_ia_status')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (iaStatusError) {
      return json({ error: iaStatusError.message }, 500)
    }

    if (!iaStatus || iaStatus.ia_available !== true) {
      return json({ error: 'La IA no está habilitada para este tenant' }, 403)
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('tenant_ai_settings')
      .select('tenant_id, is_enabled, provider, model, api_key_encrypted, base_url, system_prompt')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (settingsError) {
      return json({ error: settingsError.message }, 500)
    }

    if (!settings || settings.is_enabled !== true) {
      return json({ error: 'tenant_ai_settings no está habilitado' }, 403)
    }

    if (safeString(settings.provider).toLowerCase() !== 'gemini') {
      return json(
        {
          error: 'El tenant no está configurado con provider=gemini',
          provider: settings.provider || null,
        },
        400,
      )
    }

    if (!settings.api_key_encrypted) {
      return json({ error: 'No existe api_key_encrypted para el tenant' }, 400)
    }

    const geminiApiKey = await decryptText(settings.api_key_encrypted, AI_SETTINGS_ENCRYPTION_KEY)

    const fromIso = asDateStart(dateFrom)
    const toIsoExclusive = asDateEndExclusive(dateTo)

    let punchesQuery = supabaseAdmin
      .schema('attendance')
      .from('punches')
      .select('id, tenant_id, employee_id, punched_at, type, source, meta, created_at')
      .eq('tenant_id', tenantId)
      .gte('punched_at', fromIso)
      .lt('punched_at', toIsoExclusive)
      .order('punched_at', { ascending: true })
      .limit(maxRows)

    if (employeeId) {
      punchesQuery = punchesQuery.eq('employee_id', employeeId)
    }

    const { data: punchesData, error: punchesError } = await punchesQuery
    if (punchesError) {
      return json({ error: punchesError.message }, 500)
    }

    const punches = (punchesData || []) as PunchRow[]

    const employeeIds = Array.from(
      new Set(
        punches
          .map((p) => p.employee_id)
          .filter(Boolean),
      ),
    ) as string[]

    const employeesById = new Map<string, EmployeeRow>()

    if (employeeIds.length > 0) {
      const { data: employeesData, error: employeesError } = await supabaseAdmin
        .from('employees')
        .select('id, tenant_id, full_name, employee_code, department_id, status')
        .eq('tenant_id', tenantId)
        .in('id', employeeIds)

      if (!employeesError && Array.isArray(employeesData)) {
        for (const row of employeesData as EmployeeRow[]) {
          employeesById.set(row.id, row)
        }
      }
    }

    let filteredPunches = punches

    if (departmentId) {
      const allowedEmployeeIds = new Set(
        Array.from(employeesById.values())
          .filter((e) => e.department_id === departmentId)
          .map((e) => e.id),
      )
      filteredPunches = punches.filter((p) => p.employee_id && allowedEmployeeIds.has(p.employee_id))
    }

    const novelties = deriveNoveltyRows(filteredPunches, employeesById)

    const uniqueEmployees = new Set(filteredPunches.map((p) => p.employee_id).filter(Boolean))

    const stats = {
      punches_count: filteredPunches.length,
      employees_analyzed: uniqueEmployees.size,
      novelty_count: novelties.length,
      inconsistent_count: novelties.filter((n) => ['high', 'medium'].includes(n.severity)).length,
      late_count: 0,
      sources: filteredPunches.reduce<Record<string, number>>((acc, p) => {
        const key = safeString(p.source, 'unknown').toLowerCase()
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {}),
      types: filteredPunches.reduce<Record<string, number>>((acc, p) => {
        const key = safeString(p.type, 'unknown').toLowerCase()
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {}),
    }

    const punchSample = filteredPunches.slice(0, includeEvidence ? 200 : 100).map((p) => {
      const employee = p.employee_id ? employeesById.get(p.employee_id) : null
      return {
        id: p.id,
        employee_id: p.employee_id,
        employee_name: employee?.full_name || 'Empleado no identificado',
        employee_code: employee?.employee_code || null,
        department_id: employee?.department_id || null,
        punched_at: p.punched_at,
        type: p.type || null,
        source: p.source || null,
        meta: includeEvidence ? (p.meta || null) : null,
      }
    })

    const prompt = makePrompt({
      tenantName: safeString(iaStatus.business_name || 'Tenant'),
      analysisType,
      dateFrom,
      dateTo,
      stats,
      punches: punchSample,
      novelties,
      systemPrompt: settings.system_prompt || null,
    })

    const aiResult = await callGemini({
      apiKey: geminiApiKey,
      model: safeString(settings.model, 'gemini-2.5-flash'),
      prompt,
      baseUrl: settings.base_url || null,
    })

    const analysis = {
      summary: safeString(aiResult?.summary),
      findings: Array.isArray(aiResult?.findings)
        ? aiResult.findings.map((x: any) => safeString(x))
        : [],
      critical_employees: Array.isArray(aiResult?.critical_employees)
        ? aiResult.critical_employees.map((x: any) => ({
            employee_id: safeString(x?.employee_id),
            employee_name: safeString(x?.employee_name),
            risk_level: ['low', 'medium', 'high'].includes(safeString(x?.risk_level).toLowerCase())
              ? safeString(x?.risk_level).toLowerCase()
              : 'medium',
            reason: safeString(x?.reason),
          }))
        : [],
      recommendations: Array.isArray(aiResult?.recommendations)
        ? aiResult.recommendations.map((x: any) => safeString(x))
        : [],
      totals: {
        employees_analyzed: Number(aiResult?.totals?.employees_analyzed ?? stats.employees_analyzed ?? 0),
        late_count: Number(aiResult?.totals?.late_count ?? stats.late_count ?? 0),
        inconsistent_count: Number(aiResult?.totals?.inconsistent_count ?? stats.inconsistent_count ?? 0),
        novelty_count: Number(aiResult?.totals?.novelty_count ?? stats.novelty_count ?? 0),
      },
    }

    return json({
      ok: true,
      provider: 'gemini',
      model: safeString(settings.model, 'gemini-2.5-flash'),
      tenant_id: tenantId,
      analysis_type: analysisType,
      analysis,
      meta: {
        punches_count: filteredPunches.length,
        novelties_count: novelties.length,
        include_evidence: includeEvidence,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json({ error: message }, 500)
  }
})