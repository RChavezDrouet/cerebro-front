import React, { useRef } from 'react'

/**
 * TiltCard — "3D" effect (CSS perspective + mouse-based rotation)
 * - No WebGL. Works with strict TS and Tailwind.
 */
export default function TiltCard({
  children,
  className = '',
  maxTilt = 10,
}: {
  children: React.ReactNode
  className?: string
  maxTilt?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    const ry = (px - 0.5) * (maxTilt * 2)
    const rx = (0.5 - py) * (maxTilt * 2)
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
    el.style.setProperty('--glow-x', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--glow-y', `${(py * 100).toFixed(1)}%`)
  }

  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative rounded-2xl border transition-transform duration-150 will-change-transform ${className}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
        style={{
          background:
            'radial-gradient(600px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(255,255,255,0.18), transparent 40%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
