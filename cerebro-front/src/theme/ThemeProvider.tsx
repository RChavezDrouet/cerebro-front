import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applyTheme, PaletteKey, ThemeMode } from './theme'

type ThemeCtx = {
  mode: ThemeMode
  palette: PaletteKey
  setMode: (m: ThemeMode) => void
  setPalette: (p: PaletteKey) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

const LS_MODE = 'cerebro_theme_mode'
const LS_PALETTE = 'cerebro_theme_palette'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => (localStorage.getItem(LS_MODE) as ThemeMode) || 'dark')
  const [palette, setPaletteState] = useState<PaletteKey>(() => (localStorage.getItem(LS_PALETTE) as PaletteKey) || 'default')

  useEffect(() => {
    applyTheme(mode, palette)
    localStorage.setItem(LS_MODE, mode)
    localStorage.setItem(LS_PALETTE, palette)
  }, [mode, palette])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(mode, palette)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [mode, palette])

  const value = useMemo(() => ({
    mode,
    palette,
    setMode: setModeState,
    setPalette: setPaletteState,
  }), [mode, palette])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
