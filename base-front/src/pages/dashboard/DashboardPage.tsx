import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, CheckCircle, Clock, TrendingUp, DollarSign, Bot, X } from 'lucide-react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLORS_ATRASOS   = ['#E24B4A', '#EF9F27', '#1D9E75', '#378ADD', '#7F77DD']
const COLORS_HE        = ['#7F77DD', '#1D9E75', '#378ADD']
const COLORS_NOVEDADES = ['#EF9F27', '#E24B4A', '#378ADD', '#1D9E75']
const DEPT_COLORS      = ['#E24B4A','#EF9F27','#7F77DD','#1D9E75','#378ADD','#D85A30','#993556']

const NOV_TYPE_COLORS: Record<string, string> = {
  ATRASO:                   '#EF9F27',
  SIN_SALIDA:               '#E24B4A',
  AUSENTE:                  '#378ADD',
  DOBLE_MARCACION:          '#7F77DD',
  FUERA_GEOFENCE:           '#1D9E75',
  PATRON_IRREGULAR:         '#E24B4A',
  HORARIO_NOCTURNO_INUSUAL: '#7F77DD',
}

// Month-specific colors (ene–dic, repeating pattern)
const MONTH_COLORS = [
  '#E24B4A','#D85A30','#BA7517','#1D9E75',
  '#378ADD','#7F77DD','#E24B4A','#D85A30',
  '#BA7517','#1D9E75','#378ADD','#7F77DD',
]
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ─── Types ────────────────────────────────────────────────────────────────────

type Period     = 'hoy' | 'semana' | 'mes' | 'trimestre'
type DrillLevel = 'empresa' | 'area' | 'colaborador'
type Slice      = { label: string; value: number; color: string; empId?: string }

type DailyRow    = { day_status?: string | null }
type DeptRow     = { department_name: string; total: number; a_tiempo: number; atrasado: number; novedad: number }
type RankingRow  = { employee_id?: string; employee_code: string; employee_name: string; total: number; atrasos: number; novedades: number }
type OTRow       = { status: string; count: number }
type NovRow      = { type: string; count: number }
type FineMonthBar = { label: string; amount: number; color: string }
type AbsenceAlert = { employee_id: string; name: string; count: number }
type VacLedgerRow = { movement_type: string; days_delta: number }
type Novedad      = { fecha: string; tipo: string; estado: string }
type EmpPunch     = { id: string; punched_at: string; meta: Record<string, unknown> | null; source: string | null }
type EmpOT        = { requested_date: string; hours_requested: number; hour_type: string; status: string }
type EmpFine      = { incident_date: string; incident_type: string; applied_amount: number; was_capped: boolean }
type EmpMock      = {
  name: string; atrasos_min: number; multas_usd: number; multas_note?: string
  ausencias: number; novedades: Novedad[]; alerta: string; riesgo: 'ALTO' | 'MEDIO' | 'BAJO'
}

// ─── Attendance constants ─────────────────────────────────────────────────────

const ECO_OFFSET_MS = -5 * 60 * 60 * 1000            // UTC → Ecuador (UTC-5)
const ATT_ENTRY_SET = new Set(['in','0','3','4','entrada'])
const ATT_EXIT_SET  = new Set(['out','1','2','5','salida'])
const IN_THRESHOLD  = 8 * 60 + 10                     // 08:10 as minutes-since-midnight

// ─── Period helpers ───────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function periodRange(p: Period): { from: string; to: string } {
  const today = new Date()
  const to = isoDate(today)
  if (p === 'hoy') return { from: to, to }
  if (p === 'semana') {
    const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
    const mon = new Date(today); mon.setDate(today.getDate() - dow)
    return { from: isoDate(mon), to }
  }
  if (p === 'mes') return { from: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`, to }
  // trimestre
  const qStart = Math.floor(today.getMonth() / 3) * 3
  return { from: isoDate(new Date(today.getFullYear(), qStart, 1)), to }
}

function norm(s?: string | null) {
  const v = String(s || '').toUpperCase()
  if (v.includes('ATRAS')) return 'ATRASADO'
  if (v.includes('A_TIEM')) return 'A_TIEMPO'
  if (v.includes('ANTIC')) return 'ANTICIPADA'
  if (v.includes('NOVE')) return 'NOVEDAD'
  return v || '—'
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchDaily(tid: string, from: string, to: string): Promise<DailyRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_daily_attendance_report_v2', { p_tenant_id: tid, p_date_from: from, p_date_to: to })
  if (error) throw error
  return (data ?? []) as DailyRow[]
}

async function fetchDepts(tid: string, from: string, to: string): Promise<DeptRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_kpi_attendance_by_department', { p_tenant_id: tid, p_date_from: from, p_date_to: to })
  if (error) throw error
  return (data ?? []) as DeptRow[]
}

async function fetchRanking(tid: string, from: string, to: string): Promise<RankingRow[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .rpc('get_kpi_ranking', { p_tenant_id: tid, p_date_from: from, p_date_to: to, p_limit: 15 })
  if (error) throw error
  return (data ?? []) as RankingRow[]
}

async function fetchOT(tid: string, from: string, to: string): Promise<OTRow[] | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('overtime_requests')
    .select('status')
    .eq('tenant_id', tid)
    .gte('requested_date', from)
    .lte('requested_date', to)
  if (error) return null
  const counts: Record<string, number> = {}
  for (const r of (data ?? [])) counts[r.status] = (counts[r.status] ?? 0) + 1
  return Object.entries(counts).map(([status, count]) => ({ status, count }))
}

async function fetchNovelties(tid: string, from: string, to: string): Promise<NovRow[] | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('novelties')
    .select('type')
    .eq('tenant_id', tid)
    .gte('date', from)
    .lte('date', to)
  if (error) return null
  const counts: Record<string, number> = {}
  for (const r of (data ?? [])) counts[r.type] = (counts[r.type] ?? 0) + 1
  return Object.entries(counts).map(([type, count]) => ({ type, count }))
}

/**
 * Compute novelties directly from attendance.punches:
 *   ATRASO         — earliest 'in' punch after 08:10 Ecuador time
 *   SIN_SALIDA     — has 'in' but no 'out' on a past calendar day
 *   AUSENTE        — active employee with no punch on a working day (Mon–Fri, past days only)
 *   DOBLE_MARCACION — 2+ 'in' or 2+ 'out' on the same day
 */
async function fetchNoveltiesFromPunches(tid: string, from: string, to: string): Promise<NovRow[]> {
  const ECO_OFFSET  = -5 * 60 * 60 * 1000                       // UTC → Ecuador (UTC-5)
  const ENTRY_SET   = new Set(['in', '0', '3', '4', 'entrada'])  // lowercased
  const EXIT_SET    = new Set(['out', '1', '2', '5', 'salida'])  // lowercased
  const IN_THRESHOLD = 8 * 60 + 10                               // 08:10 as minutes-since-midnight

  const desdeUTC = new Date(`${from}T00:00:00-05:00`).toISOString()
  const hastaUTC = new Date(`${to}T23:59:59-05:00`).toISOString()

  const [{ data: punchData }, { data: empData }] = await Promise.all([
    supabase.schema(ATT_SCHEMA).from('punches')
      .select('employee_id, punched_at, meta')
      .eq('tenant_id', tid)
      .gte('punched_at', desdeUTC)
      .lte('punched_at', hastaUTC),
    supabase.schema(ATT_SCHEMA).from('employees_legacy')
      .select('id')
      .eq('tenant_id', tid),
  ])

  const allEmpIds = (empData ?? []).map((e: Record<string, unknown>) => String(e.id))

  // empId → dateStr (Ecuador) → { ins (min-of-day), outCount, inCount }
  type DaySlot = { ins: number[]; inCount: number; outCount: number }
  const byEmpDay = new Map<string, Map<string, DaySlot>>()

  for (const p of (punchData ?? [])) {
    const ecoMs  = new Date(String(p.punched_at)).getTime() + ECO_OFFSET
    const ecoD   = new Date(ecoMs)
    const yy     = ecoD.getUTCFullYear()
    const mm     = pad(ecoD.getUTCMonth() + 1)
    const dd     = pad(ecoD.getUTCDate())
    const dateStr = `${yy}-${mm}-${dd}`
    const minOfDay = ecoD.getUTCHours() * 60 + ecoD.getUTCMinutes()

    const empId = String(p.employee_id)
    if (!byEmpDay.has(empId)) byEmpDay.set(empId, new Map())
    const dm = byEmpDay.get(empId)!
    if (!dm.has(dateStr)) dm.set(dateStr, { ins: [], inCount: 0, outCount: 0 })
    const slot = dm.get(dateStr)!

    const mt = String((p.meta as Record<string, unknown> | null)?.['type'] ?? '').toLowerCase()
    if (ENTRY_SET.has(mt)) { slot.inCount++;  slot.ins.push(minOfDay) }
    else if (EXIT_SET.has(mt)) { slot.outCount++ }
  }

  const todayStr = isoDate(new Date())

  let atrasoCount = 0, sinSalidaCount = 0, dobleMarcacionCount = 0

  for (const [, dm] of byEmpDay) {
    for (const [dateStr, slot] of dm) {
      // ATRASO — earliest entry after 08:10
      if (slot.ins.length > 0 && Math.min(...slot.ins) > IN_THRESHOLD) atrasoCount++
      // SIN_SALIDA — has entries but zero exits, past day only
      if (slot.inCount > 0 && slot.outCount === 0 && dateStr < todayStr) sinSalidaCount++
      // DOBLE_MARCACION — 2+ entries or 2+ exits
      if (slot.inCount >= 2 || slot.outCount >= 2) dobleMarcacionCount++
    }
  }

  // AUSENTE — (employee, working_day) pairs with no punch at all
  // Only Mon–Fri, strictly before today
  let ausenteCount = 0
  const cur = new Date(`${from}T12:00:00Z`)
  const end = new Date(`${to}T12:00:00Z`)
  while (cur <= end) {
    const dow = cur.getUTCDay()                                              // 0=Sun
    const ds  = `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth()+1)}-${pad(cur.getUTCDate())}`
    if (dow >= 1 && dow <= 5 && ds < todayStr) {
      for (const empId of allEmpIds) {
        if (!byEmpDay.get(empId)?.has(ds)) ausenteCount++
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  const result: NovRow[] = []
  if (atrasoCount > 0)         result.push({ type: 'ATRASO',         count: atrasoCount         })
  if (sinSalidaCount > 0)      result.push({ type: 'SIN_SALIDA',      count: sinSalidaCount      })
  if (ausenteCount > 0)        result.push({ type: 'AUSENTE',         count: ausenteCount        })
  if (dobleMarcacionCount > 0) result.push({ type: 'DOBLE_MARCACION', count: dobleMarcacionCount })
  return result
}

async function fetchFines(tid: string, from: string, to: string): Promise<number | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('fine_ledger')
    .select('applied_amount')
    .eq('tenant_id', tid)
    .gte('incident_date', from)
    .lte('incident_date', to)
  if (error) return null
  return (data ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.applied_amount ?? 0), 0)
}

/** Fine totals grouped by month — for bar chart. Returns null if table doesn't exist. */
async function fetchFinesByMonth(tid: string): Promise<FineMonthBar[] | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('fine_ledger')
    .select('month_year, applied_amount')
    .eq('tenant_id', tid)
    .order('month_year', { ascending: true })
  if (error) return null
  const byMonth: Record<string, number> = {}
  for (const r of (data ?? [])) {
    const my = String(r.month_year ?? '')
    byMonth[my] = (byMonth[my] ?? 0) + Number(r.applied_amount ?? 0)
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([my, amount]) => {
      const moIdx = parseInt(my.slice(5, 7), 10) - 1
      return {
        label:  MONTH_NAMES[moIdx] ?? my,
        amount,
        color:  MONTH_COLORS[moIdx] ?? '#378ADD',
      }
    })
}

/** Employees with 3+ AUSENCIA_INJUSTIFICADA in fine_ledger. */
async function fetchAbsenceAlerts(tid: string, from: string, to: string): Promise<AbsenceAlert[] | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('fine_ledger')
    .select('employee_id, incident_type')
    .eq('tenant_id', tid)
    .eq('incident_type', 'AUSENCIA_INJUSTIFICADA')
    .gte('incident_date', from)
    .lte('incident_date', to)
  if (error) return null
  const byEmp: Record<string, number> = {}
  for (const r of (data ?? [])) {
    byEmp[r.employee_id] = (byEmp[r.employee_id] ?? 0) + 1
  }
  const alarming = Object.entries(byEmp).filter(([, c]) => c >= 3)
  if (!alarming.length) return []
  const { data: emps } = await supabase
    .schema(ATT_SCHEMA)
    .from('employees_legacy')
    .select('id, first_name, last_name')
    .in('id', alarming.map(([id]) => id))
    .eq('tenant_id', tid)
  const nameMap = new Map(
    (emps ?? []).map((e: Record<string, string>) => [e.id, `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()])
  )
  return alarming.map(([id, count]) => ({
    employee_id: id,
    name: nameMap.get(id) ?? id.slice(0, 8) + '…',
    count,
  }))
}

/** Vacation ledger for KPIs. Returns null if table doesn't exist. */
async function fetchVacLedger(tid: string): Promise<VacLedgerRow[] | null> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('vacation_ledger')
    .select('movement_type, days_delta')
    .eq('tenant_id', tid)
  if (error) return null
  return (data ?? []) as VacLedgerRow[]
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function darkenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${h(r * 0.52)}${h(g * 0.52)}${h(b * 0.52)}`
}
function hexAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
function lightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, Math.round(r * 1.35))},${Math.min(255, Math.round(g * 1.35))},${Math.min(255, Math.round(b * 1.35))})`
}

// ─── Canvas 3D Donut ──────────────────────────────────────────────────────────

interface Donut3DProps { slices: Slice[]; size?: number }

const Donut3D: React.FC<Donut3DProps> = ({ slices, size = 160 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef(0)
  const angleRef  = useRef(0)
  const slicesRef = useRef(slices)
  slicesRef.current = slices

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const rawCtx = canvasEl.getContext('2d')
    if (!rawCtx) return
    const cvs: HTMLCanvasElement        = canvasEl
    const ctx: CanvasRenderingContext2D = rawCtx

    const DEPTH = 14
    const W  = size
    const H  = size + DEPTH
    const R  = size * 0.42
    const r  = R * 0.55
    const cx = W / 2
    const cy = (H - DEPTH) / 2

    function annular(ox: number, oy: number, outer: number, inner: number, sa: number, ea: number, fill: string) {
      ctx.beginPath(); ctx.arc(ox, oy, outer, sa, ea); ctx.arc(ox, oy, inner, ea, sa, true)
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
    }

    function frame() {
      cvs.width = W; cvs.height = H
      ctx.clearRect(0, 0, W, H)
      const data  = slicesRef.current
      const total = data.reduce((s, sl) => s + sl.value, 0) || 1
      const rot   = angleRef.current
      type Arc = { sa: number; ea: number; color: string; value: number }
      const arcs: Arc[] = []
      let cur = rot
      for (const sl of data) {
        if (sl.value <= 0) continue
        const sweep = (sl.value / total) * Math.PI * 2
        arcs.push({ sa: cur, ea: cur + sweep, color: sl.color, value: sl.value })
        cur += sweep
      }
      for (const a of arcs) annular(cx, cy + DEPTH, R, r, a.sa, a.ea, darkenHex(a.color))
      for (const a of arcs) {
        ctx.beginPath(); ctx.arc(cx, cy + DEPTH, R, a.sa, a.ea); ctx.arc(cx, cy, R, a.ea, a.sa, true)
        ctx.closePath()
        const grd = ctx.createLinearGradient(cx, cy, cx, cy + DEPTH)
        grd.addColorStop(0, hexAlpha(a.color, 0.73)); grd.addColorStop(1, hexAlpha(darkenHex(a.color), 0.53))
        ctx.fillStyle = grd; ctx.fill()
      }
      for (const a of arcs) {
        annular(cx, cy, R, r, a.sa, a.ea, a.color)
        ctx.beginPath(); ctx.arc(cx, cy, R - 1, a.sa, a.ea); ctx.arc(cx, cy, R - 5, a.ea, a.sa, true)
        ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()
      }
      if (arcs.length > 1) {
        for (const a of arcs) {
          ctx.beginPath()
          ctx.moveTo(cx + r * Math.cos(a.sa), cy + r * Math.sin(a.sa))
          ctx.lineTo(cx + R * Math.cos(a.sa), cy + R * Math.sin(a.sa))
          ctx.strokeStyle = 'rgba(8,18,38,0.75)'; ctx.lineWidth = 1.5; ctx.stroke()
        }
      }
      ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
      ctx.fillStyle = 'rgb(14,22,40)'; ctx.fill()
      const displayTotal = data.reduce((s, sl) => s + sl.value, 0)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.42)'; ctx.font = `10px system-ui,sans-serif`
      ctx.fillText('Total', cx, cy - 10)
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `bold 20px system-ui,sans-serif`
      ctx.fillText(String(displayTotal), cx, cy + 9)
      angleRef.current += 0.008
      frameRef.current = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(frameRef.current)
  }, [size])

  return <canvas ref={canvasRef} width={size} height={size + 14} className="mx-auto block" />
}

// ─── Canvas 3D Isometric Bar Chart ────────────────────────────────────────────

interface BarChart3DIsoProps { bars: FineMonthBar[] }

const BarChart3DIso: React.FC<BarChart3DIsoProps> = ({ bars }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const growRef   = useRef(0)
  const frameRef  = useRef(0)
  const barsRef   = useRef(bars)
  barsRef.current = bars

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const rawCtx = canvasEl.getContext('2d')
    if (!rawCtx) return
    const cvs: HTMLCanvasElement        = canvasEl
    const ctx: CanvasRenderingContext2D = rawCtx

    const W       = cvs.offsetWidth || 360
    const H       = 200
    const PAD_L   = 32
    const PAD_R   = 20
    const PAD_T   = 20
    const PAD_B   = 32
    const ISO_DX  = 10
    const ISO_DY  = 8
    const MAX_H   = H - PAD_T - PAD_B - ISO_DY
    const BASE_Y  = H - PAD_B

    growRef.current = 0

    function frame() {
      growRef.current = Math.min(1, growRef.current + 0.04)   // ~25 frames to full height
      const grow = growRef.current

      const data = barsRef.current
      if (!data.length) return

      cvs.width  = W
      cvs.height = H
      ctx.clearRect(0, 0, W, H)

      const maxAmt = Math.max(...data.map(b => b.amount), 1)
      const totalBarW = W - PAD_L - PAD_R - ISO_DX
      const barW  = Math.max(8, Math.floor(totalBarW / data.length) - 4)
      const gap   = Math.floor((totalBarW - barW * data.length) / Math.max(data.length - 1, 1))

      // Draw baseline
      ctx.beginPath()
      ctx.moveTo(PAD_L, BASE_Y); ctx.lineTo(W - PAD_R, BASE_Y)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke()

      // Draw Y-axis hint lines
      for (let i = 1; i <= 3; i++) {
        const y = BASE_Y - (MAX_H * i / 3)
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.stroke()
      }

      data.forEach((bar, i) => {
        const barH = Math.max(2, (bar.amount / maxAmt) * MAX_H * grow)
        const x = PAD_L + i * (barW + gap)
        const topY = BASE_Y - barH

        // Right side face (darker)
        ctx.beginPath()
        ctx.moveTo(x + barW,          topY)
        ctx.lineTo(x + barW + ISO_DX, topY - ISO_DY)
        ctx.lineTo(x + barW + ISO_DX, BASE_Y - ISO_DY)
        ctx.lineTo(x + barW,          BASE_Y)
        ctx.closePath()
        ctx.fillStyle = darkenHex(bar.color)
        ctx.fill()

        // Front face (main color)
        ctx.fillStyle = bar.color
        ctx.fillRect(x, topY, barW, barH)

        // Top face (lighter — parallelogram)
        ctx.beginPath()
        ctx.moveTo(x,          topY)
        ctx.lineTo(x + barW,   topY)
        ctx.lineTo(x + barW + ISO_DX, topY - ISO_DY)
        ctx.lineTo(x + ISO_DX, topY - ISO_DY)
        ctx.closePath()
        ctx.fillStyle = lightenHex(bar.color)
        ctx.fill()

        // Label below baseline
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.font = `10px system-ui,sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(bar.label, x + barW / 2, BASE_Y + 14)

        // Amount label on top (only when grown > 0.7)
        if (grow > 0.7 && bar.amount > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.font = `bold 9px system-ui,sans-serif`
          ctx.fillText(`$${bar.amount.toFixed(0)}`, x + barW / 2, topY - ISO_DY - 4)
        }
      })

      // Y-axis label
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = `9px system-ui,sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(`max $${maxAmt.toFixed(0)}`, 2, PAD_T + 4)

      if (grow < 1) frameRef.current = requestAnimationFrame(frame)
    }

    frame()
    return () => cancelAnimationFrame(frameRef.current)
  }, [bars])   // restart animation when bars change

  return <canvas ref={canvasRef} className="w-full" height={200} />
}

// ─── EmpRealModal — tabs Resumen | Marcaciones | Novedades ───────────────────

function EmpRealModal({ empId, empName, tenantId, from, to, onClose, onViewReports }: {
  empId: string; empName: string; tenantId: string
  from: string; to: string
  onClose: () => void; onViewReports: () => void
}) {
  const [tab, setTab] = useState<'resumen' | 'marcaciones' | 'novedades'>('resumen')

  const punchQ = useQuery({
    queryKey: ['emp-modal-punch', empId, from, to],
    queryFn: async (): Promise<EmpPunch[]> => {
      const desdeUTC = new Date(`${from}T00:00:00-05:00`).toISOString()
      const hastaUTC = new Date(`${to}T23:59:59-05:00`).toISOString()
      const { data } = await supabase.schema(ATT_SCHEMA).from('punches')
        .select('id, punched_at, meta, source')
        .eq('tenant_id', tenantId).eq('employee_id', empId)
        .gte('punched_at', desdeUTC).lte('punched_at', hastaUTC)
        .order('punched_at')
      return (data ?? []) as EmpPunch[]
    }, staleTime: 60_000,
  })

  const otQ = useQuery({
    queryKey: ['emp-modal-ot', empId, from, to],
    queryFn: async (): Promise<EmpOT[] | null> => {
      const { data, error } = await supabase.schema(ATT_SCHEMA).from('overtime_requests')
        .select('requested_date, hours_requested, hour_type, status')
        .eq('tenant_id', tenantId).eq('employee_id', empId)
        .gte('requested_date', from).lte('requested_date', to)
        .order('requested_date')
      if (error) return null
      return (data ?? []) as EmpOT[]
    }, staleTime: 60_000,
  })

  const fineQ = useQuery({
    queryKey: ['emp-modal-fine', empId, from, to],
    queryFn: async (): Promise<EmpFine[] | null> => {
      const { data, error } = await supabase.schema(ATT_SCHEMA).from('fine_ledger')
        .select('incident_date, incident_type, applied_amount, was_capped')
        .eq('tenant_id', tenantId).eq('employee_id', empId)
        .gte('incident_date', from).lte('incident_date', to)
        .order('incident_date')
      if (error) return null
      return (data ?? []) as EmpFine[]
    }, staleTime: 60_000,
  })

  const todayStr = isoDate(new Date())

  const stats = useMemo(() => {
    type DS = { ins: number[]; outs: number[] }
    const byDay: Record<string, DS> = {}

    for (const p of (punchQ.data ?? [])) {
      const ecoMs = new Date(p.punched_at).getTime() + ECO_OFFSET_MS
      const d  = new Date(ecoMs)
      const ds = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`
      const min = d.getUTCHours() * 60 + d.getUTCMinutes()
      const mt  = String(p.meta?.['type'] ?? '').toLowerCase()
      if (!byDay[ds]) byDay[ds] = { ins: [], outs: [] }
      if (ATT_ENTRY_SET.has(mt))      byDay[ds].ins.push(min)
      else if (ATT_EXIT_SET.has(mt))  byDay[ds].outs.push(min)
    }

    let atrasoDays = 0, lateMin = 0, hoursMin = 0
    const novList: { date: string; tipo: string; detail: string }[] = []

    for (const [ds, slot] of Object.entries(byDay)) {
      const ins  = [...slot.ins].sort((a, b) => a - b)
      const outs = [...slot.outs].sort((a, b) => a - b)
      if (ins.length > 0 && ins[0] > IN_THRESHOLD) {
        atrasoDays++; lateMin += ins[0] - IN_THRESHOLD
        novList.push({ date: ds, tipo: 'ATRASO', detail: `${ins[0] - IN_THRESHOLD} min tarde` })
      }
      if (ins.length > 0 && outs.length === 0 && ds < todayStr) {
        novList.push({ date: ds, tipo: 'SIN_SALIDA', detail: 'Sin punch de salida' })
      }
      const pairs = Math.min(ins.length, outs.length)
      for (let i = 0; i < pairs; i++) if (outs[i] > ins[i]) hoursMin += outs[i] - ins[i]
    }

    novList.sort((a, b) => a.date.localeCompare(b.date))
    const totalFines = (fineQ.data ?? []).reduce((s, r) => s + Number(r.applied_amount ?? 0), 0)
    const heApproved = (otQ.data ?? [])?.filter(r => r.status === 'approved')
      .reduce((s, r) => s + Number(r.hours_requested ?? 0), 0) ?? 0

    return { punches: punchQ.data?.length ?? 0, atrasoDays, lateMin, hoursMin, totalFines, heApproved, novList }
  }, [punchQ.data, fineQ.data, otQ.data, todayStr])

  function fmtEco(utcStr: string) {
    const d = new Date(new Date(utcStr).getTime() + ECO_OFFSET_MS)
    return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
  }
  function fmtHrs(mins: number) { const h = Math.floor(mins/60), m = mins%60; return h > 0 ? `${h}h ${m}m` : `${m}m` }

  const isLoading = punchQ.isLoading || otQ.isLoading || fineQ.isLoading
  const TABS = [
    { key: 'resumen', label: 'Resumen' }, { key: 'marcaciones', label: 'Marcaciones' }, { key: 'novedades', label: 'Novedades' },
  ] as const

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0e1628] border border-white/10 rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">{empName}</h2>
            <p className="text-xs text-white/35 mt-0.5">{from} — {to}</p>
          </div>
          <button onClick={onClose} className="text-white/35 hover:text-white/80 transition-colors"><X size={17} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 shrink-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t.key ? 'text-blue-400 border-b-2 border-blue-400 -mb-px' : 'text-white/40 hover:text-white/60'
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-white/30 text-sm">Cargando…</div>
          ) : tab === 'resumen' ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Marcaciones',  value: stats.punches,                    color: 'text-white'    },
                  { label: 'Días atrasado',value: stats.atrasoDays,                 color: 'text-amber-400'},
                  { label: 'Min tardanza', value: stats.lateMin > 0 ? `${stats.lateMin}m` : '0m', color: 'text-amber-400'},
                  { label: 'Horas trab.',  value: fmtHrs(stats.hoursMin),           color: 'text-green-400'},
                  { label: 'HE aprobadas', value: `${stats.heApproved}h`,           color: 'text-purple-400'},
                  { label: 'Multas $',     value: `$${stats.totalFines.toFixed(2)}`,color: 'text-rose-400' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-white/35 mb-0.5">{kpi.label}</p>
                    <p className={`text-base font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>
              {otQ.data === null && <p className="text-[11px] text-amber-400/70"><code className="text-[10px]">overtime_requests</code> — pendiente C-5</p>}
              {fineQ.data === null && <p className="text-[11px] text-amber-400/70"><code className="text-[10px]">fine_ledger</code> — pendiente C-4</p>}
            </>
          ) : tab === 'marcaciones' ? (
            (punchQ.data ?? []).length === 0 ? (
              <div className="py-10 text-center text-xs text-white/25">Sin marcaciones en el período</div>
            ) : (
              <div className="space-y-1">
                {(punchQ.data ?? []).map((p, i) => {
                  const { date, time } = fmtEco(p.punched_at)
                  const mt = String(p.meta?.['type'] ?? '').toLowerCase()
                  const isEntry = ATT_ENTRY_SET.has(mt)
                  return (
                    <div key={i} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 text-xs">
                      <span className="font-mono text-white/35 w-24 shrink-0">{date}</span>
                      <span className="font-mono font-semibold text-white/75 w-12 shrink-0">{time}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${isEntry ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {isEntry ? 'Entrada' : 'Salida'}
                      </span>
                      <span className="text-white/35 truncate capitalize">{p.source ?? '—'}</span>
                    </div>
                  )
                })}
              </div>
            )
          ) : ( /* novedades */
            <div className="space-y-4">
              {stats.novList.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/25">Sin anomalías detectadas en punches</div>
              ) : (
                <div>
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-2">Anomalías en punches</p>
                  <div className="space-y-1.5">
                    {stats.novList.map((n, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 text-xs">
                        <span className="font-mono text-white/35 w-24 shrink-0">{n.date}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${n.tipo === 'ATRASO' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>{n.tipo}</span>
                        <span className="text-white/55">{n.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fineQ.data === null ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-400">
                  <code className="font-mono">attendance.fine_ledger</code> — pendiente Sesión C-4
                </div>
              ) : (fineQ.data?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-2">Multas registradas</p>
                  <div className="space-y-1.5">
                    {(fineQ.data ?? []).map((f, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 text-xs">
                        <span className="font-mono text-white/35 w-24 shrink-0">{f.incident_date}</span>
                        <span className="text-white/55 flex-1 truncate">{f.incident_type}</span>
                        <span className="font-mono font-bold text-rose-400">${Number(f.applied_amount).toFixed(2)}</span>
                        {f.was_capped && <span className="text-[10px] text-white/30">cap</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {otQ.data !== null && !!otQ.data?.length && (
                <div>
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-2">Solicitudes HE</p>
                  <div className="space-y-1.5">
                    {(otQ.data ?? []).map((ot, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 text-xs">
                        <span className="font-mono text-white/35 w-24 shrink-0">{ot.requested_date}</span>
                        <span className="text-white/55 flex-1">{ot.hour_type} · {ot.hours_requested}h</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ot.status === 'approved' ? 'bg-green-500/20 text-green-400' : ot.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>{ot.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10 shrink-0">
          <button onClick={onViewReports}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors">
            Ver marcaciones completas
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm text-white/45 hover:text-white/75 rounded-xl hover:bg-white/5 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── EmpDetailModal ───────────────────────────────────────────────────────────

const RIESGO_STYLES: Record<string, { badge: string; dot: string }> = {
  ALTO:  { badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',  dot: '#E24B4A' },
  MEDIO: { badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30', dot: '#EF9F27' },
  BAJO:  { badge: 'bg-green-500/20 text-green-400 border border-green-500/30', dot: '#1D9E75' },
}

function EmpDetailModal({ emp, onClose, onViewReports }: {
  emp: EmpMock; onClose: () => void; onViewReports: () => void
}) {
  const rc = RIESGO_STYLES[emp.riesgo]
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0e1628] border border-white/10 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-white">{emp.name}</h2>
            <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${rc.badge}`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: rc.dot }} />
              Riesgo {emp.riesgo}
            </span>
          </div>
          <button onClick={onClose} className="text-white/35 hover:text-white/80 transition-colors mt-0.5">
            <X size={17} />
          </button>
        </div>

        {/* KPI mini-row */}
        <div className="grid grid-cols-3 divide-x divide-white/10 py-4">
          <div className="px-5">
            <p className="text-[10px] text-white/40 mb-0.5">Atrasos</p>
            <p className="text-xl font-bold text-amber-400">{emp.atrasos_min}<span className="text-xs font-normal ml-1 text-white/35">min</span></p>
          </div>
          <div className="px-5">
            <p className="text-[10px] text-white/40 mb-0.5">Multas</p>
            <p className="text-xl font-bold text-rose-400">${emp.multas_usd.toFixed(2)}</p>
            {emp.multas_note && <p className="text-[10px] text-white/30 -mt-0.5">{emp.multas_note}</p>}
          </div>
          <div className="px-5">
            <p className="text-[10px] text-white/40 mb-0.5">Ausencias</p>
            <p className="text-xl font-bold text-blue-400">{emp.ausencias}</p>
          </div>
        </div>

        {/* Novedades */}
        <div className="px-6 pb-4">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-widest mb-2">Historial</p>
          <div className="space-y-1.5">
            {emp.novedades.map((n, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 text-xs">
                <span className="font-mono text-white/35 shrink-0 w-24">{n.fecha}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                  n.tipo === 'AUSENCIA' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                }`}>{n.tipo}</span>
                <span className="text-white/55 truncate">{n.estado}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI alert */}
        <div className="px-6 pb-4">
          <div
            className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            style={{ borderLeftWidth: 3, borderLeftColor: '#7F77DD' }}
          >
            <Bot size={14} className="mt-0.5 shrink-0" style={{ color: '#7F77DD' }} />
            <p className="text-xs text-white/65 leading-relaxed">
              <span className="font-semibold" style={{ color: '#7F77DD' }}>IA detecta: </span>
              {emp.alerta}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 pb-5">
          <button
            onClick={onViewReports}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
          >
            Ver marcaciones completas
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-white/45 hover:text-white/75 rounded-xl hover:bg-white/5 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DonutCard (drill-down wrapper) ──────────────────────────────────────────

const LEVEL_NEXT: Record<DrillLevel, string> = {
  empresa: 'Área', area: 'Colaborador', colaborador: 'marcaciones'
}

interface DonutCardProps {
  title: string; empresaSlices: Slice[]
  areaSlices: (item: string) => Slice[]; empSlices: (area: string, item: string) => Slice[]
  onCollaborator: (empId?: string) => void
  pending?: boolean; pendingSession?: string; pendingTable?: string
}

const DonutCard: React.FC<DonutCardProps> = ({
  title, empresaSlices, areaSlices, empSlices, onCollaborator,
  pending, pendingSession, pendingTable,
}) => {
  const [level, setLevel] = useState<DrillLevel>('empresa')
  const [path,  setPath]  = useState<string[]>([])

  const currentSlices = useMemo((): Slice[] => {
    if (level === 'empresa') return empresaSlices
    if (level === 'area')    return areaSlices(path[0])
    return empSlices(path[0], path[1])
  }, [level, path, empresaSlices, areaSlices, empSlices])

  const handleClick = useCallback((sl: Slice) => {
    console.log('CLICK legend item:', sl.label, sl.empId ?? '(no empId)', '| level:', level)
    if (level === 'empresa') { setLevel('area'); setPath([sl.label]) }
    else if (level === 'area') { setLevel('colaborador'); setPath(p => [p[0], sl.label]) }
    else onCollaborator(sl.empId ?? sl.label)
  }, [level, onCollaborator])

  function drillUp(to: DrillLevel) {
    setLevel(to); setPath(to === 'empresa' ? [] : p => p.slice(0, 1))
  }

  const total = currentSlices.reduce((s, sl) => s + sl.value, 0) || 1

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm text-white">{title}</h3>
        <nav className="flex items-center gap-1 text-[11px] text-white/35 flex-wrap justify-end">
          <button onClick={() => drillUp('empresa')}
            className={`hover:text-white/70 transition-colors ${level === 'empresa' ? 'text-white/75 font-medium' : 'cursor-pointer'}`}>
            Empresa
          </button>
          {path[0] && (<><span className="text-white/20">›</span>
            <button onClick={() => drillUp('area')}
              className={`hover:text-white/70 transition-colors max-w-[80px] truncate ${level === 'area' ? 'text-white/75 font-medium' : 'cursor-pointer'}`}>
              {path[0]}
            </button></>)}
          {path[1] && (<><span className="text-white/20">›</span>
            <span className="text-white/75 font-medium max-w-[80px] truncate">{path[1]}</span></>)}
        </nav>
      </div>

      {pending ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-5 text-xs text-amber-400 text-center space-y-1">
            <p className="font-medium">Tabla pendiente</p>
            <code className="block text-[10px] font-mono opacity-70">{pendingTable}</code>
            {pendingSession && <p className="opacity-60">{pendingSession}</p>}
          </div>
        </div>
      ) : currentSlices.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8 text-xs text-white/25">Sin datos</div>
      ) : (
        <>
          <Donut3D slices={currentSlices} size={160} />
          <div className="space-y-1">
            {currentSlices.map((sl, i) => {
              const pct = Math.round((sl.value / total) * 100)
              return (
                <button key={i} onClick={() => handleClick(sl)}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/10 transition-colors text-left group">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
                  <span className="flex-1 text-white/65 group-hover:text-white truncate">{sl.label}</span>
                  <span className="font-mono text-white/50 tabular-nums">{sl.value}</span>
                  <span className="font-mono text-white/30 w-8 text-right tabular-nums">{pct}%</span>
                  <span className="text-white/20 group-hover:text-white/60 transition-colors">›</span>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-white/20 text-center">
            {level === 'colaborador'
              ? 'Click en colaborador → marcaciones'
              : `Click → desglose por ${LEVEL_NEXT[level]}`}
          </p>
        </>
      )}
    </div>
  )
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`p-1.5 rounded-lg ${accent}`}>{icon}</span>
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-white/35 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  hoy: 'Hoy', semana: 'Semana', mes: 'Mes', trimestre: 'Trimestre',
}
const PERIODS: Period[] = ['hoy', 'semana', 'mes', 'trimestre']

const OT_LABELS: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado', compensated: 'Compensado',
}
const NOV_LABELS: Record<string, string> = {
  ATRASO: 'Atraso', AUSENCIA: 'Ausencia', DOBLE_MARCACION: 'Doble marcación',
  SIN_SALIDA: 'Sin salida', FUERA_GEOFENCE: 'Fuera zona', PATRON_IRREGULAR: 'Patrón irregular',
  HORARIO_NOCTURNO_INUSUAL: 'Horario nocturno', AUSENTE: 'Ausente',
}

// ─── Mock drill data (hardcoded until per-dept RPC is available) ─────────────

const HE_AREA_MOCK: Slice[] = [
  { label: 'Operaciones',  value: 39.85, color: '#E24B4A' },
  { label: 'Contabilidad', value: 11.25, color: '#EF9F27' },
  { label: 'Ventas',       value:  7.83, color: '#7F77DD' },
]
const HE_EMP_MOCK: Record<string, Slice[]> = {
  Operaciones:  [{ label: 'Pedro S.', value: 39.85, color: '#E24B4A' }],
  Contabilidad: [{ label: 'Ana G.',   value: 11.25, color: '#EF9F27' }],
  Ventas:       [{ label: 'Juan T.',  value:  7.83, color: '#7F77DD' }],
}
const NOV_AREA_MOCK: Record<string, Slice[]> = {
  Atraso:  [{ label: 'Pedro S.', value: 5, color: '#E24B4A' }, { label: 'Ana G.', value: 2, color: '#EF9F27' }],
  Ausente: [{ label: 'Pedro S.', value: 3, color: '#E24B4A' }],
}

const EMP_MOCK_DATA: Record<string, EmpMock> = {
  'Pedro S.': {
    name: 'Pedro Salazar',
    atrasos_min: 127,
    multas_usd: 24.50,
    ausencias: 3,
    novedades: [
      { fecha: '2026-01-20', tipo: 'AUSENCIA', estado: 'Aceptada (abuela 1)'     },
      { fecha: '2026-02-17', tipo: 'AUSENCIA', estado: 'En revisión (abuela 2)'  },
      { fecha: '2026-03-24', tipo: 'AUSENCIA', estado: 'Sospechoso (abuela 3)'   },
    ],
    alerta: '3 ausencias por fallecimiento de abuela en 3 meses',
    riesgo: 'ALTO',
  },
  'Ana G.': {
    name: 'Ana García',
    atrasos_min: 75,
    multas_usd: 0,
    multas_note: 'condonadas',
    ausencias: 0,
    novedades: [
      { fecha: '2026-01-15', tipo: 'ATRASO', estado: 'Justificada' },
      { fecha: '2026-02-15', tipo: 'ATRASO', estado: 'Justificada' },
      { fecha: '2026-03-15', tipo: 'ATRASO', estado: 'Justificada' },
    ],
    alerta: 'Patrón: atrasos días 15 por trámites bancarios',
    riesgo: 'BAJO',
  },
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const tctx     = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const [period,       setPeriod]       = useState<Period>('hoy')
  const [empModal,     setEmpModal]     = useState<EmpMock | null>(null)
  const [empRealModal, setEmpRealModal] = useState<{ id: string; name: string } | null>(null)

  const { from, to } = useMemo(() => periodRange(period), [period])

  // ── Queries ─────────────────────────────────────────────────────────────────

  const daily = useQuery({
    queryKey: ['dash-daily', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchDaily(tenantId!, from, to),
    staleTime: 60_000,
  })
  const depts = useQuery({
    queryKey: ['dash-depts', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchDepts(tenantId!, from, to),
    staleTime: 60_000,
  })
  const rankingQ = useQuery({
    queryKey: ['dash-ranking', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchRanking(tenantId!, from, to),
    staleTime: 60_000,
  })
  const otQ = useQuery({
    queryKey: ['dash-ot', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchOT(tenantId!, from, to),
    staleTime: 60_000,
  })
  const novQ = useQuery({
    queryKey: ['dash-nov', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchNovelties(tenantId!, from, to),
    staleTime: 60_000,
  })
  // Novelties computed from real punches (ATRASO / SIN_SALIDA / AUSENTE / DOBLE_MARCACION)
  const novPunchQ = useQuery({
    queryKey: ['dash-nov-punch', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchNoveltiesFromPunches(tenantId!, from, to),
    staleTime: 60_000,
  })
  const finesQ = useQuery({
    queryKey: ['dash-fines', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchFines(tenantId!, from, to),
    staleTime: 60_000,
  })
  // Fine monthly bars — always fetches full history (not filtered by period)
  const fineMonthQ = useQuery({
    queryKey: ['dash-fine-month', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchFinesByMonth(tenantId!),
    staleTime: 120_000,
  })
  // Absence alerts (3+ per employee)
  const alertsQ = useQuery({
    queryKey: ['dash-alerts', tenantId, from, to],
    enabled: !!tenantId,
    queryFn: () => fetchAbsenceAlerts(tenantId!, from, to),
    staleTime: 60_000,
  })
  // Vacation ledger KPIs
  const vacQ = useQuery({
    queryKey: ['dash-vac', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchVacLedger(tenantId!),
    staleTime: 120_000,
  })

  const handleCollaborator = useCallback((key?: string) => {
    console.log('handleCollaborator:', key)
    if (!key) { navigate('/reports/marcaciones'); return }
    // UUID → real-data modal
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
      const emp  = rankingQ.data?.find(r => r.employee_id === key)
      const name = emp?.employee_name || emp?.employee_code || key.slice(0, 8) + '…'
      setEmpRealModal({ id: key, name })
      return
    }
    // Display label → mock modal (demo data)
    const mock = EMP_MOCK_DATA[key]
    if (mock) setEmpModal(mock)
    else navigate('/reports/marcaciones')
  }, [navigate, rankingQ.data])

  // ── Debug: log when core data loads ─────────────────────────────────────────
  React.useEffect(() => {
    console.log('INIT depts:', depts.data?.length ?? 0, '| emps/ranking:', rankingQ.data?.length ?? 0,
      '| novPunch:', novPunchQ.data?.length ?? 0, '| tenantId:', tenantId ?? 'null')
  }, [depts.data, rankingQ.data, novPunchQ.data, tenantId])

  // ── Computed stats ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const rows = (daily.data ?? []) as DailyRow[]
    const s = { total: rows.length, a_tiempo: 0, atrasado: 0, novedad: 0 }
    for (const r of rows) {
      const st = norm(r.day_status)
      if (st === 'A_TIEMPO')      s.a_tiempo++
      else if (st === 'ATRASADO') s.atrasado++
      else if (st === 'NOVEDAD')  s.novedad++
    }
    return s
  }, [daily.data])

  const heAprobadas = useMemo((): number | null => {
    if (otQ.data === null || !otQ.data) return null
    return (otQ.data as OTRow[]).find(r => r.status === 'approved')?.count ?? 0
  }, [otQ.data])

  // Vacation KPIs
  const vacKpi = useMemo(() => {
    const rows = vacQ.data
    if (!rows) return null
    let approved = 0, interrupted = 0, totalDays = 0
    for (const r of rows) {
      if (r.movement_type === 'USED')     { approved++;     totalDays += Math.abs(r.days_delta) }
      if (r.movement_type === 'REVERSAL') interrupted++
    }
    return { approved, interrupted, totalDays }
  }, [vacQ.data])

  // Top 5 late employees from ranking
  const top5Late = useMemo(() =>
    (rankingQ.data ?? [])
      .filter(r => r.atrasos > 0)
      .sort((a, b) => b.atrasos - a.atrasos)
      .slice(0, 5),
  [rankingQ.data])

  const maxAtrasos = Math.max(...top5Late.map(r => r.atrasos), 1)

  // ── Donut slice generators ───────────────────────────────────────────────────

  const atrasoEmpresaSlices = useMemo<Slice[]>(() => [
    { label: 'A tiempo',     value: stats.a_tiempo,  color: COLORS_ATRASOS[2] },
    { label: 'Atrasos',      value: stats.atrasado,  color: COLORS_ATRASOS[0] },
    { label: 'Novedades',    value: stats.novedad,   color: COLORS_ATRASOS[1] },
    { label: 'Sin registro', value: Math.max(0, stats.total - stats.a_tiempo - stats.atrasado - stats.novedad), color: COLORS_ATRASOS[3] },
  ].filter(s => s.value > 0), [stats])

  const atrasoAreaSlices = useCallback((_item: string): Slice[] => {
    const result = (depts.data ?? []).map((d, i) => ({
      label: d.department_name || 'Sin área',
      value: Number(d.atrasado ?? 0) + Number(d.novedad ?? 0),
      color: DEPT_COLORS[i % DEPT_COLORS.length],
    })).filter(s => s.value > 0)
    console.log('buildDrillData called: atrasoAreaSlices, item:', _item, '| depts:', depts.data?.length ?? 0, '| result slices:', result.length)
    return result
  }, [depts.data])

  const atrasoEmpSlices = useCallback((_area: string, _item: string): Slice[] => {
    const result = (rankingQ.data ?? []).slice(0, 10).map((r, i) => ({
      label: r.employee_name || r.employee_code,
      value: Number(r.atrasos ?? 0),
      color: DEPT_COLORS[i % DEPT_COLORS.length],
      empId: r.employee_id,
    })).filter(s => s.value > 0)
    console.log('buildDrillData called: atrasoEmpSlices, area:', _area, '| emps:', rankingQ.data?.length ?? 0, '| result slices:', result.length)
    return result
  }, [rankingQ.data])

  const heEmpresaSlices = useMemo<Slice[]>(() => {
    if (!otQ.data) return []
    return (otQ.data as OTRow[]).map((row, i) => ({
      label: OT_LABELS[row.status] ?? row.status,
      value: row.count,
      color: COLORS_HE[i % COLORS_HE.length],
    })).filter(s => s.value > 0)
  }, [otQ.data])

  const novEmpresaSlices = useMemo<Slice[]>(() => {
    // Prefer punch-computed data (always available); fall back to novelties table if populated
    const src: NovRow[] =
      (novPunchQ.data && novPunchQ.data.length > 0)
        ? novPunchQ.data
        : ((novQ.data ?? []) as NovRow[])
    return src.map((row, i) => ({
      label: NOV_LABELS[row.type] ?? row.type,
      value: row.count,
      color: NOV_TYPE_COLORS[row.type] ?? COLORS_NOVEDADES[i % COLORS_NOVEDADES.length],
    })).filter(s => s.value > 0)
  }, [novPunchQ.data, novQ.data])

  // Fine monthly bars (only show if data exists)
  const fineBars: FineMonthBar[] = fineMonthQ.data ?? []
  const absenceAlerts: AbsenceAlert[] = alertsQ.data ?? []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-white/45 mt-0.5">Resumen ejecutivo de asistencia y KPIs</p>
        </div>
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p ? 'bg-blue-600 text-white shadow-sm' : 'text-white/45 hover:text-white hover:bg-white/5'
              }`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Fila 1: KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard icon={<Users size={15} />} label="Colaboradores"
          value={daily.isLoading ? '…' : stats.total}
          sub="registros del período" accent="bg-blue-500/20 text-blue-400" />
        <KpiCard icon={<CheckCircle size={15} />} label="A tiempo"
          value={daily.isLoading ? '…' : stats.total > 0
            ? `${Math.round((stats.a_tiempo / stats.total) * 100)}%` : '—'}
          sub={`${stats.a_tiempo} de ${stats.total}`} accent="bg-green-500/20 text-green-400" />
        <KpiCard icon={<Clock size={15} />} label="Min atraso est."
          value={daily.isLoading ? '…' : stats.atrasado > 0 ? `~${stats.atrasado * 15} min` : '0 min'}
          sub={`${stats.atrasado} entradas tardías`} accent="bg-amber-500/20 text-amber-400" />
        <KpiCard icon={<TrendingUp size={15} />} label="HE aprobadas"
          value={heAprobadas !== null ? heAprobadas : '—'}
          sub={heAprobadas !== null ? 'horas extra aprobadas' : 'tabla pendiente C-5'}
          accent="bg-purple-500/20 text-purple-400" />
        <KpiCard icon={<DollarSign size={15} />} label="Multas $"
          value={finesQ.data !== null && finesQ.data !== undefined
            ? `$${(finesQ.data as number).toFixed(2)}` : '—'}
          sub={finesQ.data !== null ? 'total período' : 'tabla pendiente C-4'}
          accent="bg-rose-500/20 text-rose-400" />
      </div>

      {/* ── Fila 2: Donuts ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DonutCard title="Atrasos" empresaSlices={atrasoEmpresaSlices}
          areaSlices={atrasoAreaSlices} empSlices={atrasoEmpSlices}
          onCollaborator={handleCollaborator} />
        <DonutCard title="Horas Extra" empresaSlices={heEmpresaSlices}
          areaSlices={() => HE_AREA_MOCK}
          empSlices={(area) => HE_EMP_MOCK[area] ?? []}
          onCollaborator={handleCollaborator}
          pending={otQ.data === null}
          pendingTable="attendance.overtime_requests" pendingSession="Sesión C-5" />
        <DonutCard title="Novedades" empresaSlices={novEmpresaSlices}
          areaSlices={(label) => NOV_AREA_MOCK[label] ?? []}
          empSlices={() => []}
          onCollaborator={handleCollaborator} />
      </div>

      {/* ── Fila 3: Barras 3D multas  |  Ranking + Vacaciones ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Izquierda — Barras 3D multas por mes */}
        <div className="space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold text-sm text-white mb-4">Multas por mes</h3>
            {fineMonthQ.data === null ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4 text-xs text-amber-400">
                <code className="font-mono">attendance.fine_ledger</code> — pendiente Sesión C-4
              </div>
            ) : fineBars.length === 0 ? (
              <div className="py-10 text-center text-xs text-white/25">Sin multas registradas</div>
            ) : (
              <BarChart3DIso bars={fineBars} />
            )}
          </div>

          {/* Alerta IA — AUSENCIA_INJUSTIFICADA */}
          {absenceAlerts.length > 0 && (
            <div className="space-y-2">
              {absenceAlerts.map((alert, i) => (
                <div key={i}
                  className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                  style={{ borderLeftWidth: 3, borderLeftColor: '#7F77DD' }}>
                  <Bot size={15} className="mt-0.5 shrink-0" style={{ color: '#7F77DD' }} />
                  <p className="text-xs text-white/70 leading-relaxed">
                    <span style={{ color: '#7F77DD' }} className="font-semibold">IA detecta: </span>
                    <span className="text-white font-medium">{alert.name}</span>
                    {' '}acumula{' '}
                    <span className="text-rose-400 font-semibold">{alert.count} ausencias</span>
                    {' '}injustificadas. Revisar justificaciones.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Derecha — Top 5 Atrasos + Vacaciones */}
        <div className="space-y-3">

          {/* Top 5 atrasos */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold text-sm text-white mb-4">Top 5 atrasos</h3>
            {top5Late.length === 0 ? (
              <div className="py-6 text-center text-xs text-white/25">Sin atrasos en el período</div>
            ) : (
              <div className="space-y-3">
                {top5Late.map((r, i) => {
                  const pct = Math.round((r.atrasos / maxAtrasos) * 100)
                  const initials = (r.employee_name || r.employee_code)
                    .split(' ').slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase()
                  const avatarColors = [
                    'bg-rose-500','bg-amber-500','bg-orange-500','bg-red-500','bg-pink-500'
                  ]
                  return (
                    <div key={r.employee_id ?? i} className="flex items-center gap-3">
                      {/* Avatar */}
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shrink-0 ${avatarColors[i]}`}>
                        {initials}
                      </span>
                      {/* Name + bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/70 truncate max-w-[140px]">
                            {r.employee_name || r.employee_code}
                          </span>
                          <span className="text-xs font-mono font-bold text-rose-400 ml-2 shrink-0">
                            {r.atrasos * 15} min
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-rose-500 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Vacaciones mini-KPIs */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold text-sm text-white mb-4">Vacaciones</h3>
            {vacQ.data === null ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-400">
                <code className="font-mono">attendance.vacation_ledger</code> — pendiente Sesión C-6
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Aprobadas',       value: vacKpi?.approved    ?? 0, color: 'text-green-400'  },
                  { label: 'En aprobación',   value: '—',                      color: 'text-amber-400'  },
                  { label: 'Interrumpidas',   value: vacKpi?.interrupted ?? 0, color: 'text-rose-400'   },
                  { label: 'Días totales',    value: vacKpi ? `${vacKpi.totalDays}d` : '—', color: 'text-blue-400' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-white/40 mb-0.5">{kpi.label}</p>
                    <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>

    {/* ── Employee detail modal ────────────────────────────────────────────── */}
    {empModal && (
      <EmpDetailModal
        emp={empModal}
        onClose={() => setEmpModal(null)}
        onViewReports={() => { setEmpModal(null); navigate('/reports/marcaciones') }}
      />
    )}
    {empRealModal && tenantId && (
      <EmpRealModal
        empId={empRealModal.id}
        empName={empRealModal.name}
        tenantId={tenantId}
        from={from} to={to}
        onClose={() => setEmpRealModal(null)}
        onViewReports={() => { setEmpRealModal(null); navigate('/reports/marcaciones') }}
      />
    )}
    </>
  )
}
