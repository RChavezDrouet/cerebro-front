/**
 * ==============================================
 * CEREBRO SaaS - Hook useInvoices
 * Gestión completa de facturación
 * ==============================================
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../config/supabase'
import { useToast } from './useToast'

export const useInvoices = (options = {}) => {
  const { autoLoad = true, pageSize = 10 } = options
  const [invoices, setInvoices] = useState([])
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
    dateFrom: null,
    dateTo: null,
    tenantId: null,
  })
  const [invoiceSettings, setInvoiceSettings] = useState({
    prefix: 'CERE',
    taxPercentage: 15,
    currentSequence: 1,
  })
  const toast = useToast()

  // Cargar configuración de facturación
  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('setting_type', 'billing')

      if (error) throw error

      const settings = {}
      data?.forEach(s => {
        if (s.setting_key === 'invoice_prefix') settings.prefix = s.setting_value.replace(/"/g, '')
        if (s.setting_key === 'tax_percentage') settings.taxPercentage = parseFloat(s.setting_value) || 15
        if (s.setting_key === 'invoice_sequence') settings.currentSequence = parseInt(s.setting_value) || 1
      })

      setInvoiceSettings(prev => ({ ...prev, ...settings }))
      return settings
    } catch (err) {
      console.error('Error loading invoice settings:', err)
      return invoiceSettings
    }
  }, [invoiceSettings])

  // Cargar facturas con filtros
  const loadInvoices = useCallback(async (page = 1, customFilters = filters) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          tenants(id, business_name, ruc, contact_email)
        `, { count: 'exact' })

      // Aplicar filtros
      if (customFilters.search) {
        query = query.or(`invoice_number.ilike.%${customFilters.search}%,tenants.business_name.ilike.%${customFilters.search}%`)
      }

      if (customFilters.status && customFilters.status !== 'all') {
        query = query.eq('status', customFilters.status)
      }

      if (customFilters.dateFrom) {
        query = query.gte('created_at', customFilters.dateFrom)
      }

      if (customFilters.dateTo) {
        query = query.lte('created_at', customFilters.dateTo)
      }

      if (customFilters.tenantId) {
        query = query.eq('tenant_id', customFilters.tenantId)
      }

      // Paginación
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      query = query
        .order('created_at', { ascending: false })
        .range(from, to)

      const { data, error: queryError, count } = await query

      if (queryError) throw queryError

      setInvoices(data || [])
      setPagination({
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      })
    } catch (err) {
      console.error('Error loading invoices:', err)
      setError(err.message)
      toast.error('Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }, [filters, pageSize, toast])

  // Obtener factura por ID
  const getInvoice = useCallback(async (id) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          tenants(
            id, 
            business_name, 
            trade_name,
            ruc, 
            address,
            city,
            province,
            phone,
            contact_email,
            contact_name
          ),
          invoice_items(id, description, quantity, unit_price, total),
          payments(id, amount, payment_date, payment_method, reference)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error getting invoice:', err)
      toast.error('Error al obtener factura')
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Generar número de factura
  const generateInvoiceNumber = useCallback(async () => {
    try {
      const settings = await loadSettings()
      const sequence = settings.currentSequence || 1
      const paddedSequence = String(sequence).padStart(6, '0')
      const invoiceNumber = `${settings.prefix}-${paddedSequence}`

      // Incrementar secuencia
      await supabase
        .from('app_settings')
        .update({ setting_value: String(sequence + 1) })
        .eq('setting_key', 'invoice_sequence')

      return invoiceNumber
    } catch (err) {
      console.error('Error generating invoice number:', err)
      return `INV-${Date.now()}`
    }
  }, [loadSettings])

  // Crear nueva factura/prefactura
  const createInvoice = useCallback(async (invoiceData) => {
    setLoading(true)
    try {
      const invoiceNumber = await generateInvoiceNumber()
      const settings = await loadSettings()

      // Calcular totales
      const subtotal = invoiceData.items?.reduce((sum, item) => 
        sum + (item.quantity * item.unit_price), 0) || invoiceData.subtotal || 0
      const taxAmount = subtotal * (settings.taxPercentage / 100)
      const total = subtotal + taxAmount

      const newInvoice = {
        invoice_number: invoiceNumber,
        tenant_id: invoiceData.tenant_id,
        invoice_type: invoiceData.invoice_type || 'prefactura',
        status: 'draft',
        subtotal,
        tax_percentage: settings.taxPercentage,
        tax_amount: taxAmount,
        total,
        due_date: invoiceData.due_date,
        billing_period_start: invoiceData.billing_period_start,
        billing_period_end: invoiceData.billing_period_end,
        description: invoiceData.description,
        notes: invoiceData.notes,
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert([newInvoice])
        .select()
        .single()

      if (error) throw error

      // Insertar items si existen
      if (invoiceData.items && invoiceData.items.length > 0) {
        const items = invoiceData.items.map(item => ({
          invoice_id: data.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        }))

        await supabase.from('invoice_items').insert(items)
      }

      // Auditoría
      await supabase.from('audit_logs').insert({
        action: 'CREATE_INVOICE',
        table_name: 'invoices',
        record_id: data.id,
        new_values: data,
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Factura creada exitosamente')
      await loadInvoices()
      return { success: true, data }
    } catch (err) {
      console.error('Error creating invoice:', err)
      toast.error(`Error al crear factura: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [generateInvoiceNumber, loadSettings, loadInvoices, toast])

  // Actualizar factura
  const updateInvoice = useCallback(async (id, updates) => {
    setLoading(true)
    try {
      const { data: oldData } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single()

      // Recalcular totales si cambian items
      let finalUpdates = { ...updates }
      if (updates.items) {
        const settings = await loadSettings()
        const subtotal = updates.items.reduce((sum, item) => 
          sum + (item.quantity * item.unit_price), 0)
        const taxAmount = subtotal * (settings.taxPercentage / 100)

        finalUpdates = {
          ...updates,
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
        }

        // Actualizar items
        await supabase.from('invoice_items').delete().eq('invoice_id', id)
        const items = updates.items.map(item => ({
          invoice_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        }))
        await supabase.from('invoice_items').insert(items)
        delete finalUpdates.items
      }

      const { data, error } = await supabase
        .from('invoices')
        .update({
          ...finalUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      await supabase.from('audit_logs').insert({
        action: 'UPDATE_INVOICE',
        table_name: 'invoices',
        record_id: id,
        old_values: oldData,
        new_values: data,
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Factura actualizada')
      await loadInvoices()
      return { success: true, data }
    } catch (err) {
      console.error('Error updating invoice:', err)
      toast.error(`Error al actualizar factura: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [loadSettings, loadInvoices, toast])

  // Cambiar estado de factura
  const changeStatus = useCallback(async (id, newStatus) => {
    const statusUpdates = {
      status: newStatus,
      ...(newStatus === 'sent' && { sent_at: new Date().toISOString() }),
      ...(newStatus === 'paid' && { paid_at: new Date().toISOString() }),
      ...(newStatus === 'cancelled' && { cancelled_at: new Date().toISOString() }),
    }
    return updateInvoice(id, statusUpdates)
  }, [updateInvoice])

  // Registrar pago
  const registerPayment = useCallback(async (invoiceId, paymentData) => {
    setLoading(true)
    try {
      // Obtener factura
      const { data: invoice } = await supabase
        .from('invoices')
        .select('total, payments(amount)')
        .eq('id', invoiceId)
        .single()

      const totalPaid = invoice?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
      const newTotalPaid = totalPaid + paymentData.amount

      // Registrar pago
      const { data: payment, error } = await supabase
        .from('payments')
        .insert([{
          invoice_id: invoiceId,
          amount: paymentData.amount,
          payment_date: paymentData.payment_date || new Date().toISOString(),
          payment_method: paymentData.payment_method,
          reference: paymentData.reference,
          notes: paymentData.notes,
        }])
        .select()
        .single()

      if (error) throw error

      // Actualizar estado de factura si está pagada completamente
      if (newTotalPaid >= invoice.total) {
        await changeStatus(invoiceId, 'paid')
      } else {
        await updateInvoice(invoiceId, { 
          status: 'partial',
          amount_paid: newTotalPaid,
        })
      }

      await supabase.from('audit_logs').insert({
        action: 'REGISTER_PAYMENT',
        table_name: 'payments',
        record_id: payment.id,
        new_values: { invoice_id: invoiceId, ...paymentData },
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Pago registrado exitosamente')
      return { success: true, data: payment }
    } catch (err) {
      console.error('Error registering payment:', err)
      toast.error(`Error al registrar pago: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [changeStatus, updateInvoice, toast])

  // Generar facturas masivas
  const generateBulkInvoices = useCallback(async (tenantIds, billingData) => {
    setLoading(true)
    const results = { success: [], failed: [] }

    try {
      for (const tenantId of tenantIds) {
        try {
          const result = await createInvoice({
            tenant_id: tenantId,
            ...billingData,
          })

          if (result.success) {
            results.success.push({ tenantId, invoice: result.data })
          } else {
            results.failed.push({ tenantId, error: result.error })
          }
        } catch (err) {
          results.failed.push({ tenantId, error: err.message })
        }
      }

      toast.success(`${results.success.length} facturas generadas, ${results.failed.length} fallidas`)
      return { success: true, results }
    } catch (err) {
      console.error('Error in bulk generation:', err)
      toast.error('Error al generar facturas masivas')
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [createInvoice, toast])

  // Enviar recordatorio de pago
  const sendReminder = useCallback(async (invoiceId, messageTemplate = 'payment_reminder') => {
    setLoading(true)
    try {
      // Obtener datos de la factura y cliente
      const { data: invoice } = await supabase
        .from('invoices')
        .select(`
          *,
          tenants(business_name, contact_email, contact_name)
        `)
        .eq('id', invoiceId)
        .single()

      if (!invoice) throw new Error('Factura no encontrada')

      // Llamar función RPC para enviar email
      const { error } = await supabase.rpc('send_payment_reminder', {
        p_invoice_id: invoiceId,
        p_template: messageTemplate,
      })

      if (error) throw error

      // Actualizar factura
      await supabase
        .from('invoices')
        .update({ 
          last_reminder_sent: new Date().toISOString(),
          reminder_count: (invoice.reminder_count || 0) + 1,
        })
        .eq('id', invoiceId)

      await supabase.from('audit_logs').insert({
        action: 'SEND_REMINDER',
        table_name: 'invoices',
        record_id: invoiceId,
        new_values: { template: messageTemplate },
        user_email: (await supabase.auth.getUser()).data.user?.email,
      })

      toast.success('Recordatorio enviado')
      return { success: true }
    } catch (err) {
      console.error('Error sending reminder:', err)
      toast.error(`Error al enviar recordatorio: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Enviar recordatorios masivos
  const sendBulkReminders = useCallback(async (invoiceIds, messageTemplate) => {
    setLoading(true)
    const results = { success: 0, failed: 0 }

    for (const id of invoiceIds) {
      const result = await sendReminder(id, messageTemplate)
      if (result.success) results.success++
      else results.failed++
    }

    toast.info(`${results.success} recordatorios enviados, ${results.failed} fallidos`)
    setLoading(false)
    return results
  }, [sendReminder, toast])

  // Cancelar factura
  const cancelInvoice = useCallback(async (id, reason = '') => {
    return updateInvoice(id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
  }, [updateInvoice])

  // Obtener estadísticas de facturación
  const getStats = useCallback(async () => {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Total facturado este mes
      const { data: monthInvoices } = await supabase
        .from('invoices')
        .select('total, status')
        .gte('created_at', startOfMonth.toISOString())

      const totalInvoiced = monthInvoices?.reduce((sum, i) => sum + i.total, 0) || 0
      const totalPaid = monthInvoices
        ?.filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + i.total, 0) || 0

      // Facturas por estado
      const { data: statusCounts } = await supabase
        .from('invoices')
        .select('status')

      const byStatus = statusCounts?.reduce((acc, i) => {
        acc[i.status] = (acc[i.status] || 0) + 1
        return acc
      }, {}) || {}

      return {
        success: true,
        data: {
          totalInvoiced,
          totalPaid,
          collectionRate: totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0,
          byStatus,
        }
      }
    } catch (err) {
      console.error('Error getting invoice stats:', err)
      return { success: false, error: err.message }
    }
  }, [])

  // Actualizar filtros
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Cargar al montar
  useEffect(() => {
    if (autoLoad) {
      loadSettings()
      loadInvoices()
    }
  }, [autoLoad, loadSettings, loadInvoices])

  return {
    // Estado
    invoices,
    loading,
    error,
    pagination,
    filters,
    invoiceSettings,

    // CRUD
    loadInvoices,
    getInvoice,
    createInvoice,
    updateInvoice,
    cancelInvoice,

    // Pagos
    registerPayment,

    // Acciones masivas
    generateBulkInvoices,
    sendReminder,
    sendBulkReminders,

    // Estado
    changeStatus,

    // Utilidades
    generateInvoiceNumber,
    getStats,
    updateFilters,
    loadSettings,

    // Paginación
    goToPage: (page) => loadInvoices(page),
  }
}

export default useInvoices
