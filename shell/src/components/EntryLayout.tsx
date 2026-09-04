import type { ReactNode } from 'react'
import { Header } from './Header'
import './EntryLayout.css'

/**
 * Shared frame for the entry / pid-only screens (Einstieg, Code eingeben,
 * Fehlerseite): logos-only header + a centred column, max 560px.
 */
export function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h30-entry">
      <Header />
      <main className="h30-entry__content">
        <div className="h30-entry__col">{children}</div>
      </main>
    </div>
  )
}
