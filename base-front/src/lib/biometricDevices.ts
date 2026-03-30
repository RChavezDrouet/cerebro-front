import { ATT_SCHEMA, supabase } from '@/config/supabase'

export type RawBiometricDevice = Record<string, any>

export type NormalizedBiometricDevice = {
  id: string
  serialNumber: string
  location: string | null
  label: string
  isActive: boolean
  deviceTimezone: string | null
  lastSeenAt: string | null
}

export function normalizeBiometricDevice(row: RawBiometricDevice): NormalizedBiometricDevice {
  const serialNumber = String(row?.serial_number ?? row?.serial_no ?? row?.serial ?? '').trim()
  const location = [row?.location, row?.name, row?.device_name]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || null

  const label = location ? `${location} — SN ${serialNumber}` : `SN ${serialNumber}`

  return {
    id: String(row?.id ?? serialNumber),
    serialNumber,
    location,
    label,
    isActive: row?.is_active !== false,
    deviceTimezone: row?.device_timezone ?? null,
    lastSeenAt: row?.last_seen_at ?? null,
  }
}

export async function fetchNormalizedBiometricDevices(tenantId: string): Promise<NormalizedBiometricDevice[]> {
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('biometric_devices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('serial_number', { ascending: true })

  if (error) {
    const fallback = await supabase
      .schema(ATT_SCHEMA)
      .from('biometric_devices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('serial_no', { ascending: true })

    if (fallback.error) throw fallback.error
    return (fallback.data ?? []).map(normalizeBiometricDevice)
  }

  return (data ?? []).map(normalizeBiometricDevice)
}

export function formatBiometricLocation(device: Pick<NormalizedBiometricDevice, 'location' | 'serialNumber'> | null | undefined): string {
  if (!device) return '—'
  return device.location?.trim() ? device.location.trim() : `SN ${device.serialNumber}`
}

const METHOD_LABELS: Record<string, string> = {
  face: 'Facial',
  facial: 'Facial',
  fingerprint: 'Huella digital',
  huella: 'Huella digital',
  fp: 'Huella digital',
  pin: 'Código',
  code: 'Código',
  codigo: 'Código',
  card: 'Tarjeta',
  rfid: 'Tarjeta',
  usb: 'USB',
  web: 'Web/PWA',
  pwa: 'Web/PWA',
  biometric: 'Biométrico',
}

export function humanizeMarkingTypes(values: Array<string | null | undefined>): string[] {
  const mapped = values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)
    .map((value) => METHOD_LABELS[value] ?? value.replace(/[_-]+/g, ' '))

  return Array.from(new Set(mapped))
}
