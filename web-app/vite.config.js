import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT) || 5180,
    strictPort: true,
    proxy: {
      '/api': process.env.API_URL || 'http://localhost:4000',
    },
  },
})
