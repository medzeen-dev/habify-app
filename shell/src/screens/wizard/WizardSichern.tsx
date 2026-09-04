import { useState } from 'react'
import { WizardLayout } from '../../components/WizardLayout'
import { Button } from '../../components/Button'
import { formatWithHyphen } from '../../lib/recoveryCode'
import { downloadRecoveryPdf } from '../../lib/recoveryPdf'
import './WizardSichern.css'

interface WizardSichernProps {
  recoveryCode: string
  secured: boolean
  onSecured: () => void
  onNext: () => void
  onHelp: () => void
}

/**
 * Wizard 2 — Zugang sichern (DL-059 uid already created before this screen).
 * Body copy is DL-042 frozen ("Auch wir nicht" — do not soften, DL-051/DL-064).
 * Two mandatory paths; either observed action unlocks "Weiter" (DL-060: no forced
 * choice, no checkbox in the primary path). Design: §2 node 1:833.
 */
export function WizardSichern({ recoveryCode, secured, onSecured, onNext, onHelp }: WizardSichernProps) {
  // The cascade appears only after a path was attempted (DL-060: the escape hatch
  // must not be visible from the start, or it becomes the main path).
  const [attempted, setAttempted] = useState(false)
  const pretty = formatWithHyphen(recoveryCode)

  const savePdf = () => {
    downloadRecoveryPdf(recoveryCode)
    setAttempted(true)
    onSecured()
  }

  const prepareMail = () => {
    const subject = 'Mein habify30-Wiederherstellungscode'
    const body = `Mein habify30-Wiederherstellungscode: ${pretty}\n\nBewahre ihn sicher auf — er ist der einzige Weg zurück in dein Programm.`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setAttempted(true)
    onSecured()
  }

  return (
    <WizardLayout step={2}>
      <h1 className="t-display">Sichere deinen Zugang</h1>

      <div className="h30-sichern__body">
        <p className="t-body-lg text-secondary">
          Dieser Code ist der einzige Weg zurück in dein Programm, falls du deinen Zugang verlierst —
          etwa wenn deine IT den Browser-Speicher leert. Das ist in Unternehmen üblich und passiert
          ohne Vorwarnung.
        </p>
        <p className="t-body-lg text-secondary">
          Ein Zurücksetzen per E-Mail gibt es nicht: habify30 speichert bewusst keine persönlichen
          Daten, die dich mit deinem Fortschritt verbinden. Das schützt dich — bedeutet aber, dass
          niemand dir den Zugang wiederherstellen kann. Auch wir nicht.
        </p>
      </div>

      <div className="h30-codepanel">
        <p className="t-label h30-codepanel__label">DEIN WIEDERHERSTELLUNGSCODE</p>
        <p className="h30-codepanel__code">{pretty}</p>
      </div>

      <div className="h30-sichern__paths">
        <Button variant="secondary" label="Code als PDF sichern" onClick={savePdf} />
        <Button variant="secondary" label="E-Mail an mich selbst vorbereiten" onClick={prepareMail} />
      </div>

      <p className="t-body-sm text-muted">
        Sichere den Code auf einem der beiden Wege — dann geht es weiter. Beides ist möglich. Die
        E-Mail enthält nur den Code, keinen Anmelde-Link: sie öffnet dein Mailprogramm, abschicken
        musst du sie selbst.
      </p>

      {attempted && (
        <div className="h30-cascade">
          <p className="t-body-sm text-secondary">Nichts passiert?</p>
          <button type="button" className="h30-linkbtn" onClick={onHelp}>
            Anderen Weg wählen
          </button>
        </div>
      )}

      <Button
        variant="primary"
        label="Weiter"
        className="h30-btn--page"
        onClick={onNext}
        disabled={!secured}
      />
    </WizardLayout>
  )
}
