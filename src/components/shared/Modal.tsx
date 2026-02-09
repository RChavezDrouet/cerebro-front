/**
 * ==============================================
 * CEREBRO SaaS - Componente Modal
 * Modal reutilizable con animaciones
 * ==============================================
 */

import React, { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlay = true,
  closeOnEscape = true,
  footer,
  className = '',
}) => {
  // Cerrar con ESC
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onClose()
    }
  }, [onClose, closeOnEscape])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-full mx-4',
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlay) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div 
        className={`
          bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} 
          transform transition-all duration-300 animate-slide-up
          max-h-[90vh] flex flex-col ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            {title && (
              <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ml-auto"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Componentes auxiliares del Modal
Modal.Header = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>{children}</div>
)

Modal.Body = ({ children, className = '' }) => (
  <div className={`${className}`}>{children}</div>
)

Modal.Footer = ({ children, className = '' }) => (
  <div className={`flex items-center justify-end gap-3 mt-6 ${className}`}>
    {children}
  </div>
)

// Modal de confirmación
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger', // 'danger', 'warning', 'info'
  loading = false,
}) => {
  const variantStyles = {
    danger: 'btn-danger',
    warning: 'bg-warning-500 hover:bg-warning-600 text-white',
    info: 'btn-primary',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <p className="text-slate-600">{message}</p>
      <Modal.Footer>
        <button 
          onClick={onClose} 
          className="btn-secondary"
          disabled={loading}
        >
          {cancelText}
        </button>
        <button 
          onClick={onConfirm} 
          className={variantStyles[variant]}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Procesando...
            </span>
          ) : confirmText}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default Modal
