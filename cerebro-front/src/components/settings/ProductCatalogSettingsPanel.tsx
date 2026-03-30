
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadProductCatalog, saveProductCatalog } from '../../services/cerebroEnhancements'

const newProduct = () => ({
  id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  code: '',
  name: '',
  description: '',
  billing_mode: 'package_or_consumption',
  active: true,
})

const newRate = () => ({
  id: `rate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_id: '',
  name: '',
  pricing_type: 'package',
  min_users: 1,
  max_users: 100,
  flat_price: 0,
  unit_price: 0,
  currency: 'USD',
  active: true,
  notes: '',
})

export default function ProductCatalogSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState('database')
  const [products, setProducts] = useState<any[]>([])
  const [rates, setRates] = useState<any[]>([])

  const reload = async () => {
    setLoading(true)
    try {
      const data = await loadProductCatalog()
      setProducts(data.products || [])
      setRates(data.rates || [])
      setSource(data.source || 'database')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const groupedRates = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const rate of rates) {
      if (!map[rate.product_id]) map[rate.product_id] = []
      map[rate.product_id].push(rate)
    }
    return map
  }, [rates])

  const onSave = async () => {
    setSaving(true)
    try {
      await saveProductCatalog(products, rates)
      toast.success('Productos y tarifas guardados')
      await reload()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar catálogo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Productos y tarifas</h2>
          <p className="text-sm text-slate-400">
            Define productos SaaS, paquetes por rango de usuarios y tarifas por consumo. Fuente actual: {source}.
          </p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2" onClick={onSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Cargando catálogo...</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setProducts((rows) => [...rows, newProduct()])}>
              <Plus className="w-4 h-4" />
              Nuevo producto
            </button>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setRates((rows) => [...rows, { ...newRate(), product_id: products[0]?.id || '' }])}>
              <Plus className="w-4 h-4" />
              Nueva tarifa
            </button>
          </div>

          <div className="space-y-4">
            {products.map((product, index) => (
              <div key={product.id} className="rounded-3xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.35)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      Producto #{index + 1} {product.name ? `· ${product.name}` : ''}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Tarifas asociadas: {(groupedRates[product.id] || []).length}</div>
                  </div>
                  <button
                    type="button"
                    className="btn-danger inline-flex items-center gap-2"
                    onClick={() => {
                      setProducts((rows) => rows.filter((row) => row.id !== product.id))
                      setRates((rows) => rows.filter((row) => row.product_id !== product.id))
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Código</label>
                    <input className="input-field" value={product.code} onChange={(e) => setProducts((rows) => rows.map((row) => row.id === product.id ? { ...row, code: e.target.value } : row))} />
                  </div>
                  <div>
                    <label className="input-label">Nombre</label>
                    <input className="input-field" value={product.name} onChange={(e) => setProducts((rows) => rows.map((row) => row.id === product.id ? { ...row, name: e.target.value } : row))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="input-label">Descripción</label>
                    <textarea className="input-field min-h-[96px]" value={product.description || ''} onChange={(e) => setProducts((rows) => rows.map((row) => row.id === product.id ? { ...row, description: e.target.value } : row))} />
                  </div>
                  <div>
                    <label className="input-label">Modelo de cobro</label>
                    <select className="input-field" value={product.billing_mode || 'package_or_consumption'} onChange={(e) => setProducts((rows) => rows.map((row) => row.id === product.id ? { ...row, billing_mode: e.target.value } : row))}>
                      <option value="package_or_consumption">Paquete o consumo</option>
                      <option value="package_only">Solo paquetes</option>
                      <option value="consumption_only">Solo consumo</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" checked={product.active !== false} onChange={(e) => setProducts((rows) => rows.map((row) => row.id === product.id ? { ...row, active: e.target.checked } : row))} />
                      Activo
                    </label>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {(groupedRates[product.id] || []).map((rate) => (
                    <div key={rate.id} className="rounded-2xl border border-[rgba(148,163,184,0.10)] bg-[rgba(2,6,23,0.35)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">{rate.name || 'Tarifa sin nombre'}</div>
                        <button type="button" className="btn-danger inline-flex items-center gap-2" onClick={() => setRates((rows) => rows.filter((row) => row.id !== rate.id))}>
                          <Trash2 className="w-4 h-4" />
                          Quitar
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="input-label">Nombre tarifa</label>
                          <input className="input-field" value={rate.name || ''} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, name: e.target.value } : row))} />
                        </div>
                        <div>
                          <label className="input-label">Tipo</label>
                          <select className="input-field" value={rate.pricing_type || 'package'} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, pricing_type: e.target.value } : row))}>
                            <option value="package">Paquete</option>
                            <option value="consumption">Por consumo</option>
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Moneda</label>
                          <input className="input-field" value={rate.currency || 'USD'} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, currency: e.target.value } : row))} />
                        </div>
                        <div>
                          <label className="input-label">Mínimo usuarios</label>
                          <input type="number" className="input-field" value={rate.min_users ?? 0} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, min_users: Number(e.target.value || 0) } : row))} />
                        </div>
                        <div>
                          <label className="input-label">Máximo usuarios</label>
                          <input type="number" className="input-field" value={rate.max_users ?? ''} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, max_users: e.target.value === '' ? null : Number(e.target.value) } : row))} />
                        </div>
                        <div>
                          <label className="input-label">Precio paquete</label>
                          <input type="number" step="0.01" className="input-field" value={rate.flat_price ?? 0} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, flat_price: Number(e.target.value || 0) } : row))} />
                        </div>
                        <div>
                          <label className="input-label">Valor unitario</label>
                          <input type="number" step="0.01" className="input-field" value={rate.unit_price ?? 0} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, unit_price: Number(e.target.value || 0) } : row))} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="input-label">Notas</label>
                          <input className="input-field" value={rate.notes || ''} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, notes: e.target.value } : row))} />
                        </div>
                        <div className="flex items-end">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                            <input type="checkbox" checked={rate.active !== false} onChange={(e) => setRates((rows) => rows.map((row) => row.id === rate.id ? { ...row, active: e.target.checked } : row))} />
                            Activa
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setRates((rows) => [...rows, { ...newRate(), product_id: product.id }])}>
                    <Plus className="w-4 h-4" />
                    Agregar tarifa a {product.name || product.code || 'producto'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
