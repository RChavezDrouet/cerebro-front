import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  // --- ICONOS DE NAVEGACIÓN Y ACCIÓN ---
  LogOut, 
  Search, 
  Plus, 
  Users, 
  Briefcase, 
  Phone, 
  Mail, 
  MapPin, 
  Loader, 
  X, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  MousePointer2, 
  Fingerprint, 
  Tag, 
  Layers, 
  AlignLeft, 
  Calendar, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp,
  Activity,
  User,
  PlayCircle, 
  PauseCircle, 
  CreditCard,
  Info 
} from 'lucide-react'

// ==============================================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN
// ==============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// ==============================================================================
// 2. COMPONENTE PRINCIPAL
// ==============================================================================

export default function AssistantDashboard({ session, onLogout }) {
  
  // ----------------------------------------------------------------------------
  // ESTADOS DE LA APLICACIÓN
  // ----------------------------------------------------------------------------
  
  // Estados de UI y Carga
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Estado de Búsqueda
  const [searchTerm, setSearchTerm] = useState('')

  // Datos de Negocio (Base de Datos)
  const [branding, setBranding] = useState({ 
    name: 'CEREBRO', 
    logo: null, 
    color: '#4F46E5' 
  })
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  
  // --- CRÍTICO: PERMISOS DEL ROL ---
  // Aquí guardaremos qué puede hacer el asistente (create_client, toggle_status, etc.)
  const [allowedActions, setAllowedActions] = useState([]) 
  
  // Control de Modales (Ventanas Emergentes)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showBiometricForm, setShowBiometricForm] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  
  // Estados para Facturación Automática
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [invoicePreview, setInvoicePreview] = useState({ 
    amount: 0, 
    planName: '', 
    concept: '' 
  })

  // Estado del Formulario de Nuevo Cliente
  const initialClientState = { 
    name: '', 
    ruc: '', 
    address: '', 
    location_reference: '', 
    phone_landline: '', 
    phone_extension: '', 
    phone_mobile: '',
    legal_rep_name: '', 
    legal_rep_email: '', 
    legal_rep_phone: '', 
    billing_name: '', 
    billing_email: '', 
    billing_phone: '', 
    plan: '', 
    bio_brand: '', 
    bio_model: '', 
    bio_serial: '', 
    bio_location: '', 
    bio_purchase_date: '', 
    bio_warranty_months: ''
  }
  const [clientForm, setClientForm] = useState(initialClientState)

  // ----------------------------------------------------------------------------
  // CARGA DE DATOS (FETCH DATA)
  // ----------------------------------------------------------------------------

  async function fetchData() {
    setRefreshing(true)
    try {
      // 1. Cargar Configuración Visual (Branding)
      const { data: settings } = await supabase.from('app_settings').select('*').single()
      if (settings) {
        setBranding({
          name: settings.company_name || 'CEREBRO',
          logo: settings.company_logo || null,
          color: settings.primary_color || '#4F46E5'
        })
      }

      // 2. Cargar Lista de Clientes (Tenants)
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
      setTenants(tenantsData || [])

      // 3. Cargar Planes de Suscripción
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
      setPlans(plansData || [])

      // 4. CRÍTICO: Cargar Permisos Asignados por el Administrador
      // Esto determina si los botones aparecen o no.
      const { data: permissionsData } = await supabase
        .from('role_permissions')
        .select('permissions')
        .eq('role', 'assistant')
        .single()
      
      if (permissionsData && permissionsData.permissions) {
          setAllowedActions(permissionsData.permissions)
          console.log("Permisos activos:", permissionsData.permissions)
      } else {
          setAllowedActions([]) // Si no hay configuración, no tiene permisos
      }

    } catch (error) {
      console.error("Error cargando datos:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { 
      fetchData() 
  }, [])

  // ----------------------------------------------------------------------------
  // LÓGICA DE NEGOCIO (HANDLERS)
  // ----------------------------------------------------------------------------

  // --- FILTRADO SEGURO DE CLIENTES ---
  // Convierte todo a texto para evitar errores si un campo viene nulo o numérico
  const filteredTenants = tenants.filter(t => {
    const nameSafe = (t.name || '').toString().toLowerCase()
    const rucSafe = (t.ruc || '').toString()
    const searchSafe = searchTerm.toLowerCase().trim()

    if (!searchSafe) return true // Si no hay búsqueda, mostrar todo

    return nameSafe.includes(searchSafe) || rucSafe.includes(searchSafe)
  })

  // Manejo de Inputs del Formulario
  const handleTextInput = (e) => {
      setClientForm({ ...clientForm, [e.target.name]: e.target.value })
  }

  const handleNumericInput = (e) => {
      // Solo permite números
      setClientForm({ ...clientForm, [e.target.name]: e.target.value.replace(/[^0-9]/g, '') })
  }
  
  // Utilidad: Copiar datos de Representante a Cobranza
  const copyLegalToBilling = () => {
      setClientForm(prev => ({ 
          ...prev, 
          billing_name: prev.legal_rep_name, 
          billing_email: prev.legal_rep_email, 
          billing_phone: prev.legal_rep_phone 
      }))
  }

  // ACCIÓN 1: Crear Nuevo Cliente (Con Validaciones y Permisos)
  const handleCreateClient = async (e) => {
    e.preventDefault()
    
    // a. Verificar Permiso en el Frontend (Seguridad Visual)
    if (!allowedActions.includes('create_client')) {
        alert("⛔ Acceso denegado: Su rol no tiene permiso para registrar empresas.")
        return
    }

    // b. Validar Campos Obligatorios
    if (!clientForm.name) {
        alert("⚠️ Error: Falta ingresar la 'Razón Social'.")
        return
    }
    if (!clientForm.ruc) {
        alert("⚠️ Error: Falta ingresar el 'RUC'.")
        return
    }
    if (!clientForm.plan) {
        alert("⚠️ Error: No has seleccionado un PLAN.\nPor favor selecciona una tarjeta de suscripción.")
        return
    }
    
    setSaving(true)
    try {
      // c. Preparar Datos
      const selectedPlan = plans.find(p => p.code === clientForm.plan)
      
      const payload = { 
          ...clientForm, 
          contact_email: clientForm.billing_email, 
          status: 'active', 
          courtesy_enabled: selectedPlan?.courtesy_amount > 0,
          courtesy_limit: selectedPlan?.courtesy_amount || 0,
          
          // Datos Hardware
          bio_brand: clientForm.bio_brand || null,
          bio_model: clientForm.bio_model || null,
          bio_serial: clientForm.bio_serial || null,
          bio_location: clientForm.bio_location || null,
          bio_purchase_date: clientForm.bio_purchase_date || null,
          bio_warranty_months: clientForm.bio_warranty_months ? parseInt(clientForm.bio_warranty_months) : null
      }

      // d. Insertar en Base de Datos
      const { error } = await supabase.from('tenants').insert([payload])
      if (error) throw error

      // e. Registrar en Auditoría
      await supabase.from('audit_logs').insert([{ 
          user_email: session?.user?.email, 
          action: 'Crear Cliente', 
          details: `Asistente creó a ${clientForm.name}` 
      }])

      // f. Limpieza y Recarga
      setShowClientModal(false)
      setClientForm(initialClientState)
      setShowBiometricForm(false)
      fetchData()
      alert("✅ Empresa registrada correctamente")

    } catch (error) {
      alert("Error al registrar: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  // ACCIÓN 2: Suspender / Activar Cliente
  const handleToggleStatus = async (tenant) => {
      // a. Verificar Permiso
      if (!allowedActions.includes('toggle_status')) {
          alert("⛔ No tienes permiso para suspender o activar cuentas.")
          return
      }

      const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
      const actionText = newStatus === 'active' ? 'ACTIVAR' : 'SUSPENDER'

      if(confirm(`¿Confirmas ${actionText} el servicio de ${tenant.name}?`)) {
          try {
              await supabase.from('tenants').update({ status: newStatus }).eq('id', tenant.id)
              
              // Auditoría
              await supabase.from('audit_logs').insert([{ 
                  user_email: session?.user?.email, 
                  action: 'Cambio Estado', 
                  details: `${actionText} servicio de ${tenant.name}` 
              }])
              
              fetchData()
          } catch (error) {
              alert("Error al cambiar estado: " + error.message)
          }
      }
  }

  // ACCIÓN 3: Preparar Facturación (Cálculo Automático)
  const openInvoiceModal = (tenant) => {
      // a. Verificar Permiso
      if (!allowedActions.includes('charge_client')) {
          alert("⛔ No tienes permiso para emitir facturación.")
          return
      }

      setSelectedTenant(tenant)
      
      // b. Calcular Precio Automáticamente
      const plan = plans.find(p => p.code === tenant.plan)
      
      let calculatedAmount = 0
      let planName = 'Plan Desconocido'

      if (plan) {
          planName = plan.name
          // Lógica: Si es precio fijo, usa el precio. Si es por usuario, usa precio * 10 (base)
          calculatedAmount = plan.price_model === 'fixed' 
              ? plan.price 
              : (plan.price_per_user * 10)
      }

      setInvoicePreview({
          amount: calculatedAmount,
          planName: planName,
          concept: `Suscripción Mensual: ${planName}`
      })
      
      setShowInvoiceModal(true)
  }

  // ACCIÓN 4: Confirmar Emisión de Factura
  const handleConfirmInvoice = async () => {
      if (!selectedTenant) return
      
      setSaving(true)
      try {
          const { error } = await supabase.from('invoices').insert([{
              tenant_id: selectedTenant.id,
              amount: parseFloat(invoicePreview.amount),
              concept: invoicePreview.concept,
              status: 'pending',
              due_date: new Date().toISOString().split('T')[0],
              active_users: 0
          }])

          if (error) throw error
          
          await supabase.from('audit_logs').insert([{ 
            user_email: session?.user?.email, 
            action: 'Facturación', 
            details: `Asistente generó cobro de $${invoicePreview.amount} a ${selectedTenant.name}` 
          }])

          alert("✅ Factura generada y enviada a cobro.")
          setShowInvoiceModal(false)

      } catch (error) {
          alert("Error al facturar: " + error.message)
      } finally {
          setSaving(false)
      }
  }

  // ----------------------------------------------------------------------------
  // RENDERIZADO (JSX)
  // ----------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans text-slate-800">
      
      {/* ==================================================================
          NAVBAR SUPERIOR
         ================================================================== */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
            {branding.logo ? (
                <img 
                    src={branding.logo} 
                    alt="Logo" 
                    className="h-10 w-auto object-contain rounded-md" 
                />
            ) : (
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-2.5 rounded-xl text-white shadow-lg">
                    <Activity size={24}/>
                </div>
            )}
            <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">
                    {branding.name}
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Asistente Operativo
                </span>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-700">{session?.user?.email}</p>
                <div className="flex items-center justify-end gap-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <p className="text-xs text-slate-400 font-medium">En línea</p>
                </div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <button 
                onClick={onLogout} 
                className="flex items-center gap-2 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-100 px-4 py-2.5 rounded-xl hover:bg-rose-100 transition-all"
            >
                <LogOut size={18}/> Salir
            </button>
        </div>
      </nav>

      {/* ==================================================================
          CONTENIDO PRINCIPAL
         ================================================================== */}
      <main className="max-w-[1600px] mx-auto p-8 animate-fade-in">
        
        {/* HEADER Y ACCIONES PRINCIPALES */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
            <div>
                <h2 className="text-3xl font-black text-slate-800 mb-1">
                    Panel de Operaciones
                </h2>
                <p className="text-slate-500 font-medium text-sm">
                    Gestiona altas, bajas y cobros de clientes.
                </p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                {/* Barra de Búsqueda */}
                <div className="relative flex-1 md:w-80 group">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                    <input 
                        type="text" 
                        placeholder="Buscar cliente o RUC..." 
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-l-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <button 
                    className="px-6 py-3 bg-slate-800 text-white font-bold rounded-r-xl hover:bg-slate-900 transition-all flex items-center gap-2 shadow-sm border-l border-slate-700"
                >
                    Buscar
                </button>

                {/* BOTÓN NUEVA EMPRESA: Solo visible si tiene permiso 'create_client' */}
                {allowedActions.includes('create_client') && (
                    <button 
                        onClick={() => setShowClientModal(true)} 
                        className="ml-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={20}/> Nueva Empresa
                    </button>
                )}
            </div>
        </div>

        {/* TABLA DE CLIENTES */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader className="animate-spin text-indigo-600" size={32}/>
                </div>
            ) : filteredTenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Search size={48} className="mb-4 opacity-20"/>
                    <p className="font-bold">
                        {searchTerm ? 'No se encontraron resultados' : 'No hay clientes registrados'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="p-5 pl-8">Empresa</th>
                                <th className="p-5">Contacto</th>
                                <th className="p-5">Estado</th>
                                <th className="p-5">Hardware</th>
                                <th className="p-5 text-right pr-8">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {filteredTenants.map(tenant => (
                                <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5 pl-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-black text-lg border border-slate-200">
                                                {(tenant.name || '?').charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">
                                                    {tenant.name || 'Sin Nombre'}
                                                </p>
                                                <p className="text-[11px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                                    {tenant.ruc || 'S/N'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 text-slate-600 font-medium">
                                                <User size={14} className="text-slate-400"/> 
                                                {tenant.legal_rep_name || '--'}
                                            </div>
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100 w-fit">
                                                {tenant.plan || 'Sin Plan'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        {tenant.status === 'active' 
                                            ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ACTIVO</span> 
                                            : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> PAUSADO</span>
                                        }
                                    </td>
                                    <td className="p-5">
                                        {tenant.bio_serial 
                                            ? <div className="flex items-center gap-2 text-slate-600 text-xs font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 w-fit">
                                                <Fingerprint size={14} className="text-indigo-500"/>
                                                {tenant.bio_brand}
                                              </div> 
                                            : <span className="text-xs text-slate-300 italic pl-2">--</span>
                                        }
                                    </td>
                                    <td className="p-5 text-right pr-8">
                                        <div className="flex justify-end gap-2">
                                            
                                            {/* BOTÓN COBRAR: Visible solo si tiene permiso 'charge_client' */}
                                            {allowedActions.includes('charge_client') && (
                                                <button 
                                                    onClick={() => openInvoiceModal(tenant)} 
                                                    className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100" 
                                                    title="Generar Factura"
                                                >
                                                    <CreditCard size={18}/>
                                                </button>
                                            )}
                                            
                                            {/* BOTÓN SUSPENDER: Visible solo si tiene permiso 'toggle_status' */}
                                            {allowedActions.includes('toggle_status') && (
                                                <button 
                                                    onClick={() => handleToggleStatus(tenant)} 
                                                    className={`p-2 rounded-lg transition-colors border ${tenant.status === 'active' ? 'text-rose-500 bg-rose-50 border-rose-100 hover:bg-rose-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100 hover:bg-emerald-100'}`}
                                                    title={tenant.status === 'active' ? "Suspender Servicio" : "Reactivar Servicio"}
                                                >
                                                    {tenant.status === 'active' ? <PauseCircle size={18}/> : <PlayCircle size={18}/>}
                                                </button>
                                            )}

                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </main>

      {/* ==================================================================
          MODAL: CREAR CLIENTE (ALTA EMPRESA)
         ================================================================== */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-5xl flex h-[85vh] overflow-hidden border border-white/50">
            
            {/* Sidebar del Modal */}
            <aside className="w-72 bg-slate-50 border-r border-slate-100 p-8 flex flex-col gap-8 hidden md:flex shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                        <Briefcase size={24}/>
                    </div>
                    <div>
                        <h1 className="font-black text-slate-800 text-xl leading-tight">Alta Cliente</h1>
                        <p className="text-sm font-bold text-slate-400">Nuevo Registro</p>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="flex items-center gap-3 text-indigo-700 font-bold">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm ring-4 ring-indigo-50">1</div> 
                        Datos Fiscales
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 font-bold">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm">2</div> 
                        Contacto
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 font-bold">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm">3</div> 
                        Plan & Hardware
                    </div>
                </div>
                <div className="mt-auto p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-[10px] text-indigo-600 font-medium leading-relaxed">
                        <Info size={14} className="inline mr-1 mb-0.5"/> 
                        Recuerda solicitar el RUC actualizado.
                    </p>
                </div>
            </aside>
            
            {/* Contenido del Formulario */}
            <main className="flex-1 flex flex-col min-h-0 bg-white relative">
                <button 
                    onClick={() => setShowClientModal(false)} 
                    className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 z-20"
                >
                    <X size={24}/>
                </button>
                
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <form onSubmit={handleCreateClient} className="space-y-10 pb-4">
                        
                        {/* Seccion 1: Fiscal */}
                        <div className="space-y-6">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-indigo-50 pb-2">
                                <FileText size={18}/> Información Fiscal
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Razón Social" name="name" val={clientForm.name} chg={handleTextInput} />
                                <Input label="RUC" name="ruc" val={clientForm.ruc} chg={handleNumericInput} />
                                <Input label="Dirección Matriz" name="address" val={clientForm.address} chg={handleTextInput} full />
                                <Input label="Referencia" name="location_reference" val={clientForm.location_reference} chg={handleTextInput} full />
                            </div>
                        </div>

                        {/* Seccion 2: Contacto */}
                        <div className="space-y-6">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-indigo-50 pb-2">
                                <Phone size={18}/> Contacto
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <Input label="Tel. Fijo" name="phone_landline" val={clientForm.phone_landline} chg={handleNumericInput} />
                                <Input label="Extensión" name="phone_extension" val={clientForm.phone_extension} chg={handleNumericInput} />
                                <Input label="Móvil" name="phone_mobile" val={clientForm.phone_mobile} chg={handleNumericInput} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Representante Legal</label>
                                    <Input label="Nombre Completo" name="legal_rep_name" val={clientForm.legal_rep_name} chg={handleTextInput} />
                                    <Input label="Email Personal" name="legal_rep_email" val={clientForm.legal_rep_email} chg={handleTextInput} />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cobranza</label>
                                        <button type="button" onClick={copyLegalToBilling} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded font-bold hover:bg-indigo-100 border border-indigo-100 transition-colors">COPIAR DATOS</button>
                                    </div>
                                    <Input label="Contacto Pagos" name="billing_name" val={clientForm.billing_name} chg={handleTextInput} />
                                    <Input label="Email Facturación" name="billing_email" val={clientForm.billing_email} chg={handleTextInput} />
                                </div>
                            </div>
                        </div>
                        
                        {/* Seccion 3: Plan */}
                        <div className="space-y-6">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600 tracking-widest border-b border-indigo-50 pb-2">
                                <MousePointer2 size={18}/> Plan de Suscripción
                            </h3>
                            {plans.length === 0 ? (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm font-bold text-center">
                                    ⚠️ No hay planes configurados. Contacte al administrador.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {plans.map(p => (
                                        <div 
                                            key={p.code} 
                                            onClick={() => setClientForm({...clientForm, plan: p.code})} 
                                            className={`p-5 border-2 rounded-2xl cursor-pointer transition-all hover:shadow-lg relative group ${clientForm.plan === p.code ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200'}`}
                                        >
                                            {clientForm.plan === p.code && (
                                                <div className="absolute top-3 right-3 text-indigo-600">
                                                    <CheckCircle size={20} fill="currentColor" className="text-white"/>
                                                </div>
                                            )}
                                            <p className="text-sm font-bold text-slate-700 mb-1">{p.name}</p>
                                            <span className="text-2xl font-black text-slate-900">
                                                {p.price_model === 'fixed' ? `$${p.price}` : `$${p.price_per_user}`}
                                            </span>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">
                                                {p.price_model === 'fixed' ? 'Mensual Fijo' : 'Por Usuario'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Seccion 4: Biométrico */}
                        <div className="border-t border-slate-100 pt-8">
                            <button 
                                type="button" 
                                onClick={() => setShowBiometricForm(!showBiometricForm)} 
                                className="w-full py-4 px-6 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-slate-700 font-bold hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all group shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 group-hover:scale-110 transition">
                                        <Fingerprint size={20}/>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm">Hardware / Biometría</span>
                                        <span className="block text-[10px] text-slate-400 font-normal uppercase tracking-wide group-hover:text-indigo-400">Registrar dispositivo</span>
                                    </div>
                                </div>
                                {showBiometricForm ? <ChevronUp size={20} className="text-indigo-500"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </button>
                            
                            {showBiometricForm && (
                                <div className="mt-6 p-6 bg-white border-2 border-indigo-50 rounded-2xl animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm">
                                    <Input label="Marca" name="bio_brand" val={clientForm.bio_brand} chg={handleTextInput} icon={Tag} />
                                    <Input label="Modelo" name="bio_model" val={clientForm.bio_model} chg={handleTextInput} icon={Layers} />
                                    <Input label="No. Serie" name="bio_serial" val={clientForm.bio_serial} chg={handleTextInput} icon={AlignLeft} />
                                    <Input label="Ubicación" name="bio_location" val={clientForm.bio_location} chg={handleTextInput} icon={MapPin} />
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider ml-1 flex items-center gap-1"><Calendar size={12}/> Fecha Compra</label>
                                        <input type="date" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-sm" name="bio_purchase_date" value={clientForm.bio_purchase_date} onChange={handleTextInput} />
                                    </div>
                                    <Input label="Garantía (Meses)" name="bio_warranty_months" val={clientForm.bio_warranty_months} chg={handleNumericInput} icon={ShieldCheck} />
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                
                <footer className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                    <button 
                        onClick={() => setShowClientModal(false)} 
                        className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleCreateClient} 
                        disabled={saving} 
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {saving ? <Loader className="animate-spin" size={18}/> : 'Registrar Empresa'}
                    </button>
                </footer>
            </main>
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL: FACTURACIÓN AUTOMÁTICA (COBRO)
         ================================================================== */}
      {showInvoiceModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-violet-500"></div>
                  
                  <div className="mb-6 flex justify-center">
                      <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
                          <CreditCard size={32} className="text-indigo-600"/>
                      </div>
                  </div>

                  <h2 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">
                      ${invoicePreview.amount}
                  </h2>
                  <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-wider">
                      {invoicePreview.concept}
                  </p>
                  
                  <div className="space-y-3">
                      <button 
                          onClick={handleConfirmInvoice} 
                          disabled={saving}
                          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex justify-center items-center gap-2"
                      >
                          {saving ? <Loader className="animate-spin" size={20}/> : 'Confirmar Emisión'}
                      </button>
                      <button 
                          onClick={() => setShowInvoiceModal(false)} 
                          className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors py-2"
                      >
                          Cancelar
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  )
}

// ----------------------------------------------------------------------------
// 6. COMPONENTES AUXILIARES (INPUT & ESTILOS)
// ----------------------------------------------------------------------------

const Input = ({ label, name, val, chg, type="text", full, icon:Icon }) => (
    <div className={`space-y-1.5 ${full?'col-span-2':''}`}>
        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider ml-1 flex items-center gap-1">
            {Icon && <Icon size={12}/>} {label}
        </label>
        <input 
            type={type} 
            name={name} 
            value={val} 
            onChange={chg} 
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-sm hover:border-indigo-200"
        />
    </div>
)

const styleSheet = document.createElement("style"); 
styleSheet.innerText = `
  .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`; 
document.head.appendChild(styleSheet)