import { DateTime } from 'luxon'

/**
 * Attempts to parse attendance logs (ATTLOG) sent by ZKTeco push/ADMS.
 *
 * Most common formats (line-based):
 * - "PIN\tYYYY-MM-DD HH:MM:SS\t..."
 * - "PIN,YYYY-MM-DD HH:MM:SS,..."
 * - "PIN YYYY-MM-DD HH:MM:SS ..."
 */
export function parseAttlogLines(bodyText, deviceTz) {
  const lines = String(bodyText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const out = []

  for (const line of lines) {
    // Split by tab first, then comma, then whitespace.
    let parts = line.split('\t')
    if (parts.length < 2) parts = line.split(',')
    if (parts.length < 2) parts = line.split(/\s+/)
    if (parts.length < 2) continue

    const pin = String(parts[0]).trim()
    // Date may be two tokens if whitespace-split
    let dtStr = String(parts[1]).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(dtStr) && parts[2]) {
      dtStr = `${dtStr} ${String(parts[2]).trim()}`
    }

    const dt = DateTime.fromFormat(dtStr, 'yyyy-LL-dd HH:mm:ss', { zone: deviceTz })
    if (!dt.isValid) continue

    out.push({
      device_employee_code: pin,
      punched_at_utc: dt.toUTC().toISO()
    })
  }

  return out
}
