/**
 * ==============================================
 * CEREBRO SaaS - Página de Auditoría
 * ==============================================
 */

import React, { useState, useEffect } from 'react'
import { Shield, Search, Filter, Download, Clock, User, Activity } from 'lucide-react'
import { formatDateTime, formatRelativeTime } from '../utils/formatters'

const AuditPage = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 600))
    
    setLogs([
      { id: 1, action: 'LOGIN_SUCCESS', user: 'admin@cerebro.com', details: 'Inicio de sesión exitoso', timestamp: new Date() },
      { id: 2, action: 'COMPANY_CREATED', user: 'admin@cerebro.com', details: 'Empresa: Corporación XYZ', timestamp: new Date(Date.now() - 3600000) },
      { id: 3, action: 'PAYMENT_REGISTERED', user: 'asistente@cerebro.com', details: 'Pago de $1,200 registrado', timestamp: new Date(Date.now() - 7200000) },
      { id: 4, action: 'SETTINGS_UPDATED', user: 'admin@cerebro.com', details: 'Configuración SMTP actualizada', timestamp: new Date(Date.now() - 86400000) },
      { id: 5, action: 'COMPANY_PAUSED', user: 'sistema', details: 'Empresa ABC pausada por mora', timestamp: new Date(Date.now() - 172800000) },
    ])
    setLoading(false)
  }

  const getActionBadge = (action) => {
    const styles = {
      LOGIN_SUCCESS: 'badge-success',
      LOGIN_FAILED: 'badge-danger',
      COMPANY_CREATED: 'badge-info',
      COMPANY_PAUSED: 'badge-warning',
      PAYMENT_REGISTERED: 'badge-success',
      SETTINGS_UPDATED: 'badge-info',
    }
    return styles[action] || 'badge-neutral'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auditoría</h1>
          <p className="text-slate-500 mt-1">Registro de actividad del sistema</p>
        </div>
        <button className="btn-secondary">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input-field w-full sm:w-48"
          >
            <option value="all">Todas las acciones</option>
            <option value="login">Autenticación</option>
            <option value="company">Empresas</option>
            <option value="payment">Pagos</option>
            <option value="settings">Configuración</option>
          </select>
        </div>
      </div>

      {/* Lista de logs */}
      <div className="card">
        <div className="divide-y divide-slate-100">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-4 flex items-start gap-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-48 mb-2" />
                  <div className="h-3 bg-slate-200 rounded w-32" />
                </div>
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
              </div>
            ))
          ) : logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${getActionBadge(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800">{log.details}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.user}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No hay registros de auditoría</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuditPage
