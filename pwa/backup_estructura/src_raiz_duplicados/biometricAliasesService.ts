import type { SupabaseClient } from '@supabase/supabase-js'
import type { BiometricDeviceConfig, UpdateBiometricAliasInput } from '../types/biometric'

export async function listBiometricDevicesConfig(
  supabase: SupabaseClient<any>
): Promise<BiometricDeviceConfig[]> {
  const { data, error } = await supabase.rpc('list_biometric_devices_config')

  if (error) {
    throw new Error(error.message || 'No se pudo listar los biométricos del tenant')
  }

  return (data ?? []) as BiometricDeviceConfig[]
}

export async function updateBiometricDeviceAlias(
  supabase: SupabaseClient<any>,
  input: UpdateBiometricAliasInput
): Promise<BiometricDeviceConfig> {
  const { data, error } = await supabase.rpc('set_biometric_location_alias', {
    p_device_id: input.deviceId,
    p_location_alias: input.locationAlias,
    p_location_details: input.locationDetails ?? null,
    p_display_order: input.displayOrder ?? null,
    p_is_active: input.isActive ?? null,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el alias del biométrico')
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    throw new Error('Supabase no devolvió el biométrico actualizado')
  }

  return row as BiometricDeviceConfig
}

export function biometricLabel(device: Pick<BiometricDeviceConfig, 'display_alias' | 'serial_no' | 'name'>) {
  const primary = (device.display_alias || '').trim() || (device.name || '').trim() || device.serial_no
  return `${primary}${device.serial_no ? ` · ${device.serial_no}` : ''}`
}
