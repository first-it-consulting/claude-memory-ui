import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Sessions page: served under /ui-api by the FastAPI proxy in production
      '/ui-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ui-api/, '/api'),
      },
      // Keycloak settings: served by the FastAPI proxy (python src/ui/app.py)
      '/ui-config.json': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
})
