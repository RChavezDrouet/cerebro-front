/**
 * ==============================================
 * CEREBRO SaaS - Componente Toast
 * Sistema de notificaciones toast
 * ==============================================
 */

import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '../../hooks/useToast'

const ToastIcon = ({ type }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success-500" />,
    error: <XCircle className="w-5 h-5 text-danger-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning-500" />,
    info: <Info className="w-5 h-5 text-primary-500" />,
  }
  return icons[type] || icons.info
}

const ToastItem = ({ toast, onRemove }) => {
  const bgColors = {
    success: 'bg-success-50 border-success-200',
    error: 'bg-danger-50 border-danger-200',
    warning: 'bg-warning-50 border-warning-200',
    info: 'bg-primary-50 border-primary-200',
  }

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
        animate-slide-in ${bgColors[toast.type] || bgColors.info}
      `}
      role="alert"
    >
      <ToastIcon type={toast.type} />
      <p className="flex-1 text-sm text-slate-700">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-white/50 rounded-lg transition-colors"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  )
}

const ToastContainer = () => {
  const { toasts, removeToast } = useToast()

  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

export default ToastContainer
