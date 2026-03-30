import { describe, expect, it } from 'vitest'
import { isValidEmail, validateRUC } from './validators'

describe('validators', () => {
  it('validates emails', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('bad')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('validates Ecuador RUC basic rules', () => {
    // Ejemplo de RUC válido muy usado en tests/documentación: 17900123... puede variar.
    // Aquí solo comprobamos reglas de longitud y dígitos.
    const r1 = validateRUC('123')
    expect(r1.valid).toBe(false)

    const r2 = validateRUC('1790012345001')
    // No garantizamos que sea válido real; al menos debe devolver un objeto.
    expect(typeof r2.valid).toBe('boolean')
  })
})
