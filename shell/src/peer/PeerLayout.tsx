import type { ReactNode } from 'react'
import { Header } from '../components/Header'
import './PeerApp.css'

/**
 * Frame for the peer-group pages (DL-053): logos-only header (no nav, no gear, no
 * uid), a centred column max 640. No "back to course" link anywhere — the uid may
 * not exist on the device that opened the page.
 */
export function PeerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h30-peer">
      <Header />
      <main className="h30-peer__content">
        <div className="h30-peer__col">{children}</div>
      </main>
    </div>
  )
}
