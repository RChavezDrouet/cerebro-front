import React, { useState, useEffect } from 'react'
import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useTenantStore } from '@/store/tenantStore'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type OvertimeStatus = 'pending' | 'approved' | 'rejected' | 'compensated'
type HourType       = 'SUPLEMENTARIA' | 'EXTRAORDINARIA'

type OvertimeRequest = {
  id:                 string
  tenant_id:          string
  employee_id:        string
  requested_date:     string
  hours_requested:    number
  hour_type:          HourType
  justification:      string
  status:             OvertimeStatus
  compensate_as_time: boolean
  reviewed_by:        string | null
  review_note:        string | null
  created_at:         string
}

type RejectModal = {
  open:      boolean
  requestId: string
  note:      string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OvertimeStatus, string> = {
  pending:     'Pendiente',
  approved:    'Aprobado',
  rejected:    'Rechazado',
  compensated: 'Compensado',
}

const STATUS_CLASSES: Record<OvertimeStatus, string> = {
  pending:     'bg-amber-100 text-amber-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  compensated: 'bg-blue-100 text-blue-700',
}

const HOUR_TYPE_LABELS: Record<HourType, string> = {
  SUPLEMENTARIA:  'Suplementaria',
  EXTRAORDINARIA: 'Extraordinaria',
}

const FILTER_TABS: Array<{ value: OvertimeStatus | 'all'; label: string }> = [
  { value: 'all',         label: 'Todas' },
  { value: 'pending',     label: 'Pendientes' },
  { value: 'approved',    label: 'Aprobadas' },
  { value: 'rejected',    label: 'Rechazadas' },
  { value: 'compensated', label: 'Compensadas' },
]

// ─── Component ────────────────────────────────────────────────────────────────

const OvertimeRequestsPage: React.FC = () => {
  const { tenantId, role } = useTenantStore()

  const [requests, setRequests]     = useState<OvertimeRequest[]>([])
  const [filter, setFilter]         = useState<OvertimeStatus | 'all'>('all')
  const [tablePending, setTablePending] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [actioning, setActioning]   = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<RejectModal>({
    open: false, requestId: '', note: '',
  })

  const canManage = role != null && !['employee', 'user'].includes(role)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .schema(ATT_SCHEMA)
        .from('overtime_requests')
        .select('id, tenant_id, employee_id, requested_date, hours_requested, hour_type, justification, status, compensate_as_time, reviewed_by, review_note, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      setRequests(data ?? [])
      setTablePending(false)
    } catch {
      setTablePending(true)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    setActioning(id)
    try {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('overtime_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      toast.success('Solicitud aprobada')
      await loadData()
    } catch (err) {
      toast.error('Error al aprobar')
      console.error(err)
    } finally {
      setActioning(null)
    }
  }

  const handleRejectConfirm = async () => {
    const { requestId, note } = rejectModal
    if (!note.trim()) { toast.error('La nota de rechazo es obligatoria'); return }

    setActioning(requestId)
    setRejectModal(prev => ({ ...prev, open: false }))
    try {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('overtime_requests')
        .update({
          status:      'rejected',
          review_note: note.trim(),
          updated_at:  new Date().toISOString(),
        })
        .eq('id', requestId)

      if (error) throw error
      toast.success('Solicitud rechazada')
      await loadData()
    } catch (err) {
      toast.error('Error al rechazar')
      console.error(err)
    } finally {
      setActioning(null)
      setRejectModal({ open: false, requestId: '', note: '' })
    }
  }

  const handleCompensate = async (id: string) => {
    setActioning(id)
    try {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('overtime_requests')
        .update({ status: 'compensated', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      toast.success('Marcada como compensada')
      await loadData()
    } catch (err) {
      toast.error('Error al actualizar')
      console.error(err)
    } finally {
      setActioning(null)
    }
  }

  const filtered = filter === 'all'
    ? requests
    : requests.filter(r => r.status === filter)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (tablePending) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Solicitudes de Horas Extra</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5 text-sm text-amber-700">
          La tabla{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 rounded">
            attendance.overtime_requests
          </code>{' '}
          aún no existe. Se creará en la Sesión C-5 del roadmap CIRA V2.0.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Horas Extra</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestión de solicitudes de horas suplementarias y extraordinarias del tenant.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/10 rounded-lg p-1 w-fit">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({requests.filter(r => r.status === tab.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-gray-200 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
          No hay solicitudes{filter !== 'all' ? ` con estado "${STATUS_LABELS[filter as OvertimeStatus]}"` : ''}.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-left border-b border-gray-200">
                <th className="px-4 py-3 font-medium text-gray-600">Empleado</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Horas</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Justificación</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Canjear</th>
                <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                {canManage && (
                  <th className="px-4 py-3 font-medium text-gray-600">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id} className="border-b border-gray-100 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    <span className="font-mono text-xs text-gray-400">{req.employee_id.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {req.requested_date}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {req.hours_requested}h
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-600">
                      {HOUR_TYPE_LABELS[req.hour_type] ?? req.hour_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <span title={req.justification}>
                      {req.justification.length > 60
                        ? req.justification.slice(0, 60) + '…'
                        : req.justification}
                    </span>
                    {req.review_note && (
                      <p className="text-xs text-gray-400 mt-0.5 italic" title={req.review_note}>
                        Nota: {req.review_note.length > 50 ? req.review_note.slice(0, 50) + '…' : req.review_note}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {req.compensate_as_time ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        Tiempo
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[req.status]}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={actioning === req.id}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => setRejectModal({ open: true, requestId: req.id, note: '' })}
                              disabled={actioning === req.id}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {req.status === 'approved' && (
                          <button
                            onClick={() => handleCompensate(req.id)}
                            disabled={actioning === req.id}
                            className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Compensar
                          </button>
                        )}
                        {(req.status === 'rejected' || req.status === 'compensated') && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de rechazo */}
      {rejectModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setRejectModal({ open: false, requestId: '', note: '' })}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-1">Rechazar solicitud</h3>
            <p className="text-sm text-gray-500 mb-4">
              Escribe una nota explicando el motivo del rechazo.
            </p>
            <textarea
              value={rejectModal.note}
              onChange={(e) => setRejectModal(prev => ({ ...prev, note: e.target.value }))}
              rows={4}
              placeholder="Motivo del rechazo…"
              className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setRejectModal({ open: false, requestId: '', note: '' })}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white/10 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default OvertimeRequestsPage
