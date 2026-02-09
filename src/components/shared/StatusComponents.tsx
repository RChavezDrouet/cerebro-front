/**
 * ==============================================
 * CEREBRO SaaS - Componentes de Estado
 * Badges, status pills, semáforos
 * ==============================================
 */

import React from 'react'

// Badge básico
export const Badge = ({ children, variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    danger: 'bg-danger-100 text-danger-700',
    info: 'bg-blue-100 text-blue-700',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  )
}

// Status Badge para estados de entidades
export const StatusBadge = ({ status, size = 'md' }) => {
  const statusConfig = {
    active: { label: 'Activo', variant: 'success' },
    inactive: { label: 'Inactivo', variant: 'default' },
    paused: { label: 'Pausado', variant: 'warning' },
    suspended: { label: 'Suspendido', variant: 'danger' },
    deleted: { label: 'Eliminado', variant: 'danger' },
    pending: { label: 'Pendiente', variant: 'warning' },
    draft: { label: 'Borrador', variant: 'default' },
    sent: { label: 'Enviada', variant: 'info' },
    paid: { label: 'Pagada', variant: 'success' },
    partial: { label: 'Pago Parcial', variant: 'warning' },
    overdue: { label: 'Vencida', variant: 'danger' },
    cancelled: { label: 'Cancelada', variant: 'default' },
  }

  const config = statusConfig[status] || { label: status, variant: 'default' }

  return <Badge variant={config.variant} size={size}>{config.label}</Badge>
}

// Semáforo visual para KPIs
export const TrafficLight = ({ status, size = 'md', showLabel = false }) => {
  const colors = {
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    info: 'bg-primary-500',
  }

  const labels = {
    success: 'Bien',
    warning: 'Atención',
    danger: 'Crítico',
    info: 'Info',
  }

  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`${sizes[size]} ${colors[status]} rounded-full animate-pulse`} />
      {showLabel && (
        <span className={`text-xs font-medium text-${status === 'success' ? 'success' : status === 'warning' ? 'warning' : status === 'danger' ? 'danger' : 'primary'}-600`}>
          {labels[status]}
        </span>
      )}
    </div>
  )
}

// Indicador de porcentaje con color
export const PercentageIndicator = ({ value, thresholds = { warning: 50, danger: 25 }, inverse = false }) => {
  let status = 'success'
  
  if (inverse) {
    // Para métricas donde menor es mejor (ej: tasa de morosidad)
    if (value >= thresholds.danger) status = 'danger'
    else if (value >= thresholds.warning) status = 'warning'
  } else {
    // Para métricas donde mayor es mejor (ej: tasa de recuperación)
    if (value <= thresholds.danger) status = 'danger'
    else if (value <= thresholds.warning) status = 'warning'
  }

  const colors = {
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
  }

  return (
    <span className={`font-semibold ${colors[status]}`}>
      {value.toFixed(1)}%
    </span>
  )
}

// Barra de progreso
export const ProgressBar = ({ value, max = 100, variant = 'primary', size = 'md', showLabel = false }) => {
  const percentage = Math.min((value / max) * 100, 100)

  const variants = {
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
  }

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  return (
    <div className="w-full">
      <div className={`w-full bg-slate-200 rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`${variants[variant]} ${sizes[size]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-500">{value}</span>
          <span className="text-xs text-slate-500">{max}</span>
        </div>
      )}
    </div>
  )
}

// Avatar con iniciales
export const Avatar = ({ name, src, size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getColor = (name) => {
    const colors = [
      'bg-primary-500',
      'bg-success-500',
      'bg-warning-500',
      'bg-danger-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ]
    if (!name) return colors[0]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div className={`${sizes[size]} ${getColor(name)} rounded-full flex items-center justify-center text-white font-semibold ${className}`}>
      {getInitials(name)}
    </div>
  )
}

export default { Badge, StatusBadge, TrafficLight, PercentageIndicator, ProgressBar, Avatar }
