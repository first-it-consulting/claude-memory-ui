import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build identity for the footer: the Dockerfile sets VITE_APP_VERSION/VITE_GIT_SHA;
// local dev falls back to package.json version (release-please keeps it bumped).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(
      process.env.VITE_APP_VERSION || pkg.version,
    ),
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(process.env.VITE_GIT_SHA || 'unknown'),
  },
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
