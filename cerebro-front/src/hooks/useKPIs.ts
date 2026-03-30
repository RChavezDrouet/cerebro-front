/**
 * ==============================================
 * CEREBRO SaaS - Hook useKPIs
 * Gestión de KPIs del dashboard con drill-down
 * ==============================================
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../config/supabase'

export const useKPIs = (options = {}) => {
  const { autoLoad = true, refreshInterval = 0 } = options
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    revenueChange: 0,
    activeClients: 0,
    clientsChange: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    delinquencyRate: 0,
    overdueInvoices: 0,
    collectionRate: 0,
  })
  
  const [revenueData, setRevenueData] = useState([])
  const [topClients, setTopClients] = useState([])
  const [activities, setActivities] = useState([])
  const [alerts, setAlerts] = useState([])
  const [kpiThresholds, setKpiThresholds] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Cargar umbrales de KPIs desde configuración
  const loadThresholds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('setting_type', 'kpi')

      if (error) throw error

      const thresholds = {}
      data?.forEach(setting => {
        thresholds[setting.setting_key] = parseFloat(setting.setting_value) || 0
      })

      setKpiThresholds(thresholds)
      return thresholds
    } catch (err) {
      console.error('Error loading thresholds:', err)
      // Valores por defecto
      return {
        kpi_revenue_warning: 80,
        kpi_revenue_danger: 60,
        kpi_overdue_warning: 5,
        kpi_overdue_danger: 30,
        kpi_delinquency_warning: 10,
        kpi_delinquency_danger: 25,
      }
    }
  }, [])

  // Cargar estadísticas principales
  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Cargar umbrales primero
      await loadThresholds()

      // Obtener fecha del mes actual y anterior
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      // Estadísticas de clientes activos
      const { count: activeClients } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Clientes del mes anterior para comparación
      const { count: lastMonthClients } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .lt('created_at', startOfMonth.toISOString())

      // Ingresos del mes actual
      const { data: currentRevenue } = await supabase
        .from('invoices')
        .select('total')
        .eq('status', 'paid')
        .gte('paid_at', startOfMonth.toISOString())

      const totalRevenue = currentRevenue?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

      // Ingresos del mes anterior
      const { data: lastRevenue } = await supabase
        .from('invoices')
        .select('total')
        .eq('status', 'paid')
        .gte('paid_at', startOfLastMonth.toISOString())
        .lt('paid_at', startOfMonth.toISOString())

      const lastMonthRevenue = lastRevenue?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

      // Facturas pendientes
      const { data: pending, count: pendingCount } = await supabase
        .from('invoices')
        .select('total', { count: 'exact' })
        .in('status', ['pending', 'sent'])

      const pendingAmount = pending?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

      // Facturas vencidas (más de la fecha de corte)
      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'sent', 'overdue'])
        .lt('due_date', now.toISOString())

      // Calcular tasa de morosidad
      const totalInvoices = (pendingCount || 0) + (overdueCount || 0)
      const delinquencyRate = totalInvoices > 0 
        ? ((overdueCount || 0) / totalInvoices) * 100 
        : 0

      // Calcular cambios porcentuales
      const revenueChange = lastMonthRevenue > 0 
        ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0

      const clientsChange = lastMonthClients > 0 
        ? (((activeClients || 0) - lastMonthClients) / lastMonthClients) * 100 
        : 0

      // Tasa de recuperación
      const { data: paidThisMonth } = await supabase
        .from('invoices')
        .select('total')
        .eq('status', 'paid')
        .gte('created_at', startOfMonth.toISOString())

      const paidAmount = paidThisMonth?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0
      const collectionRate = (totalRevenue + pendingAmount) > 0 
        ? (paidAmount / (paidAmount + pendingAmount)) * 100 
        : 100

      setStats({
        totalRevenue,
        revenueChange,
        activeClients: activeClients || 0,
        clientsChange,
        pendingInvoices: pendingCount || 0,
        pendingAmount,
        delinquencyRate,
        overdueInvoices: overdueCount || 0,
        collectionRate,
      })

      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error loading stats:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [loadThresholds])

  // Cargar datos del gráfico de ingresos
  const loadRevenueChart = useCallback(async (months = 6) => {
    try {
      const data = []
      const now = new Date()

      for (let i = months - 1; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        const monthName = monthStart.toLocaleDateString('es', { month: 'short' })

        const { data: monthRevenue } = await supabase
          .from('invoices')
          .select('total')
          .eq('status', 'paid')
          .gte('paid_at', monthStart.toISOString())
          .lt('paid_at', monthEnd.toISOString())

        const revenue = monthRevenue?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

        data.push({
          month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          revenue,
          target: revenue * 1.1, // Meta 10% superior
        })
      }

      setRevenueData(data)
      return data
    } catch (err) {
      console.error('Error loading revenue chart:', err)
      return []
    }
  }, [])

  // Cargar top clientes
  const loadTopClients = useCallback(async (limit = 5) => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          id,
          business_name,
          status,
          invoices(total, status, paid_at)
        `)
        .eq('status', 'active')
        .limit(limit)

      if (error) throw error

      const clientsWithRevenue = data?.map(tenant => {
        const paidInvoices = tenant.invoices?.filter(inv => inv.status === 'paid') || []
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
        
        // Calcular crecimiento (comparar últimos 2 meses)
        const now = new Date()
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)

        const thisMonthRevenue = paidInvoices
          .filter(inv => new Date(inv.paid_at) >= lastMonth)
          .reduce((sum, inv) => sum + (inv.total || 0), 0)

        const lastMonthRevenue = paidInvoices
          .filter(inv => {
            const date = new Date(inv.paid_at)
            return date >= twoMonthsAgo && date < lastMonth
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0)

        const growth = lastMonthRevenue > 0 
          ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
          : 0

        return {
          id: tenant.id,
          name: tenant.business_name,
          revenue: totalRevenue,
          growth,
          status: tenant.status,
        }
      }).sort((a, b) => b.revenue - a.revenue).slice(0, limit) || []

      setTopClients(clientsWithRevenue)
      return clientsWithRevenue
    } catch (err) {
      console.error('Error loading top clients:', err)
      return []
    }
  }, [])

  // Cargar actividad reciente
  const loadActivities = useCallback(async (limit = 10) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      const activities = data?.map(log => ({
        id: log.id,
        user: log.user_email?.split('@')[0] || 'Sistema',
        action: formatAction(log.action),
        status: getActionStatus(log.action),
        time: new Date(log.created_at),
        details: log.new_values,
      })) || []

      setActivities(activities)
      return activities
    } catch (err) {
      console.error('Error loading activities:', err)
      return []
    }
  }, [])

  // Cargar alertas del sistema
  const loadAlerts = useCallback(async () => {
    try {
      const alerts = []
      const now = new Date()

      // Facturas próximas a vencer (5 días)
      const warningDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
      const { data: upcomingInvoices, count: upcomingCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact' })
        .in('status', ['pending', 'sent'])
        .gt('due_date', now.toISOString())
        .lt('due_date', warningDate.toISOString())

      if (upcomingCount > 0) {
        alerts.push({
          type: 'warning',
          title: 'Facturas próximas a vencer',
          message: `${upcomingCount} factura(s) vencen en los próximos 5 días`,
          action: '/invoices?filter=upcoming',
        })
      }

      // Facturas vencidas
      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'sent', 'overdue'])
        .lt('due_date', now.toISOString())

      if (overdueCount > 0) {
        alerts.push({
          type: 'danger',
          title: 'Facturas vencidas',
          message: `${overdueCount} factura(s) están vencidas`,
          action: '/invoices?filter=overdue',
        })
      }

      // Clientes en mora
      const { count: delinquentCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paused')

      if (delinquentCount > 0) {
        alerts.push({
          type: 'danger',
          title: 'Clientes suspendidos',
          message: `${delinquentCount} cliente(s) suspendidos por mora`,
          action: '/tenants?filter=paused',
        })
      }

      setAlerts(alerts)
      return alerts
    } catch (err) {
      console.error('Error loading alerts:', err)
      return []
    }
  }, [])

  // Drill-down: obtener detalle de un KPI
  const getDrillDown = useCallback(async (kpiType, filters = {}) => {
    try {
      switch (kpiType) {
        case 'revenue': {
          const { data } = await supabase
            .from('invoices')
            .select(`
              id,
              invoice_number,
              total,
              status,
              paid_at,
              tenants(business_name)
            `)
            .eq('status', 'paid')
            .order('paid_at', { ascending: false })
            .limit(50)

          return { success: true, data, type: 'revenue_detail' }
        }

        case 'clients': {
          const { data } = await supabase
            .from('tenants')
            .select('id, business_name, ruc, status, created_at, plans(name)')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(50)

          return { success: true, data, type: 'clients_detail' }
        }

        case 'pending': {
          const { data } = await supabase
            .from('invoices')
            .select(`
              id,
              invoice_number,
              total,
              status,
              due_date,
              tenants(business_name, contact_email)
            `)
            .in('status', ['pending', 'sent'])
            .order('due_date', { ascending: true })
            .limit(50)

          return { success: true, data, type: 'pending_detail' }
        }

        case 'delinquency': {
          const { data } = await supabase
            .from('invoices')
            .select(`
              id,
              invoice_number,
              total,
              status,
              due_date,
              tenants(id, business_name, contact_email, phone)
            `)
            .in('status', ['pending', 'sent', 'overdue'])
            .lt('due_date', new Date().toISOString())
            .order('due_date', { ascending: true })
            .limit(50)

          return { success: true, data, type: 'delinquency_detail' }
        }

        default:
          return { success: false, error: 'Tipo de KPI no válido' }
      }
    } catch (err) {
      console.error('Error in drill-down:', err)
      return { success: false, error: err.message }
    }
  }, [])

  // Obtener estado del semáforo para un KPI
  const getKPIStatus = useCallback((value, kpiType) => {
    const thresholds = kpiThresholds

    switch (kpiType) {
      case 'delinquency':
        if (value < (thresholds.kpi_delinquency_warning || 10)) return 'success'
        if (value < (thresholds.kpi_delinquency_danger || 25)) return 'warning'
        return 'danger'

      case 'collection':
        if (value > 80) return 'success'
        if (value > 50) return 'warning'
        return 'danger'

      case 'growth':
        if (value > 10) return 'success'
        if (value > 0) return 'info'
        return 'danger'

      case 'overdue':
        if (value < (thresholds.kpi_overdue_warning || 5)) return 'success'
        if (value < (thresholds.kpi_overdue_danger || 30)) return 'warning'
        return 'danger'

      default:
        return 'info'
    }
  }, [kpiThresholds])

  // Refrescar todos los datos
  const refresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      loadStats(),
      loadRevenueChart(),
      loadTopClients(),
      loadActivities(),
      loadAlerts(),
    ])
    setLoading(false)
  }, [loadStats, loadRevenueChart, loadTopClients, loadActivities, loadAlerts])

  // Formatear acción para mostrar
  const formatAction = (action) => {
    const actions = {
      'CREATE_TENANT': 'Creó nuevo cliente',
      'UPDATE_TENANT': 'Actualizó cliente',
      'DELETE_TENANT': 'Eliminó cliente',
      'CREATE_INVOICE': 'Generó factura',
      'UPDATE_INVOICE': 'Actualizó factura',
      'REGISTER_PAYMENT': 'Registró pago',
      'SEND_REMINDER': 'Envió recordatorio',
      'RESET_ADMIN_PASSWORD': 'Reseteó contraseña',
      'UPDATE_SETTINGS': 'Actualizó configuración',
    }
    return actions[action] || action
  }

  // Obtener estado de la acción
  const getActionStatus = (action) => {
    if (action.includes('DELETE')) return 'danger'
    if (action.includes('CREATE')) return 'success'
    if (action.includes('PAYMENT')) return 'success'
    if (action.includes('REMINDER')) return 'warning'
    return 'info'
  }

  // Cargar al montar
  useEffect(() => {
    if (autoLoad) {
      refresh()
    }
  }, [autoLoad, refresh])

  // Actualización automática
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [refreshInterval, refresh])

  return {
    // Estado
    stats,
    revenueData,
    topClients,
    activities,
    alerts,
    kpiThresholds,
    loading,
    error,
    lastUpdated,

    // Acciones
    loadStats,
    loadRevenueChart,
    loadTopClients,
    loadActivities,
    loadAlerts,
    refresh,

    // Drill-down
    getDrillDown,
    getKPIStatus,
  }
}

export default useKPIs
