export type BrandingColors = {
  primary_color?: string | null
  secondary_color?: string | null
  accent_color?: string | null
}

const isHex = (v: string) => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v)

const normalizeHex = (v?: string | null): string | null => {
  if (!v) return null
  const s = v.trim()
  if (!isHex(s)) return null
  if (s.length === 4) {
    // #rgb -> #rrggbb
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  }
  return s
}

/**
 * Aplica las variables CSS de branding.
 * Nota UX: se aplica a :root, por lo que impacta Login + App.
 */
export const applyBranding = (branding: BrandingColors) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  const primary = normalizeHex(branding.primary_color) ?? '#00e673'
  const secondary = normalizeHex(branding.secondary_color) ?? '#00b3ff'
  const accent = normalizeHex(branding.accent_color) ?? '#7c3aed'

  root.style.setProperty('--brand-primary', primary)
  root.style.setProperty('--brand-secondary', secondary)
  root.style.setProperty('--brand-accent', accent)

  // Focus ring: usar primary con alpha
  root.style.setProperty('--ring', hexToRgba(primary, 0.35))
}

export const hexToRgba = (hex: string, alpha = 1) => {
  const n = normalizeHex(hex) ?? '#000000'
  const r = parseInt(n.slice(1, 3), 16)
  const g = parseInt(n.slice(3, 5), 16)
  const b = parseInt(n.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
