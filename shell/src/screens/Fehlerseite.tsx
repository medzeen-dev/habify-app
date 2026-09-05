import { useState } from 'react'
import { EntryLayout } from '../components/EntryLayout'
import { Button } from '../components/Button'
import { InputRecoveryCode } from '../components/InputRecoveryCode'
import { Divider } from '../components/Divider'
import { ContactLine } from '../components/ContactLine'
import { isValidChecksum, isValidFormat, RECOVERY_ERROR } from '../lib/recoveryCode'
import { runRecover } from '../lib/recoverFlow'
import './Fehlerseite.css'

export type FehlerState = 'B' | 'C' | 'E' | 'F'

// Zustandstexte, verbatim from Figma §1 (nodes 1:1069 F, 1:1088 B/C/E).
const STATE_TEXT: Record<'B' | 'E' | 'F', string> = {
  B: 'Diese Programmkennung kennen wir nicht. Den vollständigen Link findest du in deiner Einladungs-E-Mail. Stelle sicher, dass du ihn dort direkt öffnest — beim Kopieren und Einfügen kürzen manche E-Mail-Programme den Link.',
  E: 'Wir erreichen unseren Server gerade nicht. Das liegt nicht an dir. Versuch es in ein paar Minuten noch einmal.',
  F: 'Dieser Aufruf enthält keine Programmkennung. Öffne den Link aus deiner Einladungs-E-Mail — er bringt dich zurück in deinen Kurs.',
}

interface FehlerseiteProps {
  state: FehlerState
  /** For state C (expired). */
  expiryDate?: string
  /** F only: recovery succeeded → into the programme. */
  onSuccess?: () => void
}

/**
 * Fehlerseite — one frame, four states (DL-062). H1 + Kontaktzeile constant.
 * Only F carries a recovery-code path; B/C/E swap only the Zustandstext (no action —
 * no divider, no code field, no contact CTA). Design: §1 nodes 1:1069 (F), 1:1088 (B/C/E).
 */
export function Fehlerseite({ state, expiryDate, onSuccess }: FehlerseiteProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!isValidFormat(code) || !isValidChecksum(code)) {
      setError(RECOVERY_ERROR.checksum)
      return
    }
    setError(null)
    setBusy(true)
    const result = await runRecover(code)
    setBusy(false)
    if (result.ok) onSuccess?.()
    else setError(result.error)
  }

  const zustandstext =
    state === 'C'
      ? `Dieses Programm ist am ${expiryDate ?? '—'} beendet worden. Der Zugang ist damit geschlossen.`
      : STATE_TEXT[state]

  return (
    <EntryLayout>
      <div className="h30-kopf h30-kopf--wide">
        <h1 className="h30-h1">Es gibt ein Problem mit deinem Zugang</h1>
        <p className="h30-lead">{zustandstext}</p>
      </div>

      {state === 'F' && (
        <>
          <Divider />
          <section className="h30-codeweg">
            <h2 className="t-heading-sm">Du hast einen Wiederherstellungscode?</h2>
            <p className="t-body-md text-secondary">
              Dann kommst du auch damit zurück — der Code führt dich direkt zu deinem Programm.
            </p>
            <InputRecoveryCode
              id="recovery-code-f"
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
          </section>
        </>
      )}

      <ContactLine />
    </EntryLayout>
  )
}
