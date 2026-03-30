const KEY = 'hrcloud_pwa_device_id'

export function getOrCreateDeviceId() {
  const existing = localStorage.getItem(KEY)
  if (existing) return existing

  const value =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  localStorage.setItem(KEY, value)
  return value
}