import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import MetricsChart from './components/MetricsChart'
import { PlusCircle, LayoutDashboard, LogOut, Lock, Building, Server, Activity, Fingerprint } from 'lucide-react'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tenantsList, setTenantsList] = useState([])
  const [devicesList, setDevicesList] = useState([])
  const [tenantForm, setTenantForm] = useState({ ruc: '', name: '', email: '' })
  const [deviceForm, setDeviceForm] = useState({ serial: '', name: '', tenantId: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); if (session) fetchData()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); if (session) fetchData()
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchData = async () => {
    const [tenantsRes, devicesRes] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('biometric_devices').select('*, tenants(business_name)').order('created_at', { ascending: false })
    ])
    if (tenantsRes.data) setTenantsList(tenantsRes.data)
    if (devicesRes.data) setDevicesList(devicesRes.data)
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    setLoading(false)
  }

  const handleCreateTenant = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('tenants').insert([{ ruc: tenantForm.ruc, business_name: tenantForm.name, legal_rep_email: tenantForm.email }])
    if (error) alert(error.message); else { alert('✅ Cliente creado'); setTenantForm({ ruc: '', name: '', email: '' }); fetchData() }
  }

  const handleRegisterDevice = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('biometric_devices').insert([{ serial_number: deviceForm.serial, name: deviceForm.name, tenant_id: deviceForm.tenantId, status: 'authorized' }])
    if (error) alert(error.message); else { alert('✅ Dispositivo vinculado'); setDeviceForm({ serial: '', name: '', tenantId: '' }); fetchData() }
  }

  if (!session) return (
    <div className="flex h-screen items-center justify-center bg-slate-100 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">
        <div className="text-center mb-8"><div className="inline-flex p-4 bg-indigo-600 rounded-full text-white mb-4"><Lock size={32} /></div><h1 className="text-2xl font-bold text-slate-800">CEREBRO ADMIN</h1></div>
        <form onSubmit={handleLogin} className="space-y-5">
          <input type="email" required className="w-full p-3 border rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@roberleon.com" />
          <input type="password" required className="w-full p-3 border rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition">{loading ? '...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-[#0f172a] text-white p-6 flex flex-col shadow-2xl">
        <h1 className="text-xl font-bold mb-10 tracking-wider flex items-center gap-2 text-indigo-400"><LayoutDashboard /> CEREBRO</h1>
        <nav className="space-y-2 flex-1">
          {['dashboard', 'tenants', 'devices'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center space-x-3 w-full p-3 rounded-lg transition ${activeTab === tab ? 'bg-indigo-600 shadow-lg' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}>
              {tab === 'dashboard' && <Activity size={20} />} {tab === 'tenants' && <Building size={20} />} {tab === 'devices' && <Server size={20} />}
              <span className="capitalize">{tab === 'tenants' ? 'Clientes' : tab === 'devices' ? 'Biométricos' : 'Métricas'}</span>
            </button>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="mt-auto flex items-center space-x-3 w-full p-3 rounded-lg hover:bg-red-500/10 text-red-400 transition"><LogOut size={20} /> <span>Salir</span></button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8"><h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab === 'tenants' ? 'Gestión de Clientes' : activeTab === 'devices' ? 'Inventario Hardware' : 'Panel de Control'}</h2><p className="text-sm text-slate-500">Usuario: {session.user.email}</p></header>
        
        {activeTab === 'dashboard' && (
          <div className="animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[{l:'Clientes',v:tenantsList.length, c:'text-indigo-600'}, {l:'Activos',v:devicesList.filter(d=>d.status==='authorized').length, c:'text-emerald-500'}, {l:'Alertas',v:devicesList.filter(d=>d.status==='revoked').length, c:'text-red-500'}].map((m,i)=>(
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border"><p className="text-xs font-bold text-slate-400 uppercase">{m.l}</p><p className={`text-3xl font-extrabold mt-2 ${m.c}`}>{m.v}</p></div>
              ))}
            </div>
            <MetricsChart devices={devicesList} />
          </div>
        )}

        {activeTab === 'tenants' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border"><h3 className="font-bold text-slate-700 mb-4 flex gap-2"><PlusCircle className="text-indigo-600"/> Nuevo Cliente</h3>
              <form onSubmit={handleCreateTenant} className="grid md:grid-cols-3 gap-4">
                <input className="p-3 border rounded-lg" placeholder="Razón Social" value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} required />
                <input className="p-3 border rounded-lg" placeholder="RUC" value={tenantForm.ruc} onChange={e => setTenantForm({...tenantForm, ruc: e.target.value})} required />
                <input className="p-3 border rounded-lg" placeholder="Email" value={tenantForm.email} onChange={e => setTenantForm({...tenantForm, email: e.target.value})} required />
                <button className="bg-indigo-600 text-white font-bold py-3 rounded-lg md:col-span-3 hover:bg-indigo-700">Registrar</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Empresa</th><th className="p-4">RUC</th><th className="p-4">ID (UUID)</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{tenantsList.map(t=>(<tr key={t.id} className="hover:bg-slate-50"><td className="p-4 font-medium">{t.business_name}</td><td className="p-4">{t.ruc}</td><td className="p-4 font-mono text-xs text-slate-400 select-all">{t.id}</td></tr>))}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border"><h3 className="font-bold text-slate-700 mb-4 flex gap-2"><Fingerprint className="text-indigo-600"/> Autorizar Hardware</h3>
              <form onSubmit={handleRegisterDevice} className="grid md:grid-cols-3 gap-4">
                <input className="p-3 border rounded-lg" placeholder="Serial (SN)" value={deviceForm.serial} onChange={e => setDeviceForm({...deviceForm, serial: e.target.value})} required />
                <input className="p-3 border rounded-lg" placeholder="Nombre" value={deviceForm.name} onChange={e => setDeviceForm({...deviceForm, name: e.target.value})} />
                <input className="p-3 border rounded-lg font-mono text-xs" placeholder="UUID Cliente" value={deviceForm.tenantId} onChange={e => setDeviceForm({...deviceForm, tenantId: e.target.value})} required />
                <button className="bg-indigo-600 text-white font-bold py-3 rounded-lg md:col-span-3 hover:bg-indigo-700">Vincular</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Serial</th><th className="p-4">Nombre</th><th className="p-4">Cliente</th><th className="p-4">Estado</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{devicesList.map(d=>(<tr key={d.id} className="hover:bg-slate-50"><td className="p-4 font-mono font-bold">{d.serial_number}</td><td className="p-4">{d.name}</td><td className="p-4 text-indigo-600">{d.tenants?.business_name}</td><td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${d.status==='authorized'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{d.status}</span></td></tr>))}</tbody></table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
export default App