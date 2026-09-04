import { Flag, RotateCcw } from 'lucide-react'
import { EntryLayout } from '../components/EntryLayout'
import { Button } from '../components/Button'
import { ContactLine } from '../components/ContactLine'
import './Einstieg.css'

interface EinstiegProps {
  /** From the accesscontrol response, pre-filled "habify30" per pid (DL-058, DL-055). */
  programmName?: string
  /** "Ich bin neu hier" → Wizard Step 1 (DL-063). */
  onNew?: () => void
  /** "Ich habe schon einen Zugang" → Einstieg — Code eingeben (DL-056/063). */
  onRecover?: () => void
}

/**
 * Einstieg — shown when localStorage has no uid (DL-055). Two equal-rank options
 * (DL-063: both Secondary, "Neu hier" first). Design: §1 node 1:1014.
 */
export function Einstieg({ programmName = 'habify30', onNew, onRecover }: EinstiegProps) {
  return (
    <EntryLayout>
      <div className="h30-kopf">
        <h1 className="h30-h1">Willkommen zu {programmName}</h1>
        <p className="h30-lead">Schön, dass du da bist!</p>
      </div>

      <section className="h30-choice">
        <div className="h30-choice__title">
          <Flag size={24} aria-hidden="true" className="h30-choice__icon" />
          <h2 className="t-heading-sm">Ich bin neu hier</h2>
        </div>
        <p className="t-body-md h30-choice__desc">
          Du startest habify30 zum ersten Mal. Wir richten deinen Zugang gemeinsam ein — das dauert
          zwei Minuten.
        </p>
        <Button variant="secondary" label="Einrichtung starten" onClick={onNew} />
      </section>

      <section className="h30-choice">
        <div className="h30-choice__title">
          <RotateCcw size={24} aria-hidden="true" className="h30-choice__icon" />
          <h2 className="t-heading-sm">Ich habe schon einen Zugang</h2>
        </div>
        <p className="t-body-md h30-choice__desc">
          Gib deinen Wiederherstellungscode ein — oder hol dir den Zugang von einem Gerät, auf dem du
          noch angemeldet bist.
        </p>
        <Button variant="secondary" label="Zugang wiederherstellen" onClick={onRecover} />
      </section>

      <ContactLine />
    </EntryLayout>
  )
}
