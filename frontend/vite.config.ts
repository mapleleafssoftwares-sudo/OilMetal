import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'deposito.png'],
      manifest: {
        name: 'OilMetal Certificaciones',
        short_name: 'OilMetal',
        description: 'Sistema de gestión y trazabilidad de certificados de materiales',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/auth':         { target: 'http://localhost:8001', changeOrigin: true },
      '/categorias':   { target: 'http://localhost:8001', changeOrigin: true },
      '/productos':    { target: 'http://localhost:8001', changeOrigin: true },
      '/certificados': { target: 'http://localhost:8001', changeOrigin: true },
      '/empresas':     { target: 'http://localhost:8001', changeOrigin: true },
    },
  },
})
