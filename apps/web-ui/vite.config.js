import { defineConfig } from 'vite'

export default defineConfig({
  // Read .env files from the repo root instead of apps/web-ui/
  envDir: '../../',
})
