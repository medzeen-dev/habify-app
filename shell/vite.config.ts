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
})
