// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    strictPort: true,

    // Si quieres quitar el overlay rojo de Vite:
    // hmr: { overlay: false },

    headers: {
      // Nota: frame-ancestors NO funciona en meta; aquí sí funciona.
      'Content-Security-Policy': [
        "default-src 'self'",
        // Vite dev necesita ws + eval en algunos casos
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        // Permite llamadas a Supabase
        `connect-src 'self' https: wss:`,
        "img-src 'self' data: blob: https:",
        "frame-ancestors 'self'",
      ].join('; '),

      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  },
})