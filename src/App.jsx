import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Users, Fingerprint, PlusCircle, LayoutDashboard, LogOut, Lock } from 'lucide-react'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Estados del Dashboard
  const [activeTab, setActiveTab] = useState('tenants')
  const [tenantForm, setTenantForm] = useState({ ruc: '', name: '', email: '' })
  const [deviceForm, setDeviceForm] = useState({ serial: '', name: '', tenantId: '' })

  // Verificar sesión al cargar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('Error al entrar: ' + error.message)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleCreateTenant = async (e) => {
    e.preventDefault()
    const { error } = await supabase
      .from('tenants')
      .insert([{ 
        ruc: tenantForm.ruc, 
        business_name: tenantForm.name,
        legal_rep_name: 'Admin', 
        legal_rep_email: tenantForm.email
      }])
    
    if (error) alert('Error: ' + error.message)
    else {
      alert('¡Cliente creado exitosamente!')
      setTenantForm({ ruc: '', name: '', email: '' })
    }
  }

  const handleRegisterDevice = async (e) => {
    e.preventDefault()
    const { error } = await supabase
      .from('biometric_devices')
      .insert([{
        serial_number: deviceForm.serial,
        name: deviceForm.name,
        tenant_id: deviceForm.tenantId
      }])

    if (error) alert('Error: ' + error.message)
    else {
      alert('¡Biométrico autorizado!')
      setDeviceForm({ serial: '', name: '', tenantId: '' })
    }
  }

  // --- PANTALLA DE LOGIN ---
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl border border-indigo-100">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-indigo-100 rounded-full text-cerebro-main mb-4">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Acceso a CEREBRO</h1>
            <p className="text-slate-500">Solo personal autorizado de Rober León</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Correo Corporativo</label>
              <input type="email" required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cerebro-main outline-none"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@roberleon.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
              <input type="password" required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cerebro-main outline-none"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button disabled={loading} className="w-full bg-cerebro-main hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-lg flex justify-center">
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- DASHBOARD ---
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-gradient-to-b from-cerebro-main to-cerebro-dark text-white p-6 flex flex-col shadow-2xl">
        <h1 className="text-2xl font-bold mb-10 tracking-wider flex items-center gap-2">
          <LayoutDashboard size={28} />
          <div>CEREBRO <span className="text-xs opacity-70 block font-normal">SaaS Admin</span></div>
        </h1>
        <nav className="space-y-4 flex-1">
          <button onClick={() => setActiveTab('tenants')} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all duration-200 ${activeTab === 'tenants' ? 'bg-white/20 shadow-inner' : 'hover:bg-white/10'}`}>
            <Users size={20} /> <span className="font-medium">Gestión Clientes</span>
          </button>
          <button onClick={() => setActiveTab('devices')} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all duration-200 ${activeTab === 'devices' ? 'bg-white/20 shadow-inner' : 'hover:bg-white/10'}`}>
            <Fingerprint size={20} /> <span className="font-medium">Biométricos</span>
          </button>
        </nav>
        
        <button onClick={handleLogout} className="mt-auto flex items-center space-x-3 w-full p-3 rounded-xl hover:bg-red-500/20 text-red-100 transition">
          <LogOut size={20} /> <span>Cerrar Sesión</span>
        </button>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto bg-slate-50">
        <div className="mb-6 flex justify-end text-sm text-slate-400">
          Usuario: {session.user.email}
        </div>

        {activeTab === 'tenants' && (
          <div className="max-w-3xl mx-auto bg-white p-10 rounded-3xl shadow-xl border border-indigo-50">
            <h2 className="text-3xl font-bold text-slate-800 mb-8 flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-full text-cerebro-main"><PlusCircle size={32} /></div>
              Nuevo Inquilino
            </h2>
            <form onSubmit={handleCreateTenant} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-2">Razón Social</label>
                <input type="text" required className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-cerebro-main outline-none transition" 
                  value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} placeholder="Ej: Corporación Favorita C.A." />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">RUC / ID Fiscal</label>
                  <input type="text" required className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-cerebro-main outline-none transition" 
                    value={tenantForm.ruc} onChange={e => setTenantForm({...tenantForm, ruc: e.target.value})} placeholder="17900..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">Email Contacto</label>
                  <input type="email" required className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-cerebro-main outline-none transition" 
                    value={tenantForm.email} onChange={e => setTenantForm({...tenantForm, email: e.target.value})} placeholder="admin@empresa.com" />
                </div>
              </div>
              <button className="w-full bg-gradient-to-r from-cerebro-main to-indigo-600 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition transform hover:scale-[1.01] active:scale-95 mt-4">
                Registrar Cliente & Enviar Credenciales
              </button>
            </form>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="max-w-3xl mx-auto bg-white p-10 rounded-3xl shadow-xl border border-pink-50">
            <h2 className="text-3xl font-bold text-slate-800 mb-8 flex items-center gap-3">
              <div className="p-3 bg-pink-100 rounded-full text-cerebro-accent"><Fingerprint size={32} /></div>
              Autorizar Biométrico
            </h2>
            <form onSubmit={handleRegisterDevice} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-2">Número de Serie (SN)</label>
                <input type="text" required placeholder="Ej: ZK-2938482" className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-pink-100 focus:border-cerebro-accent outline-none transition"
                  value={deviceForm.serial} onChange={e => setDeviceForm({...deviceForm, serial: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-2">Nombre del Dispositivo</label>
                <input type="text" placeholder="Ej: Entrada Principal" className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-pink-100 focus:border-cerebro-accent outline-none transition"
                  value={deviceForm.name} onChange={e => setDeviceForm({...deviceForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-2">UUID del Tenant (Cliente)</label>
                <input type="text" required placeholder="Pega el ID del cliente aquí" className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-pink-100 focus:border-cerebro-accent outline-none transition font-mono text-sm"
                  value={deviceForm.tenantId} onChange={e => setDeviceForm({...deviceForm, tenantId: e.target.value})} />
              </div>
              <button className="w-full bg-gradient-to-r from-cerebro-accent to-pink-600 hover:from-pink-600 hover:to-pink-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-pink-200 transition transform hover:scale-[1.01] active:scale-95 mt-4">
                Autorizar Dispositivo
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default App