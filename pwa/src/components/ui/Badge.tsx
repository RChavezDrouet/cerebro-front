import React from 'react'

export function Badge({ tone = 'neutral', children }: { tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral'; children: React.ReactNode }) {
  const cls =
    tone === 'good'
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
      : tone === 'warn'
        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
        : tone === 'bad'
          ? 'bg-rose-500/15 text-rose-200 border-rose-500/30'
          : tone === 'info'
            ? 'bg-sky-500/15 text-sky-200 border-sky-500/30'
            : 'bg-white/10 text-white/80 border-white/10'

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>
}
