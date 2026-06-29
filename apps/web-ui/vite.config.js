import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

 
export default defineConfig({
  envDir: path.resolve(__dirname, '..', '..'),
  base: '/project-aura/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/aura-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/aura-api/, ''),
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  }
})