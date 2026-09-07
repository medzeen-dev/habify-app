import { useState } from 'react'
import { Shuffle, CalendarDays, Users } from 'lucide-react'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { Input } from '../../components/Input'
import { PeerLayout } from '../PeerLayout'
import { validateEmail } from '../lib/email'
import { enrolPeer, type PeerConfig } from '../lib/peerApi'

// Copy is read verbatim from Figma "habify30 Screens" §4 — Peergruppe, frame
// "Peergruppe eintragen" (1:202) / error variant (1:242). Do not paraphrase (DL-064).
const FACTS = [
  {
    icon: Shuffle,
    title: 'Die Gruppen werden zufällig gebildet',
    body: 'Du kannst dir deine Gruppe nicht aussuchen — und das ist Absicht. Der Wert einer Peergruppe liegt in den Perspektiven, die dir sonst nicht begegnen. Und niemand hindert dich daran, dich zusätzlich mit dir schon vertrauten Menschen auszutauschen.',
  },
  {
    icon: CalendarDays,
    title: null, // filled with the cutoff date below
    body: 'Alle, die sich bis dahin eingetragen haben, werden einer Gruppe zugeteilt und bekommen eine Info-E-Mail dazu. Wer sich später einträgt, kommt erst in die nächste Zuteilungsrunde — ohne die Garantie, einer Gruppe zugeteilt werden zu können.',
  },
  {
    icon: Users,
    title: 'Der Austausch läuft über euren eigenen Kanal',
    body: 'Teams, WhatsApp, Telefon — was ihr wollt. Wir sehen nicht, worüber ihr sprecht, und wir moderieren nicht.',
  },
] as const

const CONSENT_LABEL =
  'Ich bin damit einverstanden, dass meine E-Mail-Adresse den anderen Mitgliedern meiner Peergruppe mitgeteilt wird, damit ihr euch untereinander verabreden könnt.'
const DOMAIN_ERROR = 'Bitte nutze deine geschäftliche E-Mail-Adresse — die Gruppen werden innerhalb deiner Organisation gebildet.'
const FORMAT_ERROR = 'Bitte gib eine gültige E-Mail-Adresse ein.'

function formatCutoff(iso?: string): string {
  if (!iso) return 'festgelegten Stichtag'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'festgelegten Stichtag'
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

export function PeerSignup({ pid, config }: { pid: string | null; config: PeerConfig | null }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [touched, setTouched] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Apply the domain rule only when the cohort actually has domains configured;
  // an empty list means "no client-side rule" (format-only) — the backend stays
  // authoritative — rather than rejecting every address.
  const rule =
    config && config.allowedDomains.length > 0
      ? { allowedDomains: config.allowedDomains, exceptions: config.exceptions }
      : undefined
  const err = validateEmail(email, rule)
  const showError = touched && email.trim() !== '' && err !== null
  const canSubmit = consent && err === null && email.trim() !== '' && !!pid && !submitting

  const submit = async () => {
    setTouched(true)
    if (!canSubmit || !pid) return
    setSubmitting(true)
    const res = await enrolPeer({ pid, email })
    setSubmitting(false)
    if (res.ok) setDone(true)
  }

  if (done) {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Eingetragen</h1>
        <p className="t-body-lg h30-peer__intro">
          Deine Adresse steht auf der Liste. Zur Zuteilung am {formatCutoff(config?.cutoffDate)} bekommst du eine
          Info-E-Mail mit deiner Gruppe.
        </p>
        <p className="t-body-sm h30-peer__footnote">
          Diese Seite gehört nicht zu deinem Kurszugang. Deine E-Mail-Adresse wird nicht mit deinem Kursfortschritt
          verknüpft — wir können nicht sehen, wer du im Kurs bist.
        </p>
      </PeerLayout>
    )
  }

  return (
    <PeerLayout>
      <h1 className="t-display h30-peer__title">Für eine Peergruppe eintragen</h1>
      <p className="t-body-lg h30-peer__intro">
        Zwei bis drei Menschen, die sich gegenseitig durch die 30 Tage der Momentumphase begleiten. Ihr entscheidet
        gemeinsam über den Kanal, die Häufigkeit und natürlich — worüber ihr sprecht.
      </p>

      <div className="h30-peer__facts">
        {FACTS.map((f, i) => {
          const Icon = f.icon
          const title = f.title ?? `Die Einteilung erfolgt am ${formatCutoff(config?.cutoffDate)}`
          return (
            <div className="h30-peer__fact" key={i}>
              <Icon size={22} className="h30-peer__fact-icon" aria-hidden="true" />
              <div className="h30-peer__fact-body">
                <p className="t-heading-sm h30-peer__fact-title">{title}</p>
                <p className="t-body-md h30-peer__fact-text">{f.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      <Input
        id="peer-email"
        label="E-Mail-Adresse"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="vorname.nachname@firma.de"
        value={email}
        onChange={(v) => setEmail(v)}
        onBlur={() => setTouched(true)}
        error={showError}
        errorText={err === 'domain' ? DOMAIN_ERROR : FORMAT_ERROR}
      />

      <div className="h30-peer__consent">
        <Checkbox id="peer-consent" checked={consent} onChange={setConsent} label={CONSENT_LABEL} />
      </div>

      {!pid && (
        <p className="t-body-sm h30-peer__help-error">
          Diese Seite muss über den Link aus deinem Kurs geöffnet werden.
        </p>
      )}

      <div className="h30-peer__cta">
        <Button variant="primary" label="Eintragen" disabled={!canSubmit} onClick={submit} />
      </div>

      <p className="t-body-sm h30-peer__footnote">
        Diese Seite gehört nicht zu deinem Kurszugang. Deine E-Mail-Adresse wird nicht mit deinem Kursfortschritt
        verknüpft — wir können nicht sehen, wer du im Kurs bist.
      </p>
    </PeerLayout>
  )
}
