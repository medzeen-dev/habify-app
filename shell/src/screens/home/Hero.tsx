import { Clock } from 'lucide-react'
import { Button } from '../../components/Button'
import type { HeroModel } from './homeData'

/**
 * Hero — label · phase name · progress line · one primary CTA (DL-045 item 4).
 * The waiting note (info block) renders only when present — per DL-048 that is the
 * Momentum-waiting state (D) alone; Impuls is open from invitation and Werkstatt
 * opens progress-based, so neither shows a date note.
 */
export function Hero({ hero, onContinue }: { hero: HeroModel; onContinue?: () => void }) {
  return (
    <>
      <section className="h30-hero">
        <p className="t-label h30-hero__label">{hero.label}</p>
        <h1 className="t-display h30-hero__title">{hero.phaseTitle}</h1>
        <p className="t-body-lg h30-hero__sub">{hero.sub}</p>
        <Button variant="primary" label={hero.ctaLabel} onClick={onContinue} />
      </section>

      {hero.waitingNote && (
        <aside className="h30-infoblock" role="note">
          <Clock size={20} aria-hidden="true" className="h30-infoblock__icon" />
          <div className="h30-infoblock__body">
            <p className="t-body-md h30-infoblock__line1">{hero.waitingNote.line1}</p>
            {hero.waitingNote.line2 && (
              <p className="t-body-sm h30-infoblock__line2">{hero.waitingNote.line2}</p>
            )}
          </div>
        </aside>
      )}
    </>
  )
}
