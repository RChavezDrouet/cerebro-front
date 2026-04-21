import React from 'react'

type KPICardProps = {
  label: string
  value: string
  subtitle: string
  icon: React.ReactNode
  accentClass: string
  tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral'
  chip?: string
}

function toneBorder(tone: KPICardProps['tone']) {
  if (tone === 'good') return 'border-emerald-400/22'
  if (tone === 'warn') return 'border-amber-400/22'
  if (tone === 'bad') return 'border-rose-400/22'
  if (tone === 'info') return 'border-cyan-400/22'
  return 'border-white/10'
}

function KPICardComponent({
  label,
  value,
  subtitle,
  icon,
  accentClass,
  tone = 'neutral',
  chip,
}: KPICardProps) {
  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-[1.75rem] border bg-[#07111d]/88 p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 ${toneBorder(tone)}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentClass}`} />
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="relative flex min-h-[11rem] flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/46">{label}</p>
              {chip ? (
                <span className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72">
                  {chip}
                </span>
              ) : null}
            </div>
            <p className="text-[clamp(1.8rem,2vw,2.6rem)] font-semibold tracking-tight text-white">{value}</p>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.15rem] border border-white/10 bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
            {icon}
          </div>
        </div>

        <p className="mt-auto text-sm leading-6 text-white/62">{subtitle}</p>
      </div>
    </div>
  )
}

export const KPICard = React.memo(KPICardComponent)

export default KPICard
