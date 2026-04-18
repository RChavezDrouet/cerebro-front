import React from 'react'

type ExecutiveGaugeProps = {
  value: number
  label: string
  subtitle?: string
  accentFrom?: string
  accentTo?: string
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180

  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  }
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ')
}

function formatGaugeValue(value: number) {
  return `${value.toFixed(1)}%`
}

export function ExecutiveGauge({
  value,
  label,
  subtitle,
  accentFrom = '#22c55e',
  accentTo = '#84cc16',
}: ExecutiveGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const gradientId = React.useId().replace(/:/g, '')
  const trackPath = describeArc(130, 138, 96, 180, 0)
  const progressAngle = 180 - (clamped / 100) * 180
  const progressPath = describeArc(130, 138, 96, 180, progressAngle)
  const markerPoint = polarToCartesian(130, 138, 96, progressAngle)
  const targetAngle = 180 - 93 * 1.8
  const targetInner = polarToCartesian(130, 138, 82, targetAngle)
  const targetOuter = polarToCartesian(130, 138, 108, targetAngle)

  const tone =
    clamped >= 93 ? 'Controlado'
      : clamped >= 88 ? 'Seguimiento'
        : 'Riesgo'

  const toneClass =
    clamped >= 93 ? 'text-emerald-300'
      : clamped >= 88 ? 'text-amber-300'
        : 'text-rose-300'

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#09111b]/84 px-4 py-5 shadow-soft">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%)]" />
      <div className="absolute inset-x-10 top-3 h-20 rounded-full bg-emerald-400/8 blur-3xl" />

      <div className="relative">
        <svg viewBox="0 0 260 190" className="mx-auto h-64 w-full max-w-[23rem]">
          <defs>
            <linearGradient id={`${gradientId}-track`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="32%" stopColor="#f59e0b" />
              <stop offset="68%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id={`${gradientId}-progress`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor={accentFrom} />
              <stop offset="100%" stopColor={accentTo} />
            </linearGradient>
            <filter id={`${gradientId}-glow`}>
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Array.from({ length: 7 }).map((_, index) => {
            const angle = 180 - index * 30
            const outer = polarToCartesian(130, 138, 110, angle)
            const inner = polarToCartesian(130, 138, 94, angle)

            return (
              <line
                key={index}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.18)"
                strokeLinecap="round"
                strokeWidth="2.2"
              />
            )
          })}

          <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeLinecap="round" strokeWidth="22" />
          <path
            d={progressPath}
            fill="none"
            stroke={`url(#${gradientId}-progress)`}
            strokeLinecap="round"
            strokeWidth="22"
            filter={`url(#${gradientId}-glow)`}
          />
          <path
            d={trackPath}
            fill="none"
            stroke={`url(#${gradientId}-track)`}
            strokeLinecap="round"
            strokeWidth="4"
            opacity="0.28"
          />

          <line
            x1={targetInner.x}
            y1={targetInner.y}
            x2={targetOuter.x}
            y2={targetOuter.y}
            stroke="rgba(255,255,255,0.65)"
            strokeLinecap="round"
            strokeWidth="3"
          />

          <circle
            cx={markerPoint.x}
            cy={markerPoint.y}
            r="8.5"
            fill="#f8fafc"
            stroke={`url(#${gradientId}-progress)`}
            strokeWidth="4"
            filter={`url(#${gradientId}-glow)`}
          />

          <circle cx="130" cy="138" r="58" fill="rgba(7,16,29,0.96)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <circle cx="130" cy="138" r="44" fill="rgba(255,255,255,0.02)" />

          <text x="130" y="112" fill="rgba(255,255,255,0.52)" fontSize="12" textAnchor="middle">
            {label}
          </text>
          <text x="130" y="143" fill="#ffffff" fontSize="34" fontWeight="700" textAnchor="middle">
            {formatGaugeValue(clamped)}
          </text>
          <text x="130" y="165" className={toneClass} fill="currentColor" fontSize="12" fontWeight="600" textAnchor="middle">
            {tone}
          </text>

          <text x="26" y="150" fill="rgba(255,255,255,0.36)" fontSize="11">
            0
          </text>
          <text x="130" y="32" fill="rgba(255,255,255,0.50)" fontSize="11" textAnchor="middle">
            Meta 93
          </text>
          <text x="234" y="150" fill="rgba(255,255,255,0.36)" fontSize="11" textAnchor="end">
            100
          </text>
        </svg>

        <div className="mt-1 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-white/40">
          <span>Critico</span>
          <span>Zona objetivo</span>
          <span>Optimo</span>
        </div>

        {subtitle ? (
          <p className="mt-3 text-center text-sm text-white/58">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
