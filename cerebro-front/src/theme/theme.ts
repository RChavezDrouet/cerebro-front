export type ThemeMode = 'light' | 'dark' | 'system'
export type PaletteKey = 'default' | 'charcoal' | 'navy' | 'emerald' | 'indigo'

export const PALETTES: Record<PaletteKey, { name: string; primary: string; secondary: string; accent: string }> = {
  default:  { name: 'Default',  primary: '#2563ff', secondary: '#06e6ff', accent: '#22c55e' },
  charcoal: { name: 'Charcoal', primary: '#06b6d4', secondary: '#2563ff', accent: '#22c55e' },
  navy:     { name: 'Navy',     primary: '#1d4ed8', secondary: '#0ea5e9', accent: '#22c55e' },
  emerald:  { name: 'Emerald',  primary: '#059669', secondary: '#f59e0b', accent: '#22c55e' },
  indigo:   { name: 'Indigo',   primary: '#4f46e5', secondary: '#fb7185', accent: '#22c55e' },
}

export function getSystemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(mode: ThemeMode, palette: PaletteKey) {
  const root = document.documentElement
  const isDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark())
  root.classList.toggle('dark', isDark)

  const p = PALETTES[palette] ?? PALETTES.default
  root.style.setProperty('--brand-primary', p.primary)
  root.style.setProperty('--brand-secondary', p.secondary)
  root.style.setProperty('--brand-accent', p.accent)

  // limited background set (day/night)
  root.style.setProperty('--bg-page', isDark ? '#04050d' : '#f8fafc')
  root.style.setProperty('--bg-panel', isDark ? 'rgba(9,14,31,0.75)' : 'rgba(255,255,255,0.92)')
  root.style.setProperty('--text-page', isDark ? '#e5e7eb' : '#0f172a')
}
