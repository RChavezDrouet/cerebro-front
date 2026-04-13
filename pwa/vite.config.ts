// vite.config.ts — HRCloud Base PWA
// v2.2: HTTPS con mkcert para pruebas en móvil Android/iOS
// Cambios respecto a v2.1:
//   - basicSsl eliminado — reemplazado por mkcert (certificado real confiable)
//   - server.https apunta a los certificados generados por mkcert
//   - devOptions.enabled: false (no necesitamos SW en dev, solo HTTPS)

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      devOptions: {
        enabled: false,
        type: 'module',
      },

      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png',
      ],

      manifest: {
        name: 'HRCloud - Marcación Remota',
        short_name: 'HRCloud',
        description: 'Sistema de Marcación de Asistencia para Personal Remoto — HRCloud',
        theme_color: '#0f0a1e',
        background_color: '#0f0a1e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'es',

        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],

        categories: ['business', 'productivity'],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/rest\//,
          /^\/auth\//,
          /^\/storage\//,
          /^\/functions\//,
        ],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/(rest|auth|storage)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-v1',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fonts-v1',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],

        navigateFallbackAllowlist: [/^(?!\/__).*/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: true,
    port: 5174,
    https: {
      key: fs.readFileSync('./192.168.100.237+2-key.pem'),
      cert: fs.readFileSync('./192.168.100.237+2.pem'),
    },
  },
})