import type { SupabaseClient } from '@supabase/supabase-js'
import type { BiometricDeviceConfig, UpdateBiometricAliasInput } from '../types/biometric'

const ATT_SCHEMA = 'attendance'

function normalizeRows(rows: any[] | null | undefined): BiometricDeviceConfig[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    serial_no: row.serial_no,
    name: row.name ?? null,
    location_alias: row.location_alias ?? null,
    location_details: row.location_details ?? null,
    display_alias:
      (row.display_alias ?? '').trim() ||
      (row.location_alias ?? '').trim() ||
      (row.name ?? '').trim() ||
      row.serial_no,
    display_order: row.display_order ?? null,
    is_active: row.is_active ?? true,
    last_seen_at: row.last_seen_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }))
}

export async function listBiometricDevicesConfig(
  supabase: SupabaseClient<any>
): Promise<BiometricDeviceConfig[]> {
  const rpcRes = await supabase.schema(ATT_SCHEMA).rpc('list_biometric_devices_config')

  if (!rpcRes.error) {
    return normalizeRows(rpcRes.data as any[])
  }

  const msg = rpcRes.error.message || ''
  const canFallback =
    msg.includes('schema cache') ||
    msg.includes('Could not find the function') ||
    msg.includes('PGRST202')

  if (!canFallback) {
    throw new Error(msg || 'No se pudo listar los biométricos del tenant')
  }

  const selectRes = await supabase
    .schema(ATT_SCHEMA)
    .from('biometric_devices')
    .select('id,tenant_id,serial_no,name,location_alias,location_details,display_order,is_active,last_seen_at,created_at,updated_at')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (selectRes.error) {
    throw new Error(selectRes.error.message || 'No se pudo listar los biométricos del tenant')
  }

  return normalizeRows(selectRes.data as any[])
}

export async function updateBiometricDeviceAlias(
  supabase: SupabaseClient<any>,
  input: UpdateBiometricAliasInput
): Promise<BiometricDeviceConfig> {
  const rpcRes = await supabase.schema(ATT_SCHEMA).rpc('set_biometric_location_alias', {
    p_device_id: input.deviceId,
    p_location_alias: input.locationAlias,
    p_location_details: input.locationDetails ?? null,
    p_display_order: input.displayOrder ?? null,
    p_is_active: input.isActive ?? null,
  })

  if (!rpcRes.error) {
    const row = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data
    if (!row) {
      throw new Error('Supabase no devolvió el biométrico actualizado')
    }
    return normalizeRows([row])[0]
  }

  const msg = rpcRes.error.message || ''
  const canFallback =
    msg.includes('schema cache') ||
    msg.includes('Could not find the function') ||
    msg.includes('PGRST202')

  if (!canFallback) {
    throw new Error(msg || 'No se pudo actualizar el alias del biométrico')
  }

  const updateRes = await supabase
    .schema(ATT_SCHEMA)
    .from('biometric_devices')
    .update({
      location_alias: input.locationAlias,
      location_details: input.locationDetails ?? null,
      display_order: input.displayOrder ?? null,
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.deviceId)
    .select('id,tenant_id,serial_no,name,location_alias,location_details,display_order,is_active,last_seen_at,created_at,updated_at')
    .single()

  if (updateRes.error) {
    throw new Error(updateRes.error.message || 'No se pudo actualizar el alias del biométrico')
  }

  return normalizeRows([updateRes.data])[0]
}

export function biometricLabel(device: Pick<BiometricDeviceConfig, 'display_alias' | 'location_alias' | 'serial_no' | 'name'>) {
  const primary =
    (device.display_alias || '').trim() ||
    (device.location_alias || '').trim() ||
    (device.name || '').trim() ||
    device.serial_no
  return `${primary}${device.serial_no ? ` · ${device.serial_no}` : ''}`
}
