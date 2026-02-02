import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  DollarSign, Users, CreditCard, Server, Activity, LogOut, Loader, Plus, X, 
  FileText, Settings, Trash2, Edit, Info, ArrowLeft, CheckCircle, RefreshCw, 
  Briefcase, Phone, User, Building, AlertCircle, Mail, MousePointer2, Copy,
  Tag, AlignLeft, Layers, Gift, Save, TrendingUp, PieChart as PieChartIcon, 
  Sun, Moon, MoreHorizontal, Power, PlayCircle, PauseCircle, Eye, Shield, 
  Palette, Lock, Key, ChevronRight, FileClock, CheckSquare, Square
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts'

// --- CONEXIÓN ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// --- CONSTANTES DE PERMISOS (MATRIZ) ---
const SYSTEM_FEATURES = [
    { id: 'view_dashboard', label: 'Ver Dashboard y Métricas' },
    { id: 'create_client', label: 'Registrar Nuevas Empresas' },
    { id: 'edit_client', label: 'Editar Datos de Clientes' },
    { id: 'toggle_status', label: 'Suspender/Activar Servicio (Power)' },
    { id: 'charge_client', label: 'Emitir Cobros y Facturas' },
    { id: 'manage_plans', label: 'Crear y Modificar Planes' },
    { id: 'view_logs', label: 'Consultar Logs de Auditoría' },
    { id: 'manage_settings', label: 'Configuración Global del Sistema' }
]

export default function AdminDashboard({ session, onLogout }) {
  // --- ESTADOS GLOBALES ---
  const [currentView, setCurrentView] = useState('dashboard') 
  const [activeSettingsTab, setActiveSettingsTab] = useState('general') 
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [darkMode, setDarkMode] = useState(false) 
  
  // --- ESTADOS DE DATOS ---
  const [tenantsList, setTenantsList] = useState([])
  const [plansConfig, setPlansConfig] = useState([])
  const [invoicesList, setInvoicesList] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [rolePermissions, setRolePermissions] = useState({ assistant: [], maintenance: [] })
  const [usersList, setUsersList] = useState([]) // Lista simulada de usuarios con roles

  // --- ESTADOS DE ESTADÍSTICAS ---
  const [stats, setStats] = useState({ monthlyRevenue: 0, activeTenants: 0, pendingCollection: 0 })
  const [chartData, setChartData] = useState([])
  const [tenantStatusData, setTenantStatusData] = useState([])

  // --- CONFIGURACIÓN APP ---
  const [appSettings, setAppSettings] = useState({
    company_name: '', company_logo: '', primary_color: '#4F46E5',
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '',
    password_policy_level: 'medium', password_expiration_days: 90
  })

  // --- MODALES ---
  const [showClientModal, setShowClientModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showDrillDown, setShowDrillDown] = useState(null)
  
  // --- UI AUXILIAR ---
  const [hoveredPlanData, setHoveredPlanData] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)

  // --- FORMULARIOS ---
  const initialClientState = { name: '', ruc: '', address: '', location_reference: '', phone_landline: '', phone_extension: '', phone_mobile: '', legal_rep_name: '', legal_rep_email: '', legal_rep_phone: '', billing_name: '', billing_email: '', billing_phone: '', plan: '' }
  const [clientForm, setClientForm] = useState(initialClientState)
  const [clientFormErrors, setClientFormErrors] = useState({})
  
  const [invoiceForm, setInvoiceForm] = useState({ amount: 0, concept: '', due_date: '', active_users: 0 })
  const [planForm, setPlanForm] = useState({ code: '', name: '', price: 0, price_model: 'fixed', price_per_user: 0, courtesy_amount: 0, courtesy_frequency: 'monthly', description: '' })
  
  const [saving, setSaving] = useState(false)

  // ============================================================
  // 1. CARGA DE DATOS CENTRALIZADA
  // ============================================================
  async function fetchData() {
    setRefreshing(true)
    try {
      // A. Datos Operativos
      const { data: plans } = await supabase.from('subscription_plans').select('*').order('created_at', { ascending: true })
      setPlansConfig(plans || [])

      const { data: tenants } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
      setTenantsList(tenants || [])

      const { data: invoices } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
      setInvoicesList(invoices || [])

      // B. Configuración y Seguridad
      const { data: settings } = await supabase.from('app_settings').select('*').single()
      if (settings) setAppSettings(settings)

      const { data: roles } = await supabase.from('user_roles').select('*')
      setUsersList(roles || [])

      const { data: permissions } = await supabase.from('role_permissions').select('*')
      if (permissions) {
          const newPerms = { assistant: [], maintenance: [] }
          permissions.forEach(p => { if(newPerms[p.role] !== undefined) newPerms[p.role] = p.permissions })
          setRolePermissions(newPerms)
      }

      const { data: logs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
      setAuditLogs(logs || [])

      // C. Cálculos KPI
      const revenue = (invoices || []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
      const pending = (invoices || []).filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0)
      const activeCount = (tenants || []).filter(t => t.status === 'active').length;
      
      setStats({ monthlyRevenue: revenue, activeTenants: activeCount, pendingCollection: pending })

      // D. Gráficos
      setChartData([{ name: 'AGO', ingresos: revenue * 0.4 }, { name: 'SEP', ingresos: revenue * 0.6 }, { name: 'OCT', ingresos: revenue * 0.55 }, { name: 'NOV', ingresos: revenue * 0.8 }, { name: 'DIC', ingresos: revenue * 1.1 }, { name: 'ENE', ingresos: revenue }])
      setTenantStatusData([{ name: 'Activos', value: activeCount, color: '#6366f1' }, { name: 'Suspendidos', value: (tenants || []).length - activeCount, color: '#e2e8f0' }])

    } catch (e) { console.error("Error fetching data:", e) } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { fetchData() }, [])

  // --- LOGGING SYSTEM ---
  const logAction = async (action, details) => {
      try { await supabase.from('audit_logs').insert([{ user_email: session?.user?.email || 'sistema', action, details }]) } catch (e) { console.error(e) }
  }

  // ============================================================
  // 2. LÓGICA DE DRILL DOWN (DETALLE AL CLICK)
  // ============================================================
  const getDrillDownContent = () => {
      if (!showDrillDown) return null
      
      let title = ""; let data = []; let columns = []

      if (showDrillDown === 'revenue') {
          title = "Detalle de Ingresos (Facturas Pagadas)"
          data = invoicesList.filter(i => i.status === 'paid')
          columns = [
              { header: 'Fecha', render: (row) => new Date(row.created_at).toLocaleDateString() },
              { header: 'Cliente', render: (row) => { const t = tenantsList.find(t => t.id === row.tenant_id); return t ? <span className="font-bold text-slate-700">{t.name}</span> : 'Desconocido' } },
              { header: 'Concepto', render: (row) => row.concept },
              { header: 'Monto', render: (row) => <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">${row.amount}</span> }
          ]
      } else if (showDrillDown === 'pending') {
          title = "Facturas Pendientes de Cobro"
          data = invoicesList.filter(i => i.status === 'pending')
          columns = [
              { header: 'Vence', render: (row) => <span className="text-rose-500 font-bold">{new Date(row.due_date).toLocaleDateString()}</span> },
              { header: 'Cliente', render: (row) => { const t = tenantsList.find(t => t.id === row.tenant_id); return t ? t.name : 'Desconocido' } },
              { header: 'Monto', render: (row) => `$${row.amount}` },
              { header: 'Acción', render: (row) => <button className="text-[10px] uppercase font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded hover:bg-indigo-100 transition border border-indigo-200">Reenviar</button> }
          ]
      } else if (showDrillDown === 'clients') {
          title = "Cartera de Clientes Activos"
          data = tenantsList.filter(t => t.status === 'active')
          columns = [
              { header: 'Empresa', render: (row) => <span className="font-medium text-slate-700">{row.name}</span> },
              { header: 'RUC', render: (row) => <span className="font-mono text-xs text-slate-500">{row.ruc}</span> },
              { header: 'Plan', render: (row) => <span className="bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200 font-bold text-slate-600">{row.plan}</span> },
              { header: 'Contacto', render: (row) => row.contact_email }
          ]
      }

      return (
          <div className="overflow-hidden bg-white rounded-xl border border-slate-100 shadow-sm mt-2">
              <div className="bg-slate-50/50 px-6 py-3 border-b border-slate-100 font-bold text-slate-500 text-xs uppercase tracking-wider flex justify-between">
                  <span>{title}</span>
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-400">{data.length} registros</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-slate-400 font-bold text-[10px] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                        <tr>{columns.map((c, i) => <th key={i} className="px-6 py-3 bg-white">{c.header}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {data.length > 0 ? data.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">{columns.map((c, j) => <td key={j} className="px-6 py-4">{c.render(row)}</td>)}</tr>
                        )) : <tr><td colSpan={columns.length} className="p-10 text-center text-slate-400 italic">No hay datos registrados.</td></tr>}
                    </tbody>
                </table>
              </div>
          </div>
      )
  }

  // ============================================================
  // 3. HANDLERS DE ACCIÓN
  // ============================================================
  
  // -- CONFIGURACIÓN Y ROLES --
  const handleSaveSettings = async (e) => {
      e.preventDefault(); setSaving(true)
      try {
          const { error } = await supabase.from('app_settings').upsert({ id: appSettings.id || 1, ...appSettings })
          if (error) throw error; 
          await logAction('Configuración Global', 'Se actualizaron los ajustes generales.')
          alert("✅ Configuración guardada correctamente.")
      } catch (e) { alert("Error: " + e.message) } finally { setSaving(false) }
  }

  const handleUpdateRole = async (userId, newRole) => { 
      if(!confirm("¿Estás seguro de cambiar el rol de este usuario?")) return; 
      await supabase.from('user_roles').update({ role: newRole }).eq('id', userId); 
      await logAction('Cambio de Rol', `Usuario ID ${userId} a rol ${newRole}`)
      fetchData() 
  }

  const togglePermission = async (role, featureId) => {
      const currentPerms = rolePermissions[role] || []
      const newPerms = currentPerms.includes(featureId) ? currentPerms.filter(p => p !== featureId) : [...currentPerms, featureId]
      setRolePermissions({ ...rolePermissions, [role]: newPerms })
      await supabase.from('role_permissions').upsert({ role, permissions: newPerms })
      await logAction('Permisos', `Rol ${role} modificado: ${featureId}`)
  }

  // -- CLIENTES --
  const handleCreateClient = async (e) => {
    e.preventDefault(); 
    if (!clientForm.name || !clientForm.ruc || !clientForm.plan) { alert("⚠️ Completa los campos obligatorios."); return }
    setSaving(true)
    try {
      const selectedPlan = plansConfig.find(p => p.code === clientForm.plan)
      await supabase.from('tenants').insert([{ ...clientForm, contact_email: clientForm.billing_email, status: 'active', courtesy_enabled: selectedPlan?.courtesy_amount > 0, courtesy_limit: selectedPlan?.courtesy_amount || 0, courtesy_period: selectedPlan?.courtesy_frequency || 'monthly', courtesy_type: selectedPlan?.courtesy_frequency === 'always' ? 'perennial' : 'limited' }])
      await logAction('Crear Cliente', `Nuevo cliente: ${clientForm.name}`)
      setShowClientModal(false); setClientForm(initialClientState); await fetchData(); alert("¡Cliente Creado!")
    } catch (e) { alert("Error: " + e.message) } finally { setSaving(false) }
  }

  const handleToggleStatus = async (tenant) => { 
      const action = tenant.status === 'active' ? 'suspended' : 'active';
      const actionText = tenant.status === 'active' ? 'SUSPENDER' : 'REACTIVAR';
      if(confirm(`¿Confirma que desea ${actionText} el servicio para ${tenant.name}?`)) { 
          await supabase.from('tenants').update({ status: action }).eq('id', tenant.id); 
          await logAction(`Estado Cliente`, `${actionText} - ${tenant.name}`)
          fetchData() 
      } 
  }

  // -- PLANES --
  const handleSavePlan = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
        const payload = { ...planForm }
        if (!payload.code) payload.code = payload.name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4)
        if (editingPlan) {
            await supabase.from('subscription_plans').update(payload).eq('code', editingPlan.code);
            await logAction('Editar Plan', `Plan ${payload.name} actualizado`)
        } else {
            await supabase.from('subscription_plans').insert([payload])
            await logAction('Crear Plan', `Nuevo plan: ${payload.name}`)
        }
        setShowPlanModal(false); setEditingPlan(null); setPlanForm({ code: '', name: '', price: 0, price_model: 'fixed', price_per_user: 0, courtesy_amount: 0, courtesy_frequency: 'monthly', description: '' }); await fetchData() 
    } catch (e) { alert("Error: " + e.message) } finally { setSaving(false) }
  }

  // -- AUXILIARES --
  const handleNumericInput = (e) => setClientForm({ ...clientForm, [e.target.name]: e.target.value.replace(/[^0-9]/g, '') })
  const handleTextInput = (e) => setClientForm({ ...clientForm, [e.target.name]: e.target.value })
  const copyLegalToBilling = () => setClientForm(prev => ({ ...prev, billing_name: prev.legal_rep_name, billing_email: prev.legal_rep_email, billing_phone: prev.legal_rep_phone }))
  const handleDeletePlan = async (code) => { if(confirm("¿Eliminar plan?")) { await supabase.from('subscription_plans').delete().eq('code', code); await logAction('Eliminar Plan', code); await fetchData() } }
  const openEditPlan = (plan) => { setEditingPlan(plan); setPlanForm(plan); setShowPlanModal(true) }
  const openInvoiceModal = (tenant) => { setSelectedTenant(tenant); const plan = plansConfig.find(p => p.code === tenant.plan) || {}; setInvoiceForm({ amount: plan.price_model === 'fixed' ? plan.price : 10 * plan.price_per_user, concept: `Plan: ${plan.name}`, due_date: new Date().toISOString().split('T')[0], active_users: 10 }); setShowInvoiceModal(true) }
  const handleCreateInvoice = async (e) => { e.preventDefault(); setSaving(true); await supabase.from('invoices').insert([{ tenant_id: selectedTenant.id, ...invoiceForm, status: 'pending' }]); await logAction('Facturar', `Cobro a ${selectedTenant.name}`); setShowInvoiceModal(false); setSaving(false); alert("Factura enviada") }
  const handleMouseEnterPlan = (e, plan) => { if(!plan) return; const rect = e.currentTarget.getBoundingClientRect(); setTooltipPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY - 10 }); setHoveredPlanData(plan) }

  // ============================================================
  // 4. RENDER PRINCIPAL
  // ============================================================
  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${darkMode ? 'bg-slate-950 text-white' : 'bg-[#F3F4F6] text-slate-800'}`}>
      
      {/* NAVBAR */}
      <nav className={`px-8 py-4 flex justify-between items-center sticky top-0 z-30 backdrop-blur-xl border-b transition-all ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-white/60'}`}>
        <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-2.5 rounded-xl shadow-2xl text-white"><Activity size={24} strokeWidth={2.5}/></div>
            <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2">{appSettings.company_name || 'CEREBRO'} <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold">v3.0</span></h1><p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Admin Panel</p></div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
            <button onClick={() => fetchData()} className={`p-2.5 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition ${refreshing ? 'animate-spin text-indigo-600' : ''}`}><RefreshCw size={20}/></button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            {currentView === 'dashboard' ? (<button onClick={() => setCurrentView('settings')} className="nav-btn bg-indigo-50 text-indigo-700 border border-indigo-100"><Settings size={18} /> Configuración</button>) : (<button onClick={() => setCurrentView('dashboard')} className="nav-btn"><ArrowLeft size={18} /> Dashboard</button>)}
            <button onClick={onLogout} className="btn-secondary text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100"><LogOut size={18} /> Salir</button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-8">
        
        {/* VISTA 1: DASHBOARD */}
        {currentView === 'dashboard' && (
            <div className="animate-fade-in space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <KPICard3DModern onClick={() => setShowDrillDown('revenue')} title="Ingresos Recurrentes" value={`$${stats.monthlyRevenue.toLocaleString()}`} icon={DollarSign} badge="+12% este mes" gradient="bg-gradient-to-br from-[#7F56D9] to-[#5d3fd3]" shadow="shadow-[0_20px_40px_-15px_rgba(127,86,217,0.5)]" />
                    <KPICard3DModern onClick={() => setShowDrillDown('clients')} title="Clientes Activos" value={stats.activeTenants} icon={Users} badge="8 nuevos" gradient="bg-gradient-to-br from-[#06b6d4] to-[#0891b2]" shadow="shadow-[0_20px_40px_-15px_rgba(6,182,212,0.5)]" />
                    <KPICard3DModern onClick={() => setShowDrillDown('pending')} title="Pendiente de Cobro" value={`$${stats.pendingCollection.toLocaleString()}`} icon={CreditCard} badge="5 facturas" gradient="bg-gradient-to-br from-[#F04438] to-[#D92D20]" shadow="shadow-[0_20px_40px_-15px_rgba(240,68,56,0.5)]" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[420px]">
                    <div className="lg:col-span-2 bg-white rounded-[24px] p-8 shadow-xl shadow-slate-200/50 flex flex-col relative"><div className="flex justify-between mb-6"><div><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="text-violet-500" size={20}/> Tendencia</h3><p className="text-xs text-slate-400 font-medium ml-7">Últimos 6 meses</p></div></div><div className="flex-1 w-full"><ResponsiveContainer><AreaChart data={chartData}><defs><linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} /><RechartsTooltip /><Area type="monotone" dataKey="ingresos" stroke="#7c3aed" strokeWidth={4} fill="url(#colorGradient)" /></AreaChart></ResponsiveContainer></div></div>
                    <div className="bg-white rounded-[24px] p-8 shadow-xl shadow-slate-200/50 flex flex-col relative"><div className="mb-4"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><PieChartIcon className="text-cyan-500" size={20}/> Cartera</h3></div><div className="flex-1 relative"><ResponsiveContainer><PieChart><Pie data={tenantStatusData} innerRadius={80} outerRadius={105} paddingAngle={0} dataKey="value" stroke="none"><Cell fill="#06b6d4" /><Cell fill="#e2e8f0" /></Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-4xl font-black text-slate-800 tracking-tight">{tenantsList.length}</span><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clientes</span></div></div></div>
                </div>
                <div className="bg-white rounded-[24px] shadow-xl shadow-slate-200/50 overflow-hidden p-8">
                    <div className="flex justify-between items-end mb-8"><div><h2 className="text-2xl font-black text-slate-800">Listado de Clientes</h2></div><button onClick={() => setShowClientModal(true)} className="btn-modern-action"><Plus size={18} strokeWidth={3}/> Nuevo Cliente</button></div>
                    <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="pb-4 pl-4">Cliente</th><th className="pb-4">Plan</th><th className="pb-4">Estado</th><th className="pb-4 text-right pr-4">Acciones</th></tr></thead><tbody className="divide-y divide-slate-50">{tenantsList.map(tenant => (<tr key={tenant.id} className="hover:bg-slate-50/80"><td className="py-4 pl-4"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-black`}>{tenant.name.charAt(0)}</div><div><p className="font-bold text-slate-700 text-sm">{tenant.name}</p><p className="text-[10px] font-bold text-slate-400 font-mono tracking-wide">RUC: {tenant.ruc}</p></div></div></td><td className="py-4"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-[10px] font-black uppercase border border-slate-200">{tenant.plan}</span></td><td className="py-4">{tenant.status === 'active' ? <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-100 flex w-fit items-center gap-1">Activo</span> : <span className="text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold border border-slate-200">Suspendido</span>}</td><td className="py-4 text-right pr-4 flex justify-end gap-2"><button onClick={() => openInvoiceModal(tenant)} className="text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg text-xs font-bold transition">COBRAR</button><button onClick={() => handleToggleStatus(tenant)} className={`p-1.5 rounded-lg transition border ${tenant.status === 'active' ? 'text-rose-400 border-rose-100 hover:bg-rose-50 hover:text-rose-600' : 'text-emerald-400 border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600'}`} title={tenant.status === 'active' ? 'Pausar Servicio' : 'Reactivar'}>{tenant.status === 'active' ? <PauseCircle size={18}/> : <PlayCircle size={18}/>}</button></td></tr>))}</tbody></table></div>
                </div>
            </div>
        )}

        {/* VISTA 2: CONFIGURACIÓN */}
        {currentView === 'settings' && (
            <div className="animate-fade-in flex gap-8">
                <aside className="w-72 flex flex-col gap-3">
                    <div className="mb-4 px-2"><h3 className="font-black text-slate-800 text-xl">Ajustes</h3><p className="text-xs text-slate-400">Personaliza tu plataforma</p></div>
                    <SettingsTab active={activeSettingsTab === 'general'} onClick={() => setActiveSettingsTab('general')} icon={Palette} title="General" desc="Branding e Identidad" />
                    <SettingsTab active={activeSettingsTab === 'roles'} onClick={() => setActiveSettingsTab('roles')} icon={Users} title="Roles y Permisos" desc="Control de Acceso" />
                    <SettingsTab active={activeSettingsTab === 'logs'} onClick={() => setActiveSettingsTab('logs')} icon={FileClock} title="Logs de Auditoría" desc="Historial de Acciones" />
                    <SettingsTab active={activeSettingsTab === 'smtp'} onClick={() => setActiveSettingsTab('smtp')} icon={Mail} title="Servidor de Correo" desc="Configuración SMTP" />
                    <SettingsTab active={activeSettingsTab === 'security'} onClick={() => setActiveSettingsTab('security')} icon={Shield} title="Seguridad" desc="Passwords y Políticas" />
                    <SettingsTab active={activeSettingsTab === 'plans'} onClick={() => setActiveSettingsTab('plans')} icon={Layers} title="Planes" desc="Gestión de Tarifas" />
                </aside>

                <div className="flex-1 bg-white rounded-[24px] shadow-xl shadow-slate-200/50 border border-white p-10 min-h-[600px]">
                    
                    {/* 2.1 TAB GENERAL */}
                    {activeSettingsTab === 'general' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">General</h2><p className="text-sm text-slate-500">Información básica de la empresa.</p></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4"><label className="label">Nombre de la Empresa</label><input className="input-modern" value={appSettings.company_name} onChange={e => setAppSettings({...appSettings, company_name: e.target.value})} /></div>
                                <div className="space-y-4"><label className="label">Color Corporativo</label><div className="flex items-center gap-4"><input type="color" className="h-12 w-12 rounded-xl border-none cursor-pointer bg-transparent" value={appSettings.primary_color} onChange={e => setAppSettings({...appSettings, primary_color: e.target.value})} /><span className="text-sm font-bold text-slate-500 font-mono bg-slate-100 px-3 py-2 rounded-lg">{appSettings.primary_color}</span></div></div>
                                <div className="space-y-4 md:col-span-2"><label className="label">Logo URL</label><div className="flex gap-4">{appSettings.company_logo && <img src={appSettings.company_logo} className="w-14 h-14 rounded-xl border border-slate-200 object-cover shadow-sm" />}<input className="input-modern flex-1" placeholder="https://..." value={appSettings.company_logo} onChange={e => setAppSettings({...appSettings, company_logo: e.target.value})} /></div></div>
                            </div>
                            <div className="flex justify-end pt-4 border-t border-slate-100"><SubmitButton saving={saving} text="Guardar Cambios" onClick={handleSaveSettings}/></div>
                        </div>
                    )}

                    {/* 2.2 TAB ROLES (MATRIZ) */}
                    {activeSettingsTab === 'roles' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4"><div><h2 className="text-2xl font-black text-slate-800">Roles y Permisos</h2><p className="text-sm text-slate-500">Define qué puede hacer cada perfil.</p></div></div>
                            <div className="overflow-hidden border border-slate-200 rounded-xl">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wider">
                                        <tr><th className="p-4 w-1/2">Funcionalidad</th><th className="p-4 text-center bg-indigo-50 text-indigo-700 border-x border-indigo-100">Administrador</th><th className="p-4 text-center border-r border-slate-200">Asistente</th><th className="p-4 text-center">Mantenimiento</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {SYSTEM_FEATURES.map(feat => (
                                            <tr key={feat.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-sm font-bold text-slate-700">{feat.label}</td>
                                                <td className="p-4 text-center bg-indigo-50/30 border-x border-indigo-50"><CheckSquare size={20} className="mx-auto text-indigo-400 opacity-50" /></td>
                                                <td className="p-4 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100" onClick={() => togglePermission('assistant', feat.id)}>{rolePermissions.assistant.includes(feat.id) ? <CheckSquare size={20} className="mx-auto text-emerald-500"/> : <Square size={20} className="mx-auto text-slate-300"/>}</td>
                                                <td className="p-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => togglePermission('maintenance', feat.id)}>{rolePermissions.maintenance.includes(feat.id) ? <CheckSquare size={20} className="mx-auto text-emerald-500"/> : <Square size={20} className="mx-auto text-slate-300"/>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3 text-amber-700 text-xs font-bold"><Info size={18}/><p>El rol "Administrador" tiene acceso total. Los cambios en los otros roles se aplican inmediatamente.</p></div>
                        </div>
                    )}

                    {/* 2.3 TAB LOGS */}
                    {activeSettingsTab === 'logs' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">Logs de Auditoría</h2><p className="text-sm text-slate-500">Historial de acciones.</p></div>
                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0 z-10"><tr><th className="p-4">Fecha</th><th className="p-4">Usuario</th><th className="p-4">Acción</th><th className="p-4">Detalle</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {auditLogs.length > 0 ? auditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-mono text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                                                <td className="p-4 font-bold text-slate-700">{log.user_email}</td>
                                                <td className="p-4"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold uppercase">{log.action}</span></td>
                                                <td className="p-4 text-slate-600">{log.details}</td>
                                            </tr>
                                        )) : <tr><td colSpan="4" className="p-8 text-center text-slate-400">No hay registros recientes.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 2.4 TAB SMTP */}
                    {activeSettingsTab === 'smtp' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">Servidor de Correo</h2><p className="text-sm text-slate-500">Configuración SMTP.</p></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2"><label className="label">Servidor SMTP</label><input className="input-modern" placeholder="smtp.gmail.com" value={appSettings.smtp_host} onChange={e => setAppSettings({...appSettings, smtp_host: e.target.value})} /></div>
                                <div className="space-y-2"><label className="label">Puerto</label><input className="input-modern" placeholder="587" value={appSettings.smtp_port} onChange={e => setAppSettings({...appSettings, smtp_port: e.target.value})} /></div>
                                <div className="space-y-2"><label className="label">Usuario</label><input className="input-modern" placeholder="no-reply@empresa.com" value={appSettings.smtp_user} onChange={e => setAppSettings({...appSettings, smtp_user: e.target.value})} /></div>
                                <div className="space-y-2"><label className="label">Contraseña</label><input type="password" class="input-modern" placeholder="••••••••" value={appSettings.smtp_pass} onChange={e => setAppSettings({...appSettings, smtp_pass: e.target.value})} /></div>
                            </div>
                            <div className="flex justify-end pt-4 border-t border-slate-100"><SubmitButton saving={saving} text="Guardar Configuración SMTP" onClick={handleSaveSettings}/></div>
                        </div>
                    )}

                    {/* 2.5 TAB SECURITY */}
                    {activeSettingsTab === 'security' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">Seguridad</h2><p className="text-sm text-slate-500">Políticas de contraseñas.</p></div>
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-8">
                                <div>
                                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Lock size={18} className="text-indigo-600"/> Complejidad Contraseña</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {['low', 'medium', 'high'].map(level => (
                                            <div key={level} onClick={() => setAppSettings({...appSettings, password_policy_level: level})} className={`cursor-pointer p-5 rounded-xl border-2 transition-all ${appSettings.password_policy_level === level ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-white bg-white hover:border-indigo-200'}`}>
                                                <div className="font-black uppercase text-xs mb-2 text-indigo-900 flex justify-between">{level === 'low' ? 'Baja' : level === 'medium' ? 'Media' : 'Alta'} {appSettings.password_policy_level === level && <CheckCircle size={14}/>}</div>
                                                <ul className="text-[10px] text-slate-500 space-y-1.5 list-disc pl-3 font-medium">
                                                    {level === 'low' && <><li>Min 5 chars</li><li>1 Mayúscula</li></>}
                                                    {level === 'medium' && <><li>Min 6 chars</li><li>1 Especial</li></>}
                                                    {level === 'high' && <><li>Min 8 chars</li><li>Num + Mayus + Esp</li></>}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 pt-6">
                                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Key size={18} className="text-indigo-600"/> Rotación Obligatoria</h3>
                                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 w-fit">
                                        <select className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer" value={appSettings.password_expiration_days} onChange={e => setAppSettings({...appSettings, password_expiration_days: e.target.value})}>
                                            <option value="30">Cada 30 días</option><option value="60">Cada 60 días</option><option value="90">Cada 90 días</option><option value="0">Nunca (Perenne)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 pt-6"><h3 className="font-bold text-slate-700 mb-2">Recuperación</h3><p className="text-sm text-slate-500 mb-4">Link de recuperación vía email.</p><button className="text-xs bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-lg font-bold border border-indigo-100">Probar envío de email</button></div>
                            </div>
                            <div className="flex justify-end"><SubmitButton saving={saving} text="Guardar Seguridad" onClick={handleSaveSettings}/></div>
                        </div>
                    )}

                    {/* 2.6 TAB PLANES */}
                    {activeSettingsTab === 'plans' && (
                        <div className="animate-fade-in">
                            <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-4"><div><h2 className="text-2xl font-black text-slate-800">Planes</h2><p className="text-slate-500 text-sm">Gestionar tarifas.</p></div><button onClick={() => { setEditingPlan(null); setShowPlanModal(true) }} className="btn-modern-action py-2"><Plus size={16}/> Crear Plan</button></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {plansConfig.map(plan => (
                                    <div key={plan.code} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 transition group relative">
                                        <div className="flex justify-between"><h3 className="font-bold text-lg text-slate-800">{plan.name}</h3><div className="flex gap-2"><button onClick={() => openEditPlan(plan)} className="p-1.5 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"><Edit size={14}/></button><button onClick={() => handleDeletePlan(plan.code)} className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100"><Trash2 size={14}/></button></div></div>
                                        <p className="text-xs text-slate-500 mt-2 mb-4 h-8 overflow-hidden">{plan.description}</p>
                                        <div className="font-black text-2xl text-indigo-600">{plan.price_model === 'fixed' ? `$${plan.price}` : `$${plan.price_per_user}`}<span className="text-xs text-slate-400 font-bold uppercase ml-1">{plan.price_model === 'fixed' ? '/mes' : '/user'}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>

      {/* ============================================================
          5. MODALES (VENTANAS EMERGENTES)
         ============================================================ */}
         
      {/* DRILL DOWN MODAL */}
      {showDrillDown && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden relative"><div className="bg-white px-6 py-4 flex justify-between items-center border-b border-slate-100"><h3 className="font-black text-slate-800 flex items-center gap-2 text-lg"><Eye size={20} className="text-indigo-600"/> Detalle</h3><button onClick={() => setShowDrillDown(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full"><X size={20}/></button></div><div className="p-6 bg-slate-50/50">{getDrillDownContent()}</div></div></div>}
      
      {/* CLIENT MODAL */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-lg flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden border border-white/50">
            <aside className="w-72 bg-[#F9FAFB] border-r border-slate-100 p-8 flex flex-col gap-8 hidden md:flex"><div className="flex items-center gap-3"><div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30"><Briefcase size={24}/></div><div><h1 className="font-black text-slate-800 text-xl leading-tight">Alta Cliente</h1><p className="text-sm font-bold text-slate-400">Ficha Corporativa</p></div></div><nav className="flex flex-col gap-4"><StepItem num="1" text="Datos Fiscales" active /><StepItem num="2" text="Contactos" /><StepItem num="3" text="Suscripción" /></nav></aside>
            <main className="flex-1 flex flex-col min-h-0 bg-white"><div className="p-10 overflow-y-auto flex-1 custom-scrollbar"><header className="flex justify-between items-center mb-8 md:hidden"><h2 className="text-xl font-black text-slate-800">Alta de Cliente</h2><button onClick={() => setShowClientModal(false)}><X size={24} className="text-slate-400"/></button></header><form id="clientForm" onSubmit={handleCreateClient} className="space-y-10"><div className="space-y-6"><SectionTitle icon={FileText} title="Información Fiscal" /><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="label">Razón Social <span className="text-rose-500">*</span></label><input className={`input-modern ${clientFormErrors.name ? 'border-rose-500' : ''}`} placeholder="Ej. Corporación ABC" name="name" value={clientForm.name} onChange={handleTextInput} /></div><div className="space-y-2"><label className="label">R.U.C. (13 Dígitos) <span className="text-rose-500">*</span></label><input className={`input-modern font-mono ${clientFormErrors.ruc ? 'border-rose-500' : ''}`} placeholder="099..." name="ruc" value={clientForm.ruc} onChange={handleNumericInput} maxLength={13} /></div><div className="md:col-span-2 space-y-2"><label className="label">Dirección Matriz</label><input className="input-modern" placeholder="Av. Principal..." name="address" value={clientForm.address} onChange={handleTextInput} /></div><div className="md:col-span-2 space-y-2"><label className="label">Referencia</label><input className="input-modern" placeholder="Frente a..." name="location_reference" value={clientForm.location_reference} onChange={handleTextInput} /></div></div></div><div className="space-y-6"><SectionTitle icon={Phone} title="Teléfonos" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100"><div className="space-y-2"><label className="label-sub">Convencional</label><input className="input-modern bg-white" placeholder="042..." name="phone_landline" value={clientForm.phone_landline} onChange={handleNumericInput} /></div><div className="space-y-2"><label className="label-sub">Extensión</label><input className="input-modern bg-white" placeholder="101" name="phone_extension" value={clientForm.phone_extension} onChange={handleNumericInput} /></div><div className="space-y-2"><label className="label-sub">Celular <span className="text-rose-500">*</span></label><input className="input-modern bg-white border-violet-200" placeholder="099..." name="phone_mobile" value={clientForm.phone_mobile} onChange={handleNumericInput} /></div></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-4"><SectionTitle icon={User} title="Rep. Legal" /><div className="space-y-3"><input className="input-modern" placeholder="Nombre Completo" name="legal_rep_name" value={clientForm.legal_rep_name} onChange={handleTextInput} /><input className="input-modern" placeholder="Email Personal" name="legal_rep_email" value={clientForm.legal_rep_email} onChange={handleTextInput} /><input className="input-modern" placeholder="Celular" name="legal_rep_phone" value={clientForm.legal_rep_phone} onChange={handleNumericInput} /></div></div><div className="space-y-4"><div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2"><div className="flex items-center gap-2 text-violet-600"><CreditCard size={18}/><h3 className="uppercase text-xs font-black tracking-widest">Cobranza</h3></div><button type="button" onClick={copyLegalToBilling} className="text-[10px] bg-violet-50 text-violet-600 px-3 py-1 rounded-lg font-bold hover:bg-violet-100 transition">COPIAR DATOS</button></div><div className="space-y-3"><input className="input-modern" placeholder="Contacto" name="billing_name" value={clientForm.billing_name} onChange={handleTextInput} /><input className={`input-modern ${clientFormErrors.billing_email ? 'border-rose-500' : ''}`} placeholder="Email Facturas *" name="billing_email" value={clientForm.billing_email} onChange={handleTextInput} /><input className="input-modern" placeholder="Teléfono" name="billing_phone" value={clientForm.billing_phone} onChange={handleNumericInput} /></div></div></div><div className="space-y-6 pb-6"><SectionTitle icon={MousePointer2} title="Plan" /><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{plansConfig.map(plan => (<div key={plan.code} onClick={() => setClientForm({...clientForm, plan: plan.code})} className={`border-2 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-lg relative group ${clientForm.plan === plan.code ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-100' : 'border-slate-100 hover:border-violet-200'}`}>{clientForm.plan === plan.code && <div className="absolute top-3 right-3 text-violet-600"><CheckCircle size={20} fill="currentColor" className="text-white"/></div>}<p className="text-sm font-bold text-slate-700 mb-1">{plan.name}</p><span className="text-2xl font-black text-slate-900">{plan.price_model === 'fixed' ? `$${plan.price}` : `$${plan.price_per_user}`}</span></div>))}</div></div></form></div><footer className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3"><button onClick={() => setShowClientModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition">Cancelar</button><button onClick={handleCreateClient} disabled={saving} className="px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition-all flex items-center gap-2">{saving ? <Loader className="animate-spin" size={18}/> : <span>Registrar Empresa</span>}</button></footer></main></div></div>
      )}

      {/* PLAN MODAL */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden relative"><div className="px-8 pt-8 pb-4 flex justify-between items-center"><div className="flex items-center gap-2 text-violet-600"><Plus size={24} strokeWidth={3}/><h3 className="text-xl font-black text-slate-800">Nuevo Plan</h3></div><button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button></div><form onSubmit={handleSavePlan} className="px-8 pb-8 space-y-6"><div className="space-y-2"><label className="label-sub flex gap-2 items-center"><Tag size={14}/> Nombre</label><input className="input-modern" placeholder="Ej. Plan Pro" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} required/></div><div className="space-y-2"><label className="label-sub flex gap-2 items-center"><AlignLeft size={14}/> Descripción</label><textarea className="input-modern resize-none" rows="2" value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})}/></div><div className="grid grid-cols-2 gap-4"><div><label className="label-sub flex gap-2 items-center"><Layers size={14}/> Modelo</label><select className="input-modern" value={planForm.price_model} onChange={e => setPlanForm({...planForm, price_model: e.target.value})}><option value="fixed">Fijo</option><option value="per_user">Usuario</option></select></div><div><label className="label-sub flex gap-2 items-center"><DollarSign size={14}/> Precio</label><input type="number" className="input-modern" value={planForm.price_model === 'fixed' ? planForm.price : planForm.price_per_user} onChange={e => planForm.price_model === 'fixed' ? setPlanForm({...planForm, price: e.target.value}) : setPlanForm({...planForm, price_per_user: e.target.value})}/></div></div><div className="pt-2 border-t border-slate-100"><div className="flex gap-4 mt-4"><div><label className="label-sub text-slate-400">Cortesía</label><input type="number" className="input-modern" placeholder="100" value={planForm.courtesy_amount} onChange={e => setPlanForm({...planForm, courtesy_amount: e.target.value})} /></div><div><label className="label-sub text-slate-400">Frecuencia</label><select className="input-modern" value={planForm.courtesy_frequency} onChange={e => setPlanForm({...planForm, courtesy_frequency: e.target.value})}><option value="monthly">Mensual</option><option value="once">Una vez</option></select></div></div></div><button type="submit" disabled={saving} className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition-all flex justify-center gap-2">{saving ? <Loader className="animate-spin" size={20}/> : <><Save size={18}/> Guardar Plan</>}</button></form></div></div>
      )}

      {hoveredPlanData && <div style={{ position: 'fixed', left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, -100%)', zIndex: 9999, pointerEvents: 'none' }} className="mb-3 w-64 bg-slate-800 text-white p-4 rounded-xl shadow-xl animate-fade-in"><p className="font-bold text-violet-300 mb-1">{hoveredPlanData.name}</p><p className="text-xs text-slate-300 italic">{hoveredPlanData.description}</p></div>}
      {showInvoiceModal && <Modal title="Facturar" onClose={() => setShowInvoiceModal(false)}><form onSubmit={handleCreateInvoice} className="space-y-4"><div className="text-center"><p className="text-4xl font-black text-violet-600 tracking-tighter">${invoiceForm.amount.toFixed(2)}</p><p className="text-sm text-slate-400 font-bold">{invoiceForm.concept}</p></div><SubmitButton saving={saving} text="Confirmar Emisión" onClick={handleCreateInvoice} /></form></Modal>}
    </div>
  )
}

// ============================================================
// 6. COMPONENTES UI REUTILIZABLES
// ============================================================
const SettingsTab = ({ active, onClick, icon: Icon, title, desc }) => (<div onClick={onClick} className={`p-4 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 ${active ? 'bg-white shadow-md border border-slate-100 ring-1 ring-indigo-50' : 'hover:bg-white/50 hover:shadow-sm'}`}><div className={`p-2.5 rounded-lg transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:text-slate-700'}`}><Icon size={20}/></div><div><h4 className={`text-sm font-bold ${active ? 'text-slate-800' : 'text-slate-500'}`}>{title}</h4><p className="text-[10px] text-slate-400 font-medium leading-tight">{desc}</p></div>{active && <ChevronRight size={16} className="ml-auto text-indigo-400"/>}</div>)
const KPICard3DModern = ({ title, value, sub, icon: Icon, badge, gradient, shadow, onClick }) => (<div onClick={onClick} className={`relative overflow-hidden rounded-[24px] p-8 ${gradient} text-white ${shadow} hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 group cursor-pointer`}><div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><Icon size={80} strokeWidth={1} /></div><div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]"><div className="flex justify-between items-start"><div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10"><Icon size={24} /></div><span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">{badge}</span></div><div><p className="text-indigo-100 font-bold text-sm tracking-wide opacity-90 mb-1">{title}</p><p className="text-5xl font-black tracking-tight">{value}<span className="text-2xl opacity-60 ml-1">{sub}</span></p></div></div></div>)
const StepItem = ({ num, text, active }) => (<div className={`flex items-center gap-4 group cursor-pointer ${active ? '' : 'opacity-40 hover:opacity-70 transition'}`}><div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all ${active ? 'bg-violet-600 text-white shadow-violet-500/30 scale-110' : 'bg-slate-200 text-slate-500'}`}>{num}</div><span className={`text-sm font-bold ${active ? 'text-slate-800' : 'text-slate-500'}`}>{text}</span></div>)
const SectionTitle = ({ icon: Icon, title }) => (<div className="flex items-center gap-3 text-violet-600 mb-4 border-b border-slate-100 pb-3"><Icon size={20}/><h3 className="uppercase tracking-widest text-xs font-black text-slate-800">{title}</h3></div>)
const CustomTooltip = ({ active, payload }) => active && payload && payload.length ? (<div className="bg-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-bold"><p className="mb-1 opacity-60">{payload[0].payload.name}</p><p className="text-lg text-violet-300">{payload[0].name === 'Activos' || payload[0].name === 'Suspendidos' ? payload[0].value : `$${payload[0].value}`}</p></div>) : null
const getRandomColor = (name) => { const colors = ['bg-red-100 text-red-600', 'bg-orange-100 text-orange-600', 'bg-amber-100 text-amber-600', 'bg-green-100 text-green-600', 'bg-emerald-100 text-emerald-600', 'bg-teal-100 text-teal-600', 'bg-cyan-100 text-cyan-600', 'bg-sky-100 text-sky-600', 'bg-blue-100 text-blue-600', 'bg-indigo-100 text-indigo-600', 'bg-violet-100 text-violet-600', 'bg-purple-100 text-purple-600', 'bg-fuchsia-100 text-fuchsia-600', 'bg-pink-100 text-pink-600', 'bg-rose-100 text-rose-600']; return colors[name.length % colors.length]; }
const Modal = ({ title, onClose, children }) => (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in"><div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100"><h3 className="text-slate-800 font-bold text-lg">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={20} /></button></div><div className="p-6">{children}</div></div></div>)
const SubmitButton = ({ saving, text, onClick }) => (<button onClick={onClick} disabled={saving} className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">{saving ? <Loader className="animate-spin" size={18}/> : text}</button>)

const styleSheet = document.createElement("style"); 
styleSheet.innerText = `
  .nav-btn { @apply flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-sm transition-all; }
  .btn-modern-action { @apply px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-600/30 transition-all active:scale-95 flex items-center gap-2 text-sm; }
  .input-modern { @apply w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:ring-4 focus:ring-violet-100 focus:border-violet-500 outline-none transition-all text-sm font-semibold shadow-sm hover:border-slate-300; } 
  .label { @apply block text-sm font-bold text-slate-700 mb-2; }
  .label-sub { @apply block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide; }
  .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
`; 
document.head.appendChild(styleSheet)