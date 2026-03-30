export type BiometricDeviceConfig = {
  id: string
  tenant_id: string
  serial_no: string
  name: string | null
  location_alias: string | null
  location_details: string | null
  display_alias: string
  display_order: number | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type UpdateBiometricAliasInput = {
  deviceId: string
  locationAlias: string
  locationDetails?: string | null
  displayOrder?: number | null
  isActive?: boolean | null
}
