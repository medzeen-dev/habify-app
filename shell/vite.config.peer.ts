import { defineConfig } from 'vite'

import baseConfig from './vite.config'

const root = import.meta.dirname

// Peer-group build (DL-086 origin isolation, concretised 2026-09-08).
//
// Separate config rather than a `--mode` switch on purpose: `--mode peer` would also
// change which .env file Vite loads, so a later `.env.production` (VITE_API_BASE lives
// there) would silently be skipped for this build. A config file keeps mode=production.
//
// Output: dist-peer/, containing ONLY the peer entry and its assets. The Shell is not
// built here and must never be deployed to this origin — that is the whole point of the
// split (see vite.config.ts). `npm run build:peer` renames peer.html to index.html
// afterwards, so the peer Slate app serves the pages at its root and the mail links stay
// short: PEER_ORIGIN/?token=…#/abmelden
export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    outDir: 'dist-peer',
    emptyOutDir: true,
    rollupOptions: {
      input: { peer: `${root}/peer.html` },
    },
  },
})
