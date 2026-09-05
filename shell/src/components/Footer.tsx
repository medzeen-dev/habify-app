import './Footer.css'

/** Shell footer — Impressum · Datenschutz (DL-045 structure item 7). Muted links. */
export function Footer() {
  return (
    <footer className="h30-footer">
      <nav className="h30-footer__links" aria-label="Rechtliches">
        <a className="h30-footer__link" href="#impressum">
          Impressum
        </a>
        <a className="h30-footer__link" href="#datenschutz">
          Datenschutz
        </a>
      </nav>
    </footer>
  )
}
