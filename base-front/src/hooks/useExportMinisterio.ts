import { useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Fila exacta requerida por el formato FR-10 (Ministerio de Trabajo Ecuador) */
type ExportRow = {
  Cédula:      string
  Nombres:     string
  Fecha:       string
  Hora_Inicio: string
  Hora_Fin:    string
  Tipo_Hora:   string
}

type PunchRaw = {
  employee_id:  string
  punched_at:   string
  marking_type: string | null
  employee: { employee_code: string; first_name: string; last_name: string } | null
}

type EmployeeDay = {
  emp:   PunchRaw['employee']
  entry: PunchRaw | null
  exit:  PunchRaw | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-EC', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  } catch {
    return iso
  }
}

/**
 * Clasifica una marcación como entrada o salida.
 * Cubre valores ZKTeco numéricos (0/1/2/3/4) y texto (ENTRADA/SALIDA/IN/OUT).
 * Si no se reconoce, la primera marcación del empleado = entrada, la segunda = salida.
 */
function isEntry(marking_type: string | null): boolean {
  if (!marking_type) return true
  const mt = marking_type.toUpperCase().trim()
  // ZKTeco: 0=Check-In, 1=Check-Out, 2=Break-Out, 3=Break-In, 4=OT-In, 5=OT-Out
  if (mt === '0' || mt === '3' || mt === '4') return true
  if (mt === '1' || mt === '2' || mt === '5') return false
  // Texto español/inglés
  if (mt.includes('ENTRADA') || mt === 'IN' || mt === 'CHECKIN') return true
  if (mt.includes('SALIDA')  || mt === 'OUT' || mt === 'CHECKOUT') return false
  return true // fallback → entrada
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useExportMinisterio
 *
 * Genera el reporte FR-10 (formato Ministerio de Trabajo Ecuador) para una fecha.
 * Columnas exactas según ERS: Cédula | Nombres | Fecha | Hora_Inicio | Hora_Fin | Tipo_Hora
 *
 * NOTA: Tipo_Hora devuelve 'NORMAL_DIURNA' como placeholder hasta que exista
 * attendance.calculate_day_totals() (sesión CIRA C-3). Ver TECH_DEBT CIRA-2.
 */
export function useExportMinisterio() {
  const [exporting, setExporting] = useState(false)

  const exportDate = async (date: string): Promise<void> => {
    if (!date) { toast.error('Selecciona una fecha antes de exportar'); return }
    setExporting(true)

    try {
      const dayStart = `${date}T00:00:00.000Z`
      const dayEnd   = `${date}T23:59:59.999Z`

      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('punches')
        .select(`
          employee_id, punched_at, marking_type,
          employee:employees(employee_code, first_name, last_name)
        `)
        .gte('punched_at', dayStart)
        .lte('punched_at', dayEnd)
        .order('employee_id', { ascending: true })
        .order('punched_at',  { ascending: true })

      if (error) throw error

      // Normalizar join (PostgREST puede devolver array)
      const punches: PunchRaw[] = (data ?? []).map(row => ({
        ...row,
        employee: Array.isArray(row.employee)
          ? (row.employee[0] ?? null)
          : (row.employee ?? null),
      }))

      if (punches.length === 0) {
        toast('No hay marcaciones para esta fecha', { icon: 'ℹ️' })
        return
      }

      // Agrupar por empleado: primera entrada y última salida del día
      const byEmployee = new Map<string, EmployeeDay>()

      for (const punch of punches) {
        if (!byEmployee.has(punch.employee_id)) {
          byEmployee.set(punch.employee_id, { emp: punch.employee, entry: null, exit: null })
        }
        const day = byEmployee.get(punch.employee_id)!

        if (isEntry(punch.marking_type)) {
          // Primera entrada del día
          if (!day.entry) day.entry = punch
        } else {
          // Última salida del día (sobreescribir para quedar con la más tardía)
          day.exit = punch
        }
      }

      // Construir filas FR-10
      const rows: ExportRow[] = Array.from(byEmployee.values()).map(({ emp, entry, exit }) => ({
        Cédula:      emp?.employee_code ?? '',
        Nombres:     emp ? `${emp.first_name} ${emp.last_name}`.trim() : '',
        Fecha:       date,
        Hora_Inicio: entry ? fmtTime(entry.punched_at) : '',
        Hora_Fin:    exit  ? fmtTime(exit.punched_at)  : '',
        // Pendiente C-3: reemplazar con resultado de calculate_day_totals() cuando exista
        Tipo_Hora:   'NORMAL_DIURNA',
      }))

      // Construir workbook
      const ws = XLSX.utils.json_to_sheet(rows, {
        header: ['Cédula', 'Nombres', 'Fecha', 'Hora_Inicio', 'Hora_Fin', 'Tipo_Hora'],
      })

      // Anchos de columna
      ws['!cols'] = [
        { wch: 14 }, // Cédula
        { wch: 32 }, // Nombres
        { wch: 12 }, // Fecha
        { wch: 12 }, // Hora_Inicio
        { wch: 12 }, // Hora_Fin
        { wch: 22 }, // Tipo_Hora
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia MT')

      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      saveAs(blob, `MT_asistencia_${date}.xlsx`)
      toast.success(`Exportado: MT_asistencia_${date}.xlsx (${rows.length} filas)`)

    } catch (err) {
      console.error('[useExportMinisterio]', err)
      toast.error('Error al exportar. Revisa la consola para más detalles.')
    } finally {
      setExporting(false)
    }
  }

  return { exportDate, exporting }
}
