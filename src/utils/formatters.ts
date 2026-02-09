/**
 * ==============================================
 * CEREBRO SaaS - Funciones de Formateo
 * ==============================================
 * Archivo: src/utils/formatters.ts
 *
 * Nota:
 * - Este archivo incluye el alias `formatDateSmart` -> `formatSmartDate`
 *   para compatibilidad con TenantsPage.tsx.
 */

import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CURRENCY, DATE_FORMATS } from './constants'

type DateInput = string | Date | null | undefined

const toDate = (value: DateInput): Date | null => {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : value
  return isValid(d) ? d : null
}

/**
 * Formatea un valor como moneda
 */
export const formatCurrency = (amount: number | null | undefined, currency: string = CURRENCY.code): string => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `${CURRENCY.symbol}0.00`
  }

  return new Intl.NumberFormat(CURRENCY.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: CURRENCY.decimals,
    maximumFractionDigits: CURRENCY.decimals,
  }).format(amount)
}

/**
 * Formatea un número con separadores de miles
 */
export const formatNumber = (value: number | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0'
  }

  return new Intl.NumberFormat(CURRENCY.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Formatea un porcentaje (0-100)
 */
export const formatPercentage = (value: number | null | undefined, decimals: number = 1): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0%'
  }
  return `${formatNumber(value, decimals)}%`
}

/**
 * Formatea una fecha (dd/MM/yyyy por defecto)
 */
export const formatDate = (date: DateInput, formatStr: string = DATE_FORMATS.DISPLAY): string => {
  const d = toDate(date)
  if (!d) return ''

  try {
    return format(d, formatStr, { locale: es })
  } catch (error) {
    console.warn('Error al formatear fecha:', error)
    return ''
  }
}

/**
 * Formatea una fecha con hora
 */
export const formatDateTime = (date: DateInput): string => {
  return formatDate(date, DATE_FORMATS.DISPLAY_WITH_TIME)
}

/**
 * Formatea una fecha en formato relativo (hace X minutos, etc.)
 */
export const formatRelativeTime = (date: DateInput): string => {
  const d = toDate(date)
  if (!d) return ''

  try {
    return formatDistanceToNow(d, { addSuffix: true, locale: es })
  } catch (error) {
    console.warn('Error al formatear fecha relativa:', error)
    return ''
  }
}

/**
 * Formatea una fecha de manera inteligente:
 * - Relativa si es reciente
 * - Absoluta si es antigua
 */
export const formatSmartDate = (date: DateInput, recentThresholdHours: number = 24): string => {
  const d = toDate(date)
  if (!d) return ''

  try {
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < recentThresholdHours) {
      return formatRelativeTime(d)
    }

    return formatDate(d)
  } catch (error) {
    console.warn('Error al formatear fecha inteligente:', error)
    return ''
  }
}

/**
 * Alias de compatibilidad (TenantsPage.tsx importa formatDateSmart)
 */
export const formatDateSmart = formatSmartDate

/**
 * Formatea un RUC con separadores visuales: XXXX-XXXXX-XXXX
 */
export const formatRUC = (ruc: string | null | undefined): string => {
  if (!ruc) return ''
  const clean = String(ruc).replace(/\D/g, '')
  if (clean.length !== 13) return String(ruc)

  return `${clean.slice(0, 4)}-${clean.slice(4, 9)}-${clean.slice(9, 13)}`
}

/**
 * Formatea un número de teléfono (Ecuador)
 */
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return ''
  const clean = String(phone).replace(/\D/g, '')

  // Móvil: 09X XXX XXXX
  if (clean.length === 10 && clean.startsWith('09')) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`
  }

  // Fijo: (0X) XXX XXXX
  if (clean.length === 9 && clean.startsWith('0')) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 5)} ${clean.slice(5)}`
  }

  // Con código país: +593 X XXX XXXX
  if (clean.length === 12 && clean.startsWith('593')) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`
  }

  return String(phone)
}

/**
 * Trunca un texto y añade ellipsis
 */
export const truncateText = (text: string | null | undefined, maxLength: number = 50): string => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`
}

/**
 * Capitaliza la primera letra de un texto
 */
export const capitalize = (text: string | null | undefined): string => {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Capitaliza cada palabra de un texto
 */
export const capitalizeWords = (text: string | null | undefined): string => {
  if (!text) return ''
  return text
    .split(' ')
    .filter((w) => w.trim().length > 0)
    .map(capitalize)
    .join(' ')
}

/**
 * Convierte bytes a formato legible
 */
export const formatBytes = (bytes: number | null | undefined, decimals: number = 2): string => {
  if (!bytes || bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const sized = bytes / Math.pow(k, i)

  return `${parseFloat(sized.toFixed(dm))} ${sizes[i] ?? 'Bytes'}`
}

/**
 * Formatea duración en milisegundos a formato legible
 */
export const formatDuration = (ms: number | null | undefined): string => {
  if (!ms || ms <= 0) return '0s'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/**
 * Genera iniciales de un nombre
 */
export const getInitials = (name: string | null | undefined, maxChars: number = 2): string => {
  if (!name) return ''
  return name
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0]!.toUpperCase())
    .slice(0, maxChars)
    .join('')
}

/**
 * Formatea estado de empresa (tenant)
 */
export const formatCompanyStatus = (
  status: string | null | undefined
): { label: string; color: string } => {
  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: 'Activa', color: 'success' },
    paused: { label: 'Pausada', color: 'warning' },
    suspended: { label: 'Suspendida', color: 'danger' },
    pending: { label: 'Pendiente', color: 'info' },
  }

  const key = status ?? ''
  return statusMap[key] ?? { label: String(status ?? ''), color: 'neutral' }
}

/**
 * Formatea rol de usuario (interno)
 */
export const formatUserRole = (
  role: string | null | undefined
): { label: string; color: string } => {
  const roleMap: Record<string, { label: string; color: string }> = {
    admin: { label: 'Administrador', color: 'primary' },
    assistant: { label: 'Asistente', color: 'secondary' },
    maintenance: { label: 'Mantenimiento', color: 'warning' },
  }

  const key = role ?? ''
  return roleMap[key] ?? { label: String(role ?? ''), color: 'neutral' }
}

export default {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatSmartDate,
  formatDateSmart,
  formatRUC,
  formatPhone,
  truncateText,
  capitalize,
  capitalizeWords,
  formatBytes,
  formatDuration,
  getInitials,
  formatCompanyStatus,
  formatUserRole,
}
