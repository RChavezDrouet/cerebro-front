// Helper opcional para mostrar textos consistentes en el formulario de empleados.

export function biometricDisplayText(option: {
  alias?: string | null
  serialNo?: string | null
  details?: string | null
}) {
  const alias = (option.alias || '').trim()
  const serial = (option.serialNo || '').trim()
  const details = (option.details || '').trim()

  if (alias && details) return `${alias} · ${details}`
  if (alias) return alias
  if (serial) return serial
  return 'Biométrico'
}
