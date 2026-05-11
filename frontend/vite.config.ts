import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':         { target: 'http://localhost:8000', changeOrigin: true },
      '/categorias':   { target: 'http://localhost:8000', changeOrigin: true },
      '/productos':    { target: 'http://localhost:8000', changeOrigin: true },
      '/certificados': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
