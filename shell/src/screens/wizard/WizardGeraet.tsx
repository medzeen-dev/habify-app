import { QrCode } from 'lucide-react'
import { WizardLayout } from '../../components/WizardLayout'
import { Button } from '../../components/Button'
import './WizardGeraet.css'

/**
 * Wizard 3 — Weiteres Gerät hinzufügen (DL-042 further-device). QR encodes a
 * single-use, minutes-valid magic link (pending backend). "Zum Programm" is the
 * click-through to the end → wizardCompleted (DL-051). No "Konto" wording (DL-065).
 * Design: §2 node 1:859.
 */
export function WizardGeraet({ onComplete }: { onComplete: () => void }) {
  const sendLink = () =>
    console.info('[Wizard 3] Link per E-Mail senden — Magic Link folgt (Backend)')

  return (
    <WizardLayout step={3}>
      <h1 className="t-display">Weiteres Gerät hinzufügen</h1>
      <p className="t-body-lg text-secondary">
        Um habify30 auch auf dem Handy oder einem zweiten Computer zu nutzen, verbindest du das
        weitere Gerät einmalig. Du hast dafür zwei Möglichkeiten — über das Scannen des Codes oder du
        sendest dir selbst eine E-Mail mit dem Zugangslink.
      </p>

      <div className="h30-geraet__card">
        <div className="h30-geraet__qr" aria-hidden="true">
          <QrCode size={40} strokeWidth={1.5} />
        </div>
        <div className="h30-geraet__body">
          <p className="t-heading-sm">Mit dem Handy scannen</p>
          <p className="t-body-md text-secondary">
            Behandle den Link wie deinen Zugang — wer ihn öffnet, ist in deinem Kurs. Er gilt nur
            wenige Minuten und nur einmal.
          </p>
          <Button variant="secondary" label="Link per E-Mail senden" onClick={sendLink} />
        </div>
      </div>

      <p className="t-body-md text-secondary">
        Du kannst jederzeit unter Einstellungen weitere Geräte hinzufügen.
      </p>

      <div className="h30-geraet__actions">
        <Button variant="primary" label="Zum Programm" className="h30-btn--page" onClick={onComplete} />
      </div>
    </WizardLayout>
  )
}
