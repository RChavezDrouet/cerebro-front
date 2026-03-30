// Minimal input hardening helpers (OWASP A03)

export function assertString(
  v: unknown,
  field: string,
  opts: { minLen?: number; maxLen?: number } = {}
) {
  const { minLen = 1, maxLen = 500 } = opts

  if (typeof v !== 'string') throw new Error(`Invalid ${field}`)
  const s = v.trim()
  if (s.length < minLen) throw new Error(`Missing ${field}`)
  if (s.length > maxLen) throw new Error(`${field} too long`)
  return s
}

export function assertEmail(v: unknown, field: string) {
  const s = assertString(v, field, { minLen: 3, maxLen: 254 })
  // Simple email sanity check
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) throw new Error(`Invalid ${field}`)
  return s.toLowerCase()
}

export function assertOneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]) {
  const s = assertString(v, field, { minLen: 1, maxLen: 100 })
  if (!allowed.includes(s as T)) throw new Error(`Invalid ${field}`)
  return s as T
}