import { useState } from 'react'
import { WizardLayout } from '../../components/WizardLayout'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { formatWithHyphen } from '../../lib/recoveryCode'
import './WizardHilfe.css'

const WEGE = [
  '· In deinen Passwortmanager eintragen — dort findest du ihn am sichersten wieder.',
  '· Auf Papier notieren und dorthin legen, wo du ihn in vier Wochen noch findest.',
  '· Ein Foto vom Bildschirm machen.',
]

/**
 * Wizard 2 — Hilfe: Code von Hand sichern — last stage of the cascade (DL-060).
 * This is the ONLY place in the Wizard where a confirmation checkbox is allowed;
 * it starts unchecked and unlocks "Weiter" (DL-060). Design: §2 node 1:881.
 */
export function WizardHilfe({
  recoveryCode,
  onNext,
  onBack,
}: {
  recoveryCode: string
  onNext: () => void
  onBack: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <WizardLayout step={2}>
      <h1 className="t-heading-lg">Code von Hand sichern</h1>
      <p className="t-body-lg text-secondary">
        Wenn weder der Download noch dein Mailprogramm funktionieren, notiere den Code selbst. Er ist
        der einzige Weg zurück — auch wir können deinen Zugang nicht wiederherstellen.
      </p>

      <div className="h30-codepanel h30-codepanel--left">
        <p className="t-label h30-codepanel__label">DEIN WIEDERHERSTELLUNGSCODE</p>
        <p className="h30-codepanel__code">{formatWithHyphen(recoveryCode)}</p>
      </div>

      <div className="h30-wege">
        <p className="t-heading-sm">Drei Möglichkeiten</p>
        {WEGE.map((w) => (
          <p className="t-body-md text-secondary" key={w}>
            {w}
          </p>
        ))}
      </div>

      <Checkbox
        id="cb-hilfe"
        checked={confirmed}
        onChange={setConfirmed}
        label="Ich habe den Code notiert und finde ihn wieder."
      />

      <div className="h30-hilfe__actions">
        <Button
          variant="primary"
          label="Weiter"
          className="h30-btn--page"
          onClick={onNext}
          disabled={!confirmed}
        />
        <button type="button" className="h30-linkbtn" onClick={onBack}>
          Zurück
        </button>
      </div>
    </WizardLayout>
  )
}
