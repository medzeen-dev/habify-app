import { DoorOpen, Lock, ShieldCheck } from 'lucide-react'
import { WizardLayout } from '../../components/WizardLayout'
import { Button } from '../../components/Button'
import './WizardWillkommen.css'

// NOTE: fact-icon glyphs are a close Lucide match to the design — confirm against Figma.
const FACTS = [
  {
    Icon: DoorOpen,
    title: 'Du bist schon drin',
    body: 'Es gibt keine klassische Anmeldung mit Nutzername und Passwort, das du dir merken müsstest.',
  },
  {
    Icon: ShieldCheck,
    title: 'Deine Privatsphäre ist geschützt',
    body: 'Der Zugang, den wir für dich erstellt haben, lässt sich zu keinem Zeitpunkt einer Person zuordnen — von niemandem, uns eingeschlossen. Alles, was du im Kurs schreibst, ist mit diesem Zugang verknüpft, nicht mit dir.',
  },
  {
    Icon: Lock,
    title: 'Niemand liest mit',
    body: 'Deine Organisation weiß nur, dass du an dem Programm teilnimmst. Was du schreibst, sieht sie zu keinem Zeitpunkt.',
  },
]

/**
 * Wizard 1 — Willkommen (DL-051). H1 carries the mental model, not a greeting (DL-066).
 * No uid is created here yet (DL-059) — the Rückweg catches a misclick before that.
 * Design: §2 node 1:790.
 */
export function WizardWillkommen({
  onNext,
  onRecover,
  busy = false,
}: {
  onNext: () => void
  onRecover: () => void
  busy?: boolean
}) {
  return (
    <WizardLayout step={1}>
      <h1 className="t-display">Kein Passwort, keine Anmeldung</h1>
      <p className="t-body-lg text-secondary">
        habify30 ist bewusst anders gebaut als das, was du sonst kennst. Was das für dich bedeutet —
        und was es dich kostet.
      </p>

      <div className="h30-facts">
        {FACTS.map(({ Icon, title, body }) => (
          <div className="h30-facts__row" key={title}>
            <Icon size={20} aria-hidden="true" className="h30-facts__icon" />
            <div className="h30-facts__body">
              <p className="t-heading-sm">{title}</p>
              <p className="t-body-md text-secondary">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="t-body-md text-secondary">
        Dieser Schutz deiner Daten hat allerdings eine Kehrseite: Wenn du deinen Zugang verlieren
        solltest, gibt es wirklich niemanden, der dir dann aufmachen könnte. Um diesen Fall geht es im
        nächsten Schritt.
      </p>

      <Button
        variant="primary"
        label={busy ? 'Einen Moment …' : 'Weiter'}
        className="h30-btn--page"
        onClick={onNext}
        disabled={busy}
      />

      <div className="h30-rueckweg">
        <p className="t-body-sm text-secondary">Du hast schon einen Zugang?</p>
        <button type="button" className="h30-linkbtn" onClick={onRecover}>
          Wiederherstellungscode eingeben
        </button>
      </div>
    </WizardLayout>
  )
}
