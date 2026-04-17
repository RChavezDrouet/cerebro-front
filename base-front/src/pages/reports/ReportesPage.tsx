import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FileCheck, CalendarDays, Clock, Briefcase,
  TrendingUp, Bell, CircleDollarSign, ArrowUp,
} from 'lucide-react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id:            string
  employee_code: string
  first_name:    string
  last_name:     string
}

type Punch = {
  id:          string
  employee_id: string
  punched_at:  string
  meta:        Record<string, unknown> | null   // jsonb; marking type lives in meta->>'type'
  source:      string
  employee:    { first_name: string; last_name: string; employee_code: string } | null
}

type EmpSummary = {
  employee:      Employee
  days_present:  number
  total_punches: number
  late_days:     number
  avg_in_time:   string | null
}

type OvertimeRequest = {
  id:                 string
  employee_id:        string
  requested_date:     string
  hours_requested:    number
  hour_type:          'SUPLEMENTARIA' | 'EXTRAORDINARIA'
  justification:      string
  status:             'pending' | 'approved' | 'rejected' | 'compensated'
  compensate_as_time: boolean
  reviewed_by:        string | null
  review_note:        string | null
  created_at:         string
}

type VacationLedger = {
  id:              string
  employee_id:     string
  movement_type:   'ACCRUAL' | 'USED' | 'REVERSAL' | 'PAYOUT'
  days_delta:      number
  reference_date:  string
  amount_usd:      number | null
  income_base_usd: number | null
  notes:           string | null
}

type Novelty = {
  id:           string
  employee_id:  string
  type:         string
  severity:     string | null
  detected_by:  string | null
  details:      Record<string, unknown> | null
  date:         string
  created_at:   string
}

type FineLedger = {
  id:                string
  employee_id:       string
  incident_date:     string
  incident_type:     string
  calculated_amount: number
  applied_amount:    number
  was_capped:        boolean
  cap_excess:        number
  month_year:        string
}

// ─── Ranking types ────────────────────────────────────────────────────────────

type PunctualityRow = {
  employee:       Employee
  days_analyzed:  number
  on_time_days:   number
  late_days:      number
  total_late_min: number
  pct:            number   // 0-100
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MARKING_LABELS: Record<string, string> = {
  '0': 'Entrada', '3': 'Entrada', '4': 'HE Entrada',
  '1': 'Salida',  '2': 'Salida',  '5': 'HE Salida',
  ENTRADA: 'Entrada', SALIDA: 'Salida', IN: 'Entrada', OUT: 'Salida',
}
function sourceLabel(p: Punch): string {
  const s = p.source ?? ''
  if (s === 'web' || s === 'pwa') return 'Web / PWA'
  if (s === 'import') return 'Importado'
  if (s === 'biometric') {
    const vt = String(p.meta?.['verify_type'] ?? '')
    if (vt === '15') return 'Biométrico / Facial'
    if (vt === '1')  return 'Biométrico / Huella'
    if (vt === '3')  return 'Biométrico / Código'
    return 'Biométrico'
  }
  return s || '—'
}
const OT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobado',
  rejected: 'Rechazado', compensated: 'Compensado',
}
const OT_STATUS_CLASSES: Record<string, string> = {
  pending:     'bg-amber-500/20 text-amber-400',
  approved:    'bg-green-500/20 text-green-400',
  rejected:    'bg-red-500/20 text-red-400',
  compensated: 'bg-blue-500/20 text-blue-400',
}
const VAC_MOVE_LABELS: Record<string, string> = {
  ACCRUAL: 'Devengo', USED: 'Utilizado', REVERSAL: 'Reversión', PAYOUT: 'Pago',
}
const VAC_MOVE_CLASSES: Record<string, string> = {
  ACCRUAL:  'bg-green-500/20 text-green-400',
  USED:     'bg-blue-500/20 text-blue-400',
  REVERSAL: 'bg-amber-500/20 text-amber-400',
  PAYOUT:   'bg-purple-500/20 text-purple-400',
}
const NOVELTY_SEVERITY_CLASSES: Record<string, string> = {
  low:      'bg-blue-500/20 text-blue-400',
  medium:   'bg-amber-500/20 text-amber-400',
  high:     'bg-red-500/20 text-red-400',
  critical: 'bg-red-700/30 text-red-300',
}
const FINE_TYPE_LABELS: Record<string, string> = {
  ATRASO_ENTRADA:         'Atraso entrada',
  ATRASO_ALMUERZO:        'Atraso almuerzo',
  SALIDA_TEMPRANA:        'Salida temprana',
  AUSENCIA_INJUSTIFICADA: 'Ausencia injustif.',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function isoDateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function monthStart(year: number, month: number) {
  return `${year}-${String(month).padStart(2,'0')}-01`
}
function monthEnd(year: number, month: number) {
  const last = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2,'0')}-${String(last).padStart(2,'0')}`
}
function empName(employees: Employee[], id: string) {
  const e = employees.find(x => x.id === id)
  return e ? `${e.last_name}, ${e.first_name}` : id.slice(0, 8) + '…'
}
function empCode(employees: Employee[], id: string) {
  return employees.find(x => x.id === id)?.employee_code ?? '—'
}
function initials(emp: Employee) {
  return (emp.first_name[0] ?? '') + (emp.last_name[0] ?? '')
}
/** Extracts the marking type string from punch.meta->>'type' */
function metaType(p: Punch): string {
  return String(p.meta?.['type'] ?? '')
}
function avatarColor(id: string) {
  const COLORS = [
    'bg-blue-500','bg-purple-500','bg-green-500','bg-amber-500',
    'bg-rose-500','bg-cyan-500','bg-indigo-500','bg-teal-500',
  ]
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  return COLORS[n % COLORS.length]
}

// ─── Small shared components ──────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  )
}
function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center text-sm text-white/40">
      {msg}
    </div>
  )
}
function PendingTable({ table, session }: { table: string; session: string }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-6 py-5 text-sm text-amber-400">
      La tabla{' '}
      <code className="font-mono text-xs bg-amber-500/20 px-1 rounded">attendance.{table}</code>{' '}
      aún no existe. Se creará en la Sesión {session} del roadmap CIRA V2.0.
    </div>
  )
}
function KpiCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-4">
      <p className="text-xs text-white/50 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}
function EmpSelect({ value, onChange, employees, loading }: {
  value: string; onChange: (v: string) => void
  employees: Employee[]; loading: boolean
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={loading}
      className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white
                 focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[200px]">
      <option value="all">Todos los empleados</option>
      {employees.map(e => (
        <option key={e.id} value={e.id}>{e.last_name}, {e.first_name} ({e.employee_code})</option>
      ))}
    </select>
  )
}
function Avatar({ emp }: { emp: Employee }) {
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shrink-0 ${avatarColor(emp.id)}`}>
      {initials(emp)}
    </span>
  )
}

// ─── Tab routing ──────────────────────────────────────────────────────────────

const TAB_ROUTES: Record<string, number> = {
  '/reports':               0,
  '/reports/marcaciones':   0,
  '/reports/asistencia':    1,
  '/reports/horas-extra':   2,
  '/reports/vacaciones':    3,
  '/reports/ranking':       4,
  '/reports/novedades':     5,
  '/reports/multas':        6,
}
const TAB_PATHS = [
  '/reports/marcaciones',
  '/reports/asistencia',
  '/reports/horas-extra',
  '/reports/vacaciones',
  '/reports/ranking',
  '/reports/novedades',
  '/reports/multas',
]
const TAB_CONFIG: {
  label: string
  icon: React.ReactNode
  color: string          // Tailwind bg for the circle
  border: string         // Tailwind border for active state
  bg: string             // Tailwind bg for active state
  text: string           // Tailwind text for active state
}[] = [
  {
    label: 'Marcaciones',
    icon:  <FileCheck size={18} />,
    color: 'bg-blue-500',
    border: 'border-blue-500',
    bg:    'bg-blue-500/10',
    text:  'text-blue-300',
  },
  {
    label: 'Resumen Mensual',
    icon:  <CalendarDays size={18} />,
    color: 'bg-indigo-500',
    border: 'border-indigo-500',
    bg:    'bg-indigo-500/10',
    text:  'text-indigo-300',
  },
  {
    label: 'Horas Extra',
    icon:  <div className="relative"><Clock size={16} /><ArrowUp size={9} className="absolute -top-0.5 -right-0.5" /></div>,
    color: 'bg-amber-500',
    border: 'border-amber-500',
    bg:    'bg-amber-500/10',
    text:  'text-amber-300',
  },
  {
    label: 'Vacaciones',
    icon:  <Briefcase size={18} />,
    color: 'bg-teal-500',
    border: 'border-teal-500',
    bg:    'bg-teal-500/10',
    text:  'text-teal-300',
  },
  {
    label: 'Ranking',
    icon:  <TrendingUp size={18} />,
    color: 'bg-green-500',
    border: 'border-green-500',
    bg:    'bg-green-500/10',
    text:  'text-green-300',
  },
  {
    label: 'Novedades',
    icon:  <Bell size={18} />,
    color: 'bg-rose-500',
    border: 'border-rose-500',
    bg:    'bg-rose-500/10',
    text:  'text-rose-300',
  },
  {
    label: 'Multas',
    icon:  <CircleDollarSign size={18} />,
    color: 'bg-orange-500',
    border: 'border-orange-500',
    bg:    'bg-orange-500/10',
    text:  'text-orange-300',
  },
]
// keep a flat labels array for legacy use
const TAB_LABELS = TAB_CONFIG.map(t => t.label)

// ─── Component ────────────────────────────────────────────────────────────────

const ReportesPage: React.FC = () => {
  const { tenantId } = useTenantStore()
  const location     = useLocation()
  const navigate     = useNavigate()

  const initialTab = TAB_ROUTES[location.pathname] ?? 0
  const [activeTab, setActiveTab] = useState(initialTab)

  const today    = isoDateLocal(new Date())
  const nowYear  = new Date().getFullYear()
  const nowMonth = new Date().getMonth() + 1

  // ── Shared ──────────────────────────────────────────────────────────────────
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [loadingEmp, setLoadingEmp] = useState(true)
  const [empFilter,  setEmpFilter]  = useState<string>('all')

  // Tab 0
  const [dateFrom,   setDateFrom]   = useState(today)
  const [dateTo,     setDateTo]     = useState(today)
  const [punches,    setPunches]    = useState<Punch[]>([])
  const [loadingPun, setLoadingPun] = useState(false)

  // Tabs 1 + 4 share month/year
  const [sumMonth,      setSumMonth]      = useState(String(nowMonth).padStart(2,'0'))
  const [sumYear,       setSumYear]       = useState(nowYear)
  const [monthPunches,  setMonthPunches]  = useState<Punch[]>([])
  const [loadingMonth,  setLoadingMonth]  = useState(false)

  // Tab 2
  const [otRequests,  setOtRequests]  = useState<OvertimeRequest[]>([])
  const [loadingOT,   setLoadingOT]   = useState(false)
  const [otTablePend, setOtTablePend] = useState(false)
  const [otStatusFlt, setOtStatusFlt] = useState<string>('all')
  const [otYear,      setOtYear]      = useState(nowYear)

  // Tab 3
  const [vacLedger,    setVacLedger]    = useState<VacationLedger[]>([])
  const [loadingVac,   setLoadingVac]   = useState(false)
  const [vacTablePend, setVacTablePend] = useState(false)

  // Tab 5
  const [novelties,     setNovelties]     = useState<Novelty[]>([])
  const [loadingNov,    setLoadingNov]    = useState(false)
  const [novTablePend,  setNovTablePend]  = useState(false)

  // Tab 6
  const [fineLedger,    setFineLedger]    = useState<FineLedger[]>([])
  const [loadingFine,   setLoadingFine]   = useState(false)
  const [fineTablePend, setFineTablePend] = useState(false)
  const [fineMonth,     setFineMonth]     = useState(String(nowMonth).padStart(2,'0'))
  const [fineYear,      setFineYear]      = useState(nowYear)

  // ── Tenant resolver ─────────────────────────────────────────────────────────
  const resolveTenantId = async (): Promise<string | null> => {
    if (tenantId) return tenantId
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id').eq('id', user.id).single()
    return profile?.tenant_id ?? null
  }
  void resolveTenantId  // referenced in handleApprove/Reject in OT

  // ── Load employees once ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase.schema(ATT_SCHEMA).from('employees')
      .select('id, employee_code, first_name, last_name')
      .eq('status', 'active').order('last_name')
      .then(({ data }) => { setEmployees(data ?? []); setLoadingEmp(false) })
  }, [])

  // ── TAB 0: Marcaciones ──────────────────────────────────────────────────────
  const loadPunches = async () => {
    setLoadingPun(true)
    try {
      const resolvedTenantId = await resolveTenantId()
      if (!resolvedTenantId) throw new Error('Tenant no identificado')

      // Step 1 — punches without join
      const desdeUTC = new Date(`${dateFrom}T00:00:00-05:00`).toISOString()
      const hastaUTC = new Date(`${dateTo}T23:59:59-05:00`).toISOString()
      console.log('QUERY punches:', { desdeUTC, hastaUTC, resolvedTenantId })
      let q = supabase.schema(ATT_SCHEMA).from('punches')
        .select('id, employee_id, punched_at, meta, source')
        .eq('tenant_id', resolvedTenantId)
        .gte('punched_at', desdeUTC)
        .lte('punched_at', hastaUTC)
        .order('punched_at', { ascending: false }).limit(500)
      if (empFilter !== 'all') q = q.eq('employee_id', empFilter)
      const { data: punchData, error } = await q
      console.log('RESULT punches:', { count: punchData?.length, error })
      if (error) throw error

      // Step 2 — employees_legacy separately
      const { data: empData } = await supabase
        .schema(ATT_SCHEMA).from('employees_legacy')
        .select('id, first_name, last_name, employee_code')
        .eq('tenant_id', resolvedTenantId)

      // Step 3 — merge in JS
      const empMap = new Map((empData ?? []).map(e => [e.id, e]))
      const rows = (punchData ?? []).map(p => ({
        ...p,
        employee: empMap.get(p.employee_id) ?? null,
      }))
      setPunches(rows as unknown as Punch[])
    } catch { toast.error('Error al cargar marcaciones') }
    finally   { setLoadingPun(false) }
  }
  useEffect(() => { if (activeTab === 0) loadPunches() }, [activeTab, dateFrom, dateTo, empFilter])

  // ── TAB 1 + 4: Shared month punches ────────────────────────────────────────
  const loadMonthPunches = async () => {
    setLoadingMonth(true)
    try {
      const resolvedTenantId = await resolveTenantId()
      if (!resolvedTenantId) throw new Error('Tenant no identificado')

      // Step 1 — punches without join
      let q = supabase.schema(ATT_SCHEMA).from('punches')
        .select('id, employee_id, punched_at, meta, source')
        .eq('tenant_id', resolvedTenantId)
        .gte('punched_at', new Date(`${monthStart(sumYear, parseInt(sumMonth))}T00:00:00-05:00`).toISOString())
        .lte('punched_at', new Date(`${monthEnd(sumYear, parseInt(sumMonth))}T23:59:59-05:00`).toISOString())
        .order('punched_at').limit(2000)
      if (empFilter !== 'all') q = q.eq('employee_id', empFilter)
      const { data: punchData, error } = await q
      if (error) throw error

      // Step 2 — employees_legacy separately
      const { data: empData } = await supabase
        .schema(ATT_SCHEMA).from('employees_legacy')
        .select('id, first_name, last_name, employee_code')
        .eq('tenant_id', resolvedTenantId)

      // Step 3 — merge in JS
      const empMap = new Map((empData ?? []).map(e => [e.id, e]))
      const rows = (punchData ?? []).map(p => ({
        ...p,
        employee: empMap.get(p.employee_id) ?? null,
      }))
      setMonthPunches(rows as unknown as Punch[])
    } catch { toast.error('Error al cargar datos del mes') }
    finally   { setLoadingMonth(false) }
  }
  useEffect(() => {
    if (activeTab === 1 || activeTab === 4) loadMonthPunches()
  }, [activeTab, sumYear, sumMonth, empFilter])

  // Summary per employee — puntual if entry ≤ 08:10 (490 min)
  const empSummaries = useMemo((): EmpSummary[] => {
    const byEmp = new Map<string, Punch[]>()
    for (const p of monthPunches) {
      const arr = byEmp.get(p.employee_id) ?? []; arr.push(p)
      byEmp.set(p.employee_id, arr)
    }
    const result: EmpSummary[] = []
    for (const [empId, emP] of byEmp) {
      const emp = employees.find(e => e.id === empId) ??
        { id: empId, employee_code: '?', first_name: '?', last_name: '?' }
      const byDate = new Map<string, Punch[]>()
      for (const p of emP) {
        const d = p.punched_at.slice(0, 10)
        const arr = byDate.get(d) ?? []; arr.push(p); byDate.set(d, arr)
      }
      let late_days = 0; const in_times: number[] = []
      for (const [, dPs] of byDate) {
        const entries = dPs
          .filter(p => ['0','3','4','ENTRADA','IN'].includes(metaType(p)))
          .sort((a, b) => a.punched_at.localeCompare(b.punched_at))
        if (entries.length > 0) {
          const t    = new Date(entries[0].punched_at)
          const mins = t.getHours() * 60 + t.getMinutes()
          in_times.push(mins)
          if (mins > 490) late_days++  // > 08:10 = tardío
        }
      }
      const avg_in_time = in_times.length > 0 ? (() => {
        const avg = Math.round(in_times.reduce((a, b) => a + b, 0) / in_times.length)
        return `${String(Math.floor(avg/60)).padStart(2,'0')}:${String(avg%60).padStart(2,'0')}`
      })() : null
      result.push({ employee: emp, days_present: byDate.size,
        total_punches: emP.length, late_days, avg_in_time })
    }
    return result.sort((a, b) =>
      `${a.employee.last_name}${a.employee.first_name}`
        .localeCompare(`${b.employee.last_name}${b.employee.first_name}`))
  }, [monthPunches, employees])

  // ── TAB 4: Ranking derived from empSummaries ────────────────────────────────
  const rankingRows = useMemo((): PunctualityRow[] => {
    return empSummaries.map(s => {
      const days_analyzed  = s.days_present
      const late_days      = s.late_days
      const on_time_days   = days_analyzed - late_days
      const pct            = days_analyzed > 0
        ? Math.round((on_time_days / days_analyzed) * 100) : 100

      // Approximate late minutes: assume avg 15 min per late day (real calc needs punches detail)
      const total_late_min = monthPunches
        .filter(p => p.employee_id === s.employee.id &&
          ['0','3','4','ENTRADA','IN'].includes(metaType(p)))
        .reduce((sum, p) => {
          const t    = new Date(p.punched_at)
          const mins = t.getHours() * 60 + t.getMinutes()
          return mins > 490 ? sum + (mins - 490) : sum
        }, 0)

      return { employee: s.employee, days_analyzed, on_time_days, late_days, total_late_min, pct }
    })
  }, [empSummaries, monthPunches])

  const rankBestToWorst = useMemo(() =>
    [...rankingRows].sort((a, b) => b.pct - a.pct || a.late_days - b.late_days),
    [rankingRows])

  const rankWorstLate = useMemo(() =>
    [...rankingRows]
      .filter(r => r.late_days > 0)
      .sort((a, b) => b.total_late_min - a.total_late_min),
    [rankingRows])

  const maxLateMin = rankWorstLate[0]?.total_late_min ?? 1

  // ── TAB 2: Horas extra ──────────────────────────────────────────────────────
  const loadOT = async () => {
    setLoadingOT(true); setOtTablePend(false)
    try {
      let q = supabase.schema(ATT_SCHEMA).from('overtime_requests')
        .select('id, employee_id, requested_date, hours_requested, hour_type, justification, status, compensate_as_time, reviewed_by, review_note, created_at')
        .gte('requested_date', `${otYear}-01-01`)
        .lte('requested_date', `${otYear}-12-31`)
        .order('requested_date', { ascending: false })
      if (empFilter !== 'all') q = q.eq('employee_id', empFilter)
      if (otStatusFlt !== 'all') q = q.eq('status', otStatusFlt)
      const { data, error } = await q
      if (error) throw error
      setOtRequests((data ?? []) as OvertimeRequest[])
    } catch { setOtTablePend(true) }
    finally   { setLoadingOT(false) }
  }
  useEffect(() => { if (activeTab === 2) loadOT() }, [activeTab, otYear, otStatusFlt, empFilter])

  const otKpis = useMemo(() => {
    const pending     = otRequests.filter(r => r.status === 'pending').length
    const approved    = otRequests.filter(r => r.status === 'approved')
    const rejected    = otRequests.filter(r => r.status === 'rejected').length
    const approvedHrs = approved.reduce((s, r) => s + r.hours_requested, 0)
    const suplemHrs   = otRequests
      .filter(r => r.status === 'approved' && r.hour_type === 'SUPLEMENTARIA')
      .reduce((s, r) => s + r.hours_requested, 0)
    return { pending, approvedCount: approved.length, approvedHrs, rejected, suplemHrs }
  }, [otRequests])

  // ── TAB 3: Vacaciones ───────────────────────────────────────────────────────
  const loadVac = async () => {
    setLoadingVac(true); setVacTablePend(false)
    try {
      const { data, error } = await supabase.schema(ATT_SCHEMA)
        .from('vacation_ledger')
        .select('id, employee_id, movement_type, days_delta, reference_date, amount_usd, income_base_usd, notes')
        .order('reference_date', { ascending: false }).limit(200)
      if (error) throw error
      setVacLedger((data ?? []) as VacationLedger[])
    } catch { setVacTablePend(true) }
    finally   { setLoadingVac(false) }
  }
  useEffect(() => { if (activeTab === 3) loadVac() }, [activeTab])

  const vacKpis = useMemo(() => {
    const used      = vacLedger.filter(r => r.movement_type === 'USED').length
    const accrual   = vacLedger.filter(r => r.movement_type === 'ACCRUAL').length
    const reversal  = vacLedger.filter(r => r.movement_type === 'REVERSAL').length
    const totalDays = vacLedger.reduce((s, r) => s + r.days_delta, 0)
    return { used, accrual, reversal, totalDays }
  }, [vacLedger])

  // ── TAB 5: Novedades ────────────────────────────────────────────────────────
  const loadNovelties = async () => {
    setLoadingNov(true); setNovTablePend(false)
    try {
      const { data, error } = await supabase.schema(ATT_SCHEMA)
        .from('novelties')
        .select('id, employee_id, type, severity, detected_by, details, date, created_at')
        .order('date', { ascending: false }).limit(200)
      if (error) throw error
      setNovelties((data ?? []) as Novelty[])
    } catch { setNovTablePend(true) }
    finally   { setLoadingNov(false) }
  }
  useEffect(() => { if (activeTab === 5) loadNovelties() }, [activeTab])

  const novKpis = useMemo(() => {
    const byType = new Map<string, number>()
    for (const n of novelties) byType.set(n.type, (byType.get(n.type) ?? 0) + 1)
    const high  = novelties.filter(n => n.severity === 'high' || n.severity === 'critical').length
    return { total: novelties.length, high, byType }
  }, [novelties])

  // ── TAB 6: Multas ───────────────────────────────────────────────────────────
  const loadFine = async () => {
    setLoadingFine(true); setFineTablePend(false)
    try {
      const periodKey = `${fineYear}-${fineMonth}`
      const { data, error } = await supabase.schema(ATT_SCHEMA)
        .from('fine_ledger')
        .select('id, employee_id, incident_date, incident_type, calculated_amount, applied_amount, was_capped, cap_excess, month_year')
        .eq('month_year', periodKey)
        .order('incident_date', { ascending: false })
      if (error) throw error
      setFineLedger((data ?? []) as FineLedger[])
    } catch { setFineTablePend(true) }
    finally   { setLoadingFine(false) }
  }
  useEffect(() => { if (activeTab === 6) loadFine() }, [activeTab, fineYear, fineMonth])

  const fineKpis = useMemo(() => {
    const totalCalc    = fineLedger.reduce((s, r) => s + r.calculated_amount, 0)
    const totalApplied = fineLedger.reduce((s, r) => s + r.applied_amount, 0)
    const capped       = fineLedger.filter(r => r.was_capped).length
    return { total: fineLedger.length, totalCalc, totalApplied, capped }
  }, [fineLedger])

  // ── Tab switch ───────────────────────────────────────────────────────────────
  const switchTab = (idx: number) => {
    setActiveTab(idx); navigate(TAB_PATHS[idx], { replace: true })
  }

  // ── Export Tab 0 CSV ─────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Fecha','Hora','Empleado','Código','Tipo','Fuente'],
      ...punches.map(p => [
        fmtDate(p.punched_at), fmtTime(p.punched_at),
        p.employee ? `${p.employee.last_name}, ${p.employee.first_name}` : p.employee_id.slice(0,8),
        p.employee?.employee_code ?? '',
        MARKING_LABELS[metaType(p)] ?? (metaType(p) || '—'),
        sourceLabel(p),
      ]),
    ]
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `marcaciones_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  // Shared month filter block used in Tab 1 and Tab 4
  const MonthFilter = (
    <div className="flex flex-wrap items-end gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <div>
        <label className="block text-xs text-white/50 mb-1">Mes</label>
        <select value={sumMonth} onChange={e => setSumMonth(e.target.value)}
          className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
          {MONTHS.map((m, i) => (
            <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">Año</label>
        <input type="number" value={sumYear} min={2020} max={2030}
          onChange={e => setSumYear(parseInt(e.target.value) || nowYear)}
          className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">Empleado</label>
        <EmpSelect value={empFilter} onChange={setEmpFilter} employees={employees} loading={loadingEmp} />
      </div>
      <button onClick={loadMonthPunches} disabled={loadingMonth}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loadingMonth ? 'Cargando…' : 'Consultar'}
      </button>
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        <p className="text-sm text-white/50 mt-1">
          Consulta marcaciones, asistencia, horas extra, vacaciones y más.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TAB_CONFIG.map((tab, idx) => {
          const active = activeTab === idx
          return (
            <button
              key={idx}
              onClick={() => switchTab(idx)}
              className={[
                'flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
                active
                  ? `${tab.bg} ${tab.border} ${tab.text}`
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80',
              ].join(' ')}
            >
              {/* Icon circle */}
              <span className={[
                'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
                active ? tab.color : 'bg-white/10',
                'text-white',
              ].join(' ')}>
                {tab.icon}
              </span>
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 0 — MARCACIONES
      ══════════════════════════════════════════════════════ */}
      {activeTab === 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Hasta</label>
              <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)}
                className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Empleado</label>
              <EmpSelect value={empFilter} onChange={setEmpFilter} employees={employees} loading={loadingEmp} />
            </div>
            <button onClick={loadPunches} disabled={loadingPun}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loadingPun ? 'Cargando…' : 'Consultar'}
            </button>
            {punches.length > 0 && (
              <button onClick={exportCSV}
                className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors ml-auto">
                Exportar CSV
              </button>
            )}
          </div>

          {loadingPun ? <Spinner /> : punches.length === 0 ? (
            <EmptyState msg="No hay marcaciones en el período seleccionado." />
          ) : (
            <>
              <p className="text-xs text-white/40">
                {punches.length} marcación{punches.length !== 1 ? 'es' : ''} — máx. 500
              </p>
              <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-left">
                      {['Fecha','Hora','Empleado','Código','Tipo','Fuente'].map(h => (
                        <th key={h} className="px-4 py-3 font-medium text-white/60">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {punches.map(p => {
                      const mtLabel = MARKING_LABELS[metaType(p)] ?? (metaType(p) || '—')
                      const isEntry = ['Entrada','HE Entrada'].includes(mtLabel)
                      return (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2 font-mono text-xs text-white/70">{fmtDate(p.punched_at)}</td>
                          <td className="px-4 py-2 font-mono font-semibold text-white">{fmtTime(p.punched_at)}</td>
                          <td className="px-4 py-2 text-white whitespace-nowrap">
                            {p.employee
                              ? `${p.employee.last_name}, ${p.employee.first_name}`
                              : <span className="font-mono text-xs text-white/40">{p.employee_id.slice(0,8)}…</span>}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-white/50">{p.employee?.employee_code ?? '—'}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              isEntry ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                              {mtLabel}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-white/50">{sourceLabel(p)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 1 — RESUMEN MENSUAL
      ══════════════════════════════════════════════════════ */}
      {activeTab === 1 && (
        <div className="space-y-4">
          {MonthFilter}
          <p className="text-xs text-white/40">Puntual = entrada ≤ 08:10 · Tardío = entrada &gt; 08:10</p>
          {loadingMonth ? <Spinner /> : empSummaries.length === 0 ? (
            <EmptyState msg="No hay datos de asistencia para el período." />
          ) : (
            <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-left">
                    {['Empleado','Código','Días presentes','Total marcaciones','Días tardíos','H. entrada prom.'].map(h => (
                      <th key={h} className="px-4 py-3 font-medium text-white/60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empSummaries.map(s => (
                    <tr key={s.employee.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                        {s.employee.last_name}, {s.employee.first_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50">{s.employee.employee_code}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          {s.days_present}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-white/70">{s.total_punches}</td>
                      <td className="px-4 py-3 text-center">
                        {s.late_days > 0
                          ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">{s.late_days}</span>
                          : <span className="text-green-400/70 text-xs font-bold">✓</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-white/70">{s.avg_in_time ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-white/5">
                    <td className="px-4 py-2 text-xs text-white/50" colSpan={2}>
                      {empSummaries.length} empleado{empSummaries.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-xs text-white/60">
                      {empSummaries.reduce((a, s) => a + s.days_present, 0)}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-xs text-white/60">
                      {empSummaries.reduce((a, s) => a + s.total_punches, 0)}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-xs text-amber-400/70">
                      {empSummaries.reduce((a, s) => a + s.late_days, 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2 — HORAS EXTRA
      ══════════════════════════════════════════════════════ */}
      {activeTab === 2 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Año</label>
              <input type="number" value={otYear} min={2020} max={2030}
                onChange={e => setOtYear(parseInt(e.target.value) || nowYear)}
                className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Estado</label>
              <select value={otStatusFlt} onChange={e => setOtStatusFlt(e.target.value)}
                className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {['all','pending','approved','rejected','compensated'].map(v => (
                  <option key={v} value={v}>{OT_STATUS_LABELS[v] ?? 'Todos'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Empleado</label>
              <EmpSelect value={empFilter} onChange={setEmpFilter} employees={employees} loading={loadingEmp} />
            </div>
            <button onClick={loadOT} disabled={loadingOT}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loadingOT ? 'Cargando…' : 'Consultar'}
            </button>
          </div>

          {otTablePend ? <PendingTable table="overtime_requests" session="C-5" /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Pendientes" value={otKpis.pending}
                  color={otKpis.pending > 0 ? 'text-amber-400' : 'text-white'} />
                <KpiCard label="Aprobadas" value={otKpis.approvedCount}
                  sub={`${otKpis.approvedHrs.toFixed(1)} h totales`} color="text-green-400" />
                <KpiCard label="Rechazadas" value={otKpis.rejected}
                  color={otKpis.rejected > 0 ? 'text-red-400' : 'text-white'} />
                <KpiCard label="H. suplementarias aprobadas" value={`${otKpis.suplemHrs.toFixed(1)} h`}
                  sub="Límite legal: 48 h/mes"
                  color={otKpis.suplemHrs > 48 ? 'text-red-400' : 'text-blue-400'} />
              </div>
              {loadingOT ? <Spinner /> : otRequests.length === 0 ? (
                <EmptyState msg="No hay solicitudes para los filtros seleccionados." />
              ) : (
                <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-left">
                        {['Colaborador','Fecha','Tipo','Horas','Monto $','Justificación','Workflow','Estado'].map(h => (
                          <th key={h} className="px-4 py-3 font-medium text-white/60">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {otRequests.map(r => (
                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2.5 text-white whitespace-nowrap">
                            {empName(employees, r.employee_id)}
                            <span className="ml-1 font-mono text-xs text-white/40">{empCode(employees, r.employee_id)}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-white/70">{r.requested_date}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.hour_type === 'SUPLEMENTARIA' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {r.hour_type === 'SUPLEMENTARIA' ? 'Suplem. 50%' : 'Extraord. 100%'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-white text-right">{r.hours_requested}h</td>
                          <td className="px-4 py-2.5 text-right text-xs text-white/30" title="Disponible en C-3">—</td>
                          <td className="px-4 py-2.5 text-white/60 max-w-[160px]">
                            <span title={r.justification}>
                              {r.justification.length > 45 ? r.justification.slice(0,45)+'…' : r.justification}
                            </span>
                            {r.review_note && (
                              <p className="text-xs text-white/30 italic mt-0.5">
                                ↳ {r.review_note.length > 35 ? r.review_note.slice(0,35)+'…' : r.review_note}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.reviewed_by
                              ? <span className="text-white/60">1 nivel ✓</span>
                              : <span className="text-white/30">Sin revisar</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${OT_STATUS_CLASSES[r.status] ?? ''}`}>
                              {OT_STATUS_LABELS[r.status] ?? r.status}
                            </span>
                            {r.compensate_as_time && (
                              <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">T</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3 — VACACIONES
      ══════════════════════════════════════════════════════ */}
      {activeTab === 3 && (
        <div className="space-y-5">
          {vacTablePend ? <PendingTable table="vacation_ledger" session="C-6" /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Utilizados" value={vacKpis.used} color="text-blue-400" />
                <KpiCard label="Devengos" value={vacKpis.accrual} color="text-green-400" />
                <KpiCard label="Reversiones" value={vacKpis.reversal}
                  color={vacKpis.reversal > 0 ? 'text-amber-400' : 'text-white'} />
                <KpiCard label="Días netos (saldo)" value={vacKpis.totalDays.toFixed(1)}
                  color={vacKpis.totalDays >= 0 ? 'text-green-400' : 'text-red-400'}
                  sub="ACCRUAL − USED − PAYOUT" />
              </div>
              {loadingVac ? <Spinner /> : vacLedger.length === 0 ? (
                <EmptyState msg="No hay movimientos de vacaciones registrados." />
              ) : (
                <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-left">
                        {['Colaborador','Movimiento','Fecha ref.','Días Δ','Monto $','Base 12m $','Nota'].map(h => (
                          <th key={h} className="px-4 py-3 font-medium text-white/60">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vacLedger.map(v => (
                        <tr key={v.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2.5 text-white whitespace-nowrap">
                            {empName(employees, v.employee_id)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${VAC_MOVE_CLASSES[v.movement_type] ?? 'bg-white/10 text-white/50'}`}>
                              {VAC_MOVE_LABELS[v.movement_type] ?? v.movement_type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-white/70">{v.reference_date}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${v.days_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {v.days_delta >= 0 ? '+' : ''}{v.days_delta}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-white/70">
                            {v.amount_usd != null ? `$${v.amount_usd.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-white/40">
                            {v.income_base_usd != null ? `$${v.income_base_usd.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-white/50 max-w-[150px]">
                            {v.notes ? <span title={v.notes}>{v.notes.length > 38 ? v.notes.slice(0,38)+'…' : v.notes}</span>
                              : <span className="text-white/20">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4 — RANKING PUNTUALIDAD
      ══════════════════════════════════════════════════════ */}
      {activeTab === 4 && (
        <div className="space-y-5">
          {MonthFilter}

          {loadingMonth ? <Spinner /> : rankingRows.length === 0 ? (
            <EmptyState msg="Sin datos de marcaciones para el período seleccionado." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Columna izquierda — Ranking de puntualidad */}
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10">
                  <h2 className="text-sm font-semibold text-white">Ranking de Puntualidad</h2>
                  <p className="text-xs text-white/40 mt-0.5">Puntual = entrada ≤ 08:10</p>
                </div>
                <div className="divide-y divide-white/5">
                  {rankBestToWorst.map((row, idx) => (
                    <div key={row.employee.id} className="flex items-center gap-3 px-5 py-3">
                      {/* Position */}
                      <span className={`text-sm font-bold w-6 text-center shrink-0 ${
                        idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-white/60' : idx === 2 ? 'text-orange-700' : 'text-white/30'
                      }`}>
                        {idx + 1}
                      </span>
                      {/* Avatar */}
                      <Avatar emp={row.employee} />
                      {/* Name + sub */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {row.employee.last_name}, {row.employee.first_name}
                        </p>
                        <p className="text-xs text-white/40">
                          {row.late_days === 0
                            ? 'Sin atrasos'
                            : `${row.late_days} atraso${row.late_days !== 1 ? 's' : ''}`}
                        </p>
                        {/* Green progress bar */}
                        <div className="mt-1.5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${row.pct}%`,
                              backgroundColor: row.pct >= 90 ? '#22c55e' : row.pct >= 70 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                      {/* % pill */}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        row.pct >= 90 ? 'bg-green-500/20 text-green-400'
                          : row.pct >= 70 ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {row.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columna derecha — Atrasos acumulados */}
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10">
                  <h2 className="text-sm font-semibold text-white">Atrasos Acumulados</h2>
                  <p className="text-xs text-white/40 mt-0.5">Minutos extra sobre 08:10 · multa ref. $0.05/min</p>
                </div>
                {rankWorstLate.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-green-400/60">
                    ✓ Sin atrasos en el período
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {rankWorstLate.map(row => {
                      const fineEst = (row.total_late_min * 0.05).toFixed(2)
                      const barPct  = Math.round((row.total_late_min / maxLateMin) * 100)
                      return (
                        <div key={row.employee.id} className="flex items-center gap-3 px-5 py-3">
                          <Avatar emp={row.employee} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {row.employee.last_name}, {row.employee.first_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-white/50 font-mono">
                                {row.total_late_min} min
                              </span>
                              <span className="text-xs text-red-400 font-mono">
                                ~${fineEst}
                              </span>
                            </div>
                            {/* Red progress bar */}
                            <div className="mt-1.5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500/70 rounded-full transition-all"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 bg-red-500/20 text-red-400">
                            {row.late_days}d
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 5 — NOVEDADES
      ══════════════════════════════════════════════════════ */}
      {activeTab === 5 && (
        <div className="space-y-5">
          {novTablePend ? <PendingTable table="novelties" session="C-2 (GAP-2)" /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total novedades" value={novKpis.total} color="text-white" />
                <KpiCard label="Alta / Crítica" value={novKpis.high}
                  color={novKpis.high > 0 ? 'text-red-400' : 'text-white'} />
                {Array.from(novKpis.byType.entries()).slice(0, 2).map(([type, cnt]) => (
                  <KpiCard key={type} label={type.replace(/_/g,' ')} value={cnt} color="text-amber-400" />
                ))}
              </div>
              {loadingNov ? <Spinner /> : novelties.length === 0 ? (
                <EmptyState msg="No hay novedades registradas." />
              ) : (
                <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-left">
                        {['Fecha','Colaborador','Tipo','Severidad','Detectado por','Detalles'].map(h => (
                          <th key={h} className="px-4 py-3 font-medium text-white/60">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {novelties.map(n => (
                        <tr key={n.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2.5 font-mono text-xs text-white/70">{n.date}</td>
                          <td className="px-4 py-2.5 text-white whitespace-nowrap">
                            {empName(employees, n.employee_id)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-white/70">{n.type.replace(/_/g,' ')}</td>
                          <td className="px-4 py-2.5">
                            {n.severity ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${NOVELTY_SEVERITY_CLASSES[n.severity] ?? 'bg-white/10 text-white/50'}`}>
                                {n.severity}
                              </span>
                            ) : <span className="text-white/30">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-white/50">{n.detected_by ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-white/40 max-w-[200px]">
                            {n.details ? (
                              <span title={JSON.stringify(n.details)}>
                                {JSON.stringify(n.details).slice(0, 60)}…
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 6 — MULTAS APLICADAS
      ══════════════════════════════════════════════════════ */}
      {activeTab === 6 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Mes</label>
              <select value={fineMonth} onChange={e => setFineMonth(e.target.value)}
                className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {MONTHS.map((m, i) => (
                  <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Año</label>
              <input type="number" value={fineYear} min={2020} max={2030}
                onChange={e => setFineYear(parseInt(e.target.value) || nowYear)}
                className="p-2 border border-white/20 rounded-lg text-sm bg-white/5 text-white w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <button onClick={loadFine} disabled={loadingFine}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loadingFine ? 'Cargando…' : 'Consultar'}
            </button>
          </div>

          {fineTablePend ? <PendingTable table="fine_ledger" session="C-4" /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Multas del período" value={fineKpis.total} />
                <KpiCard label="Total calculado" value={`$${fineKpis.totalCalc.toFixed(2)}`}
                  color="text-white" />
                <KpiCard label="Total aplicado" value={`$${fineKpis.totalApplied.toFixed(2)}`}
                  color="text-red-400" sub="Después de tope legal" />
                <KpiCard label="Capadas por tope" value={fineKpis.capped}
                  color={fineKpis.capped > 0 ? 'text-amber-400' : 'text-white'} />
              </div>
              {loadingFine ? <Spinner /> : fineLedger.length === 0 ? (
                <EmptyState msg="No hay multas registradas para el período." />
              ) : (
                <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-left">
                        {['Fecha','Colaborador','Tipo incidente','Calculado','Aplicado','Capada','Exceso'].map(h => (
                          <th key={h} className="px-4 py-3 font-medium text-white/60">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fineLedger.map(f => (
                        <tr key={f.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2.5 font-mono text-xs text-white/70">{f.incident_date}</td>
                          <td className="px-4 py-2.5 text-white whitespace-nowrap">
                            {empName(employees, f.employee_id)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-white/70">
                            {FINE_TYPE_LABELS[f.incident_type] ?? f.incident_type}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-white/70">
                            ${f.calculated_amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-red-400 font-semibold">
                            ${f.applied_amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {f.was_capped
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">Sí</span>
                              : <span className="text-white/25 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-white/40">
                            {f.was_capped ? `$${f.cap_excess.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-white/5">
                        <td colSpan={3} className="px-4 py-2 text-xs text-white/40">
                          {fineLedger.length} registro{fineLedger.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-white/60">
                          ${fineKpis.totalCalc.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-red-400/70">
                          ${fineKpis.totalApplied.toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  )
}

export default ReportesPage
