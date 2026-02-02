import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Shield, Lock, Loader, AlertCircle, UserCheck, LogOut } from 'lucide-react'

// --- 1. IMPORTAR DASHBOARD REAL ---
// (Asegúrate de que src/components/AdminDashboard.jsx exista)
import AdminDashboard from './components/AdminDashboard'

// --- 2. CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// --- 3. COMPONENTES TEMPORALES (Para roles que aún no construimos) ---

const AssistantDashboard = ({ session, onLogout }) => (
  <div className="p-10 bg-slate-50 min-h-screen">
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Panel de Asistente</h1>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
          <LogOut size={18} /> Salir
        </button>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-2 text-purple-600">Módulo de Cobranzas</h2>
        <p>Este módulo está en construcción. Aquí verás la gestión de facturas.</p>
      </div>
    </div>
  </div>
)

const UserDashboard = ({ session, onLogout }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-100">
    <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-slate-200">
      <div className="inline-block p-3 bg-slate-100 rounded-full mb-4">
        <UserCheck className="w-8 h-8 text-slate-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Cuenta de Usuario</h1>
      <p className="text-slate-500 mb-6">No tienes permisos administrativos asignados.</p>
      <button onClick={onLogout} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition">
        Cerrar Sesión
      </button>
    </div>
  </div>
)

// --- 4. PANTALLA DE LOGIN ---
const LoginScreen = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } catch (err) {
      setError(err.message === "Invalid login credentials" 
        ? "Correo o contraseña incorrectos" 
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-sm bg-opacity-95">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-indigo-50 rounded-full">
            <Shield className="w-10 h-10 text-indigo-600" />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">CEREBRO SaaS</h2>
        <p className="text-center text-slate-500 mb-8">Acceso Seguro Administrativo</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-3 border border-red-100">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Correo Electrónico</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
              placeholder="admin@juvo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 active:scale-[0.98] transition flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            {loading ? <Loader className="animate-spin" size={20} /> : <><Lock size={18} /> Iniciar Sesión</>}
          </button>
        </form>
      </div>
    </div>
  )
}

// --- 5. APP PRINCIPAL (LÓGICA MAESTRA) ---
function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Función segura para obtener rol sin errores de Schema
  const fetchUserRole = async (userId) => {
    try {
      console.log("🔍 Buscando rol para:", userId)
      
      const { data, error } = await supabase
        .from('internal_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle() 

      if (error) {
        console.error("⚠️ Error SQL:", error.message)
        setRole('user') 
      } else if (!data) {
        console.warn("⚠️ Sin perfil")
        setRole('user')
      } else {
        console.log("✅ Rol encontrado:", data.role)
        setRole(data.role)
      }
    } catch (err) {
      console.error("❌ Error inesperado:", err)
      setRole('user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUserRole(session.user.id)
      else setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setRole(null) // Resetear rol mientras cargamos
        fetchUserRole(session.user.id)
      } else {
        setRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setRole(null)
    setSession(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Cargando CEREBRO...</p>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  // AQUÍ ESTÁ LA MAGIA: Usamos el AdminDashboard importado
  switch (role) {
    case 'admin':
      return <AdminDashboard session={session} onLogout={handleLogout} />
    case 'assistant':
      return <AssistantDashboard session={session} onLogout={handleLogout} />
    default:
      return <UserDashboard session={session} onLogout={handleLogout} />
  }
}

export default App