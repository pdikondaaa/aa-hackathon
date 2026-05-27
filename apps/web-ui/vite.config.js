import path from 'path'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  envDir: path.resolve(__dirname, '..', '..'),
  plugins: [],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  }
})