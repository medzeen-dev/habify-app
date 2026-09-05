import { useState } from 'react'
import { Lock, Settings, Menu, X } from 'lucide-react'
import type { TabModel, TabKey } from '../screens/home/homeData'
import './Nav.css'

interface NavProps {
  tabs: TabModel[]
  /** Fires for a reachable tab (active/available), the gear, or the mobile menu. */
  onNavigate?: (target: TabKey | 'einstellungen') => void
}

/**
 * Main navigation (DL-039: four co-equal tabs Home / Impuls / Werkstatt / Momentum;
 * Home is the default landing hub). Desktop shows full labels with a gear for
 * Einstellungen set off to the right (DL-044, 40px gap, no divider); mobile collapses
 * to a burger (DL-041) with the four tabs plus an Einstellungen row below a divider.
 * Locked tabs (date-/progress-gated phases) carry a lock icon and are inert.
 */
export function Nav({ tabs, onNavigate }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const go = (target: TabKey | 'einstellungen') => {
    setMenuOpen(false)
    onNavigate?.(target)
  }

  return (
    <header className="h30-nav">
      <div className="h30-nav__bar">
        <div className="h30-nav__wordmark">habify30</div>

        {/* Desktop tabs — optically centred; the outer slots balance the wordmark. */}
        <nav className="h30-nav__tabs" aria-label="Programmbereiche">
          {tabs.map((t) => (
            <NavTab key={t.key} tab={t} onClick={() => go(t.key)} />
          ))}
        </nav>

        <div className="h30-nav__right">
          <button
            type="button"
            className="h30-nav__gear"
            aria-label="Einstellungen"
            onClick={() => go('einstellungen')}
          >
            <Settings size={24} aria-hidden="true" />
          </button>
          <div className="h30-nav__client-slot" aria-hidden="true" />
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          className="h30-nav__burger"
          aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <nav className="h30-nav__menu" aria-label="Programmbereiche">
          {tabs.map((t) => (
            <NavMenuRow key={t.key} tab={t} onClick={() => go(t.key)} />
          ))}
          <div className="h30-nav__menu-divider" />
          <button type="button" className="h30-nav__menu-row" onClick={() => go('einstellungen')}>
            <Settings size={20} aria-hidden="true" className="h30-nav__menu-icon" />
            <span>Einstellungen</span>
          </button>
        </nav>
      )}
    </header>
  )
}

function NavTab({ tab, onClick }: { tab: TabModel; onClick: () => void }) {
  if (tab.status === 'locked') {
    return (
      <span className="h30-nav__tab h30-nav__tab--locked" aria-disabled="true">
        {tab.label}
        <Lock size={16} aria-hidden="true" className="h30-nav__lock" />
      </span>
    )
  }
  const cls = tab.status === 'active' ? 'h30-nav__tab h30-nav__tab--active' : 'h30-nav__tab'
  return (
    <button
      type="button"
      className={cls}
      aria-current={tab.status === 'active' ? 'page' : undefined}
      onClick={onClick}
    >
      {tab.label}
    </button>
  )
}

function NavMenuRow({ tab, onClick }: { tab: TabModel; onClick: () => void }) {
  if (tab.status === 'locked') {
    return (
      <span className="h30-nav__menu-row h30-nav__menu-row--locked" aria-disabled="true">
        <span>{tab.label}</span>
        <Lock size={18} aria-hidden="true" className="h30-nav__menu-icon" />
      </span>
    )
  }
  return (
    <button
      type="button"
      className={
        tab.status === 'active'
          ? 'h30-nav__menu-row h30-nav__menu-row--active'
          : 'h30-nav__menu-row'
      }
      aria-current={tab.status === 'active' ? 'page' : undefined}
      onClick={onClick}
    >
      <span>{tab.label}</span>
    </button>
  )
}
