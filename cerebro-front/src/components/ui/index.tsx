import React from 'react'
import { Loader2 } from 'lucide-react'

// ── GlassCard ──────────────────────────────────────────────────
export function GlassCard({
  children,
  className = '',
  hover = true,
  glow,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: 'blue' | 'cyan' | 'violet' | 'green' | 'amber' | 'red'
  onClick?: () => void
}) {
  const glowMap = {
    blue:   'hover:shadow-neon-blue hover:border-neon-blue/20',
    cyan:   'hover:shadow-neon-cyan hover:border-neon-cyan/20',
    violet: 'hover:shadow-neon-violet hover:border-neon-violet/20',
    green:  'hover:border-neon-green/20',
    amber:  'hover:border-neon-amber/20',
    red:    'hover:border-neon-red/20',
  }
  return (
    <div
      onClick={onClick}
      className={`glass-card ${hover ? 'transition-all duration-300' : ''} ${glow ? glowMap[glow] : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

// ── StatCard ───────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
  icon,
  color = 'blue',
  loading = false,
  trend,
  onClick,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color?: 'blue' | 'cyan' | 'violet' | 'green' | 'amber' | 'red'
  loading?: boolean
  trend?: { value: number; positive: boolean }
  onClick?: () => void
}) {
  const colors = {
    blue:   { bg: 'bg-neon-blue/10',   border: 'border-neon-blue/20',   text: 'text-neon-blue',   glow: 'stat-card-blue' },
    cyan:   { bg: 'bg-neon-cyan/10',   border: 'border-neon-cyan/20',   text: 'text-neon-cyan',   glow: 'stat-card-cyan' },
    violet: { bg: 'bg-neon-violet/10', border: 'border-neon-violet/20', text: 'text-neon-violet', glow: 'stat-card-violet' },
    green:  { bg: 'bg-neon-green/10',  border: 'border-neon-green/20',  text: 'text-neon-green',  glow: 'stat-card-green' },
    amber:  { bg: 'bg-neon-amber/10',  border: 'border-neon-amber/20',  text: 'text-neon-amber',  glow: 'stat-card-amber' },
    red:    { bg: 'bg-neon-red/10',    border: 'border-neon-red/20',    text: 'text-neon-red',    glow: 'stat-card-red' },
  }
  const c = colors[color]
  return (
    <div
      onClick={onClick}
      className={`glass-card stat-card-glow ${c.glow} p-5 transition-all duration-300 hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
          <span className={c.text}>{icon}</span>
        </div>
        {trend && (
          <span className={`text-xs font-mono px-2 py-1 rounded-full ${trend.positive ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-neon-red/10 text-neon-red border border-neon-red/20'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      {loading ? (
        <div>
          <div className="h-8 w-24 shimmer rounded-lg mb-2" />
          <div className="h-3 w-16 shimmer rounded" />
        </div>
      ) : (
        <div>
          <p className={`text-3xl font-bold font-sans ${c.text} animate-count-up`}>{value}</p>
          <p className="text-sm text-slate-400 mt-1 font-body">{label}</p>
          {sub && <p className="text-xs text-slate-600 mt-0.5 font-body">{sub}</p>}
        </div>
      )}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'badge-active',
    paused:    'badge-paused',
    suspended: 'badge-suspended',
    draft:     'badge-draft',
    sent:      'badge-sent',
    paid:      'badge-paid',
    overdue:   'badge-overdue',
    cancelled: 'badge-draft',
  }
  const labels: Record<string, string> = {
    active:    'Activa',
    paused:    'Pausada',
    suspended: 'Suspendida',
    draft:     'Borrador',
    sent:      'Enviada',
    paid:      'Pagada',
    overdue:   'Vencida',
    cancelled: 'Cancelada',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium font-body ${map[status] || 'badge-draft'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {labels[status] || status}
    </span>
  )
}

// ── PageHeader ────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-8 gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-cyan flex-shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white font-sans">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5 font-body">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

// ── NeonButton ────────────────────────────────────────────────
export function NeonButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 font-body'
  const sizes = { sm: 'px-3 py-2 text-sm', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  const variants = {
    primary:   'btn-neon',
    secondary: 'bg-cosmos-750 border border-white/8 text-slate-300 hover:bg-cosmos-700 hover:border-white/12 hover:text-white',
    danger:    'bg-neon-red/10 border border-neon-red/25 text-neon-red hover:bg-neon-red/20 hover:shadow-lg hover:shadow-neon-red/20',
    ghost:     'text-slate-400 hover:text-white hover:bg-white/5',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

// ── InputField ────────────────────────────────────────────────
export function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  disabled,
  maxLength,
  pattern,
  autoComplete,
  error,
  hint,
  suffix,
  prefix,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  maxLength?: number
  pattern?: string
  autoComplete?: string
  error?: string
  hint?: string
  suffix?: React.ReactNode
  prefix?: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-400 mb-1.5 font-body">
        {label}{required && <span className="text-neon-cyan ml-1">*</span>}
      </label>
      <div className="relative">
        {prefix && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          pattern={pattern}
          autoComplete={autoComplete || (type === 'password' ? 'new-password' : type === 'email' ? 'email' : 'off')}
          className={`input-cosmos ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-10' : ''} ${error ? 'border-neon-red/40 focus:border-neon-red/60' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">{suffix}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-neon-red font-body">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-slate-600 font-body">{hint}</p>}
    </div>
  )
}

// ── SectionCard ───────────────────────────────────────────────
export function SectionCard({
  title,
  icon,
  children,
  accent,
  className = '',
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  accent?: 'blue' | 'cyan' | 'violet' | 'green'
  className?: string
}) {
  const accentColors = {
    blue:   'border-neon-blue/25',
    cyan:   'border-neon-cyan/25',
    violet: 'border-neon-violet/25',
    green:  'border-neon-green/25',
  }
  const textColors = {
    blue:   'text-neon-blue',
    cyan:   'text-neon-cyan',
    violet: 'text-neon-violet',
    green:  'text-neon-green',
  }
  return (
    <div className={`glass-card p-6 ${accent ? accentColors[accent] : ''} ${className}`}>
      <div className={`flex items-center gap-2 mb-5 pb-4 border-b border-white/5`}>
        {icon && <span className={accent ? textColors[accent] : 'text-neon-cyan'}>{icon}</span>}
        <h2 className={`text-sm font-semibold uppercase tracking-widest font-sans ${accent ? textColors[accent] : 'text-slate-400'}`}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className={`${s[size]} relative`}>
      <div className={`${s[size]} rounded-full border-2 border-neon-blue/20 border-t-neon-blue animate-spin`} />
      <div className={`absolute inset-1 rounded-full border border-neon-cyan/10 border-b-neon-cyan/30 animate-spin`} style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
    </div>
  )
}

// ── Convenience aliases (to keep pages concise) ───────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <GlassCard className={`p-5 ${className}`}>{children}</GlassCard>
}

export function Button({
  children,
  onClick,
  disabled,
  loading,
  variant,
  size,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <NeonButton onClick={onClick} disabled={disabled} loading={loading} variant={variant} size={size} className={className}>
      {children}
    </NeonButton>
  )
}

export function Input({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'text',
  disabled,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
  type?: string
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`input-cosmos ${className}`}
    />
  )
}

export function Select({
  value,
  onChange,
  children,
  className = '',
  disabled,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`input-cosmos ${className}`}
    >
      {children}
    </select>
  )
}

// ── FullPageLoader ────────────────────────────────────────────
export function FullPageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
      <Spinner size="lg" />
      <p className="text-slate-600 text-sm font-body animate-pulse">Cargando...</p>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cosmos-750 border border-white/5 flex items-center justify-center text-slate-600 mb-4">
        {icon}
      </div>
      <h3 className="text-white font-semibold font-sans mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm font-body max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
