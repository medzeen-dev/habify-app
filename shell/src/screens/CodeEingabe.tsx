import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { EntryLayout } from '../components/EntryLayout'
import { Button } from '../components/Button'
import { InputRecoveryCode } from '../components/InputRecoveryCode'
import { Divider } from '../components/Divider'
import { ContactLine } from '../components/ContactLine'
import { isValidChecksum, isValidFormat, RECOVERY_ERROR } from '../lib/recoveryCode'
import { runRecover } from '../lib/recoverFlow'
import './CodeEingabe.css'

interface CodeEingabeProps {
  /** Back link → Einstieg (DL-056). No "Neu anfangen" button. */
  onBack?: () => void
  /** Recovery succeeded → into the programme (DL-057). */
  onSuccess?: () => void
}

/**
 * Einstieg — Code eingeben (DL-056). Recovery-code field, primary action,
 * "other device" path, the DL-042 frozen-loss block, back link. Design: §1 node 1:1039.
 */
export function CodeEingabe({ onBack, onSuccess }: CodeEingabeProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    // (1) Local checksum — immediate, no server call (DL-029).
    if (!isValidFormat(code) || !isValidChecksum(code)) {
      setError(RECOVERY_ERROR.checksum)
      return
    }
    setError(null)
    setBusy(true)
    // (2) /recover → accesscontrol; not-found / errors come back here (DL-057).
    const result = await runRecover(code)
    setBusy(false)
    if (result.ok) onSuccess?.()
    else setError(result.error)
  }

  return (
    <EntryLayout>
      <div className="h30-kopf">
        <h1 className="h30-h1">Wiederherstellungscode eingeben</h1>
        <p className="h30-lead">
          Du hast ihn bei der Einrichtung gesichert — als PDF, und vielleicht zusätzlich in einer
          E-Mail an dich selbst.
        </p>
      </div>

      <InputRecoveryCode
        value={code}
        onChange={(raw) => {
          setCode(raw)
          if (error) setError(null)
        }}
        error={!!error}
        errorText={error ?? undefined}
      />
      <Button
        variant="primary"
        label={busy ? 'Wird geprüft …' : 'Zugang wiederherstellen'}
        className="h30-btn--page"
        onClick={submit}
        disabled={busy || code.length < 8}
      />

      <Divider />

      <section className="h30-info-card">
        <h2 className="t-heading-sm">Kein Code zur Hand?</h2>
        <p className="t-body-md text-secondary">
          Öffne habify30 auf einem Gerät, auf dem du noch angemeldet bist. Unter Einstellungen findest
          du deinen Code — und kannst dieses Gerät direkt verbinden.
        </p>
      </section>

      {/* DL-042 frozen copy ("Auch wir nicht") — verbatim, do not soften (DL-051/DL-064). */}
      <section className="h30-verlust">
        <h2 className="t-heading-sm">Auch kein zweites Gerät?</h2>
        <p className="t-body-md text-secondary">
          Dann kommst du nicht zurück in dein Programm. Das ist keine Einstellung, die sich ändern
          lässt: habify30 speichert bewusst nichts, was dich mit deinem Fortschritt verbindet. Das
          schützt dich — bedeutet aber, dass niemand dir den Zugang wiederherstellen kann. Auch wir
          nicht.
        </p>
        <p className="t-body-md text-secondary">
          Was verloren geht: dein Fortschritt im Kurs und deine Antworten aus den Reflexionen.
        </p>
        <p className="t-body-md text-secondary">
          Was bleibt: deine Programm-E-Mails, deine Peergruppe und alle Termine, die du gebucht hast.
          Die hängen nicht an diesem Zugang.
        </p>
        <p className="t-body-md text-secondary">
          Du kannst neu anfangen — über den Link aus deiner Einladungs-E-Mail. Der Kurs startet dann
          von vorn.
        </p>
      </section>

      <button type="button" className="h30-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Zurück</span>
      </button>

      <ContactLine />
    </EntryLayout>
  )
}
