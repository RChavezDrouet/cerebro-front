import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react_vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase_vendor: ['@supabase/supabase-js'],
          query_vendor: ['@tanstack/react-query'],
          chart_vendor: ['recharts'],
          export_vendor: ['xlsx', 'jspdf', 'html2canvas', 'file-saver'],
        },
      },
    },
  },
})
