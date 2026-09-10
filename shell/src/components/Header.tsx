import './Header.css'

/**
 * Logos-only header. The bottom divider is unconditional: Figma carries it inside the
 * component, so the `bordered` modifier is gone (decided 2026-09-10). Note the visible
 * consequence -- entry, error and peer-group pages previously rendered without a line.
 * Left: habify30 wordmark; right: reserved client-logo slot (DL-041). Wordmark is text
 * until the real asset is wired.
 */
export function Header() {
  return (
    <header className="h30-header">
      <div className="h30-header__wordmark">habify30</div>
      <div className="h30-header__client-slot" aria-hidden="true" />
    </header>
  )
}
