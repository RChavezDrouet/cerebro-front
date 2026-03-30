// src/pages/AccessPage.tsx  ·  CEREBRO v4.3.3
// Tres secciones: Staff · Roles & Permisos · Crear Usuario
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { cerebro, supabase } from '@/config/supabase'
import {
  GlassCard, NeonButton, InputField, PageHeader,
  SectionCard, FullPageLoader,
} from '@/components/ui'
import { usePermissions } from '@/lib/permissions'
import {
  ShieldCheck, UserPlus, Users, Save, RefreshCw,
  Eye, EyeOff, Mail, Key, Check, X, Info,
  Shield, Lock, ChevronDown, ChevronUp, UserCog, Pencil,
} from 'lucide-react'
import zxcvbn from 'zxcvbn'

// ─── Tipos ────────────────────────────────────────────────────
type StaffRole = 'admin' | 'assistant' | 'maintenance'

type StaffRow = {
  id?: string
  email: string
  role: StaffRole
  full_name: string | null
  is_active: boolean
  user_id: string | null
  created_at?: string
}

type InviteForm = {
  email: string
  full_name: string
  role: StaffRole
  temp_password: string
}

// ─── 19 permisos canónicos ────────────────────────────────────
const PERMISSIONS = [
  // Empresas (5)
  { key: 'tenants.view',    cat: 'Empresas',    label: 'Ver empresas',           desc: 'Ver lista y detalle de tenants' },
  { key: 'tenants.create',  cat: 'Empresas',    label: 'Crear empresas',         desc: 'Registrar nuevos tenants' },
  { key: 'tenants.edit',    cat: 'Empresas',    label: 'Editar empresas',        desc: 'Modificar datos de tenants' },
  { key: 'tenants.suspend', cat: 'Empresas',    label: 'Pausar / Suspender',     desc: 'Cambiar estado de tenants' },
  { key: 'tenants.delete',  cat: 'Empresas',    label: 'Eliminar empresas',      desc: 'Borrar tenants (irreversible)' },
  // Facturación (5)
  { key: 'invoices.view',   cat: 'Facturación', label: 'Ver facturas',           desc: 'Ver historial de facturación' },
  { key: 'invoices.create', cat: 'Facturación', label: 'Crear facturas',         desc: 'Generar nuevas facturas' },
  { key: 'invoices.edit',   cat: 'Facturación', label: 'Editar facturas',        desc: 'Modificar facturas existentes' },
  { key: 'invoices.delete', cat: 'Facturación', label: 'Eliminar facturas',      desc: 'Borrar facturas' },
  { key: 'payments.manage', cat: 'Facturación', label: 'Gestionar pagos',        desc: 'Registrar y editar pagos' },
  // KPIs (2)
  { key: 'kpis.view',       cat: 'KPIs',        label: 'Ver KPIs',               desc: 'Acceder a métricas y dashboard' },
  { key: 'kpis.export',     cat: 'KPIs',        label: 'Exportar reportes',      desc: 'Descargar CSV / PDF' },
  // Accesos (2)
  { key: 'access.view',     cat: 'Accesos',     label: 'Ver accesos',            desc: 'Ver roles y staff' },
  { key: 'access.manage',   cat: 'Accesos',     label: 'Gestionar accesos',      desc: 'Editar roles, permisos y staff' },
  // Sistema (5)
  { key: 'audit.view',      cat: 'Sistema',     label: 'Ver auditoría',          desc: 'Consultar logs de auditoría' },
  { key: 'settings.view',   cat: 'Sistema',     label: 'Ver configuración',      desc: 'Ver ajustes del sistema' },
  { key: 'settings.edit',   cat: 'Sistema',     label: 'Editar configuración',   desc: 'Modificar parámetros globales' },
  { key: 'staff.manage',    cat: 'Sistema',     label: 'Gestionar staff',        desc: 'Crear y editar usuarios Cerebro' },
  { key: 'reports.export',  cat: 'Sistema',     label: 'Exportar reportes gen.', desc: 'Exportar reportes globales' },
]

const DEFAULT_PERMS: Record<StaffRole, string[]> = {
  admin:       PERMISSIONS.map(p => p.key),
  assistant:   ['tenants.view','tenants.edit','invoices.view','invoices.create','invoices.edit','payments.manage','kpis.view','audit.view','settings.view'],
  maintenance: ['tenants.view','audit.view'],
}

const ROLE_STYLE: Record<string, string> = {
  admin:       'text-neon-cyan  border-neon-cyan/30  bg-neon-cyan/10',
  assistant:   'text-violet-400 border-violet-400/30 bg-violet-400/10',
  maintenance: 'text-amber-400  border-amber-400/30  bg-amber-400/10',
}

const ROLE_DESC: Record<string, string> = {
  admin:       'Acceso total · puede crear usuarios y editar permisos',
  assistant:   'Operativo · facturación y empresas · sin gestión de sistema',
  maintenance: 'Solo lectura · ve empresas y logs de auditoría',
}

const PWD_COLOR  = ['bg-red-500','bg-orange-500','bg-yellow-400','bg-neon-blue','bg-neon-green']
const PWD_TEXT   = ['text-red-400','text-orange-400','text-yellow-400','text-neon-blue','text-neon-green']
const PWD_LABEL  = ['Muy débil','Débil','Regular','Buena','Excelente']

// ─── HUD corner helper ────────────────────────────────────────
function Corners({ c }: { c: string }) {
  const s = { borderColor: c }
  return (
    <>
      <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={s}/>
      <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={s}/>
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={s}/>
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={s}/>
    </>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border capitalize tracking-wider ${ROLE_STYLE[role] ?? 'text-slate-400 border-white/10 bg-white/5'}`}>
      {role}
    </span>
  )
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${on ? 'bg-neon-blue/80' : 'bg-cosmos-700'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all shadow ${on ? 'left-5 bg-white' : 'left-0.5 bg-slate-500'}`}/>
    </button>
  )
}

// Avatar con inicial
function Avatar({ name, email, size = 9 }: { name?: string | null; email: string; size?: number }) {
  const letter = (name || email).charAt(0).toUpperCase()
  const hue = email.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div className={`w-${size} h-${size} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 text-sm`}
      style={{ background: `hsl(${hue},45%,22%)`, border: '1px solid rgba(255,255,255,0.08)' }}>
      {letter}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
export default function AccessPage() {
  const { user: me, refresh: refreshMyPerms } = usePermissions()
  const isAdmin = me?.role === 'admin'

  // Tabs
  const [tab, setTab] = useState<'staff' | 'roles' | 'invite'>('staff')

  // Staff
  const [loading, setLoading]     = useState(true)
  const [staff, setStaff]         = useState<StaffRow[]>([])
  const [filter, setFilter]       = useState('')
  const [selected, setSelected]   = useState<StaffRow | null>(null)
  const [savingUser, setSavingUser] = useState(false)

  // Roles
  const [editRole, setEditRole]   = useState<StaffRole>('assistant')
  const [perms, setPerms]         = useState<Record<string, boolean>>({})
  const [savingPerms, setSavingPerms] = useState(false)
  const [openCats, setOpenCats]   = useState<Set<string>>(new Set(['Empresas', 'Facturación']))

  // Invite
  const [form, setForm]           = useState<InviteForm>({ email: '', full_name: '', role: 'assistant', temp_password: '' })
  const [pwdScore, setPwdScore]   = useState(0)
  const [showPwd, setShowPwd]     = useState(false)
  const [inviting, setInviting]   = useState(false)

  // ─── Carga staff ──────────────────────────────────────────
  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await cerebro.from('user_roles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setStaff((data as any) ?? [])
    } catch (e: any) { toast.error('Error al cargar staff: ' + e.message) }
    finally { setLoading(false) }
  }, [])

  // ─── Carga permisos del rol ───────────────────────────────
  const loadRolePerms = useCallback(async (role: StaffRole) => {
    const { data } = await cerebro.from('role_permissions').select('permissions').eq('role', role).maybeSingle()
    const arr: string[] = (data as any)?.permissions ?? DEFAULT_PERMS[role] ?? []
    const map: Record<string, boolean> = {}
    PERMISSIONS.forEach(p => { map[p.key] = arr.includes(p.key) })
    setPerms(map)
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])
  useEffect(() => { loadRolePerms(editRole) }, [editRole, loadRolePerms])

  // ─── Guardar permisos ─────────────────────────────────────
  const savePerms = async () => {
    if (!isAdmin) return toast.error('Solo admin puede editar permisos')
    setSavingPerms(true)
    const allowed = PERMISSIONS.filter(p => perms[p.key]).map(p => p.key)
    const { error } = await cerebro.from('role_permissions').upsert({ role: editRole, permissions: allowed }, { onConflict: 'role' })
    if (error) toast.error(error.message)
    else { toast.success(`Permisos de "${editRole}" guardados`); await refreshMyPerms() }
    setSavingPerms(false)
  }

  // ─── Guardar cambios de usuario ───────────────────────────
  const saveUser = async () => {
    if (!selected || !isAdmin) return
    setSavingUser(true)
    const { error } = await cerebro.from('user_roles').update({
      role: selected.role,
      full_name: selected.full_name,
      is_active: selected.is_active,
    }).eq('email', selected.email)
    if (error) toast.error(error.message)
    else {
      toast.success('Usuario actualizado')
      setStaff(prev => prev.map(s => s.email === selected.email ? { ...s, ...selected } : s))
      await refreshMyPerms()
    }
    setSavingUser(false)
  }

  // ─── Invitar usuario (Edge Function) ─────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return toast.error('Solo admin puede crear usuarios')
    const email = form.email.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error('Email inválido')
    if (!form.full_name.trim()) return toast.error('Nombre requerido')
    if (form.temp_password.length < 8) return toast.error('Contraseña: mínimo 8 caracteres')
    if (pwdScore < 2) return toast.error('Contraseña demasiado débil')
    if (staff.some(s => s.email === email)) return toast.error('Ya existe un usuario con ese email')
    setInviting(true)
    try {
      const { error } = await supabase.functions.invoke('admin-invite-staff', {
        body: { email, password: form.temp_password, full_name: form.full_name.trim(), role: form.role }
      })
      if (error) throw new Error(error.message)
      await loadStaff()
      setForm({ email: '', full_name: '', role: 'assistant', temp_password: '' })
      setPwdScore(0)
      setTab('staff')
      toast.success(`Usuario ${email} creado correctamente ✓`)
    } catch (e: any) { toast.error(e.message ?? 'Error al crear usuario') }
    finally { setInviting(false) }
  }

  // ─── Helpers ──────────────────────────────────────────────
  const filteredStaff = useMemo(() => {
    const q = filter.toLowerCase()
    if (!q) return staff
    return staff.filter(s => s.email.toLowerCase().includes(q) || (s.full_name ?? '').toLowerCase().includes(q) || s.role.includes(q))
  }, [staff, filter])

  const permsByCat = useMemo(() => {
    const m = new Map<string, typeof PERMISSIONS>()
    for (const p of PERMISSIONS) { if (!m.has(p.cat)) m.set(p.cat, []); m.get(p.cat)!.push(p) }
    return [...m.entries()]
  }, [])

  const toggleCat = (c: string) => setOpenCats(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })

  if (loading) return <FullPageLoader />

  // ════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <PageHeader
        title="Accesos y Usuarios"
        subtitle={`${staff.length} usuarios de Cerebro · roles y permisos granulares`}
        icon={<ShieldCheck size={18} />}
        actions={
          <div className="flex items-center gap-2">
            <NeonButton variant="secondary" size="sm" onClick={loadStaff}>
              <RefreshCw size={13}/> Actualizar
            </NeonButton>
            {isAdmin && (
              <NeonButton size="sm" onClick={() => setTab('invite')}>
                <UserPlus size={14}/> Nuevo usuario
              </NeonButton>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-white/5 bg-cosmos-850 w-fit">
        {([
          ['staff',  <Users     size={13}/>, 'Usuarios',          staff.length],
          ['roles',  <Shield    size={13}/>, 'Roles y Permisos',  null],
          ['invite', <UserPlus  size={13}/>, 'Nuevo Usuario',     null],
        ] as [string, React.ReactNode, string, number | null][]).map(([k, icon, label, cnt]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-body ${
              tab === k ? 'bg-neon-blue/15 text-white border border-neon-blue/25' : 'text-slate-500 hover:text-slate-300 hover:bg-white/4'
            }`}>
            {icon} {label}
            {cnt !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${tab === k ? 'bg-neon-blue/20 text-neon-blue' : 'bg-white/5 text-slate-600'}`}>{cnt}</span>
            )}
          </button>
        ))}
      </div>

      {/* ╔══════════════════════════════════════════════════╗
          ║  TAB · STAFF                                     ║
          ╚══════════════════════════════════════════════════╝ */}
      {tab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Lista */}
          <div className="space-y-3">
            <input
              className="input-cosmos text-sm"
              placeholder="Buscar nombre, email, rol…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />

            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-0.5">
              {filteredStaff.map(s => (
                <button key={s.email} onClick={() => setSelected({ ...s })}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selected?.email === s.email ? 'border-neon-blue/35 bg-neon-blue/7' : 'border-white/5 hover:border-white/10 hover:bg-white/3'
                  }`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.full_name} email={s.email} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-body truncate">{s.full_name || s.email.split('@')[0]}</p>
                        {!s.is_active && <span className="text-[10px] font-mono text-neon-red border border-neon-red/25 px-1.5 rounded">INACTIVO</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-600 font-mono truncate">{s.email}</span>
                        <RoleBadge role={s.role}/>
                      </div>
                    </div>
                    <Pencil size={12} className="text-slate-700 flex-shrink-0"/>
                  </div>
                </button>
              ))}
              {filteredStaff.length === 0 && (
                <p className="text-center py-8 text-slate-600 text-sm font-body">Sin resultados</p>
              )}
            </div>
          </div>

          {/* Panel edición */}
          <div className="lg:col-span-2">
            {!selected ? (
              <GlassCard className="flex flex-col items-center justify-center py-20 gap-3 h-full">
                <UserCog size={28} className="text-slate-700"/>
                <p className="text-slate-500 text-sm font-body">Selecciona un usuario para editarlo</p>
              </GlassCard>
            ) : (
              <div className="relative glass-card p-0 overflow-hidden">
                <Corners c="#2563ff"/>

                {/* Header card */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <UserCog size={15} className="text-neon-blue"/>
                    <span className="text-sm font-semibold text-white">Editar Usuario</span>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition">
                    <X size={14}/>
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-cosmos-800/50 border border-white/5">
                    <Avatar name={selected.full_name} email={selected.email} size={14}/>
                    <div>
                      <p className="text-white font-semibold">{selected.full_name || '—'}</p>
                      <p className="text-sm text-slate-500 font-mono">{selected.email}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <RoleBadge role={selected.role}/>
                        {!selected.is_active && <span className="text-[10px] font-mono text-neon-red border border-neon-red/25 px-1.5 py-0.5 rounded-full">INACTIVO</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-body text-slate-400 mb-1.5">Nombre completo</label>
                      <input
                        className="input-cosmos"
                        value={selected.full_name || ''}
                        disabled={!isAdmin}
                        onChange={e => setSelected(p => p ? { ...p, full_name: e.target.value } : p)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-body text-slate-400 mb-1.5">Rol</label>
                      <select
                        className="input-cosmos"
                        value={selected.role}
                        disabled={!isAdmin || selected.email === me?.email}
                        onChange={e => setSelected(p => p ? { ...p, role: e.target.value as StaffRole } : p)}
                      >
                        <option value="admin">admin — Acceso total</option>
                        <option value="assistant">assistant — Operativo</option>
                        <option value="maintenance">maintenance — Solo lectura</option>
                      </select>
                    </div>
                  </div>

                  {/* Descripción del rol seleccionado */}
                  <div className="px-3 py-2.5 rounded-xl border border-white/5 bg-white/2 text-xs text-slate-500 font-body">
                    {ROLE_DESC[selected.role]}
                  </div>

                  {/* Toggle activo */}
                  {isAdmin && selected.email !== me?.email && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/2">
                      <div>
                        <p className="text-sm text-white font-body">Estado de la cuenta</p>
                        <p className="text-xs text-slate-600 mt-0.5">Los inactivos no pueden ingresar a CEREBRO</p>
                      </div>
                      <button
                        onClick={() => setSelected(p => p ? { ...p, is_active: !p.is_active } : p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-body transition-all ${
                          selected.is_active
                            ? 'border-neon-red/25 bg-neon-red/8 text-neon-red hover:bg-neon-red/15'
                            : 'border-neon-green/25 bg-neon-green/8 text-neon-green hover:bg-neon-green/15'
                        }`}>
                        {selected.is_active ? <><X size={14}/> Desactivar</> : <><Check size={14}/> Activar</>}
                      </button>
                    </div>
                  )}

                  {/* Aviso no-admin */}
                  {!isAdmin && (
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-400/15 bg-amber-400/5 text-xs text-amber-400/80 font-body">
                      <Lock size={12}/> Solo el rol <strong>admin</strong> puede editar usuarios.
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-slate-700 font-mono">
                      {selected.user_id ? `uid: ${selected.user_id.slice(0,8)}…` : 'Sin auth_uid'}
                    </p>
                    <div className="flex gap-2">
                      <NeonButton variant="secondary" size="sm" onClick={() => setSelected(null)}>Cancelar</NeonButton>
                      <NeonButton size="sm" onClick={saveUser} loading={savingUser} disabled={!isAdmin}>
                        <Save size={13}/> Guardar
                      </NeonButton>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ╔══════════════════════════════════════════════════╗
          ║  TAB · ROLES Y PERMISOS                          ║
          ╚══════════════════════════════════════════════════╝ */}
      {tab === 'roles' && (
        <div className="space-y-5">

          {/* Selector de rol */}
          <SectionCard title="Rol a configurar" icon={<Shield size={15}/>} accent="blue">
            <div className="grid grid-cols-3 gap-3">
              {(['admin','assistant','maintenance'] as StaffRole[]).map(r => {
                const active = editRole === r
                const cnt = PERMISSIONS.filter(p => perms[p.key]).length
                return (
                  <button key={r} onClick={() => setEditRole(r)}
                    className={`p-4 rounded-xl border text-left transition-all ${active ? 'border-neon-blue/30 bg-neon-blue/8' : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/4'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <RoleBadge role={r}/>
                      {active && <span className="text-[10px] font-mono text-neon-blue">{cnt}/{PERMISSIONS.length}</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-body mt-1">{ROLE_DESC[r]}</p>
                  </button>
                )
              })}
            </div>
          </SectionCard>

          {/* Matriz de permisos */}
          <div className="relative glass-card p-0 overflow-hidden">
            <Corners c="#2563ff"/>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Permisos:</span>
                  <RoleBadge role={editRole}/>
                </div>
                <p className="text-xs text-slate-500 font-body mt-0.5">
                  {PERMISSIONS.filter(p => perms[p.key]).length} / {PERMISSIONS.length} activos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <NeonButton variant="secondary" size="sm" disabled={!isAdmin}
                  onClick={() => {
                    const defs = DEFAULT_PERMS[editRole]
                    const m: Record<string,boolean> = {}
                    PERMISSIONS.forEach(p => { m[p.key] = defs.includes(p.key) })
                    setPerms(m)
                    toast.success('Reseteado a valores por defecto')
                  }}>
                  <RefreshCw size={13}/> Defaults
                </NeonButton>
                <NeonButton size="sm" onClick={savePerms} loading={savingPerms} disabled={!isAdmin}>
                  <Save size={13}/> Guardar
                </NeonButton>
              </div>
            </div>

            {/* Categorías */}
            <div className="p-4 space-y-2">
              {permsByCat.map(([cat, ps]) => {
                const open = openCats.has(cat)
                const active = ps.filter(p => perms[p.key]).length
                const allOn  = ps.every(p => perms[p.key])
                return (
                  <div key={cat} className="rounded-xl border border-white/5 overflow-hidden">
                    <button onClick={() => toggleCat(cat)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white/2 hover:bg-white/4 transition-colors">
                      <div className="flex items-center gap-3">
                        {open ? <ChevronUp size={13} className="text-slate-500"/> : <ChevronDown size={13} className="text-slate-500"/>}
                        <span className="text-sm font-semibold text-white">{cat}</span>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                          active === ps.length ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-white/5 text-slate-500'
                        }`}>{active}/{ps.length}</span>
                      </div>
                      {isAdmin && (
                        <span onClick={e => {
                          e.stopPropagation()
                          setPerms(prev => { const n = {...prev}; ps.forEach(p => { n[p.key] = !allOn }); return n })
                        }}
                        className="text-[11px] font-mono text-slate-500 hover:text-neon-cyan px-2 py-1 rounded-lg hover:bg-white/5 transition">
                          {allOn ? 'Quitar todos' : 'Marcar todos'}
                        </span>
                      )}
                    </button>

                    {open && (
                      <div className="divide-y divide-white/4">
                        {ps.map(p => (
                          <div key={p.key} className="flex items-center justify-between px-4 py-3 hover:bg-white/2 transition-colors">
                            <div className="min-w-0 flex-1 mr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white font-body">{p.label}</span>
                                <code className="text-[10px] text-slate-700 border border-white/5 px-1.5 py-0.5 rounded">{p.key}</code>
                              </div>
                              <p className="text-xs text-slate-600 font-body mt-0.5">{p.desc}</p>
                            </div>
                            <Toggle on={!!perms[p.key]} onChange={v => setPerms(prev => ({...prev, [p.key]: v}))} disabled={!isAdmin}/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {!isAdmin && (
              <div className="mx-5 mb-4 flex items-center gap-2 p-3 rounded-xl border border-amber-400/15 bg-amber-400/5 text-xs text-amber-400/80 font-body">
                <Lock size={12}/> Solo admin puede modificar permisos
              </div>
            )}
          </div>
        </div>
      )}

      {/* ╔══════════════════════════════════════════════════╗
          ║  TAB · NUEVO USUARIO                             ║
          ╚══════════════════════════════════════════════════╝ */}
      {tab === 'invite' && (
        <div className="max-w-2xl">
          {!isAdmin ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 gap-3">
              <Lock size={28} className="text-slate-700"/>
              <p className="text-slate-500 text-sm font-body">Solo el rol <strong className="text-white">admin</strong> puede crear usuarios</p>
            </GlassCard>
          ) : (
            <form onSubmit={handleInvite} autoComplete="off">
              <SectionCard title="Crear Usuario de CEREBRO" icon={<UserPlus size={15}/>} accent="cyan">
                <div className="space-y-5">

                  {/* Info */}
                  <div className="p-4 rounded-xl border border-neon-cyan/15 bg-neon-cyan/4 flex gap-3">
                    <Info size={15} className="text-neon-cyan flex-shrink-0 mt-0.5"/>
                    <p className="text-sm text-slate-300 font-body">
                      Se creará una cuenta en <strong className="text-neon-cyan">Supabase Auth</strong> y
                      una fila en <code className="text-neon-cyan text-xs">cerebro.user_roles</code>.
                      El usuario podrá acceder de inmediato con las credenciales ingresadas.
                    </p>
                  </div>

                  {/* Email + Nombre */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-body text-slate-400 mb-1.5">Email <span className="text-neon-cyan">*</span></label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"/>
                        <input type="email" required autoComplete="off"
                          className="input-cosmos pl-10"
                          placeholder="staff@empresa.com"
                          value={form.email}
                          onChange={e => setForm(f => ({...f, email: e.target.value}))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-body text-slate-400 mb-1.5">Nombre completo <span className="text-neon-cyan">*</span></label>
                      <input type="text" required autoComplete="off"
                        className="input-cosmos"
                        placeholder="Juan Pérez"
                        value={form.full_name}
                        onChange={e => setForm(f => ({...f, full_name: e.target.value}))}
                      />
                    </div>
                  </div>

                  {/* Rol */}
                  <div>
                    <label className="block text-sm font-body text-slate-400 mb-2">Rol <span className="text-neon-cyan">*</span></label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['admin','assistant','maintenance'] as StaffRole[]).map(r => (
                        <button key={r} type="button" onClick={() => setForm(f => ({...f, role: r}))}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            form.role === r ? 'border-neon-blue/35 bg-neon-blue/10' : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/4'
                          }`}>
                          <RoleBadge role={r}/>
                          <p className="text-[11px] text-slate-600 font-body mt-2 leading-snug">{ROLE_DESC[r].split('·')[0]}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-body text-slate-400 mb-1.5">Contraseña temporal <span className="text-neon-cyan">*</span></label>
                    <div className="relative">
                      <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"/>
                      <input
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="input-cosmos pl-10 pr-11"
                        placeholder="Mínimo 8 caracteres"
                        value={form.temp_password}
                        onChange={e => { setForm(f => ({...f, temp_password: e.target.value})); setPwdScore(zxcvbn(e.target.value).score) }}
                      />
                      <button type="button" onClick={() => setShowPwd(s => !s)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                        {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                      </button>
                    </div>

                    {form.temp_password && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {[0,1,2,3,4].map(i => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= pwdScore ? PWD_COLOR[pwdScore] : 'bg-cosmos-700'}`}/>
                          ))}
                        </div>
                        <p className={`text-xs font-body ${PWD_TEXT[pwdScore]}`}>{PWD_LABEL[pwdScore]}</p>
                      </div>
                    )}

                    <div className="mt-2 p-3 rounded-xl bg-neon-blue/5 border border-neon-blue/15">
                      <p className="text-xs text-slate-500 font-body flex items-center gap-1.5">
                        <Shield size={11} className="text-neon-blue flex-shrink-0"/>
                        OWASP A07: mínimo 12 caracteres, mayúsculas + números + símbolos.
                        El usuario debe cambiarla en su primer acceso.
                      </p>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-3 pt-1">
                    <NeonButton type="button" variant="secondary" className="flex-1" onClick={() => { setTab('staff'); setForm({ email: '', full_name: '', role: 'assistant', temp_password: '' }) }}>
                      Cancelar
                    </NeonButton>
                    <NeonButton type="submit" className="flex-1" loading={inviting}>
                      <UserPlus size={15}/>
                      {inviting ? 'Creando usuario…' : 'Crear Usuario'}
                    </NeonButton>
                  </div>

                </div>
              </SectionCard>
            </form>
          )}
        </div>
      )}

    </div>
  )
}
