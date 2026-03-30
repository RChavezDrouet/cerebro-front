/**
 * Regla de presentación para empleado y RRHH.
 * Usar siempre este texto visible cuando la marcación esté amarrada a ubicación.
 */
export function biometricDisplayLabel(device: {
  location_alias?: string | null
  name?: string | null
  serial_no?: string | null
}) {
  return device.location_alias?.trim() || device.name?.trim() || device.serial_no || 'Biométrico sin identificar'
}
