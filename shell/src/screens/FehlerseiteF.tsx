import { useState } from 'react'
import { EntryLayout } from '../components/EntryLayout'
import { Button } from '../components/Button'
import { InputRecoveryCode } from '../components/InputRecoveryCode'
import { Divider } from '../components/Divider'
import { ContactLine } from '../components/ContactLine'
import { isValidChecksum, isValidFormat, RECOVERY_ERROR } from '../lib/recoveryCode'
import { runRecover } from '../lib/recoverFlow'
import './FehlerseiteF.css'

interface FehlerseiteFProps {
  /** Recovery succeeded → into the programme (DL-057). */
  onSuccess?: () => void
}

/**
 * Fehlerseite — Zustand F: no pid (neither URL nor cache) — the ONLY state with a
 * code-entry field (DL-062). H1 is constant across all four states (B/C/E/F).
 * No contact CTA, no "Neu anfangen" button. Design: §1 node 1:1069.
 *
 * States B (pid invalid) / C (pid expired) / E (Catalyst unreachable) share this
 * frame with different text and no input — added when their reference copy is pulled.
 */
export function FehlerseiteF({ onSuccess }: FehlerseiteFProps) {
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

  return (
    <EntryLayout>
      <div className="h30-kopf h30-kopf--wide">
        <h1 className="h30-h1">Es gibt ein Problem mit deinem Zugang</h1>
        <p className="h30-lead">
          Dieser Aufruf enthält keine Programmkennung. Öffne den Link aus deiner Einladungs-E-Mail —
          er bringt dich zurück in deinen Kurs.
        </p>
      </div>

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

      <ContactLine />
    </EntryLayout>
  )
}
