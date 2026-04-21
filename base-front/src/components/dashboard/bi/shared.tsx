import React from 'react'

import { Badge } from '@/components/ui/Badge'

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-EC', {
    notation: 'compact',
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: value >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)}%`
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDateLabel(value: string) {
  if (!value) return 'Sin fecha'

  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
  }).format(parsed)
}

export function truncateChartLabel(value: string, max = 14) {
  const normalized = String(value ?? '').trim()
  if (normalized.length <= max) return normalized
  if (max <= 3) return normalized.slice(0, max)
  return `${normalized.slice(0, Math.max(max - 3, 1)).trimEnd()}...`
}

export function toneDotClass(tone: 'good' | 'warn' | 'bad' | 'info' | 'neutral') {
  if (tone === 'good') return 'bg-emerald-400'
  if (tone === 'warn') return 'bg-amber-400'
  if (tone === 'bad') return 'bg-rose-400'
  if (tone === 'info') return 'bg-cyan-400'
  return 'bg-white/40'
}

export function toneBadge(tone: 'good' | 'warn' | 'bad' | 'info' | 'neutral', label: string) {
  return <Badge tone={tone}>{label}</Badge>
}

export function EmptyPanel({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-white/12 bg-white/5 px-6 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-lg text-sm leading-6 text-white/58">{description}</p>
    </div>
  )
}

export function SkeletonPanel({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[1.8rem] border border-white/10 bg-white/6 ${className}`} />
  )
}

export function ChartTooltipCard({
  label,
  lines,
}: {
  label: string
  lines: Array<{ colorClass: string; label: string; value: string }>
}) {
  return (
    <div className="max-w-[16rem] min-w-[12rem] rounded-2xl border border-white/10 bg-[#081320]/95 px-3 py-2 shadow-soft backdrop-blur">
      <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/45" title={label}>
        {label}
      </div>
      <div className="mt-2 space-y-1.5">
        {lines.map((line) => (
          <div key={`${line.label}-${line.value}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex min-w-0 items-center gap-2 text-white/72">
              <span className={`h-2.5 w-2.5 rounded-full ${line.colorClass}`} />
              <span className="truncate">{line.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-white">{line.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
