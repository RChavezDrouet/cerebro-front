/**
 * ==============================================
 * CEREBRO SaaS - Componente Table
 * Tabla con paginación, ordenamiento y filtros
 * ==============================================
 */

import React, { useState, useMemo } from 'react'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Loader2,
} from 'lucide-react'

const Table = ({
  columns,
  data = [],
  loading = false,
  pagination = null,
  onPageChange,
  onSort,
  sortBy,
  sortOrder = 'asc',
  selectable = false,
  selectedRows = [],
  onSelectRows,
  onRowClick,
  emptyMessage = 'No hay datos para mostrar',
  emptyIcon: EmptyIcon,
  actions,
  className = '',
  stickyHeader = false,
}) => {
  const [localSearch, setLocalSearch] = useState('')

  const filteredData = useMemo(() => {
    if (!localSearch || pagination) return data
    return data.filter(row => 
      columns.some(col => {
        const value = col.accessor ? row[col.accessor] : ''
        return String(value).toLowerCase().includes(localSearch.toLowerCase())
      })
    )
  }, [data, localSearch, columns, pagination])

  const handleSelectRow = (rowId) => {
    if (!onSelectRows) return
    if (selectedRows.includes(rowId)) {
      onSelectRows(selectedRows.filter(id => id !== rowId))
    } else {
      onSelectRows([...selectedRows, rowId])
    }
  }

  const handleSelectAll = () => {
    if (!onSelectRows) return
    if (selectedRows.length === filteredData.length) {
      onSelectRows([])
    } else {
      onSelectRows(filteredData.map(row => row.id))
    }
  }

  const renderCell = (column, row, rowIndex) => {
    if (column.render) {
      return column.render(row, rowIndex)
    }
    const value = column.accessor ? row[column.accessor] : ''
    if (column.format) {
      return column.format(value, row)
    }
    return value
  }

  return (
    <div className={`bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden ${className}`}>
      {(actions || !pagination) && (
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          {!pagination && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="input-field pl-10 py-2"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`bg-slate-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === filteredData.length && filteredData.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.map((column, index) => (
                <th
                  key={column.accessor || index}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider
                    ${column.sortable ? 'cursor-pointer hover:bg-slate-100 select-none' : ''} ${column.className || ''}`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && onSort && onSort(column.accessor)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.header}</span>
                    {column.sortable && sortBy === column.accessor && (
                      sortOrder === 'asc' 
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                    <span className="text-slate-500">Cargando...</span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                  {EmptyIcon && <EmptyIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />}
                  <p className="text-slate-500">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              filteredData.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  className={`hover:bg-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} 
                    ${selectedRows.includes(row.id) ? 'bg-primary-50' : ''}`}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {selectable && (
                    <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  )}
                  {columns.map((column, colIndex) => (
                    <td
                      key={column.accessor || colIndex}
                      className={`px-4 py-3 text-sm text-slate-700 ${column.cellClassName || ''}`}
                    >
                      {renderCell(column, row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1
                } else if (pagination.page <= 3) {
                  pageNum = i + 1
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i
                } else {
                  pageNum = pagination.page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                      ${pagination.page === pageNum ? 'bg-primary-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Table
