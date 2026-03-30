export type BrandingColors = {
  primary_color?: string | null
  secondary_color?: string | null
  accent_color?: string | null
  button_radius?: number | string | null
  button_style?: string | null
  button_text_transform?: string | null
  surface_style?: string | null
  background_type?: string | null
  background_color?: string | null
  background_image_url?: string | null
  background_overlay_opacity?: number | string | null
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
  const backgroundColor = normalizeHex(branding.background_color as any) ?? '#020617'

  root.style.setProperty('--brand-primary', primary)
  root.style.setProperty('--brand-secondary', secondary)
  root.style.setProperty('--brand-accent', accent)
  root.style.setProperty('--background-color', backgroundColor)
  root.style.setProperty('--button-radius', `${Number(branding.button_radius ?? 18)}px`)
  root.style.setProperty('--button-style', String(branding.button_style || 'gradient'))
  root.style.setProperty('--button-text-transform', String(branding.button_text_transform || 'none'))
  root.style.setProperty('--surface-style', String(branding.surface_style || 'glass'))
  root.style.setProperty('--background-type', String(branding.background_type || 'gradient'))
  root.style.setProperty('--background-image-url', branding.background_image_url ? `url(${branding.background_image_url})` : 'none')
  root.style.setProperty('--background-overlay-opacity', String(Number(branding.background_overlay_opacity ?? 0.2)))

  if (typeof document !== 'undefined' && document.body) {
    document.body.dataset.buttonStyle = String(branding.button_style || 'gradient')
    document.body.dataset.backgroundType = String(branding.background_type || 'gradient')
    document.body.dataset.surfaceStyle = String(branding.surface_style || 'glass')
  }

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
