import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  // Iconos para la interfaz
  Shield, 
  Lock, 
  Mail, 
  Loader, 
  AlertCircle, 
  ArrowRight, 
  Fingerprint, 
  CheckCircle,
  Activity,
  LayoutDashboard
} from 'lucide-react'

// ==============================================================================
// 1. IMPORTACIÓN DE PANELES (DASHBOARDS)
// ==============================================================================
import AdminDashboard from './components/AdminDashboard'
import AssistantDashboard from './components/AssistantDashboard'

// ==============================================================================
// 2. CONFIGURACIÓN DE SUPABASE
// ==============================================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// ==============================================================================
// 3. COMPONENTE PRINCIPAL (APP)
// ==============================================================================
export default function App() {
  
  // ----------------------------------------------------------------------------
  // ESTADOS DE LA APLICACIÓN
  // ----------------------------------------------------------------------------

  // Estado de Sesión y Permisos
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null) 
  
  // Estado de Carga Global (Pantalla negra inicial)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Iniciando sistema...')
  
  // Estado de Carga del Botón de Login
  const [loginLoading, setLoginLoading] = useState(false)
  
  // Estados del Formulario
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  // Estado de Identidad Corporativa (Branding)
  const [branding, setBranding] = useState({
    company_name: 'CEREBRO SaaS',
    company_logo: null,
    primary_color: '#4F46E5' // Color Indigo por defecto
  })

  // ----------------------------------------------------------------------------
  // FUNCIONES DE SOPORTE (LÓGICA DE NEGOCIO)
  // ----------------------------------------------------------------------------

  /**
   * Función segura para obtener el rol del usuario.
   * Incluye un "Timeout" para evitar que el sistema se congele si la BD está lenta.
   */
  const fetchUserRoleSafely = async (userEmail) => {
      try {
          console.log(`🔍 Buscando rol para: ${userEmail}...`)
          
          // 1. Creamos una promesa de Timeout (4 segundos máximo)
          const timeoutPromise = new Promise((resolve) => 
              setTimeout(() => resolve({ timeout: true }), 4000)
          );

          // 2. Creamos la promesa de la Base de Datos
          const dbPromise = supabase
              .from('user_roles')
              .select('role')
              .eq('email', userEmail)
              .maybeSingle();

          // 3. Carrera: La que termine primero gana
          const result = await Promise.race([dbPromise, timeoutPromise]);

          // 4. Evaluar el resultado
          if (result?.timeout) {
              console.warn("⚠️ Tiempo de espera agotado al buscar rol.");
              // Fallback de seguridad si hay timeout
              return userEmail.includes('admin') ? 'admin' : 'assistant';
          }

          const { data, error } = result || {};

          if (error) {
              console.error("❌ Error en consulta de roles:", error);
              throw error;
          }

          if (data && data.role) {
              console.log("✅ Rol confirmado:", data.role);
              return data.role;
          } else {
              console.warn("⚠️ Usuario sin rol explícito. Asignando rol por defecto.");
              // Lógica de respaldo por Email (Hardcoded para emergencias)
              if (userEmail.includes('admin') || userEmail === 'raul@juvo.com') {
                  return 'admin';
              } else {
                  return 'assistant';
              }
          }
      } catch (e) {
          console.error("Excepción crítica en roles:", e);
          // Último recurso para no bloquear la app
          return 'assistant';
      }
  }

  /**
   * Carga la configuración visual (Logo y Nombre) desde la base de datos.
   */
  const fetchBranding = async () => {
      try {
          const { data } = await supabase.from('app_settings').select('*').single()
          if (data) {
              setBranding({
                  company_name: data.company_name || 'CEREBRO SaaS',
                  company_logo: data.company_logo || null,
                  primary_color: data.primary_color || '#4F46E5'
              })
              // Actualizar título del navegador
              document.title = `${data.company_name} - Acceso`
          }
      } catch (e) { 
          // Fallo silencioso (usa valores por defecto)
      }
  }

  // ----------------------------------------------------------------------------
  // EFECTOS (INICIALIZACIÓN)
  // ----------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    // Función de arranque secuencial
    const init = async () => {
        if (!mounted) return;
        
        setLoadingStatus('Estableciendo conexión segura...')
        
        // 1. Cargar Branding (Paralelo)
        fetchBranding();
        
        // 2. Verificar Sesión Actual
        const { data: { session: initSession } } = await supabase.auth.getSession();
        
        if (initSession && mounted) {
            setLoadingStatus('Verificando permisos de acceso...');
            setSession(initSession);
            
            // Buscar rol antes de quitar el loading
            const role = await fetchUserRoleSafely(initSession.user.email);
            if (mounted) setUserRole(role);
        }
        
        // 3. Finalizar Carga
        if (mounted) {
            setLoading(false);
            setLoadingStatus('');
        }
    }

    init();

    // Listener para cambios de sesión (Login/Logout en otras pestañas o eventos)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;
        
        console.log("🔔 Evento Auth:", event);

        if (event === 'SIGNED_OUT') {
            setSession(null);
            setUserRole(null);
            setLoading(false);
            setLoginLoading(false);
            setEmail('');
            setPassword('');
        } 
        else if (event === 'SIGNED_IN' && currentSession) {
            // Nota: El manejo principal está en handleLogin para evitar parpadeos,
            // pero esto sirve de respaldo si el login ocurre por otro medio.
            setSession(currentSession);
        }
    });

    return () => { 
        mounted = false; 
        subscription.unsubscribe(); 
    }
  }, []);

  // ----------------------------------------------------------------------------
  // HANDLERS (MANEJADORES DE EVENTOS)
  // ----------------------------------------------------------------------------

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Validación de campos vacíos
    if (!email || !password) {
        setErrorMsg("Por favor, ingrese correo y contraseña.");
        return;
    }

    setLoginLoading(true);
    setErrorMsg(null);

    try {
      // 1. Autenticar con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
      });
      
      if (error) throw error;

      // 2. Si el login es exitoso, forzar la carga del rol INMEDIATAMENTE
      // Esto evita que la pantalla se quede en "Verificando..." esperando el evento
      if (data.session) {
          setSession(data.session);
          
          // Mantenemos el estado de carga activo mientras buscamos el rol
          const role = await fetchUserRoleSafely(data.session.user.email);
          
          // Actualizamos el rol y la sesión al mismo tiempo para disparar el cambio de vista
          setUserRole(role);
      }

    } catch (error) {
      console.error("Fallo en login:", error.message);
      
      // Mensajes de error amigables para el usuario
      if (error.message.includes("Invalid")) {
          setErrorMsg("Credenciales incorrectas. Intente nuevamente.");
      } else if (error.message.includes("verified")) {
          setErrorMsg("Su correo electrónico no ha sido verificado.");
      } else {
          setErrorMsg("Error de conexión con el servidor.");
      }
      
      setLoginLoading(false); // Solo quitamos el spinner si falló
    }
  };

  const handleLogout = async () => {
    try {
        setLoading(true);
        setLoadingStatus('Cerrando sesión...');
        await supabase.auth.signOut();
        // El listener se encargará de limpiar el estado
    } catch (error) {
        console.error("Error al salir:", error);
        setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // RENDERIZADO CONDICIONAL (VISTAS)
  // ----------------------------------------------------------------------------

  // VISTA 1: CARGA INICIAL (PANTALLA NEGRA)
  if (loading) {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f172a] text-white gap-6 font-sans">
            <div className="relative">
                {/* Spinner animado */}
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                {/* Icono central */}
                <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                    <Activity size={20} className="text-indigo-400"/>
                </div>
            </div>
            {/* Texto de estado */}
            <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-bold tracking-widest text-slate-300 uppercase animate-pulse">
                    Cargando Sistema
                </p>
                <p className="text-xs text-slate-500 font-mono">
                    {loadingStatus}
                </p>
            </div>
        </div>
    )
  }

  // VISTA 2: PANELES DE CONTROL (DASHBOARDS)
  // Si hay sesión y rol definido, mostramos el dashboard correspondiente
  if (session && userRole) {
      if (userRole === 'admin') {
          return <AdminDashboard session={session} onLogout={handleLogout} />
      }
      
      if (userRole === 'assistant') {
          return <AssistantDashboard session={session} onLogout={handleLogout} />
      }
      
      // Fallback para roles no implementados (Mantenimiento, etc.)
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full border border-slate-200">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield size={32} className="text-orange-500"/>
                </div>
                <h1 className="text-xl font-bold text-slate-800 mb-2">Acceso Limitado</h1>
                <p className="text-slate-500 text-sm mb-6">
                    Su rol actual ({userRole}) no tiene un panel asignado en esta versión.
                </p>
                <button 
                    onClick={handleLogout} 
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all"
                >
                    Cerrar Sesión
                </button>
            </div>
        </div>
      )
  }

  // VISTA 3: LOGIN (DISEÑO COMPACTO Y RESPONSIVE)
  // Si no hay sesión, mostramos el formulario de login
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Elementos Decorativos de Fondo (Glow) */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* TARJETA DE LOGIN */}
      {/* Max-width ajustado a 380px para ser compacto como pediste */}
      <div className="bg-white w-full max-w-[380px] rounded-[24px] shadow-2xl relative overflow-hidden z-10 animate-fade-in-up border border-white/10">
        
        {/* Barra superior con gradiente */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        <div className="p-8">
            
            {/* SECCIÓN 1: LOGO Y TÍTULO */}
            <div className="flex flex-col items-center mb-8">
                <div className="mb-5 relative group cursor-pointer perspective-1000">
                    <div className="absolute inset-0 bg-indigo-100 rounded-2xl rotate-6 group-hover:rotate-12 transition-transform duration-500 ease-out"></div>
                    <div className="relative bg-white p-3 rounded-2xl shadow-md border border-slate-50 group-hover:scale-105 transition-transform duration-300">
                        {branding.company_logo ? (
                            <img 
                                src={branding.company_logo} 
                                alt="Logo Empresa" 
                                className="h-12 w-auto object-contain"
                            />
                        ) : (
                            <Shield size={40} className="text-indigo-600" strokeWidth={1.5} />
                        )}
                    </div>
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight text-center leading-tight">
                    {branding.company_name}
                </h1>
                <p className="text-slate-400 font-medium text-xs mt-1 flex items-center gap-1.5">
                    <Lock size={10}/> Acceso Seguro Administrativo
                </p>
            </div>

            {/* SECCIÓN 2: ALERTA DE ERROR */}
            {errorMsg && (
              <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-600 text-xs font-bold animate-shake">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {/* SECCIÓN 3: FORMULARIO */}
            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* CAMPO: EMAIL */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                    Correo Electrónico
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" 
                    placeholder="usuario@empresa.com"
                  />
                  {/* Indicador visual de email válido */}
                  {email.includes('@') && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-500 animate-fade-in">
                          <CheckCircle size={14} />
                      </div>
                  )}
                </div>
              </div>

              {/* CAMPO: CONTRASEÑA */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Contraseña
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" 
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* BOTÓN DE ACCIÓN */}
              <button 
                type="submit" 
                disabled={loginLoading} 
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm group mt-2"
              >
                {loginLoading ? (
                    <>
                        <Loader className="animate-spin" size={18} />
                        <span className="animate-pulse">Verificando...</span>
                    </>
                ) : (
                    <>
                        <span>Iniciar Sesión</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                    </>
                )}
              </button>
            </form>

            {/* PIE DE TARJETA */}
            <div className="mt-8 text-center border-t border-slate-100 pt-5">
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-help opacity-70 hover:opacity-100 transition-opacity">
                <Fingerprint size={12} />
                Acceso restringido y monitoreado
              </p>
            </div>

        </div>
      </div>
      
      {/* FOOTER GENERAL */}
      <div className="absolute bottom-4 text-slate-600 text-[10px] font-medium text-center opacity-50 hover:opacity-100 transition-opacity cursor-default">
        &copy; {new Date().getFullYear()} {branding.company_name}. <br/>Todos los derechos reservados.
      </div>

      {/* --- ESTILOS CSS INYECTADOS --- */}
      <style>{`
        @keyframes fade-in-up { 
            from { opacity: 0; transform: translateY(15px); } 
            to { opacity: 1; transform: translateY(0); } 
        } 
        .animate-fade-in-up { 
            animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        @keyframes shake { 
            0%, 100% { transform: translateX(0); } 
            25% { transform: translateX(-2px); } 
            75% { transform: translateX(2px); } 
        }
        .animate-shake { 
            animation: shake 0.3s ease-in-out; 
        }
        .animate-pulse-slow {
            animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  )
}

