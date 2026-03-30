// Objetivo: en el formulario de empleado, los combos de biométrico deben mostrar
// display_alias y NO serial_no como valor principal de usabilidad.

import { listBiometricDevicesConfig, biometricLabel } from '../src/services/biometricAliasesService'

const loadBiometricOptions = async () => {
  const rows = await listBiometricDevicesConfig(supabase)

  const activeRows = rows.filter((row) => row.is_active)

  setBiometricOptions(
    activeRows.map((row) => ({
      value: row.id,
      label: biometricLabel(row), // ejemplo: Entrada principal · 8029252100142
      alias: row.display_alias,
      serialNo: row.serial_no,
      details: row.location_details,
    }))
  )
}

// Si quieres que solo se vea el alias y no el serial, cambia `biometricLabel(row)` por `row.display_alias`.
