import './Divider.css'

/** "oder" separator used on Code eingeben and Fehlerseite. */
export function Divider({ label = 'oder' }: { label?: string }) {
  return (
    <div className="h30-divider" role="separator" aria-hidden="true">
      <span className="h30-divider__line" />
      <span className="t-label h30-divider__label">{label}</span>
      <span className="h30-divider__line" />
    </div>
  )
}
