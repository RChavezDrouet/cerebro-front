/**
 * ==============================================
 * CEREBRO SaaS - Funciones de Validación
 * ==============================================
 */

import { VALIDATION } from './constants'

/**
 * Valida que un campo no esté vacío
 */
export const isRequired = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * Valida formato de email
 */
export const isValidEmail = (email) => {
  if (!email) return false
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email.trim())
}

/**
 * Calcula el dígito verificador del RUC ecuatoriano
 */
const calculateRucVerifier = (digits, type = 'natural') => {
  const coefficients = {
    natural: [2, 1, 2, 1, 2, 1, 2, 1, 2],
    public: [3, 2, 7, 6, 5, 4, 3, 2],
    private: [4, 3, 2, 7, 6, 5, 4, 3, 2],
  }

  const coef = coefficients[type]
  if (!coef) return -1

  let sum = 0
  for (let i = 0; i < coef.length; i++) {
    let product = parseInt(digits[i]) * coef[i]
    
    if (type === 'natural') {
      sum += product >= 10 ? product - 9 : product
    } else {
      sum += product
    }
  }

  let modulo = type === 'natural' ? 10 : 11
  let verifier = modulo - (sum % modulo)
  
  if (verifier === modulo) verifier = 0
  
  return verifier
}

/**
 * Valida el RUC ecuatoriano completo
 */
export const validateRUC = (ruc) => {
  const cleanRuc = ruc?.toString().replace(/\D/g, '')

  if (!cleanRuc || cleanRuc.length !== VALIDATION.RUC_LENGTH) {
    return { valid: false, error: `El RUC debe tener exactamente ${VALIDATION.RUC_LENGTH} dígitos` }
  }

  if (!/^\d+$/.test(cleanRuc)) {
    return { valid: false, error: 'El RUC solo debe contener números' }
  }

  const provinceCode = parseInt(cleanRuc.substring(0, 2))
  
  if ((provinceCode < 1 || provinceCode > 24) && provinceCode !== 30) {
    return { valid: false, error: 'El código de provincia del RUC no es válido' }
  }

  const thirdDigit = parseInt(cleanRuc[2])
  let type = ''
  let verifierPosition = 0
  let expectedVerifier = 0

  if (thirdDigit >= 0 && thirdDigit <= 5) {
    type = 'natural'
    verifierPosition = 9
    expectedVerifier = calculateRucVerifier(cleanRuc.substring(0, 9), 'natural')
  } else if (thirdDigit === 6) {
    type = 'public'
    verifierPosition = 8
    expectedVerifier = calculateRucVerifier(cleanRuc.substring(0, 8), 'public')
  } else if (thirdDigit === 9) {
    type = 'private'
    verifierPosition = 9
    expectedVerifier = calculateRucVerifier(cleanRuc.substring(0, 9), 'private')
  } else {
    return { valid: false, error: 'El tercer dígito del RUC no es válido' }
  }

  const actualVerifier = parseInt(cleanRuc[verifierPosition])

  if (expectedVerifier !== actualVerifier) {
    return { valid: false, error: 'El dígito verificador del RUC no es correcto' }
  }

  return { valid: true, type, formattedRuc: cleanRuc }
}

/**
 * Valida número de teléfono
 */
export const validatePhone = (phone, required = false) => {
  if (!phone || !phone.trim()) {
    if (required) return { valid: false, error: 'El teléfono es obligatorio' }
    return { valid: true }
  }

  const cleanPhone = phone.replace(/[^\d+]/g, '')

  if (cleanPhone.length < VALIDATION.PHONE_MIN_LENGTH) {
    return { valid: false, error: `El teléfono debe tener al menos ${VALIDATION.PHONE_MIN_LENGTH} dígitos` }
  }

  if (cleanPhone.length > VALIDATION.PHONE_MAX_LENGTH) {
    return { valid: false, error: `El teléfono no puede tener más de ${VALIDATION.PHONE_MAX_LENGTH} dígitos` }
  }

  return { valid: true, formattedPhone: cleanPhone }
}

/**
 * Valida que al menos uno de los teléfonos esté presente
 */
export const validateAtLeastOnePhone = (landline, mobile) => {
  const hasLandline = landline && landline.trim().length > 0
  const hasMobile = mobile && mobile.trim().length > 0

  if (!hasLandline && !hasMobile) {
    return { valid: false, error: 'Debe ingresar al menos un teléfono (convencional o celular)' }
  }

  if (hasLandline) {
    const landlineValidation = validatePhone(landline)
    if (!landlineValidation.valid) {
      return { valid: false, error: `Teléfono convencional: ${landlineValidation.error}` }
    }
  }

  if (hasMobile) {
    const mobileValidation = validatePhone(mobile)
    if (!mobileValidation.valid) {
      return { valid: false, error: `Teléfono celular: ${mobileValidation.error}` }
    }
  }

  return { valid: true }
}

/**
 * Evalúa la fortaleza de una contraseña
 */
export const validatePasswordStrength = (password, rules = {}) => {
  const {
    minLength = VALIDATION.PASSWORD_MIN_LENGTH,
    requireDigit = false,
    requireUppercase = false,
    requireSpecial = false,
  } = rules

  const feedback = []
  let valid = true

  if (!password || password.length < minLength) {
    feedback.push(`Mínimo ${minLength} caracteres`)
    valid = false
  }

  if (requireDigit && !/\d/.test(password)) {
    feedback.push('Debe incluir al menos un número')
    valid = false
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    feedback.push('Debe incluir al menos una mayúscula')
    valid = false
  }

  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Debe incluir al menos un carácter especial')
    valid = false
  }

  // Calcular score (0-4)
  let score = 0
  if (password) {
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++
    score = Math.min(4, score)
  }

  return { valid, score, feedback }
}

/**
 * Valida fecha
 */
export const isValidDate = (date) => {
  if (!date) return false
  const d = new Date(date)
  return d instanceof Date && !isNaN(d)
}

/**
 * Valida que una fecha sea futura
 */
export const isFutureDate = (date) => {
  if (!isValidDate(date)) return false
  return new Date(date) > new Date()
}

/**
 * Valida que una fecha sea pasada
 */
export const isPastDate = (date) => {
  if (!isValidDate(date)) return false
  return new Date(date) < new Date()
}

/**
 * Valida número positivo
 */
export const isPositiveNumber = (value) => {
  const num = parseFloat(value)
  return !isNaN(num) && num > 0
}

/**
 * Valida número no negativo
 */
export const isNonNegativeNumber = (value) => {
  const num = parseFloat(value)
  return !isNaN(num) && num >= 0
}

/**
 * Valida longitud máxima de texto
 */
export const maxLength = (value, max) => {
  if (!value) return true
  return value.length <= max
}

/**
 * Valida longitud mínima de texto
 */
export const minLength = (value, min) => {
  if (!value) return false
  return value.length >= min
}

export default {
  isRequired,
  isValidEmail,
  validateRUC,
  validatePhone,
  validateAtLeastOnePhone,
  validatePasswordStrength,
  isValidDate,
  isFutureDate,
  isPastDate,
  isPositiveNumber,
  isNonNegativeNumber,
  maxLength,
  minLength,
}
