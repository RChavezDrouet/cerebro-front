import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../App'
import { supabase } from '../../config/supabase'
import { formatSupabaseError } from '../../utils/supabaseErrors'

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: Array<'admin' | 'assistant' | 'maintenance'>
  permission?: string
}

type MessageRow = {
  id: string
  title: string
  body: string
  priority: 'normal' | 'urgent'
  created_at: string
}

type ComposeDraft = {
  title: string
  body: string
  priority: 'normal' | 'urgent'
  target_roles: Array<'all' | 'admin' | 'assistant' | 'maintenance'>
  email_all_tenants: boolean
  email_internal: boolean
}

const roleLabel = (role: string | null) => {
  if (role === 'admin') return 'Administrador'
  if (role === 'assistant') return 'Asistente'
  if (role === 'maintenance') return 'Mantenimiento'
  return '—'
}

const RoleChip = ({ role }: { role: string | null }) => {
  const isAdmin = role === 'admin'
  const isAssistant = role === 'assistant'
  const isMaintenance = role === 'maintenance'

  const cls = isAdmin
    ? 'bg-[rgba(0,230,115,0.12)] text-[rgba(0,230,115,0.95)] border-[rgba(0,230,115,0.18)]'
    : isAssistant
      ? 'bg-[rgba(0,179,255,0.12)] text-[rgba(0,179,255,0.95)] border-[rgba(0,179,255,0.18)]'
      : isMaintenance
        ? 'bg-[rgba(124,58,237,0.12)] text-[rgba(124,58,237,0.95)] border-[rgba(124,58,237,0.18)]'
        : 'bg-[rgba(148,163,184,0.12)] text-slate-200 border-[rgba(148,163,184,0.18)]'

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--brand-primary)' }} />
      {roleLabel(role)}
    </span>
  )
}

const NavItemLink = ({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) => {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
          'border border-transparent',
          isActive
            ? 'bg-[rgba(15,23,42,0.65)] border-[rgba(0,230,115,0.22)] shadow-[0_0_0_1px_rgba(0,230,115,0.08),0_16px_40px_-18px_rgba(0,0,0,0.65)]'
            : 'text-slate-300 hover:bg-[rgba(15,23,42,0.55)] hover:text-slate-100',
        ].join(' ')
      }
    >
      <item.icon className="h-5 w-5 opacity-80 group-hover:opacity-100" />
      <span>{item.label}</span>
    </NavLink>
  )
}

const MessagesPopover = ({ role, userId }: { role: string | null; userId: string | null }) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const unreadCount = useMemo(() => {
    if (!messages.length) return 0
    return messages.reduce((acc, m) => acc + (readIds.has(m.id) ? 0 : 1), 0)
  }, [messages, readIds])

  const load = async () => {
    if (!role || !userId) return
    setLoading(true)
    try {
      // mensajes para el rol + mensajes globales (target_roles incluye 'all')
      const or = `target_roles.cs.{${role}},target_roles.cs.{all}`
      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .select('id,title,body,priority,created_at')
        .or(or)
        .order('created_at', { ascending: false })
        .limit(10)

      if (msgErr) throw msgErr
      setMessages((msgData || []) as MessageRow[])

      const { data: readData, error: readErr } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', userId)

      if (readErr) {
        // no bloquear UI
        console.warn('No se pudo leer message_reads:', readErr.message)
        setReadIds(new Set())
      } else {
        setReadIds(new Set((readData || []).map((r: any) => r.message_id)))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const markRead = async (messageId: string) => {
    if (!userId) return
    setReadIds((prev) => new Set([...Array.from(prev), messageId]))
    const { error } = await supabase.from('message_reads').upsert(
      [{ user_id: userId, message_id: messageId, read_at: new Date().toISOString() }],
      { onConflict: 'user_id,message_id' },
    )
    if (error) {
      console.warn('No se pudo marcar leído:', error.message)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.45)] text-slate-200 hover:bg-[rgba(15,23,42,0.65)]"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-extrabold text-slate-950 shadow-glow-primary">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-[rgba(148,163,184,0.16)] bg-[rgba(2,6,23,0.85)] backdrop-blur-xl shadow-soft-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-300" />
              <p className="text-sm font-semibold text-slate-100">Mensajes</p>
            </div>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-2xl text-slate-300 hover:bg-[rgba(148,163,184,0.12)]"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Cargando…</div>
            ) : messages.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Sin mensajes</div>
            ) : (
              <div className="divide-y divide-[rgba(148,163,184,0.10)]">
                {messages.map((m) => {
                  const unread = !readIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => markRead(m.id)}
                      className="w-full px-4 py-3 text-left hover:bg-[rgba(148,163,184,0.06)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {m.priority === 'urgent' && (
                              <span className="rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)] px-2 py-0.5 text-[10px] font-bold text-[rgba(239,68,68,0.95)]">
                                URGENTE
                              </span>
                            )}
                            <p className={`text-sm font-semibold ${unread ? 'text-slate-50' : 'text-slate-200'}`}>{m.title}</p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-400">{m.body}</p>
                        </div>
                        {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--brand-primary)' }} />}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">{new Date(m.created_at).toLocaleString()}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-3 text-right">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                toast('Centro de mensajes (próximamente)', { icon: '💬' })
                setOpen(false)
              }}
            >
              Ver todo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const ComposeMessageModal = ({
  open,
  onClose,
  role,
  userEmail,
}: {
  open: boolean
  onClose: () => void
  role: string | null
  userEmail: string | null
}) => {
  const [draft, setDraft] = useState<ComposeDraft>({
    title: '',
    body: '',
    priority: 'normal',
    target_roles: ['all'],
    email_all_tenants: role === 'admin',
    email_internal: true,
  })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft({
      title: '',
      body: '',
      priority: 'normal',
      target_roles: ['all'],
      email_all_tenants: role === 'admin',
      email_internal: true,
    })
  }, [open, role])

  const toggleRole = (r: ComposeDraft['target_roles'][number]) => {
    setDraft((p) => {
      const has = p.target_roles.includes(r)
      const next = has ? p.target_roles.filter((x) => x !== r) : [...p.target_roles, r]
      // si queda vacío, volvemos a all
      return { ...p, target_roles: next.length ? next : ['all'] }
    })
  }

  const send = async () => {
    if (!draft.title.trim()) return toast.error('Título requerido')
    if (!draft.body.trim()) return toast.error('Mensaje requerido')

    setSending(true)
    try {
      // 1) Mensaje in-app
      const { error: msgErr } = await supabase.from('messages').insert({
        title: draft.title.trim(),
        body: draft.body.trim(),
        priority: draft.priority,
        target_roles: draft.target_roles,
        created_by: userEmail,
      })
      if (msgErr) throw msgErr

      // 2) Email (solo admin; a todos los tenants + roles internos)
      if (role === 'admin' && (draft.email_all_tenants || draft.email_internal)) {
        const { error: fnErr, data } = await supabase.functions.invoke('broadcast-email', {
          body: {
            title: draft.title.trim(),
            body: draft.body.trim(),
            priority: draft.priority,
            send_to_tenants: !!draft.email_all_tenants,
            send_to_internal: !!draft.email_internal,
            internal_roles: draft.target_roles.includes('all')
              ? ['admin', 'assistant', 'maintenance']
              : draft.target_roles.filter((x) => x !== 'all'),
          },
        })
        if (fnErr) {
          toast('Mensaje creado, pero falló envío de correo. Revisa Edge Function/SMTP.', { icon: '⚠️' })
          console.warn('broadcast-email error', fnErr)
        } else {
          const sent = (data as any)?.sent ?? null
          if (sent != null) toast.success(`Correo enviado (${sent})`)
        }
      }

      toast.success('Mensaje enviado')
      onClose()
    } catch (e: any) {
      const f = formatSupabaseError(e)
      toast.error(`${f.title}: ${f.hint}`)
      console.error('messages insert / broadcast-email error:', e)
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[rgba(148,163,184,0.16)] bg-[rgba(2,6,23,0.92)] backdrop-blur-xl shadow-soft-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(148,163,184,0.12)]">
          <div>
            <p className="text-sm text-slate-400">Nuevo mensaje</p>
            <h3 className="text-lg font-semibold text-slate-100">Comunicación interna (y opcionalmente email)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-300 hover:bg-[rgba(148,163,184,0.12)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="input-label">Título</label>
            <input className="input-field" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Mensaje</label>
            <textarea className="input-field min-h-[120px]" value={draft.body} onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Prioridad</label>
              <select className="input-field" value={draft.priority} onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value as any }))}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="input-label">Destino (roles in-app)</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'admin', 'assistant', 'maintenance'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={
                      draft.target_roles.includes(r)
                        ? 'px-3 py-1.5 rounded-full text-xs font-bold bg-[rgba(0,230,115,0.14)] border border-[rgba(0,230,115,0.20)] text-[rgba(0,230,115,0.95)]'
                        : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-[rgba(148,163,184,0.08)] border border-[rgba(148,163,184,0.16)] text-slate-200 hover:bg-[rgba(148,163,184,0.12)]'
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {role === 'admin' && (
            <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Envío por correo (SMTP global)</div>
                  <div className="text-xs text-slate-400">Requiere Edge Function broadcast-email + SMTP configurado.</div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={draft.email_all_tenants} onChange={(e) => setDraft((p) => ({ ...p, email_all_tenants: e.target.checked }))} />
                    Enviar a todos los tenants (tenants.contact_email)
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={draft.email_internal} onChange={(e) => setDraft((p) => ({ ...p, email_internal: e.target.checked }))} />
                    Enviar a usuarios internos (user_roles)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[rgba(148,163,184,0.12)] flex items-center justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={send} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const {userRole, user, signOut, isAdmin, isAssistant, can} = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    // Persistir ruta (evita volver al dashboard tras refresh)
    try {
      const p = location.pathname + location.search
      if (p && p !== '/login') window.localStorage.setItem('cerebro:last_path', p)
    } catch {
      // ignore
    }
  }, [location.pathname, location.search])

  const navItems: NavItem[] = useMemo(
  () => [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tenants', label: 'Clientes', icon: Users, permission: 'clients.view' },
    { to: '/invoices', label: 'Facturación', icon: FileText, permission: 'invoices.view' },
    { to: '/audit', label: 'Auditoría', icon: Shield, permission: 'audit.view' },
    { to: '/settings', label: 'Config', icon: Settings, permission: 'settings.view' },
  ],
  [],
)

  const visibleNav = navItems.filter((i) => {
    if (i.permission) return typeof can === 'function' ? can(i.permission) : false
    if (i.roles) return userRole ? i.roles.includes(userRole as any) : false
    return true
  })

  const userId = user?.id ?? null

  const onLogout = async () => {
    await signOut()
    toast.success('Sesión cerrada')
  }

  const headerTitle = isAdmin ? 'Panel Administrador' : isAssistant ? 'Panel Asistente' : 'Panel'

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(0,230,115,0.10),transparent_55%),radial-gradient(900px_520px_at_80%_20%,rgba(0,179,255,0.12),transparent_58%),radial-gradient(700px_420px_at_60%_90%,rgba(124,58,237,0.10),transparent_55%),linear-gradient(180deg,#020617,#050b1a 48%,#020617)]">
      <ComposeMessageModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        role={userRole}
        userEmail={user?.email ?? null}
      />

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-[rgba(148,163,184,0.10)] bg-[rgba(2,6,23,0.55)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.45)] text-slate-200"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-100">{import.meta.env.VITE_APP_NAME || 'Cerebro'}</p>
            <p className="text-[11px] text-slate-400">{headerTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || isAssistant) && (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.45)] text-slate-200 hover:bg-[rgba(15,23,42,0.65)]"
                aria-label="Nuevo mensaje"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            )}
            <MessagesPopover role={userRole} userId={userId} />
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[min(86vw,340px)] border-r border-[rgba(148,163,184,0.12)] bg-[rgba(2,6,23,0.90)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="text-sm font-extrabold text-slate-100">{import.meta.env.VITE_APP_NAME || 'Cerebro'}</p>
                <p className="text-xs text-slate-400">{headerTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-200 hover:bg-[rgba(148,163,184,0.10)]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pb-4">
              <RoleChip role={userRole} />
            </div>

            <nav className="px-3 space-y-1">
              {visibleNav.map((it) => (
                <NavItemLink key={it.to} item={it} onNavigate={() => setMobileOpen(false)} />
              ))}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-[rgba(148,163,184,0.12)]">
              <button type="button" onClick={onLogout} className="btn-secondary w-full justify-center">
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop shell */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6">
            <div className="rounded-3xl border border-[rgba(148,163,184,0.14)] bg-[rgba(2,6,23,0.55)] backdrop-blur-xl shadow-soft-xl">
              <div className="px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-slate-100">{import.meta.env.VITE_APP_NAME || 'Cerebro'}</p>
                    <p className="text-xs text-slate-400">{headerTitle}</p>
                  </div>
                  <div className="h-10 w-10 rounded-2xl" style={{ background: 'linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))' }} />
                </div>
                <div className="mt-4">
                  <RoleChip role={userRole} />
                </div>
              </div>

              <nav className="px-3 pb-3 space-y-1">
                {visibleNav.map((it) => (
                  <NavItemLink key={it.to} item={it} />
                ))}
              </nav>

              <div className="px-5 py-4 border-t border-[rgba(148,163,184,0.12)] flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{user?.email || '—'}</p>
                  <p className="text-[11px] text-slate-500 truncate">Sesión activa</p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.45)] text-slate-200 hover:bg-[rgba(15,23,42,0.65)]"
                  aria-label="Salir"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString()}</p>
              <h1 className="text-2xl font-extrabold text-slate-50">{headerTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              {(isAdmin || isAssistant) && (
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2"
                  onClick={() => setComposeOpen(true)}
                >
                  <MessageSquare className="h-4 w-4" />
                  Nuevo mensaje
                </button>
              )}
              <MessagesPopover role={userRole} userId={userId} />
              <div className="h-10 w-10 rounded-2xl border border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.45)]" />
            </div>
          </div>

          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  )
}
