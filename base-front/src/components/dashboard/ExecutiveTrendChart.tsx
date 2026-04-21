import React from 'react'

import {
  formatNumber,
  type DashboardAttendanceChannelPoint,
} from '@/lib/dashboard/hrDashboard'

type ExecutiveTrendChartProps = {
  points: DashboardAttendanceChannelPoint[]
  contextLabel: string
}

type SvgPoint = {
  x: number
  y: number
}

function buildPath(points: SvgPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function buildAreaPath(points: SvgPoint[], baseline: number) {
  if (!points.length) return ''
  const start = points[0]
  const end = points[points.length - 1]
  return `${buildPath(points)} L ${end.x.toFixed(2)} ${baseline.toFixed(2)} L ${start.x.toFixed(2)} ${baseline.toFixed(2)} Z`
}

function buildPointX(index: number, total: number, leftPad: number, usableWidth: number) {
  if (total <= 1) return leftPad + usableWidth / 2
  const stepX = usableWidth / (total - 1)
  return leftPad + stepX * index
}

function TrendBadge({
  label,
  toneClass,
}: {
  label: string
  toneClass: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
      {label}
    </span>
  )
}

function SummaryTile({
  label,
  value,
  note,
  accentClass,
}: {
  label: string
  value: string
  note: string
  accentClass: string
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accentClass}`} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-white/58">{note}</p>
    </div>
  )
}

export function ExecutiveTrendChart({
  points,
  contextLabel,
}: ExecutiveTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)
  const gradientId = React.useId().replace(/:/g, '')

  const pointsKey = React.useMemo(
    () => points.map((point) => `${point.date}:${point.onsite}:${point.remote}:${point.facial}:${point.fingerprint}:${point.code}:${point.web}`).join('|'),
    [points],
  )

  React.useEffect(() => {
    setHoveredIndex(points.length ? points.length - 1 : null)
  }, [points.length, pointsKey])

  if (!points.length) {
    return (
      <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
        Aun no hay suficiente densidad de marcaciones para construir el pulso de canales.
      </div>
    )
  }

  const width = Math.max(points.length * 82, 780)
  const height = 330
  const leftPad = 26
  const rightPad = 24
  const topPad = 22
  const bottomPad = 54
  const usableWidth = width - leftPad - rightPad
  const usableHeight = height - topPad - bottomPad
  const baseline = height - bottomPad
  const maxValue = points.reduce((max, point) => Math.max(max, point.onsite, point.remote, 1), 1)
  const activeIndex = hoveredIndex ?? points.length - 1
  const activePoint = points[activeIndex] ?? points[points.length - 1]

  const series = [
    {
      key: 'onsite' as const,
      dot: '#e0f2fe',
      lineId: `${gradientId}-onsite-line`,
    },
    {
      key: 'remote' as const,
      dot: '#f5d0fe',
      lineId: `${gradientId}-remote-line`,
    },
  ]

  const buildSeriesPoints = (key: 'onsite' | 'remote') =>
    points.map<SvgPoint>((point, index) => ({
      x: buildPointX(index, points.length, leftPad, usableWidth),
      y: topPad + usableHeight - ((point[key] || 0) / maxValue) * usableHeight,
    }))

  const onsitePoints = buildSeriesPoints('onsite')
  const remotePoints = buildSeriesPoints('remote')
  const activeX = buildPointX(activeIndex, points.length, leftPad, usableWidth)
  const onsitePeak = points.reduce((best, point) => (point.onsite > best.onsite ? point : best), points[0])
  const remotePeak = points.reduce((best, point) => (point.remote > best.remote ? point : best), points[0])
  const totals = points.reduce(
    (acc, point) => {
      acc.onsite += point.onsite
      acc.remote += point.remote
      acc.facial += point.facial
      acc.fingerprint += point.fingerprint
      acc.code += point.code
      return acc
    },
    { onsite: 0, remote: 0, facial: 0, fingerprint: 0, code: 0 },
  )

  const dominantChannel = totals.onsite >= totals.remote ? 'Presencial dominante' : 'Remota dominante'
  const revealStyle = {
    transformOrigin: 'left center',
    animation: 'dashboardTrendReveal 980ms cubic-bezier(0.22, 1, 0.36, 1) 1 both',
  } satisfies React.CSSProperties

  return (
    <div className="rounded-[1.9rem] border border-white/10 bg-[#06101b]/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <style>
        {`
          @keyframes dashboardTrendReveal {
            0% { opacity: 0.18; transform: scaleX(0.06) translateY(16px); }
            100% { opacity: 1; transform: scaleX(1) translateY(0); }
          }
        `}
      </style>

      <div className="flex flex-wrap items-center gap-2">
        <TrendBadge label="Presencial = facial + huella + codigo" toneClass="border-cyan-400/20 bg-cyan-500/10 text-cyan-100" />
        <TrendBadge label="Web = marcacion remota" toneClass="border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100" />
        <TrendBadge label={contextLabel} toneClass="border-white/10 bg-white/5 text-white/65" />
        <TrendBadge label={dominantChannel} toneClass="border-emerald-400/20 bg-emerald-500/10 text-emerald-100" />
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg key={pointsKey} viewBox={`0 0 ${width} ${height}`} className="h-[19rem] w-full min-w-[36rem] sm:h-[21rem] sm:min-w-[42rem]">
          <defs>
            <linearGradient id={`${gradientId}-onsite-line`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#84cc16" />
            </linearGradient>
            <linearGradient id={`${gradientId}-remote-line`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id={`${gradientId}-onsite-fill`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.22)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </linearGradient>
            <linearGradient id={`${gradientId}-remote-fill`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(168,85,247,0.14)" />
              <stop offset="100%" stopColor="rgba(168,85,247,0)" />
            </linearGradient>
            <filter id={`${gradientId}-glow`}>
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Array.from({ length: 5 }).map((_, index) => {
            const y = topPad + (usableHeight / 4) * index
            const labelValue = Math.round(maxValue - (maxValue / 4) * index)

            return (
              <g key={index}>
                <line
                  x1={leftPad}
                  x2={width - rightPad}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="8 10"
                />
                <text
                  x={width - rightPad}
                  y={y - 7}
                  fill="rgba(255,255,255,0.34)"
                  fontSize="11"
                  textAnchor="end"
                >
                  {formatNumber(labelValue)}
                </text>
              </g>
            )
          })}

          <line x1={activeX} x2={activeX} y1={topPad} y2={baseline} stroke="rgba(255,255,255,0.16)" strokeDasharray="5 8" />

          <g style={revealStyle}>
            <path d={buildAreaPath(onsitePoints, baseline)} fill={`url(#${gradientId}-onsite-fill)`} />
            <path d={buildAreaPath(remotePoints, baseline)} fill={`url(#${gradientId}-remote-fill)`} />

            {series.map((serie) => {
              const pointsForSeries = serie.key === 'onsite' ? onsitePoints : remotePoints
              const path = buildPath(pointsForSeries)

              return (
                <g key={serie.key}>
                  <path
                    d={path}
                    fill="none"
                    stroke="rgba(15,23,42,0.78)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={serie.key === 'onsite' ? 10 : 9}
                    transform="translate(0 4)"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={`url(#${serie.lineId})`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={serie.key === 'onsite' ? 6 : 5}
                    filter={`url(#${gradientId}-glow)`}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="rgba(255,255,255,0.24)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.4"
                    transform="translate(0 -1.5)"
                  />
                  {pointsForSeries.map((point, index) => (
                    <circle
                      key={`${serie.key}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={index === activeIndex ? 6.2 : 4}
                      fill={serie.dot}
                      stroke={`url(#${serie.lineId})`}
                      strokeWidth={index === activeIndex ? 2.4 : 1.6}
                    />
                  ))}
                </g>
              )
            })}
          </g>

          {points.map((point, index) => (
            <g key={point.date}>
              <rect
                x={buildPointX(index, points.length, leftPad, usableWidth) - 20}
                y={topPad}
                width="40"
                height={usableHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(index)}
              />
              <text
                x={buildPointX(index, points.length, leftPad, usableWidth)}
                y={height - 15}
                fill={index === activeIndex ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.44)'}
                fontSize="11"
                textAnchor="middle"
              >
                {point.label}
              </text>
            </g>
          ))}

          {activePoint ? (
            <g transform={`translate(${Math.max(Math.min(activeX - 88, width - 208), 18)} 20)`}>
              <rect width="190" height="92" rx="18" fill="rgba(7,16,29,0.92)" stroke="rgba(255,255,255,0.14)" />
              <text x="18" y="24" fill="rgba(255,255,255,0.68)" fontSize="11">
                {activePoint.label}
              </text>
              <text x="18" y="46" fill="#e2e8f0" fontSize="13" fontWeight="600">
                Presencial {formatNumber(activePoint.onsite)}
              </text>
              <text x="18" y="64" fill="#f5d0fe" fontSize="12">
                Web {formatNumber(activePoint.remote)}
              </text>
              <text x="18" y="82" fill="rgba(255,255,255,0.58)" fontSize="11">
                Facial {formatNumber(activePoint.facial)} · Huella {formatNumber(activePoint.fingerprint)} · Codigo {formatNumber(activePoint.code)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <SummaryTile
          label="Presencial"
          value={formatNumber(totals.onsite)}
          note={`Pico ${onsitePeak.label} con ${formatNumber(onsitePeak.onsite)}`}
          accentClass="bg-cyan-300"
        />
        <SummaryTile
          label="Web"
          value={formatNumber(totals.remote)}
          note={`Pico ${remotePeak.label} con ${formatNumber(remotePeak.remote)}`}
          accentClass="bg-fuchsia-300"
        />
        <SummaryTile
          label="Facial / Huella"
          value={`${formatNumber(totals.facial)} / ${formatNumber(totals.fingerprint)}`}
          note="Canales presenciales dominantes dentro del periodo."
          accentClass="bg-emerald-300"
        />
        <SummaryTile
          label="Codigo"
          value={formatNumber(totals.code)}
          note="Refuerza accesos nocturnos y puntos de respaldo operativo."
          accentClass="bg-amber-300"
        />
      </div>
    </div>
  )
}
