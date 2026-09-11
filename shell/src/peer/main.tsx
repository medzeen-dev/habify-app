import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Manrope (no third-party font CDN — EU-only, DL-028/DL-043).
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '../index.css'
import { PeerApp } from './PeerApp'

// Build marker — the frontend counterpart of BUILD in functions/peer/index.js. Bump it in
// the same commit as any change whose deployment has to be verifiable; read it back on the
// serving host as `document.documentElement.dataset.peerBuild` (or in view-source: the
// bundle name changes with it). Slate's deploy log is not that check — see A5/DL-091.
const PEER_BUILD = '2026-09-11-cachetest'
document.documentElement.dataset.peerBuild = PEER_BUILD

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PeerApp />
  </StrictMode>,
)
