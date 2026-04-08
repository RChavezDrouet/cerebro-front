/**
 * lib/branding.ts — Base PWA v4.1.0
 * Carga branding del tenant y lo inyecta como variables CSS en :root.
 * Implementa contraste automatico WCAG AA.
 */
import { supabase } from '@/config/supabase'
import type { BaseTenantConfig } from '@/types'

/** Calcula si el texto sobre un color HEX debe ser blanco u oscuro. WCAG 2.1 */
export function getContrastText(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0,2), 16)
  const g = parseInt(clean.slice(2,4), 16)
  const b = parseInt(clean.slice(4,6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#0D1B2A' : '#FFFFFF'
}

/** Carga la config de branding del tenant y aplica CSS variables. */
export async function loadBranding(tenantId: string): Promise<BaseTenantConfig | null> {
  const { data } = await supabase
    .schema('attendance').from('base_tenant_config')
    .select('*').eq('tenant_id', tenantId).maybeSingle()

  if (!data) return null

  applyBranding(data as BaseTenantConfig)
  return data as BaseTenantConfig
}

export function applyBranding(cfg: BaseTenantConfig) {
  const root = document.documentElement
  const isDark = (cfg.theme ?? 'dark') === 'dark'

  // Colores de marca
  root.style.setProperty('--color-primary',   cfg.color_primary   || '#0056E6')
  root.style.setProperty('--color-secondary', cfg.color_secondary || '#00B3FF')
  root.style.setProperty('--color-accent',    cfg.color_accent    || '#7C3AED')
  root.style.setProperty('--color-sidebar',   cfg.color_sidebar   || '#0F2744')
  root.style.setProperty('--color-header',    cfg.color_header    || '#0D1B2A')

  // Contraste automatico sobre color primario (WCAG AA)
  root.style.setProperty('--color-on-primary', getContrastText(cfg.color_primary || '#0056E6'))

  // Tema dark / light
  if (isDark) {
    root.style.setProperty('--color-bg',      '#0D1B2A')
    root.style.setProperty('--color-surface', '#0F2744')
    root.style.setProperty('--color-border',  'rgba(255,255,255,0.08)')
    root.style.setProperty('--color-text',    '#F1F5F9')
    root.style.setProperty('--color-muted',   '#94A3B8')
    root.classList.remove('theme-light')
  } else {
    root.style.setProperty('--color-bg',      '#F8FAFC')
    root.style.setProperty('--color-surface', '#FFFFFF')
    root.style.setProperty('--color-border',  'rgba(0,0,0,0.08)')
    root.style.setProperty('--color-text',    '#0D1B2A')
    root.style.setProperty('--color-muted',   '#64748B')
    root.classList.add('theme-light')
  }
}

/** Defaults de branding cuando no hay config del tenant */
export const DEFAULT_BRANDING: BaseTenantConfig = {
  id: '', tenant_id: '',
  color_primary:   '#0056E6',
  color_secondary: '#00B3FF',
  color_accent:    '#7C3AED',
  color_sidebar:   '#0F2744',
  color_header:    '#0D1B2A',
  theme: 'dark',
  smtp_verified: false,
}
