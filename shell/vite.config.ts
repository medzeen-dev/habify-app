import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = import.meta.dirname

// habify30 Shell — build config.
// Hosting target: Catalyst Slate (DL-068). Two hard requirements from there:
//  1. Root base-path '/' (Slate serves from root, no prefix — Catalyst_Platform_Capabilities A3).
//  2. Hash-based asset file names, because Slate sends `cache-control: max-age=31536000`
//     on ALL resources incl. index.html (A5). Vite hashes assets by default in `build`,
//     which is exactly the mitigation the canon calls for.
//
// Two entries, built SEPARATELY and never into the same output:
//  - index.html → the uid-aware Shell (src/main.tsx)          — `npm run build`      → dist/
//  - peer.html  → the pid-only peer-group context (DL-053)     — `npm run build:peer` → dist-peer/
// Each output goes to its own Slate app on its own origin, so the browser's per-origin
// localStorage isolation makes the Shell's uid physically unreadable from the peer
// context — the hard DPO boundary DL-036/DL-053 intend, made structural by DL-086.
// Building them together would put both entries on both origins: the Shell would then be
// reachable under the peer origin and could write its own h30.state there, which turns
// the guarantee back into a code convention. Hence: one entry per build.
// The peer build lives in vite.config.peer.ts and emits peer.html as that app's index.html.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: { main: `${root}/index.html` },
    },
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
