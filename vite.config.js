import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __PUBLIC_HOST__: JSON.stringify(process.env.VITE_PUBLIC_HOST || '192.168.100.21'),
    __SESSION_TTL_MINUTES__: JSON.stringify(process.env.VITE_SESSION_TTL_MINUTES || '600'),
  },
  server: {
    port: 5173,
    // Django serves the API; no CORS config needed on the backend.
    // proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
    proxy: {
      '/api': {
        // target: 'http://192.168.100.21:8001',
        target: 'http://127.0.0.1:8001',
        changeOrigin: true
        // no rewrite
      },
      // KYC report documents/photos come back as relative /media/... URLs —
      // serve them through the same Django host as the API.
      '/media': {
        // target: 'http://192.168.100.21:8001',
        target: 'http://127.0.0.1:8001',
        changeOrigin: true
      }
    },
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**']
    }
  },
})