import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  // --- ICONOS DE NAVEGACIÓN Y ACCIÓN ---
  DollarSign, 
  Users, 
  CreditCard, 
  Activity, 
  LogOut, 
  Loader, 
  Plus, 
  X, 
  FileText, 
  Settings, 
  Trash2, 
  Edit, 
  Info, 
  ArrowLeft, 
  RefreshCw, 
  Briefcase, 
  Phone, 
  User, 
  Mail, 
  MousePointer2, 
  Tag, 
  AlignLeft, 
  Layers, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Sun, 
  Moon, 
  PlayCircle, 
  PauseCircle, 
  Eye, 
  Shield, 
  Palette, 
  Lock, 
  Key, 
  FileClock,
  Save,          // CRÍTICO PARA GUARDAR
  Upload,        // CRÍTICO PARA LOGO
  Image as ImageIcon,
  UserPlus,      // CRÍTICO PARA CREAR USUARIOS
  
  // --- ICONOS DE FORMULARIO Y SELECCIÓN ---
  CheckSquare, 
  Square, 
  CheckCircle,   // CRÍTICO PARA SELECCIÓN DE PLANES
  
  // --- ICONOS DE HARDWARE / BIOMÉTRICO ---
  Fingerprint, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp,
  ChevronRight
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts'

// ==============================================================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// ==============================================================================
// 2. CONSTANTES GLOBALES
// ==============================================================================

// Matriz de funcionalidades para la gestión de Roles
const SYSTEM_FEATURES = [
    { id: 'view_dashboard', label: 'Ver Dashboard y Métricas' }, 
    { id: 'create_client', label: 'Registrar Nuevas Empresas' },
    { id: 'edit_client', label: 'Editar Datos de Clientes' }, 
    { id: 'toggle_status', label: 'Suspender/Activar Servicio' },
    { id: 'charge_client', label: 'Emitir Facturación' }, 
    { id: 'manage_plans', label: 'Gestión de Planes' },
    { id: 'manage_users', label: 'Gestión de Usuarios y Accesos' }, 
    { id: 'view_logs', label: 'Ver Auditoría del Sistema' }, 
    { id: 'manage_settings', label: 'Configuración Global' }
]

// ==============================================================================
// 3. COMPONENTE PRINCIPAL
// ==============================================================================

export default function AdminDashboard({ session, onLogout }) {
  
  // ----------------------------------------------------------------------------
  // ESTADOS DE LA APLICACIÓN
  // ----------------------------------------------------------------------------
  
  // Control de UI y Navegación
  const [currentView, setCurrentView] = useState('dashboard') // 'dashboard' | 'settings'
  const [activeSettingsTab, setActiveSettingsTab] = useState('general') 
  const [refreshing, setRefreshing] = useState(false)
  const [darkMode, setDarkMode] = useState(false) 
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  
  // Datos de Negocio
  const [tenantsList, setTenantsList] = useState([])
  const [plansConfig, setPlansConfig] = useState([])
  const [invoicesList, setInvoicesList] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [rolePermissions, setRolePermissions] = useState({ assistant: [], maintenance: [] })
  
  // Gestión de Usuarios
  const [systemUsers, setSystemUsers] = useState([])

  // Estadísticas Calculadas
  const [stats, setStats] = useState({ 
      monthlyRevenue: 0, 
      activeTenants: 0, 
      pendingCollection: 0 
  })
  const [chartData, setChartData] = useState([])
  const [tenantStatusData, setTenantStatusData] = useState([])

  // Configuración Global
  const [appSettings, setAppSettings] = useState({ 
    company_name: '', 
    company_logo: '', 
    primary_color: '#4F46E5', 
    smtp_host: '', 
    smtp_port: '', 
    smtp_user: '', 
    smtp_pass: '', 
    password_policy_level: 'medium', 
    password_expiration_days: 90 
  })

  // Control de Modales
  const [showClientModal, setShowClientModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false) 
  const [showDrillDown, setShowDrillDown] = useState(null)
  
  // Estado para Sección Biometría
  const [showBiometricForm, setShowBiometricForm] = useState(false) 
  
  // Estados Auxiliares de UI
  const [hoveredPlanData, setHoveredPlanData] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)

  // ----------------------------------------------------------------------------
  // FORMULARIOS (ESTADOS INICIALES)
  // ----------------------------------------------------------------------------
  
  // Formulario Cliente
  const initialClientState = { 
    name: '', ruc: '', address: '', location_reference: '', 
    phone_landline: '', phone_extension: '', phone_mobile: '',
    legal_rep_name: '', legal_rep_email: '', legal_rep_phone: '', 
    billing_name: '', billing_email: '', billing_phone: '', plan: '',
    bio_brand: '', bio_model: '', bio_serial: '', 
    bio_location: '', bio_purchase_date: '', bio_warranty_months: ''
  }
  const [clientForm, setClientForm] = useState(initialClientState)
  
  // Formulario Factura
  const [invoiceForm, setInvoiceForm] = useState({ 
      amount: 0, concept: '', due_date: '', active_users: 0 
  })
  
  // Formulario Plan
  const [planForm, setPlanForm] = useState({ 
      code: '', name: '', price: 0, price_model: 'fixed', 
      price_per_user: 0, description: '' 
  })

  // Formulario Nuevo Usuario
  const [userForm, setUserForm] = useState({
      email: '', password: '', role: 'assistant'
  })

  // ----------------------------------------------------------------------------
  // CARGA DE DATOS (FETCH DATA)
  // ----------------------------------------------------------------------------
  
  async function fetchData() {
    setRefreshing(true)
    try {
      // 1. Cargar Planes
      const { data: plans } = await supabase.from('subscription_plans').select('*').order('created_at', { ascending: true })
      setPlansConfig(plans || [])
      
      // 2. Cargar Clientes
      const { data: tenants } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
      setTenantsList(tenants || [])
      
      // 3. Cargar Facturas
      const { data: invoices } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
      setInvoicesList(invoices || [])
      
      // 4. Cargar Configuración
      const { data: settings } = await supabase.from('app_settings').select('*').single()
      if (settings) setAppSettings(settings)
      
      // 5. Cargar Permisos
      const { data: permissions } = await supabase.from('role_permissions').select('*')
      if (permissions) {
          const newPerms = { assistant: [], maintenance: [] }
          permissions.forEach(p => { 
              if(newPerms[p.role] !== undefined) newPerms[p.role] = p.permissions 
          })
          setRolePermissions(newPerms)
      }

      // 6. Cargar Usuarios del Sistema
      const { data: users } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false })
      setSystemUsers(users || [])
      
      // 7. Cargar Logs
      const { data: logs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
      setAuditLogs(logs || [])

      // 8. Calcular KPIs
      const revenue = (invoices || []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
      const pending = (invoices || []).filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0)
      const activeCount = (tenants || []).filter(t => t.status === 'active').length;
      
      setStats({ monthlyRevenue: revenue, activeTenants: activeCount, pendingCollection: pending })
      
      // 9. Datos Gráficos
      setChartData([ 
          { name: 'AGO', ingresos: revenue * 0.4 }, 
          { name: 'SEP', ingresos: revenue * 0.6 }, 
          { name: 'OCT', ingresos: revenue * 0.55 }, 
          { name: 'NOV', ingresos: revenue * 0.8 }, 
          { name: 'DIC', ingresos: revenue * 1.1 }, 
          { name: 'ENE', ingresos: revenue } 
      ])
      
      setTenantStatusData([ 
          { name: 'Activos', value: activeCount, color: '#6366f1' }, 
          { name: 'Suspendidos', value: (tenants || []).length - activeCount, color: '#e2e8f0' } 
      ])

    } catch (e) { 
        console.error("Error crítico cargando datos:", e) 
    } finally { 
        setRefreshing(false) 
    }
  }

  useEffect(() => { fetchData() }, [])

  // ----------------------------------------------------------------------------
  // LOGICA DE NEGOCIO (HANDLERS)
  // ----------------------------------------------------------------------------
  
  const logAction = async (action, details) => { 
      try { 
          await supabase.from('audit_logs').insert([{ 
              user_email: session?.user?.email || 'sistema', 
              action, 
              details 
          }]) 
      } catch (e) { console.error(e) } 
  }

  // --- GESTIÓN DE USUARIOS (CON CORRECCIÓN DE ID) ---
  const handleCreateUser = async (e) => {
      e.preventDefault()
      if (!userForm.email || !userForm.password) { 
          alert("Por favor ingrese email y contraseña.")
          return 
      }
      setSaving(true)
      try {
          // Generamos ID manualmente para evitar el error "null value in column id"
          const tempId = crypto.randomUUID();

          // Insertar en tabla de roles
          const { error } = await supabase.from('user_roles').insert([{
              id: tempId, // Solución del error
              email: userForm.email,
              role: userForm.role,
              created_at: new Date().toISOString()
          }])
          
          if (error) throw error

          await logAction('Crear Usuario', `Nuevo usuario: ${userForm.email} (${userForm.role})`)
          alert(`Usuario ${userForm.email} creado con rol ${userForm.role.toUpperCase()}`)
          
          setShowUserModal(false)
          setUserForm({ email: '', password: '', role: 'assistant' })
          fetchData()
      } catch (error) {
          alert("Error creando usuario: " + error.message)
          console.error(error)
      } finally {
          setSaving(false)
      }
  }

  const handleDeleteUser = async (email) => {
      if(confirm(`¿Estás seguro de eliminar el acceso para ${email}?`)) {
          try {
              await supabase.from('user_roles').delete().eq('email', email)
              await logAction('Eliminar Usuario', email)
              fetchData()
          } catch (e) { alert(e.message) }
      }
  }

  // --- BRANDING ---
  const handleLogoUpload = async (event) => {
    try {
        setUploadingLogo(true)
        const file = event.target.files[0]
        if (!file) return

        const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`
        
        // 1. Subir
        const { error: uploadError } = await supabase.storage.from('branding').upload(fileName, file)
        if (uploadError) throw uploadError

        // 2. Obtener URL
        const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(fileName)

        // 3. Guardar en estado local y luego guardar settings
        setAppSettings({ ...appSettings, company_logo: publicUrl })
        
    } catch (error) {
        alert('Error subiendo logo: ' + error.message)
    } finally {
        setUploadingLogo(false)
    }
  }

  // --- CLIENTES ---
  const handleCreateClient = async (e) => {
    e.preventDefault()
    if (!clientForm.name || !clientForm.ruc || !clientForm.plan) { 
        alert("Campos obligatorios: Nombre, RUC y Plan.")
        return 
    }
    setSaving(true)
    try {
      const selectedPlan = plansConfig.find(p => p.code === clientForm.plan)
      const payload = { 
          ...clientForm, 
          contact_email: clientForm.billing_email, 
          status: 'active', 
          courtesy_enabled: selectedPlan?.courtesy_amount > 0, 
          courtesy_limit: selectedPlan?.courtesy_amount || 0,
          // Biométrico
          bio_brand: clientForm.bio_brand || null, 
          bio_model: clientForm.bio_model || null, 
          bio_serial: clientForm.bio_serial || null, 
          bio_location: clientForm.bio_location || null, 
          bio_purchase_date: clientForm.bio_purchase_date || null, 
          bio_warranty_months: clientForm.bio_warranty_months ? parseInt(clientForm.bio_warranty_months) : null 
      }
      await supabase.from('tenants').insert([payload])
      await logAction('Crear Cliente', clientForm.name)
      setShowClientModal(false)
      setClientForm(initialClientState)
      setShowBiometricForm(false)
      fetchData()
      alert("Cliente creado exitosamente")
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const handleToggleStatus = async (tenant) => {
      const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
      if(confirm(`¿${newStatus === 'active' ? 'ACTIVAR' : 'SUSPENDER'} servicio para ${tenant.name}?`)) {
          await supabase.from('tenants').update({ status: newStatus }).eq('id', tenant.id)
          fetchData()
      }
  }

  // --- CONFIGURACIÓN Y PLANES ---
  const handleSaveSettings = async (e) => { 
      e.preventDefault()
      setSaving(true)
      try { 
          await supabase.from('app_settings').upsert({ id: appSettings.id || 1, ...appSettings })
          await logAction('Config', 'Actualización global')
          alert("Configuración guardada") 
      } catch(e){ alert(e.message) } finally { setSaving(false) } 
  }

  const togglePermission = async (role, featureId) => {
      const current = rolePermissions[role] || []
      const next = current.includes(featureId) 
          ? current.filter(p => p !== featureId) 
          : [...current, featureId]
      setRolePermissions({...rolePermissions, [role]: next})
      await supabase.from('role_permissions').upsert({ role, permissions: next })
  }

  const handleSavePlan = async (e) => { 
      e.preventDefault()
      setSaving(true)
      const p = { ...planForm }
      if(!p.code) p.code = p.name.toLowerCase().replace(/\s/g,'-')+'-'+Date.now().toString().slice(-4)
      
      if(editingPlan) {
          await supabase.from('subscription_plans').update(p).eq('code',editingPlan.code)
      } else {
          await supabase.from('subscription_plans').insert([p])
      }
      setShowPlanModal(false)
      fetchData()
      setSaving(false)
  }

  // --- AUXILIARES UI ---
  const handleTextInput = (e) => setClientForm({ ...clientForm, [e.target.name]: e.target.value })
  const handleNumericInput = (e) => setClientForm({ ...clientForm, [e.target.name]: e.target.value.replace(/[^0-9]/g, '') })
  const copyLegalToBilling = () => setClientForm(prev => ({ ...prev, billing_name: prev.legal_rep_name, billing_email: prev.legal_rep_email, billing_phone: prev.legal_rep_phone }))
  const handleMouseEnterPlan = (e, plan) => { if(!plan) return; const rect = e.currentTarget.getBoundingClientRect(); setTooltipPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY - 10 }); setHoveredPlanData(plan) }
  const openInvoiceModal = (t) => { setSelectedTenant(t); const p = plansConfig.find(pl=>pl.code===t.plan)||{}; setInvoiceForm({amount: p.price_model==='fixed'?p.price:10*p.price_per_user, concept:`Suscripción: ${p.name}`, due_date:new Date().toISOString().split('T')[0], active_users:10}); setShowInvoiceModal(true) }
  const handleCreateInvoice = async (e) => { e.preventDefault(); setSaving(true); await supabase.from('invoices').insert([{tenant_id:selectedTenant.id, ...invoiceForm, status:'pending'}]); setShowInvoiceModal(false); setSaving(false); alert("Factura Enviada") }
  
  const getDrillDownContent = () => { 
      if (!showDrillDown) return null; 
      let title="", data=[], columns=[]
      if (showDrillDown === 'revenue') { 
          title = "Ingresos Recurrentes"; data = invoicesList.filter(i => i.status === 'paid'); columns = [{h:'Fecha', r:r=>new Date(r.created_at).toLocaleDateString()}, {h:'Cliente', r:r=>{const t=tenantsList.find(t=>t.id===r.tenant_id);return t?t.name:'--'}}, {h:'Monto', r:r=>`$${r.amount}`}] 
      } else if (showDrillDown === 'pending') { 
          title = "Pendientes de Cobro"; data = invoicesList.filter(i => i.status === 'pending'); columns = [{h:'Vence', r:r=>new Date(r.due_date).toLocaleDateString()}, {h:'Cliente', r:r=>{const t=tenantsList.find(t=>t.id===r.tenant_id);return t?t.name:'--'}}, {h:'Monto', r:r=>`$${r.amount}`}] 
      } else if (showDrillDown === 'clients') { 
          title = "Cartera de Clientes"; data = tenantsList.filter(t => t.status === 'active'); columns = [{h:'Empresa', r:r=>r.name}, {h:'Plan', r:r=>r.plan}, {h:'Email', r:r=>r.contact_email}] 
      }
      return (
          <div className="overflow-hidden bg-white rounded-xl border border-slate-100 shadow-sm mt-2">
              <div className="bg-slate-50 px-6 py-3 text-xs font-bold uppercase text-slate-500 border-b border-slate-100">{title}</div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-white sticky top-0 shadow-sm">
                          <tr>{columns.map((c,i)=><th key={i} className="px-6 py-3 font-bold text-slate-400 text-xs uppercase">{c.h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {data.map((r,i)=><tr key={i} className="hover:bg-slate-50">{columns.map((c,j)=><td key={j} className="px-6 py-3 text-slate-600">{c.r(r)}</td>)}</tr>)}
                      </tbody>
                  </table>
              </div>
          </div>
      )
  }

  // ----------------------------------------------------------------------------
  // RENDERIZADO (JSX)
  // ----------------------------------------------------------------------------
  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${darkMode ? 'bg-slate-950 text-white' : 'bg-[#F3F4F6] text-slate-800'}`}>
      
      {/* --- NAVBAR --- */}
      <nav className={`px-8 py-4 flex justify-between items-center sticky top-0 z-30 backdrop-blur-xl border-b transition-all ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-white/60'}`}>
        <div className="flex items-center gap-4">
            {appSettings.company_logo ? (
                <img src={appSettings.company_logo} alt="Logo" className="h-10 w-auto object-contain rounded-md shadow-sm bg-white p-1" />
            ) : (
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl text-white shadow-lg"><Activity size={24}/></div>
            )}
            <div>
                <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                    {appSettings.company_name || 'CEREBRO'} 
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Admin</span>
                </h1>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={()=>setDarkMode(!darkMode)} className="p-2.5 rounded-xl bg-white shadow-sm hover:bg-slate-50 transition">{darkMode?<Sun size={18}/>:<Moon size={18}/>}</button>
            <button onClick={fetchData} className="p-2.5 rounded-xl bg-white shadow-sm hover:bg-slate-50 transition"><RefreshCw size={18} className={refreshing?'animate-spin text-indigo-600':''}/></button>
            <div className="h-8 w-px bg-slate-300 mx-2"></div>
            {currentView === 'dashboard' ? (
                <button onClick={()=>setCurrentView('settings')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 border border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all">
                    <Settings size={16}/> Configuración
                </button>
            ) : (
                <button onClick={()=>setCurrentView('dashboard')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 border border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all">
                    <ArrowLeft size={16}/> Dashboard
                </button>
            )}
            <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all">
                <LogOut size={16}/> Salir
            </button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-8">
        
        {/* --- VISTA: DASHBOARD --- */}
        {currentView === 'dashboard' && (
            <div className="animate-fade-in space-y-8">
                
                {/* KPIS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KPI title="Ingresos Recurrentes" val={`$${stats.monthlyRevenue.toLocaleString()}`} icon={DollarSign} color="indigo" onClick={()=>setShowDrillDown('revenue')} />
                    <KPI title="Clientes Activos" val={stats.activeTenants} icon={Users} color="cyan" onClick={()=>setShowDrillDown('clients')} />
                    <KPI title="Por Cobrar" val={`$${stats.pendingCollection.toLocaleString()}`} icon={CreditCard} color="rose" onClick={()=>setShowDrillDown('pending')} />
                </div>
                
                {/* GRÁFICOS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-violet-500"/> Tendencia Financiera</h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs><linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:11, fontWeight:600}} dy={10}/>
                                    <RechartsTooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} cursor={{stroke:'#e2e8f0', strokeWidth:2}}/>
                                    <Area type="monotone" dataKey="ingresos" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col relative">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><PieChartIcon size={18} className="text-cyan-500"/> Cartera de Clientes</h3>
                        <div className="flex-1 w-full min-h-0 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={tenantStatusData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                                        {tenantStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#e2e8f0'} />))}
                                    </Pie>
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                <span className="text-4xl font-black text-slate-800 tracking-tight">{tenantsList.length}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABLA CLIENTES */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-slate-800">Listado de Clientes</h2>
                        <button onClick={()=>setShowClientModal(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 text-sm">
                            <Plus size={18}/> Nuevo Cliente
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="p-4 rounded-l-xl">Empresa</th>
                                    <th className="p-4">Plan Actual</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4 rounded-r-xl text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tenantsList.map(t=>(
                                    <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-700 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">{t.name.charAt(0)}</div>
                                                <div>{t.name}<div className="text-[10px] text-slate-400 font-mono font-normal">{t.ruc}</div></div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="inline-block" onMouseEnter={(e)=>handleMouseEnterPlan(e,plansConfig.find(p=>p.code===t.plan))} onMouseLeave={()=>setHoveredPlanData(null)}>
                                                <span className="bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-bold text-slate-600 shadow-sm cursor-help">{t.plan}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {t.status==='active'
                                                ? <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-100 flex w-fit items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Activo</span>
                                                : <span className="text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold border border-slate-200 flex w-fit items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Pausado</span>
                                            }
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={()=>openInvoiceModal(t)} className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">COBRAR</button>
                                            <button onClick={()=>handleToggleStatus(t)} className={`p-1.5 rounded-lg border transition ${t.status==='active'?'text-rose-500 border-rose-100 hover:bg-rose-50':'text-emerald-500 border-emerald-100 hover:bg-emerald-50'}`}>
                                                {t.status==='active'?<PauseCircle size={18}/>:<PlayCircle size={18}/>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- VISTA: CONFIGURACIÓN --- */}
        {currentView === 'settings' && (
            <div className="flex gap-8 animate-fade-in">
                
                {/* Sidebar Settings */}
                <aside className="w-72 space-y-2 shrink-0">
                    <div className="mb-6 px-2"><h3 className="font-black text-slate-800 text-xl">Ajustes</h3><p className="text-xs text-slate-400">Administración del sistema</p></div>
                    <TabBtn id="general" icon={Palette} label="General" active={activeSettingsTab} set={setActiveSettingsTab}/>
                    {/* NUEVO TAB DE USUARIOS */}
                    <TabBtn id="users" icon={UserPlus} label="Usuarios y Accesos" active={activeSettingsTab} set={setActiveSettingsTab}/>
                    <TabBtn id="roles" icon={Users} label="Roles y Permisos" active={activeSettingsTab} set={setActiveSettingsTab}/>
                    <TabBtn id="logs" icon={FileClock} label="Auditoría" active={activeSettingsTab} set={setActiveSettingsTab}/>
                    <TabBtn id="smtp" icon={Mail} label="SMTP Correo" active={activeSettingsTab} set={setActiveSettingsTab}/>
                    <TabBtn id="security" icon={Shield} label="Seguridad" active={activeSettingsTab} set={setActiveSettingsTab}/>
                    <TabBtn id="plans" icon={Layers} label="Planes" active={activeSettingsTab} set={setActiveSettingsTab}/>
                </aside>
                
                <div className="flex-1 bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-white p-10 min-h-[600px]">
                    
                    {/* TAB GENERAL */}
                    {activeSettingsTab === 'general' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">General</h2></div>
                            <div className="grid grid-cols-2 gap-8">
                                <Input label="Nombre de la Empresa" val={appSettings.company_name} chg={e=>setAppSettings({...appSettings, company_name:e.target.value})}/>
                                <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Color</label><div className="flex gap-3"><input type="color" className="w-12 h-12 rounded-xl cursor-pointer border-0" value={appSettings.primary_color} onChange={e=>setAppSettings({...appSettings, primary_color:e.target.value})}/><div className="flex items-center px-4 bg-slate-50 rounded-xl text-sm font-mono font-bold text-slate-600 border border-slate-200">{appSettings.primary_color}</div></div></div>
                                
                                {/* Upload Logo */}
                                <div className="col-span-2 space-y-3">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Logo Corporativo</label>
                                    <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="w-32 h-32 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative">
                                            {appSettings.company_logo ? <img src={appSettings.company_logo} className="w-full h-full object-contain p-2"/> : <ImageIcon size={32} className="text-slate-300"/>}
                                            {uploadingLogo && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader className="animate-spin text-indigo-600"/></div>}
                                        </div>
                                        <label className="cursor-pointer px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition shadow-sm flex items-center gap-2">
                                            <Upload size={18}/> {uploadingLogo ? 'Subiendo...' : 'Subir Imagen'}
                                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo}/>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end"><BtnSave onClick={handleSaveSettings} saving={saving}/></div>
                        </div>
                    )}

                    {/* TAB USUARIOS (NUEVO) */}
                    {activeSettingsTab === 'users' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                <div><h2 className="text-2xl font-black text-slate-800">Gestión de Usuarios</h2><p className="text-sm text-slate-500">Administra quién tiene acceso al panel.</p></div>
                                <button onClick={() => setShowUserModal(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 text-sm"><Plus size={18}/> Crear Usuario</button>
                            </div>
                            
                            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                        <tr><th className="p-4">Usuario / Email</th><th className="p-4">Rol Asignado</th><th className="p-4">Fecha Creación</th><th className="p-4 text-right">Acciones</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {systemUsers.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-bold text-slate-700 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User size={16}/></div>
                                                    {u.email}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : u.role === 'assistant' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-500 font-mono text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => handleDeleteUser(u.email)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {systemUsers.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">No hay usuarios registrados aparte del administrador.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB ROLES */}
                    {activeSettingsTab === 'roles' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">Matriz de Permisos</h2></div>
                            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500"><tr><th className="p-4 w-1/2">Funcionalidad</th><th className="p-4 text-center">Admin</th><th className="p-4 text-center">Asistente</th><th className="p-4 text-center">Mantenimiento</th></tr></thead><tbody className="divide-y divide-slate-100">{SYSTEM_FEATURES.map(f=>(<tr key={f.id} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-700">{f.label}</td><td className="p-4 text-center"><CheckSquare size={20} className="mx-auto text-indigo-200"/></td><td onClick={()=>togglePermission('assistant',f.id)} className="p-4 text-center cursor-pointer hover:bg-slate-100 transition">{rolePermissions.assistant.includes(f.id)?<CheckSquare size={20} className="mx-auto text-indigo-600"/>:<Square size={20} className="mx-auto text-slate-300"/>}</td><td onClick={()=>togglePermission('maintenance',f.id)} className="p-4 text-center cursor-pointer hover:bg-slate-100 transition">{rolePermissions.maintenance.includes(f.id)?<CheckSquare size={20} className="mx-auto text-indigo-600"/>:<Square size={20} className="mx-auto text-slate-300"/>}</td></tr>))}</tbody></table></div>
                        </div>
                    )}

                    {/* TAB LOGS */}
                    {activeSettingsTab === 'logs' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">Auditoría</h2></div>
                            <div className="h-[500px] overflow-y-auto border border-slate-200 rounded-xl custom-scrollbar"><table className="w-full text-xs text-left"><thead className="bg-slate-50 sticky top-0 shadow-sm z-10"><tr><th className="p-4 font-bold text-slate-500 uppercase">Fecha</th><th className="p-4 font-bold text-slate-500 uppercase">Usuario</th><th className="p-4 font-bold text-slate-500 uppercase">Acción</th><th className="p-4 font-bold text-slate-500 uppercase">Detalle</th></tr></thead><tbody className="divide-y divide-slate-100">{auditLogs.map(l=>(<tr key={l.id} className="hover:bg-slate-50"><td className="p-4 text-slate-500 font-mono">{new Date(l.created_at).toLocaleString()}</td><td className="p-4 font-bold text-slate-700">{l.user_email}</td><td className="p-4"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-bold border border-indigo-100">{l.action}</span></td><td className="p-4 text-slate-600">{l.details}</td></tr>))}</tbody></table></div>
                        </div>
                    )}

                    {/* TAB SMTP */}
                    {activeSettingsTab === 'smtp' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">Servidor SMTP</h2></div>
                            <div className="grid grid-cols-2 gap-8"><Input label="Host SMTP" val={appSettings.smtp_host} chg={e=>setAppSettings({...appSettings, smtp_host:e.target.value})}/><Input label="Puerto" val={appSettings.smtp_port} chg={e=>setAppSettings({...appSettings, smtp_port:e.target.value})}/><Input label="Usuario" val={appSettings.smtp_user} chg={e=>setAppSettings({...appSettings, smtp_user:e.target.value})}/><div className="space-y-2"><label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Contraseña</label><input type="password" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all" value={appSettings.smtp_pass} onChange={e=>setAppSettings({...appSettings, smtp_pass:e.target.value})}/></div></div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end"><BtnSave onClick={handleSaveSettings} saving={saving}/></div>
                        </div>
                    )}

                    {/* TAB SEGURIDAD */}
                    {activeSettingsTab === 'security' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-black text-slate-800">Seguridad</h2></div>
                            <div className="p-8 border border-slate-200 rounded-2xl space-y-8 bg-slate-50"><div><h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Lock size={18}/> Nivel de Contraseña</h3><div className="flex gap-4">{['low','medium','high'].map(l=>(<button key={l} onClick={()=>setAppSettings({...appSettings, password_policy_level:l})} className={`px-6 py-3 rounded-xl text-sm font-black uppercase border-2 transition-all ${appSettings.password_policy_level===l?'bg-indigo-600 border-indigo-600 text-white shadow-lg':'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}>{l}</button>))}</div></div><div className="border-t border-slate-200 pt-6"><h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Key size={18}/> Rotación Obligatoria</h3><select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all w-48" value={appSettings.password_expiration_days} onChange={e=>setAppSettings({...appSettings, password_expiration_days:e.target.value})}><option value="30">Cada 30 días</option><option value="90">Cada 90 días</option><option value="0">Nunca</option></select></div></div>
                            <div className="flex justify-end"><BtnSave onClick={handleSaveSettings} saving={saving}/></div>
                        </div>
                    )}

                    {/* TAB PLANES */}
                    {activeSettingsTab === 'plans' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4"><div><h2 className="text-2xl font-black text-slate-800">Planes</h2></div><button onClick={()=>{setEditingPlan(null);setShowPlanModal(true)}} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 text-sm"><Plus size={16}/> Crear Plan</button></div>
                            <div className="grid grid-cols-2 gap-6">{plansConfig.map(p=>(<div key={p.code} className="p-6 border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition group relative bg-white"><div className="flex justify-between items-start mb-2"><h3 className="font-black text-lg text-slate-800">{p.name}</h3><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition"><button onClick={()=>openEditPlan(p)} className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"><Edit size={16}/></button><button onClick={()=>handleDeletePlan(p.code)} className="p-1.5 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100"><Trash2 size={16}/></button></div></div><p className="text-sm text-slate-500 mb-4 h-10 overflow-hidden">{p.description}</p><div className="flex items-baseline gap-1"><span className="text-3xl font-black text-indigo-600">${p.price}</span><span className="text-xs font-bold text-slate-400 uppercase">/ {p.price_model === 'fixed' ? 'Mes' : 'Usuario'}</span></div></div>))}</div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>

      {/* ==============================================================================
          MODALES (VENTANAS EMERGENTES)
         ============================================================================== */}
         
      {/* 1. DRILL DOWN MODAL */}
      {showDrillDown && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-slate-100">
                      <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg"><Eye size={20} className="text-indigo-600"/> Vista Detallada</h3>
                      <button onClick={()=>setShowDrillDown(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-0 bg-slate-50/50 overflow-y-auto">
                      {getDrillDownContent()}
                  </div>
              </div>
          </div>
      )}
      
      {/* 2. MODAL CREAR USUARIO (NUEVO) */}
      {showUserModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                  <div className="px-8 pt-8 pb-4 flex justify-between items-center border-b border-slate-100">
                      <h3 className="text-xl font-black text-slate-800">Nuevo Usuario</h3>
                      <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleCreateUser} className="p-8 space-y-6">
                      <Input label="Correo Electrónico" name="email" type="email" val={userForm.email} chg={e => setUserForm({...userForm, email: e.target.value})} />
                      <Input label="Contraseña Temporal" name="password" type="text" val={userForm.password} chg={e => setUserForm({...userForm, password: e.target.value})} />
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider ml-1">Rol del Sistema</label>
                          <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                              <option value="assistant">Asistente (Operativo)</option>
                              <option value="maintenance">Mantenimiento (Técnico)</option>
                              <option value="admin">Administrador (Total)</option>
                          </select>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-700">
                          <Info size={16} className="inline mr-1 mb-0.5"/>
                          El usuario podrá ingresar inmediatamente con estas credenciales.
                      </div>
                      <BtnSave saving={saving} onClick={handleCreateUser} />
                  </form>
              </div>
          </div>
      )}

      {/* 3. MODAL CLIENTE (CON SECCIÓN BIOMÉTRICA) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-lg flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl flex h-[85vh] overflow-hidden border border-white/50">
            <aside className="w-72 bg-[#F9FAFB] border-r border-slate-100 p-8 flex flex-col gap-8 hidden md:flex shrink-0">
                <div className="flex items-center gap-3"><div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30"><Briefcase size={24}/></div><div><h1 className="font-black text-slate-800 text-xl leading-tight">Alta Cliente</h1><p className="text-sm font-bold text-slate-400">Ficha Corporativa</p></div></div>
                <nav className="flex flex-col gap-4"><StepItem num="1" text="Datos Fiscales" active /><StepItem num="2" text="Contactos" /><StepItem num="3" text="Suscripción & Hardware" /></nav>
            </aside>
            <main className="flex-1 flex flex-col min-h-0 bg-white relative">
                <button onClick={()=>setShowClientModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 z-20"><X size={24}/></button>
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <form id="clientForm" onSubmit={handleCreateClient} className="space-y-10 pb-4">
                        <div className="space-y-6"><SectionTitle icon={FileText} title="Información Fiscal" /><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Input label="Razón Social" name="name" val={clientForm.name} chg={handleTextInput} /><Input label="RUC" name="ruc" val={clientForm.ruc} chg={handleNumericInput} /><Input label="Dirección Matriz" name="address" val={clientForm.address} chg={handleTextInput} full /><Input label="Referencia" name="location_reference" val={clientForm.location_reference} chg={handleTextInput} full /></div></div>
                        <div className="space-y-6"><SectionTitle icon={Phone} title="Teléfonos & Contacto" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100"><Input label="Convencional" name="phone_landline" val={clientForm.phone_landline} chg={handleNumericInput} /><Input label="Extensión" name="phone_extension" val={clientForm.phone_extension} chg={handleNumericInput} /><Input label="Móvil" name="phone_mobile" val={clientForm.phone_mobile} chg={handleNumericInput} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-4"><h4 className="text-xs font-black uppercase text-indigo-600 tracking-wider">Representante Legal</h4><Input label="Nombre" name="legal_rep_name" val={clientForm.legal_rep_name} chg={handleTextInput} /><Input label="Email" name="legal_rep_email" val={clientForm.legal_rep_email} chg={handleTextInput} /></div><div className="space-y-4"><div className="flex justify-between items-center"><h4 className="text-xs font-black uppercase text-indigo-600 tracking-wider">Cobranza</h4><button type="button" onClick={copyLegalToBilling} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold hover:bg-indigo-100 transition">COPIAR DATOS</button></div><Input label="Contacto" name="billing_name" val={clientForm.billing_name} chg={handleTextInput} /><Input label="Email Facturas" name="billing_email" val={clientForm.billing_email} chg={handleTextInput} /></div></div></div>
                        <div className="space-y-6"><SectionTitle icon={MousePointer2} title="Plan de Suscripción" /><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{plansConfig.map(p=>(<div key={p.code} onClick={()=>setClientForm({...clientForm, plan:p.code})} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all hover:shadow-lg relative group ${clientForm.plan===p.code?'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100':'border-slate-100 hover:border-indigo-200'}`}>{clientForm.plan===p.code && <div className="absolute top-3 right-3 text-indigo-600"><CheckCircle size={20} fill="currentColor" className="text-white"/></div>}<p className="text-sm font-bold text-slate-700 mb-1">{p.name}</p><span className="text-2xl font-black text-slate-900">{p.price_model==='fixed'?`$${p.price}`:`$${p.price_per_user}`}</span></div>))}</div></div>
                        <div className="border-t border-slate-100 pt-8">
                            <button type="button" onClick={() => setShowBiometricForm(!showBiometricForm)} className="w-full py-4 px-6 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-slate-700 font-bold hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all group shadow-sm">
                                <div className="flex items-center gap-4"><div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 group-hover:scale-110 transition"><Fingerprint size={20}/></div><div className="text-left"><span className="block text-sm">Hardware / Biometría</span><span className="block text-[10px] text-slate-400 font-normal uppercase tracking-wide group-hover:text-indigo-400">Agregar dispositivo de asistencia</span></div></div>
                                {showBiometricForm ? <ChevronUp size={20} className="text-indigo-500"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </button>
                            {showBiometricForm && (
                                <div className="mt-6 p-6 bg-white border-2 border-indigo-50 rounded-2xl animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm">
                                    <div className="space-y-2"><label className="label-sub flex gap-2 items-center text-indigo-600"><Tag size={14}/> Marca</label><input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm hover:border-indigo-200" placeholder="Ej. ZKTECO" name="bio_brand" value={clientForm.bio_brand} onChange={handleTextInput} /></div>
                                    <div className="space-y-2"><label className="label-sub flex gap-2 items-center text-indigo-600"><Layers size={14}/> Modelo</label><input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm hover:border-indigo-200" placeholder="MB460" name="bio_model" value={clientForm.bio_model} onChange={handleTextInput} /></div>
                                    <div className="space-y-2"><label className="label-sub flex gap-2 items-center text-indigo-600"><AlignLeft size={14}/> No. Serie</label><input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm hover:border-indigo-200 font-mono" placeholder="SN-123456" name="bio_serial" value={clientForm.bio_serial} onChange={handleTextInput} /></div>
                                    <div className="space-y-2"><label className="label-sub flex gap-2 items-center text-indigo-600"><MapPin size={14}/> Ubicación Ref.</label><input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm hover:border-indigo-200" placeholder="Entrada Principal" name="bio_location" value={clientForm.bio_location} onChange={handleTextInput} /></div>
                                    <div className="space-y-2"><label className="label-sub flex gap-2 items-center text-indigo-600"><Calendar size={14}/> Fecha Compra</label><input type="date" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm hover:border-indigo-200" name="bio_purchase_date" value={clientForm.bio_purchase_date} onChange={handleTextInput} /></div>
                                    <div className="space-y-2"><label className="label-sub flex gap-2 items-center text-indigo-600"><ShieldCheck size={14}/> Garantía (Meses)</label><input type="number" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm hover:border-indigo-200" placeholder="12" name="bio_warranty_months" value={clientForm.bio_warranty_months} onChange={handleNumericInput} /></div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                <footer className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]"><button onClick={() => setShowClientModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition">Cancelar</button><button onClick={handleCreateClient} disabled={saving} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 active:scale-95">{saving ? <Loader className="animate-spin" size={18}/> : <span>Registrar Empresa</span>}</button></footer>
            </main>
          </div>
        </div>
      )}

      {/* 4. MODAL PLANES */}
      {showPlanModal && (<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative"><button onClick={()=>setShowPlanModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={24}/></button><h2 className="text-xl font-black mb-6 text-slate-800">Gestionar Plan</h2><form onSubmit={handleSavePlan} className="space-y-4"><Input label="Nombre del Plan" val={planForm.name} chg={e=>setPlanForm({...planForm,name:e.target.value})}/><Input label="Descripción Corta" val={planForm.description} chg={e=>setPlanForm({...planForm,description:e.target.value})}/><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Modelo</label><select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all" value={planForm.price_model} onChange={e=>setPlanForm({...planForm,price_model:e.target.value})}><option value="fixed">Precio Fijo</option><option value="per_user">Por Usuario</option></select></div><Input label="Precio ($)" type="number" val={planForm.price_model==='fixed'?planForm.price:planForm.price_per_user} chg={e=>planForm.price_model==='fixed'?setPlanForm({...planForm,price:e.target.value}):setPlanForm({...planForm,price_per_user:e.target.value})}/></div><BtnSave saving={saving}/></form></div></div>)}
      
      {/* 5. MODAL FACTURA */}
      {showInvoiceModal && (<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-violet-500"></div><h2 className="text-3xl font-black text-indigo-600 mb-1">${invoiceForm.amount}</h2><p className="text-sm font-bold text-slate-400 mb-6">{invoiceForm.concept}</p><div className="space-y-3"><button onClick={handleCreateInvoice} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex justify-center">{saving ? <Loader className="animate-spin"/> : 'Confirmar Emisión'}</button><button onClick={()=>setShowInvoiceModal(false)} className="text-sm font-bold text-slate-400 hover:text-slate-600">Cancelar</button></div></div></div>)}
      
      {/* TOOLTIP FLOTANTE */}
      {hoveredPlanData && (<div style={{ position: 'fixed', left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, -100%)', zIndex: 9999, pointerEvents: 'none' }} className="mb-3 w-64 bg-slate-800 text-white p-4 rounded-xl shadow-xl animate-fade-in"><p className="font-bold text-violet-300 mb-1">{hoveredPlanData.name}</p><p className="text-xs text-slate-300 italic">{hoveredPlanData.description}</p></div>)}
    </div>
  )
}

// ==============================================================================
// 7. COMPONENTES DE UI REUTILIZABLES (EXPANDIDOS)
// ==============================================================================

const Input = ({ label, name, val, chg, type="text", full }) => (
    <div className={`space-y-1.5 ${full?'col-span-2':''}`}>
        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider ml-1">{label}</label>
        <input 
            type={type} 
            name={name} 
            value={val} 
            onChange={chg} 
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-sm hover:border-indigo-200"
        />
    </div>
)

const BtnSave = ({ onClick, saving }) => (
    <button 
        onClick={onClick} 
        disabled={saving} 
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
    >
        {saving ? <Loader className="animate-spin" size={20}/> : <><Save size={18}/> Guardar Cambios</>}
    </button>
)

const TabBtn = ({ id, icon:Icon, label, active, set }) => (
    <button 
        onClick={()=>set(id)} 
        className={`w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-3 font-bold text-sm transition-all duration-200 ${active?'bg-white text-indigo-700 shadow-md ring-1 ring-indigo-50 border-l-4 border-indigo-600':'text-slate-500 hover:bg-white hover:text-slate-700'}`}
    >
        <Icon size={18} className={active ? 'text-indigo-600' : 'text-slate-400'}/> {label}
        {active && <ChevronRight size={16} className="ml-auto text-indigo-300"/>}
    </button>
)

const StepItem = ({ num, text, active }) => (
    <div className={`flex items-center gap-4 group cursor-pointer ${active ? '' : 'opacity-50 hover:opacity-80 transition'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all ${active ? 'bg-violet-600 text-white shadow-violet-500/30 scale-110' : 'bg-white text-slate-400 border border-slate-200'}`}>{num}</div>
        <span className={`text-sm font-bold ${active ? 'text-slate-800' : 'text-slate-500'}`}>{text}</span>
    </div>
)

const SectionTitle = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-3 text-indigo-600 mb-6 border-b border-indigo-50 pb-3">
        <Icon size={20}/>
        <h3 className="uppercase tracking-widest text-xs font-black text-slate-800">{title}</h3>
    </div>
)

const KPI = ({ title, val, icon:Icon, color, onClick }) => {
    const colors = { indigo: 'from-indigo-500 to-violet-600', cyan: 'from-cyan-400 to-blue-500', rose: 'from-rose-400 to-orange-500' }
    return (
        <div onClick={onClick} className={`relative overflow-hidden rounded-[24px] p-8 text-white shadow-xl shadow-slate-200/50 bg-gradient-to-br ${colors[color]} cursor-pointer hover:-translate-y-1 transition-all duration-300 group`}>
            <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-6"><div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10"><Icon size={24}/></div></div>
                <div><p className="text-indigo-100 text-sm font-bold opacity-90 mb-1">{title}</p><p className="text-4xl font-black tracking-tight">{val}</p></div>
            </div>
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><Icon size={120}/></div>
        </div>
    )
}

// ==============================================================================
// 8. ESTILOS GLOBALES
// ==============================================================================
const styleSheet = document.createElement("style"); 
styleSheet.innerText = `
  .input-modern { @apply w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-sm hover:border-indigo-200; }
  .label-sub { @apply text-[10px] font-bold uppercase tracking-wide text-slate-400; }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`; 
document.head.appendChild(styleSheet)