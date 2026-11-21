/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Build identity injected by the Dockerfile (VITE_APP_VERSION/VITE_GIT_SHA);
  // vite.config.ts falls back to package.json version + 'unknown' in dev.
  readonly VITE_APP_VERSION?: string
  readonly VITE_GIT_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
