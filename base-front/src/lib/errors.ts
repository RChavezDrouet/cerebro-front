export function safeErrorMessage(err: unknown): string {
  // OWASP: evitar fuga de información sensible por mensajes de error
  if (typeof err === 'string') return 'Operación no completada.'
  if (err && typeof err === 'object' && 'message' in err) return 'Operación no completada.'
  return 'Operación no completada.'
}
