/**
 * ==============================================
 * CEREBRO SaaS - Constantes del Sistema
 * ==============================================
 */

// Información de la aplicación
export const APP_INFO = {
  name: import.meta.env.VITE_APP_NAME || 'CEREBRO SaaS',
  version: import.meta.env.VITE_APP_VERSION || '3.0.0',
  description: 'Sistema de Gestión Multi-Tenant',
  company: 'HRCloud',
  project: 'ProyectoRLeon',
}

// Rutas de la aplicación
export const ROUTES = {
  // Públicas
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Privadas - Comunes
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',

  // Privadas - Admin/Asistente
  TENANTS: '/tenants',
  TENANT_CREATE: '/tenants/create',
  TENANT_DETAIL: '/tenants/:id',
  TENANT_EDIT: '/tenants/:id/edit',

  // Facturación
  INVOICES: '/invoices',
  INVOICE_CREATE: '/invoices/create',
  INVOICE_DETAIL: '/invoices/:id',
  PREFACTURA: '/prefactura',

  // Configuración (Solo Admin)
  SETTINGS: '/settings',
  SETTINGS_GENERAL: '/settings/general',
  SETTINGS_ROLES: '/settings/roles',
  SETTINGS_SECURITY: '/settings/security',
  SETTINGS_PLANS: '/settings/plans',
  SETTINGS_PREFACTURA: '/settings/prefactura',
  SETTINGS_EMAIL: '/settings/email',

  // Auditoría
  AUDIT: '/audit',
  AUDIT_LOGS: '/audit/logs',

  // Mantenimiento
  MONITORING: '/monitoring',
  ALERTS: '/monitoring/alerts',

  // Mensajería
  MESSAGES: '/messages',
  NOTIFICATIONS: '/notifications',

  // Cobranzas
  COLLECTIONS: '/collections',

  // Reportes
  REPORTS: '/reports',
}

// Permisos del sistema
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD_ADMIN: 'view_dashboard_admin',
  VIEW_DASHBOARD_ASSISTANT: 'view_dashboard_assistant',
  VIEW_DASHBOARD_MAINTENANCE: 'view_dashboard_maintenance',

  // Clientes/Tenants
  VIEW_TENANTS: 'view_tenants',
  CREATE_TENANT: 'create_tenant',
  EDIT_TENANT: 'edit_tenant',
  DELETE_TENANT: 'delete_tenant',
  PAUSE_TENANT: 'pause_tenant',
  ENABLE_TENANT: 'enable_tenant',

  // Facturación
  VIEW_INVOICES: 'view_invoices',
  CREATE_INVOICE: 'create_invoice',
  EDIT_INVOICE: 'edit_invoice',
  DELETE_INVOICE: 'delete_invoice',
  GENERATE_PREFACTURA: 'generate_prefactura',
  REGISTER_PAYMENT: 'register_payment',

  // Cobranzas
  VIEW_COLLECTIONS: 'view_collections',
  MANAGE_COLLECTIONS: 'manage_collections',

  // Configuración
  VIEW_SETTINGS: 'view_settings',
  EDIT_SETTINGS: 'edit_settings',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_PLANS: 'manage_plans',

  // Auditoría
  VIEW_AUDIT_LOGS: 'view_audit_logs',

  // Sistema
  VIEW_MONITORING: 'view_monitoring',
  MANAGE_ALERTS: 'manage_alerts',

  // Mensajería
  VIEW_MESSAGES: 'view_messages',
  SEND_MESSAGES: 'send_messages',
  VIEW_NOTIFICATIONS: 'view_notifications',

  // Reportes
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',
}

// Acciones de auditoría
export const AUDIT_ACTIONS = {
  // Autenticación
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',

  // Usuarios
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',

  // Empresas/Tenants
  COMPANY_CREATED: 'COMPANY_CREATED',
  COMPANY_UPDATED: 'COMPANY_UPDATED',
  COMPANY_PAUSED: 'COMPANY_PAUSED',
  COMPANY_ENABLED: 'COMPANY_ENABLED',
  COMPANY_AUTO_PAUSED_BY_ARREARS: 'COMPANY_AUTO_PAUSED_BY_ARREARS',
  COMPANY_DELETED: 'COMPANY_DELETED',

  // Facturación
  INVOICE_CREATED: 'INVOICE_CREATED',
  INVOICE_UPDATED: 'INVOICE_UPDATED',
  INVOICE_DELETED: 'INVOICE_DELETED',
  PAYMENT_REGISTERED: 'PAYMENT_REGISTERED',
  PREFACTURA_GENERATED: 'PREFACTURA_GENERATED',

  // Configuración
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  ROLE_PERMISSIONS_UPDATED: 'ROLE_PERMISSIONS_UPDATED',
  PLAN_CREATED: 'PLAN_CREATED',
  PLAN_UPDATED: 'PLAN_UPDATED',
  PLAN_DELETED: 'PLAN_DELETED',

  // Sistema
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  ALERT_TRIGGERED: 'ALERT_TRIGGERED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
}

// Prioridades de notificaciones
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
}

// Estados de factura
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
}

// Formato de moneda
export const CURRENCY = {
  code: 'USD',
  symbol: '$',
  locale: 'es-EC',
  decimals: 2,
}

// Límites y validaciones
export const VALIDATION = {
  RUC_LENGTH: 13,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
  EMAIL_MAX_LENGTH: 255,
  NAME_MAX_LENGTH: 255,
  PHONE_MIN_LENGTH: 7,
  PHONE_MAX_LENGTH: 15,
  ADDRESS_MAX_LENGTH: 500,
  DESCRIPTION_MAX_LENGTH: 1000,
}

// Mensajes de error comunes
export const ERROR_MESSAGES = {
  REQUIRED: 'Este campo es obligatorio',
  INVALID_EMAIL: 'Ingrese un correo electrónico válido',
  INVALID_RUC: 'El RUC debe tener 13 dígitos y ser válido',
  INVALID_PHONE: 'Ingrese un número de teléfono válido',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos {min} caracteres',
  PASSWORD_WEAK: 'La contraseña no cumple con los requisitos de seguridad',
  PASSWORDS_NOT_MATCH: 'Las contraseñas no coinciden',
  NETWORK_ERROR: 'Error de conexión. Verifique su internet.',
  UNAUTHORIZED: 'No tiene permisos para realizar esta acción',
  SESSION_EXPIRED: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
  GENERIC_ERROR: 'Ocurrió un error. Por favor, intente nuevamente.',
}

// Intervalos de actualización automática (en milisegundos)
export const REFRESH_INTERVALS = {
  DASHBOARD_KPIS: 5 * 60 * 1000,      // 5 minutos
  NOTIFICATIONS: 30 * 1000,            // 30 segundos
  SYSTEM_METRICS: 60 * 1000,           // 1 minuto
  COLLECTION_STATUS: 2 * 60 * 1000,    // 2 minutos
}

// Configuración de paginación
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_PAGE_SIZE: 100,
}

// Formatos de fecha
export const DATE_FORMATS = {
  DISPLAY: 'dd/MM/yyyy',
  DISPLAY_WITH_TIME: 'dd/MM/yyyy HH:mm',
  ISO: 'yyyy-MM-dd',
  ISO_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss",
  RELATIVE: 'relative', // "Hace 5 minutos", etc.
}

// Días de la semana
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
]

// Meses del año
export const MONTHS = [
  { value: 0, label: 'Enero' },
  { value: 1, label: 'Febrero' },
  { value: 2, label: 'Marzo' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Mayo' },
  { value: 5, label: 'Junio' },
  { value: 6, label: 'Julio' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Septiembre' },
  { value: 9, label: 'Octubre' },
  { value: 10, label: 'Noviembre' },
  { value: 11, label: 'Diciembre' },
]

export default {
  APP_INFO,
  ROUTES,
  PERMISSIONS,
  AUDIT_ACTIONS,
  NOTIFICATION_PRIORITIES,
  INVOICE_STATUS,
  CURRENCY,
  VALIDATION,
  ERROR_MESSAGES,
  REFRESH_INTERVALS,
  PAGINATION,
  DATE_FORMATS,
}
