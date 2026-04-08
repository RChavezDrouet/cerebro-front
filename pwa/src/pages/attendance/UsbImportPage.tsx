import React from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { UploadCloud, Loader2, CheckCircle2, FileText } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

import * as XLSX from 'xlsx'

type ImportRow = {
  employee_code: string
  punched_at: string
  type?: string
  source?: string
  biometric_method?: string
  status?: string
  verify_type?: string
  serial_no?: string
  biometric_employee_code?: string
  pin?: string
}

function normalizeHeaders(h: unknown) {
  return String(h || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function cleanCell(v: unknown) {
  return String(v ?? '').trim().replace(/^"|"$/g, '')
}

function splitLine(line: string) {
  if (line.includes('\t')) return line.split('\t').map(cleanCell)
  if (line.includes(';')) return line.split(';').map(cleanCell)
  if (line.includes(',')) return line.split(',').map(cleanCell)
  return line.trim().split(/\s{2,}|\s\|\s|\|/).map(cleanCell)
}

function looksLikeHeader(parts: string[]) {
  const joined = parts.map((p) => normalizeHeaders(p)).join('|')
  return [
    'employee_code',
    'codigo',
    'cod_empleado',
    'empleado',
    'pin',
    'biometric_employee_code',
    'punched_at',
    'fecha_hora',
    'timestamp',
    'datetime',
    'type',
    'tipo',
  ].some((token) => joined.includes(token))
}

function mapObjectRow(r: Record<string, unknown>): ImportRow {
  const m: Record<string, unknown> = {}
  Object.keys(r).forEach((k) => {
    m[normalizeHeaders(k)] = r[k]
  })

  const code = cleanCell(m.employee_code || m.codigo || m.cod_empleado || m.empleado || m.pin || m.biometric_employee_code)
  const ts = cleanCell(m.punched_at || m.fecha_hora || m.timestamp || m.datetime || m.fecha)
  const pin = cleanCell(m.biometric_employee_code || m.pin || code)

  return {
    employee_code: code,
    punched_at: ts,
    type: cleanCell(m.type || m.tipo || ''),
    source: cleanCell(m.source || 'usb'),
    biometric_method: cleanCell(m.biometric_method || m.metodo_biometrico || m.method || ''),
    status: cleanCell(m.status || m.estado || ''),
    verify_type: cleanCell(m.verify_type || m.tipo_verificacion || ''),
    serial_no: cleanCell(m.serial_no || m.sn || ''),
    biometric_employee_code: pin,
    pin,
  }
}

function parseDatText(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const rows: ImportRow[] = []
  let serialNo = ''

  for (const line of lines) {
    const snMatch = line.match(/\bSN\s*[:=]\s*([A-Za-z0-9_-]+)/i)
    if (snMatch) {
      serialNo = snMatch[1]
      continue
    }

    const parts = splitLine(line)
    if (parts.length < 2) continue
    if (looksLikeHeader(parts)) continue

    const code = cleanCell(parts[0])
    const punchedAt = cleanCell(parts[1])
    const status = cleanCell(parts[2] ?? '')
    const verifyType = cleanCell(parts[3] ?? '')

    if (!code || !punchedAt) continue

    rows.push({
      employee_code: code,
      punched_at: punchedAt,
      source: 'usb_dat',
      status,
      verify_type: verifyType,
      serial_no: serialNo || undefined,
      biometric_employee_code: code,
      pin: code,
    })
  }

  return rows
}

export default function UsbImportPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const [fileName, setFileName] = React.useState('')
  const [rows, setRows] = React.useState<ImportRow[]>([])

  const parseFile = async (file: File) => {
    setFileName(file.name)
    const lower = file.name.toLowerCase()

    try {
      let out: ImportRow[] = []

      if (lower.endsWith('.dat') || lower.endsWith('.txt') || lower.endsWith('.log')) {
        const text = await file.text()
        out = parseDatText(text)
      } else {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
        out = raw.map(mapObjectRow)
      }

      const valid = out.filter((r) => r.employee_code && r.punched_at)
      setRows(valid)

      if (valid.length === 0) {
        toast.error('No se encontraron filas válidas. Para DAT usa formato ATTLOG: PIN, fecha_hora, status, verify_type.')
      } else {
        toast.success(`Archivo cargado: ${valid.length} filas`)
      }
    } catch (e: any) {
      setRows([])
      toast.error(e?.message || 'No se pudo leer el archivo')
    }
  }

  const runImport = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sin tenant')
      if (rows.length === 0) throw new Error('Sin filas')
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .rpc('import_usb_punches', { p_tenant_id: tenantId, p_rows: rows })
      if (error) throw error
      return data
    },
    onSuccess: () => toast.success('Importación completada'),
    onError: (e: any) => toast.error(e?.message || 'No se pudo importar'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Importación USB</h1>
        <p className="mt-1 text-sm text-white/60">Sube XLSX, CSV o DAT y registra marcaciones usando RPC.</p>
      </div>

      <Card title="Archivo" subtitle="XLSX/CSV: employee_code, punched_at. DAT ATTLOG: PIN, fecha_hora, status, verify_type.">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.dat,.txt,.log"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) parseFile(f)
          }}
          className="block w-full text-sm text-white/70 file:mr-4 file:rounded-2xl file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
        />
        {fileName ? <div className="mt-2 text-xs text-white/50">{fileName}</div> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            leftIcon={runImport.isPending ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            onClick={() => runImport.mutate()}
            disabled={runImport.isPending || rows.length === 0}
          >
            Importar
          </Button>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <CheckCircle2 size={14} />
            Filas: <span className="font-semibold text-white">{rows.length}</span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
          <div className="flex items-center gap-2 font-semibold text-white/80">
            <FileText size={14} />
            DAT soportado
          </div>
          <div className="mt-2">
            Ejemplo ATTLOG: <span className="font-mono">1\t2026-03-29 15:54:00\t0\t15</span>
          </div>
          <div className="mt-1">
            Si tu DAT usa PIN biométrico distinto al código del empleado, conviene ajustar el RPC para resolver también por{' '}
            <span className="font-mono">biometric_employee_code</span>.
          </div>
          <div className="mt-1">
            Si recibes error <span className="font-mono">function import_usb_punches does not exist</span>, ejecuta el SQL del ZIP.
          </div>
        </div>
      </Card>

      <Card title="Previsualización" subtitle="Primeras 50 filas válidas">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60">
              <tr>
                <th className="py-2 text-left">employee_code</th>
                <th className="py-2 text-left">punched_at</th>
                <th className="py-2 text-left">status</th>
                <th className="py-2 text-left">verify_type</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r, idx) => (
                <tr key={idx} className="border-t border-white/10">
                  <td className="py-2 font-semibold">{r.employee_code}</td>
                  <td className="py-2">{r.punched_at}</td>
                  <td className="py-2 text-white/70">{r.status ?? ''}</td>
                  <td className="py-2 text-white/70">{r.verify_type ?? ''}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-white/55" colSpan={4}>
                    Sin datos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
