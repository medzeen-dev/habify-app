import { defineConfig } from 'vite'

import baseConfig from './vite.config'

const root = import.meta.dirname

// Peer-group build (DL-086 origin isolation, concretised 2026-09-08).
//
// A separate config rather than a `--mode peer` switch on purpose: what this file
// encodes is the *entry and output* split (peer.html -> dist-peer/), which a mode cannot
// express. That leaves mode free for the one thing it is good at, picking the .env file:
//   npm run build:peer      -> mode=production -> .env.production  (Prod gateway)
//   npm run build:peer:dev  -> mode=devbackend -> .env.devbackend  (Dev backend URL)
// Both are production builds -- only VITE_API_BASE differs, because Development and
// Production are separate Slate apps on separate origins in front of separate backends.
// Do not name the second mode `development`: that flips NODE_ENV and would ship an
// unminified React development bundle to a real origin.
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
