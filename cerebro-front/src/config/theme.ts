/**
 * ==============================================
 * CEREBRO SaaS - Configuración del Tema
 * ==============================================
 * 
 * Configuración centralizada de colores, tipografía y valores de diseño.
 * Estos valores deben sincronizarse con tailwind.config.js
 */

export const theme = {
  // Paleta de colores
  colors: {
    primary: {
      50: '#e6f0ff',
      100: '#b3d1ff',
      200: '#80b3ff',
      300: '#4d94ff',
      400: '#1a75ff',
      500: '#0056e6',
      600: '#0044b3',
      700: '#003380',
      800: '#00224d',
      900: '#00111a',
    },
    secondary: {
      50: '#e6fff2',
      100: '#b3ffd9',
      200: '#80ffc0',
      300: '#4dffa6',
      400: '#1aff8d',
      500: '#00e673',
      600: '#00b35a',
      700: '#008040',
      800: '#004d27',
      900: '#001a0d',
    },
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    dark: '#1f2937',
    light: '#f9fafb',
  },

  // Espaciado
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // Bordes redondeados
  borderRadius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.5rem',  // 24px
    full: '9999px',
  },

  // Tipografía
  typography: {
    fontFamily: {
      sans: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Sombras
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    soft: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    glow: {
      primary: '0 0 20px rgba(0, 86, 230, 0.3)',
      success: '0 0 20px rgba(34, 197, 94, 0.3)',
      warning: '0 0 20px rgba(245, 158, 11, 0.3)',
      danger: '0 0 20px rgba(239, 68, 68, 0.3)',
    },
  },

  // Transiciones
  transitions: {
    fast: '150ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
    verySlow: '500ms ease',
  },

  // Breakpoints (sincronizados con Tailwind)
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Z-index
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 1080,
  },
}

// Configuración de KPIs con semáforos
export const kpiConfig = {
  // Tasa de morosidad
  delinquencyRate: {
    thresholds: {
      success: { max: 10 },  // Verde: 0-10%
      warning: { max: 25 },  // Amarillo: 10-25%
      danger: { min: 25 },   // Rojo: >25%
    },
    format: 'percentage',
    icon: 'TrendingDown',
  },

  // Tasa de recuperación
  recoveryRate: {
    thresholds: {
      danger: { max: 50 },   // Rojo: 0-50%
      warning: { max: 75 },  // Amarillo: 50-75%
      success: { min: 75 },  // Verde: >75%
    },
    format: 'percentage',
    icon: 'TrendingUp',
  },

  // Clientes nuevos
  newClients: {
    thresholds: {
      danger: { percentOfGoal: 50 },   // Rojo: <50% del objetivo
      warning: { percentOfGoal: 80 },  // Amarillo: 50-80%
      success: { percentOfGoal: 80 },  // Verde: >80%
    },
    format: 'number',
    icon: 'Users',
  },

  // Ingresos
  revenue: {
    thresholds: {
      danger: { percentOfGoal: 60 },
      warning: { percentOfGoal: 90 },
      success: { percentOfGoal: 90 },
    },
    format: 'currency',
    icon: 'DollarSign',
  },

  // Uso de recursos del sistema (para mantenimiento)
  systemResources: {
    disk: {
      warning: 70,  // Amarillo: >70%
      danger: 85,   // Rojo: >85%
    },
    cpu: {
      warning: 75,
      danger: 90,
    },
    memory: {
      warning: 80,
      danger: 95,
    },
  },
}

// Configuración de estados de empresas
export const companyStatus = {
  active: {
    label: 'Activa',
    color: 'success',
    bgColor: 'bg-success-100',
    textColor: 'text-success-700',
    icon: 'CheckCircle',
  },
  paused: {
    label: 'Pausada',
    color: 'warning',
    bgColor: 'bg-warning-100',
    textColor: 'text-warning-700',
    icon: 'PauseCircle',
  },
  suspended: {
    label: 'Suspendida',
    color: 'danger',
    bgColor: 'bg-danger-100',
    textColor: 'text-danger-700',
    icon: 'XCircle',
  },
  pending: {
    label: 'Pendiente',
    color: 'info',
    bgColor: 'bg-primary-100',
    textColor: 'text-primary-700',
    icon: 'Clock',
  },
}

// Configuración de niveles de seguridad de contraseñas
export const passwordStrengthLevels = {
  low: {
    label: 'Bajo',
    minLength: 6,
    requireDigit: false,
    requireUppercase: false,
    requireSpecial: false,
    color: 'danger',
  },
  medium: {
    label: 'Medio',
    minLength: 8,
    requireDigit: true,
    requireUppercase: false,
    requireSpecial: false,
    color: 'warning',
  },
  high: {
    label: 'Alto',
    minLength: 12,
    requireDigit: true,
    requireUppercase: true,
    requireSpecial: true,
    color: 'success',
  },
}

// Configuración de tipos de ciclo de facturación
export const billingCycleTypes = {
  weekly: {
    label: 'Semanal',
    days: 7,
  },
  fifteen_days: {
    label: 'Quincenal',
    days: 15,
  },
  monthly_end: {
    label: 'Fin de mes',
    days: null, // Calculado dinámicamente
  },
}

// Roles del sistema
export const userRoles = {
  admin: {
    label: 'Administrador',
    description: 'Acceso total a todas las funcionalidades',
    color: 'primary',
    icon: 'Shield',
  },
  assistant: {
    label: 'Asistente',
    description: 'Acceso según matriz de permisos',
    color: 'secondary',
    icon: 'UserCog',
  },
  maintenance: {
    label: 'Mantenimiento',
    description: 'Acceso al dashboard técnico',
    color: 'warning',
    icon: 'Settings',
  },
}

export default theme
