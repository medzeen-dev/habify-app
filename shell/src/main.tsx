import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted Manrope (no third-party font CDN — EU-only, DL-028/DL-043).
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
