import './Header.css'

/**
 * Logos-only header. Entry screens use it borderless; the Wizard uses `bordered`
 * (bottom divider, "kein Tab-Ausbruch"). Left: habify30 wordmark; right: reserved
 * client-logo slot (DL-041). Wordmark is text until the real asset is wired.
 */
export function Header({ bordered = false }: { bordered?: boolean }) {
  return (
    <header className={bordered ? 'h30-header h30-header--bordered' : 'h30-header'}>
      <div className="h30-header__wordmark">habify30</div>
      <div className="h30-header__client-slot" aria-hidden="true" />
    </header>
  )
}
