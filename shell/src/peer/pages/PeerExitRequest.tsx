import { useState } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { PeerLayout } from '../PeerLayout'
import { validateEmail } from '../lib/email'
import { requestPeerExit, type PeerConfig } from '../lib/peerApi'

// Copy verbatim from Figma §4 — Peergruppe, "Peergruppe verlassen — A" (1:282).
const FORMAT_ERROR = 'Bitte gib eine gültige E-Mail-Adresse ein.'

function pidFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('pid')?.trim() || null
}

export function PeerExitRequest({ config, onSent }: { config: PeerConfig | null; onSent: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)

  // Domain rule applies here too when available (DL-053), but the exit page is often
  // reached from the group email on a device with no pid/config — then format-only.
  const rule =
    config && config.allowedDomains.length > 0
      ? { allowedDomains: config.allowedDomains, exceptions: config.exceptions }
      : undefined
  const err = validateEmail(email, rule)
  const showError = touched && email.trim() !== '' && err !== null
  const canSubmit = err === null && email.trim() !== ''

  const submit = () => {
    setTouched(true)
    if (!canSubmit) return
    // Fire-and-forget; advance regardless (non-revealing, DL-053).
    void requestPeerExit({ email, pid: pidFromUrl() })
    onSent(email.trim())
  }

  return (
    <PeerLayout>
      <h1 className="t-display h30-peer__title">Peergruppe verlassen</h1>
      <p className="t-body-lg h30-peer__intro">
        Gib die E-Mail-Adresse ein, mit der du dich für die Peergruppe angemeldet hast. Wir schicken dir eine Nachricht
        mit einem Abmeldelink — erst wenn du ihn öffnest, wirst du aus der Gruppe entfernt und die anderen
        Gruppenmitglieder über deinen Austritt informiert.
      </p>

      <Input
        id="peer-exit-email"
        label="E-Mail-Adresse"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="vorname.nachname@firma.de"
        value={email}
        onChange={setEmail}
        onBlur={() => setTouched(true)}
        error={showError}
        errorText={FORMAT_ERROR}
      />

      <div className="h30-peer__cta">
        <Button variant="primary" label="Bestätigungslink anfordern" disabled={!canSubmit} onClick={submit} />
      </div>

      <p className="t-body-sm h30-peer__footnote">
        Diese Seite gehört nicht zu deinem Kurszugang. Deine E-Mail-Adresse wird hier nicht mit deinem Kursfortschritt
        verknüpft — sie dient allein dazu, dich aus der Gruppenliste zu entfernen.
      </p>
    </PeerLayout>
  )
}
