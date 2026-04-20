function readDebugFlag(): boolean {
  if (import.meta.env.DEV) return true

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

