function readDebugFlag(): boolean {
  if (import.meta.env.DEV) return true

  if (String(import.meta.env.VITE_DEBUG_DASHBOARD ?? '').trim().toLowerCase() === 'true') {
    return true
  }

  try {
    return localStorage.getItem('HRCLOUD_DEBUG_BASE') === '1'
  } catch {
    return false
  }
}

export function baseDebug(scope: string, payload: Record<string, unknown>) {
  if (!readDebugFlag()) return

  console.info(`[HRCloud Base Debug] ${scope}`, payload)
}
