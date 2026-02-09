/**
 * CEREBRO SaaS - Página de Facturación
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Plus, Search, Eye, DollarSign, Mail, Building2, RefreshCw, XCircle, Trash2, Download, Receipt, Clock, TrendingUp } from 'lucide-react'
import { supabase } from '../config/supabase'
import { formatCurrency, formatDate } from '../utils/formatters'

const StatusBadge = ({ status }) => {
  const cfg = { draft: ['Borrador','slate'], pending: ['Pendiente','warning'], sent: ['Enviada','blue'], paid: ['Pagada','success'], partial: ['Parcial','warning'], overdue: ['Vencida','danger'], cancelled: ['Cancelada','slate'] }
  const [label, color] = cfg[status] || ['—','slate']
  return <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700`}>{label}</span>
}

const KPIs = ({ stats, loading }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    {[
      { label: 'Facturado', value: formatCurrency(stats.totalInvoiced||0), icon: Receipt, color: 'primary' },
      { label: 'Cobrado', value: formatCurrency(stats.totalPaid||0), icon: DollarSign, color: 'success' },
      { label: 'Tasa Cobro', value: `${(stats.collectionRate||0).toFixed(1)}%`, icon: TrendingUp, color: 'success' },
      { label: 'Pendientes', value: stats.pendingCount||0, icon: Clock, color: 'warning' },
    ].map((k,i) => <div key={i} className="card p-4 flex items-center gap-3"><div className={`p-2 rounded-xl bg-${k.color}-50`}><k.icon className={`w-5 h-5 text-${k.color}-600`}/></div><div><p className="text-xs text-slate-500">{k.label}</p><p className="text-lg font-bold">{loading?'...':k.value}</p></div></div>)}
  </div>
)

const InvoiceModal = ({ isOpen, onClose, invoice, tenants, onSave, loading }) => {
  const [form, setForm] = useState({ tenant_id:'', invoice_type:'prefactura', description:'', due_date:'', items:[{description:'',quantity:1,unit_price:0}], notes:'' })
  useEffect(() => {
    if(isOpen && !invoice) {
      const d = new Date(); const dd = new Date(d.getTime()+15*86400000)
      setForm({ tenant_id:'', invoice_type:'prefactura', description:'Servicio mensual HRCloud', due_date:dd.toISOString().split('T')[0], items:[{description:'Servicio mensual',quantity:1,unit_price:0}], notes:'' })
    } else if(invoice) {
      setForm({ tenant_id:invoice.tenant_id||'', invoice_type:invoice.invoice_type||'prefactura', description:invoice.description||'', due_date:invoice.due_date?.split('T')[0]||'', items:invoice.invoice_items?.length?invoice.invoice_items:[{description:'',quantity:1,unit_price:0}], notes:invoice.notes||'' })
    }
  }, [invoice, isOpen])
  if(!isOpen) return null
  const subtotal = form.items.reduce((s,i)=>s+(i.quantity*i.unit_price),0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between"><h3 className="font-semibold">{invoice?'Editar':'Nueva'} Factura</h3><button onClick={onClose}><XCircle className="w-5 h-5 text-slate-400"/></button></div>
        <form onSubmit={e=>{e.preventDefault();onSave(form)}} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="input-label">Cliente *</label><select value={form.tenant_id} onChange={e=>setForm({...form,tenant_id:e.target.value})} className="input-field" required><option value="">Seleccionar...</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="input-label">Vencimiento *</label><input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="input-field" required/></div>
          </div>
          <div><label className="input-label">Descripción</label><input type="text" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="input-field"/></div>
          <div>
            <div className="flex justify-between mb-2"><label className="input-label">Items</label><button type="button" onClick={()=>setForm({...form,items:[...form.items,{description:'',quantity:1,unit_price:0}]})} className="text-sm text-primary-600"><Plus className="w-4 h-4 inline"/> Agregar</button></div>
            {form.items.map((it,i)=><div key={i} className="flex gap-2 mb-2 p-2 bg-slate-50 rounded-lg">
              <input type="text" value={it.description} onChange={e=>{const items=[...form.items];items[i].description=e.target.value;setForm({...form,items})}} className="input-field flex-1" placeholder="Descripción"/>
              <input type="number" value={it.quantity} onChange={e=>{const items=[...form.items];items[i].quantity=parseInt(e.target.value)||1;setForm({...form,items})}} className="input-field w-16" min="1"/>
              <input type="number" value={it.unit_price} onChange={e=>{const items=[...form.items];items[i].unit_price=parseFloat(e.target.value)||0;setForm({...form,items})}} className="input-field w-24" step="0.01"/>
              <span className="w-20 text-right pt-2 font-medium">{formatCurrency(it.quantity*it.unit_price)}</span>
              {form.items.length>1&&<button type="button" onClick={()=>setForm({...form,items:form.items.filter((_,j)=>j!==i)})} className="text-danger-500"><Trash2 className="w-4 h-4"/></button>}
            </div>)}
            <div className="mt-3 p-3 bg-slate-100 rounded-lg text-right text-sm"><p>Subtotal: <strong>{formatCurrency(subtotal)}</strong></p><p>IVA 15%: <strong>{formatCurrency(subtotal*0.15)}</strong></p><p className="text-lg font-bold text-primary-600">Total: {formatCurrency(subtotal*1.15)}</p></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary" disabled={loading}>{loading?<RefreshCw className="w-4 h-4 animate-spin"/>:<FileText className="w-4 h-4"/>} {invoice?'Actualizar':'Crear'}</button></div>
        </form>
      </div>
    </div>
  )
}

const PaymentModal = ({ isOpen, onClose, invoice, onSave, loading }) => {
  const [pay, setPay] = useState({ amount:0, payment_date:new Date().toISOString().split('T')[0], payment_method:'transferencia', reference:'' })
  useEffect(() => { if(invoice) setPay(p=>({...p,amount:invoice.total-(invoice.amount_paid||0)})) }, [invoice])
  if(!isOpen||!invoice) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex justify-between"><h3 className="font-semibold">Registrar Pago</h3><button onClick={onClose}><XCircle className="w-5 h-5 text-slate-400"/></button></div>
        <form onSubmit={e=>{e.preventDefault();onSave(invoice.id,pay)}} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm"><p>Factura: <strong>{invoice.invoice_number}</strong></p><p>Total: <strong>{formatCurrency(invoice.total)}</strong></p><p>Pendiente: <strong className="text-warning-600">{formatCurrency(invoice.total-(invoice.amount_paid||0))}</strong></p></div>
          <div><label className="input-label">Monto *</label><input type="number" value={pay.amount} onChange={e=>setPay({...pay,amount:parseFloat(e.target.value)||0})} className="input-field" step="0.01" required/></div>
          <div><label className="input-label">Fecha *</label><input type="date" value={pay.payment_date} onChange={e=>setPay({...pay,payment_date:e.target.value})} className="input-field" required/></div>
          <div><label className="input-label">Método</label><select value={pay.payment_method} onChange={e=>setPay({...pay,payment_method:e.target.value})} className="input-field"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="tarjeta">Tarjeta</option></select></div>
          <div><label className="input-label">Referencia</label><input type="text" value={pay.reference} onChange={e=>setPay({...pay,reference:e.target.value})} className="input-field"/></div>
          <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary" disabled={loading}><DollarSign className="w-4 h-4"/> Registrar</button></div>
        </form>
      </div>
    </div>
  )
}

const PreviewModal = ({ isOpen, onClose, invoice }) => {
  if(!isOpen||!invoice) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between"><h3 className="font-semibold">Vista Previa</h3><button onClick={onClose}><XCircle className="w-5 h-5 text-slate-400"/></button></div>
        <div className="p-8">
          <div className="flex justify-between mb-8"><div><h1 className="text-2xl font-bold">CEREBRO SaaS</h1><p className="text-slate-500">Sistema HRCloud</p></div><div className="text-right"><h2 className="text-xl font-bold text-primary-600">{invoice.invoice_type?.toUpperCase()}</h2><p className="font-semibold">{invoice.invoice_number}</p><p className="text-sm text-slate-500">Fecha: {formatDate(invoice.created_at)}</p><p className="text-sm text-slate-500">Vence: {formatDate(invoice.due_date)}</p></div></div>
          <div className="mb-6 p-4 bg-slate-50 rounded-xl"><h3 className="font-semibold mb-1">Cliente:</h3><p className="font-medium">{invoice.tenants?.name}</p><p className="text-sm text-slate-600">RUC: {invoice.tenants?.ruc}</p></div>
          <div className="border-t border-b py-4 mb-4"><p>{invoice.description||'Servicio mensual'}</p></div>
          <div className="text-right"><p>Subtotal: <strong>{formatCurrency(invoice.subtotal)}</strong></p><p>IVA: <strong>{formatCurrency(invoice.tax_amount)}</strong></p><p className="text-xl font-bold text-primary-600 mt-2">Total: {formatCurrency(invoice.total)}</p></div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3"><button onClick={onClose} className="btn-secondary">Cerrar</button><button className="btn-primary"><Download className="w-4 h-4"/> PDF</button></div>
      </div>
    </div>
  )
}

export default function InvoicesPage() {
  const [searchParams] = useSearchParams()
  const [invoices, setInvoices] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(searchParams.get('filter')||'all')
  const [showForm, setShowForm] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('invoices').select('*, tenants(id,name,ruc,contact_email)')
    if(filter!=='all') q=q.eq('status',filter)
    if(search) q=q.ilike('invoice_number',`%${search}%`)
    const {data}=await q.order('created_at',{ascending:false}).limit(50)
    setInvoices(data||[])
    // Stats
    const now=new Date(), som=new Date(now.getFullYear(),now.getMonth(),1)
    const {data:sd}=await supabase.from('invoices').select('total,status').gte('created_at',som.toISOString())
    const ti=sd?.reduce((s,i)=>s+(i.total||0),0)||0
    const tp=sd?.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.total||0),0)||0
    const pc=sd?.filter(i=>['pending','sent'].includes(i.status)).length||0
    setStats({totalInvoiced:ti,totalPaid:tp,collectionRate:ti>0?(tp/ti)*100:0,pendingCount:pc})
    setLoading(false)
  },[filter,search])

  useEffect(()=>{load()},[load])
  useEffect(()=>{supabase.from('tenants').select('id,name,ruc').eq('status','active').then(({data})=>setTenants(data||[]))},[])

  const saveInvoice = async (form) => {
    setLoading(true)
    const sub=form.items.reduce((s,i)=>s+(i.quantity*i.unit_price),0)
    const inv={tenant_id:form.tenant_id,invoice_type:form.invoice_type,description:form.description,due_date:form.due_date,subtotal:sub,tax_percentage:15,tax_amount:sub*0.15,total:sub*1.15,status:'pending',notes:form.notes}
    if(selected){await supabase.from('invoices').update(inv).eq('id',selected.id)}
    else{const{count}=await supabase.from('invoices').select('*',{count:'exact',head:true});inv.invoice_number=`CERE-${String((count||0)+1).padStart(6,'0')}`;await supabase.from('invoices').insert([inv])}
    setShowForm(false);setSelected(null);load()
  }

  const savePay = async (id,pay) => {
    setLoading(true)
    await supabase.from('payments').insert([{invoice_id:id,...pay}])
    const inv=invoices.find(i=>i.id===id)
    const np=(inv?.amount_paid||0)+pay.amount
    await supabase.from('invoices').update({amount_paid:np,status:np>=inv?.total?'paid':'partial',paid_at:np>=inv?.total?new Date().toISOString():null}).eq('id',id)
    setShowPay(false);setSelected(null);load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800">Facturación</h1><p className="text-slate-500">Gestión de facturas y prefacturas</p></div>
        <button onClick={()=>{setSelected(null);setShowForm(true)}} className="btn-primary"><Plus className="w-5 h-5"/> Nueva Prefactura</button>
      </div>
      <KPIs stats={stats} loading={loading}/>
      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input type="text" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="input-field pl-10"/></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="input-field w-40"><option value="all">Todos</option><option value="pending">Pendiente</option><option value="paid">Pagada</option><option value="overdue">Vencida</option></select>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Factura</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cliente</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fecha</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Total</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Estado</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Acciones</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading?<tr><td colSpan={6} className="py-12 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary-500"/></td></tr>
            :invoices.length===0?<tr><td colSpan={6} className="py-12 text-center text-slate-500"><FileText className="w-12 h-12 mx-auto mb-3 text-slate-300"/><p>No hay facturas</p></td></tr>
            :invoices.map(inv=><tr key={inv.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><p className="font-medium">{inv.invoice_number}</p><p className="text-xs text-slate-500">{inv.invoice_type}</p></td>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400"/>{inv.tenants?.name||'—'}</div></td>
              <td className="px-4 py-3"><p className="text-sm">{formatDate(inv.created_at)}</p><p className="text-xs text-slate-500">Vence: {formatDate(inv.due_date)}</p></td>
              <td className="px-4 py-3 font-semibold">{formatCurrency(inv.total)}</td>
              <td className="px-4 py-3"><StatusBadge status={inv.status}/></td>
              <td className="px-4 py-3"><div className="flex gap-1">
                <button onClick={()=>{setSelected(inv);setShowPreview(true)}} className="p-2 hover:bg-slate-100 rounded-lg" title="Ver"><Eye className="w-4 h-4 text-slate-500"/></button>
                {!['paid','cancelled'].includes(inv.status)&&<><button onClick={()=>{setSelected(inv);setShowPay(true)}} className="p-2 hover:bg-slate-100 rounded-lg" title="Pago"><DollarSign className="w-4 h-4 text-success-500"/></button><button onClick={()=>alert('Recordatorio enviado')} className="p-2 hover:bg-slate-100 rounded-lg" title="Recordatorio"><Mail className="w-4 h-4 text-warning-500"/></button></>}
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <InvoiceModal isOpen={showForm} onClose={()=>{setShowForm(false);setSelected(null)}} invoice={selected} tenants={tenants} onSave={saveInvoice} loading={loading}/>
      <PaymentModal isOpen={showPay} onClose={()=>{setShowPay(false);setSelected(null)}} invoice={selected} onSave={savePay} loading={loading}/>
      <PreviewModal isOpen={showPreview} onClose={()=>{setShowPreview(false);setSelected(null)}} invoice={selected}/>
    </div>
  )
}
