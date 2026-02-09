/**
 * ==============================================
 * CEREBRO SaaS - Hook useTenants
 * Gestión completa de clientes/tenants
 * ==============================================
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../config/supabase'
import { useToast } from './useToast'

export const useTenants = (options = {}) => {
  const { autoLoad = true, pageSize = 10 } = options
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 0,
  })
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    plan: 'all',
  })
  const toast = useToast()

  // Cargar tenants con paginación y filtros
  const loadTenants = useCallback(async (page = 1, customFilters = filters) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('tenants')
        .select('*, plans(name, type)', { count: 'exact' })

      // Aplicar filtros
      if (customFilters.search) {
        query = query.or(`business_name.ilike.%${customFilters.search}%,ruc.ilike.%${customFilters.search}%,contact_email.ilike.%${customFilters.search}%`)
      }

      if (customFilters.status && customFilters.status !== 'all') {
        query = query.eq('status', customFilters.status)
      }

      if (customFilters.plan && customFilters.plan !== 'all') {
        query = query.eq('plan_id', customFilters.plan)
      }

      // Paginación
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      query = query
        .order('created_at', { ascending: false })
        .range(from, to)

      const { data, error: queryError, count } = await query

      if (queryError) throw queryError

      setTenants(data || [])
      setPagination({
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      })
    } catch (err) {
      console.error('Error loading tenants:', err)
      setError(err.message)
      toast.error('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [filters, pageSize, toast])

  // Obtener un tenant por ID
  const getTenant = useCallback(async (id) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          plans(id, name, type, price, max_users),
          invoices(id, invoice_number, total, status, due_date),
          tenant_contacts(id, name, email, phone, role, is_primary)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error getting tenant:', err)
      toast.error('Error al obtener datos del cliente')
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Crear nuevo tenant
  const createTenant = useCallback(async (tenantData) => {
    setLoading(true)
    try {
      // Preparar datos
      const newTenant = {
        business_name: tenantData.business_name,
        trade_name: tenantData.trade_name || tenantData.business_name,
        ruc: tenantData.ruc,
        address: tenantData.address,
        city: tenantData.city,
        province: tenantData.province,
        phone: tenantData.phone,
        contact_email: tenantData.contact_email,
        contact_name: tenantData.contact_name,
        plan_id: tenantData.plan_id,
        status: 'active',
        billing_day: tenantData.billing_day || 1,
        grace_period_days: tenantData.grace_period_days || 15,
        courtesy_users: tenantData.courtesy_users || 0,
        courtesy_months: tenantData.courtesy_months || 0,
        contract_start: tenantData.contract_start || new Date().toISOString(),
        contract_end: tenantData.contract_end,
        notes: tenantData.notes,
      }

      const { data, error } = await supabase
        .from('tenants')
        .insert([newTenant])
        .select()
        .single()

      if (error) throw error

      // Crear contactos adicionales si existen
      if (tenantData.contacts && tenantData.contacts.length > 0) {
        const contacts = tenantData.contacts.map(contact => ({
          tenant_id: data.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          role: contact.role,
          is_primary: contact.is_primary || false,
        }))

        await supabase.from('tenant_contacts').insert(contacts)
      }

      // Registrar en auditoría
      await supabase.from('audit_logs').insert({
        action: 'CREATE_TENANT',
        table_name: 'tenants',
        record_id: data.id,
        new_values: data,
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Cliente creado exitosamente')
      await loadTenants()
      return { success: true, data }
    } catch (err) {
      console.error('Error creating tenant:', err)
      toast.error(`Error al crear cliente: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [loadTenants, toast])

  // Actualizar tenant
  const updateTenant = useCallback(async (id, updates) => {
    setLoading(true)
    try {
      // Obtener datos anteriores para auditoría
      const { data: oldData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single()

      const { data, error } = await supabase
        .from('tenants')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Registrar en auditoría
      await supabase.from('audit_logs').insert({
        action: 'UPDATE_TENANT',
        table_name: 'tenants',
        record_id: id,
        old_values: oldData,
        new_values: data,
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Cliente actualizado exitosamente')
      await loadTenants()
      return { success: true, data }
    } catch (err) {
      console.error('Error updating tenant:', err)
      toast.error(`Error al actualizar cliente: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [loadTenants, toast])

  // Cambiar estado del tenant
  const changeStatus = useCallback(async (id, newStatus, reason = '') => {
    return updateTenant(id, { 
      status: newStatus,
      status_reason: reason,
      status_changed_at: new Date().toISOString(),
    })
  }, [updateTenant])

  // Pausar tenant por mora
  const pauseForDelinquency = useCallback(async (id) => {
    return changeStatus(id, 'paused', 'Suspendido por mora')
  }, [changeStatus])

  // Reactivar tenant
  const reactivate = useCallback(async (id) => {
    return changeStatus(id, 'active', 'Reactivado manualmente')
  }, [changeStatus])

  // Eliminar tenant (soft delete)
  const deleteTenant = useCallback(async (id) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ 
          status: 'deleted',
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      // Registrar en auditoría
      await supabase.from('audit_logs').insert({
        action: 'DELETE_TENANT',
        table_name: 'tenants',
        record_id: id,
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Cliente eliminado')
      await loadTenants()
      return { success: true }
    } catch (err) {
      console.error('Error deleting tenant:', err)
      toast.error(`Error al eliminar cliente: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [loadTenants, toast])

  // Reset password del administrador de BASE
  const resetAdminPassword = useCallback(async (tenantId, contactEmail) => {
    setLoading(true)
    try {
      // Generar nueva contraseña temporal
      const tempPassword = generateTempPassword()

      // Llamar función RPC para resetear password
      const { error } = await supabase.rpc('reset_tenant_admin_password', {
        p_tenant_id: tenantId,
        p_contact_email: contactEmail,
        p_temp_password: tempPassword,
      })

      if (error) throw error

      // Registrar en auditoría
      await supabase.from('audit_logs').insert({
        action: 'RESET_ADMIN_PASSWORD',
        table_name: 'tenants',
        record_id: tenantId,
        new_values: { contact_email: contactEmail },
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Contraseña reseteada y enviada por correo')
      return { success: true, tempPassword }
    } catch (err) {
      console.error('Error resetting password:', err)
      toast.error(`Error al resetear contraseña: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Generar contraseña temporal segura
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  // Obtener estadísticas de tenants
  const getStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_tenant_stats')
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error getting stats:', err)
      return { success: false, error: err.message }
    }
  }, [])

  // Actualizar filtros
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Cargar al montar si autoLoad está habilitado
  useEffect(() => {
    if (autoLoad) {
      loadTenants()
    }
  }, [autoLoad, loadTenants])

  // Recargar cuando cambian los filtros
  useEffect(() => {
    if (autoLoad) {
      loadTenants(1, filters)
    }
  }, [filters, autoLoad, loadTenants])

  return {
    // Estado
    tenants,
    loading,
    error,
    pagination,
    filters,

    // Acciones CRUD
    loadTenants,
    getTenant,
    createTenant,
    updateTenant,
    deleteTenant,

    // Acciones de estado
    changeStatus,
    pauseForDelinquency,
    reactivate,

    // Otras acciones
    resetAdminPassword,
    getStats,
    updateFilters,

    // Paginación
    goToPage: (page) => loadTenants(page),
    nextPage: () => loadTenants(pagination.page + 1),
    prevPage: () => loadTenants(pagination.page - 1),
  }
}

export default useTenants
