import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// habify30 Shell — build config.
// Hosting target: Catalyst Slate (DL-068). Two hard requirements from there:
//  1. Root base-path '/' (Slate serves from root, no prefix — Catalyst_Platform_Capabilities A3).
//  2. Hash-based asset file names, because Slate sends `cache-control: max-age=31536000`
//     on ALL resources incl. index.html (A5). Vite hashes assets by default in `build`,
//     which is exactly the mitigation the canon calls for.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // Dev only: proxy /api → Dev Catalyst Functions so the browser calls same-origin
  // (no CORS/preflight). Prod uses VITE_API_BASE against api.habify30.k-a-d-o.com,
  // where gateway CORS (Authorized Domains) must be configured — manual function
  // CORS does not cover the OPTIONS preflight on Catalyst.
  server: {
    proxy: {
      '/api': {
        target: 'https://habify30-20116360871.development.catalystserverless.eu/server',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
