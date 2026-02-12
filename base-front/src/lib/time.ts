// src/lib/time.ts

export function isTimeHHMMorHHMMSS(v: string): boolean {
  const s = (v ?? '').trim()
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s)
}

export function normalizeToHHMMSS(v: string): string {
  const s = (v ?? '').trim()
  if (!isTimeHHMMorHHMMSS(s)) throw new Error('invalid time')
  return s.length === 5 ? `${s}:00` : s
}

export function toHHMM(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  return s.length >= 5 ? s.slice(0, 5) : s
}
