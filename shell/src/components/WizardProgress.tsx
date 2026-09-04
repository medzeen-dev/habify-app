import './WizardProgress.css'

/** Three-dot step indicator (DL-051: Wizard is 3 steps). */
export function WizardProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="h30-wp">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={n === step ? 'h30-wp__dot h30-wp__dot--active' : 'h30-wp__dot'}
          aria-hidden="true"
        />
      ))}
      <span className="t-label h30-wp__label">Schritt {step} von 3</span>
    </div>
  )
}
