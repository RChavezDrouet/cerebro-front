/**
 * ==============================================
 * CEREBRO SaaS - Punto de Entrada Principal
 * ==============================================
 * 
 * Sistema de Gestión Multi-Tenant
 * HRCloud - ProyectoRLeon
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

// Configuración global del Toaster para notificaciones
const toastOptions = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: '#1e293b',
    color: '#f8fafc',
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '400px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  success: {
    duration: 3000,
    style: {
      background: '#065f46',
    },
    iconTheme: {
      primary: '#34d399',
      secondary: '#065f46',
    },
  },
  error: {
    duration: 5000,
    style: {
      background: '#991b1b',
    },
    iconTheme: {
      primary: '#fca5a5',
      secondary: '#991b1b',
    },
  },
  loading: {
    style: {
      background: '#1e40af',
    },
    iconTheme: {
      primary: '#93c5fd',
      secondary: '#1e40af',
    },
  },
}

// Ocultar loader inicial cuando React está listo
const hideInitialLoader = () => {
  const loader = document.getElementById('initial-loader')
  if (loader) {
    loader.classList.add('hidden')
    setTimeout(() => loader.remove(), 300)
  }
}

// Crear raíz de React y renderizar aplicación
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster toastOptions={toastOptions} />
  </React.StrictMode>
)

// Ocultar loader después de que React se monte
setTimeout(hideInitialLoader, 100)

// Log de inicio para desarrollo
if (import.meta.env.DEV) {
  console.log(
    '%c🧠 CEREBRO SaaS v' + (import.meta.env.VITE_APP_VERSION || '3.0.0'),
    'color: #0056e6; font-size: 16px; font-weight: bold;'
  )
  console.log(
    '%cSistema de Gestión Multi-Tenant | HRCloud - ProyectoRLeon',
    'color: #64748b; font-size: 12px;'
  )
}
