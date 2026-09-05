import { CalendarClock } from 'lucide-react'
import { Button } from '../../components/Button'
import type { WebinarModel } from './homeData'

/**
 * Webinar dates — an open list in view, not a hub link (DL-045c). Only upcoming
 * dates, no scrollbar (at most 5 per cohort). Foot action loads an .ics with all
 * upcoming dates incl. access links (DL-045). Webinars are recommended, not required
 * (DL-050).
 */
export function WebinarCard({
  webinars,
  onAddToCalendar,
}: {
  webinars: WebinarModel[]
  onAddToCalendar?: () => void
}) {
  return (
    <section className="h30-card h30-webinars">
      <header className="h30-card__head">
        <CalendarClock size={20} aria-hidden="true" className="h30-card__head-icon" />
        <h2 className="t-heading-md">Kommende Webinare</h2>
      </header>

      <ul className="h30-webinars__list">
        {webinars.map((w) => (
          <li key={w.when} className="h30-webinar">
            <p className="t-body-sm h30-webinar__when">{w.when}</p>
            <p className="t-body-md h30-webinar__title">{w.title}</p>
          </li>
        ))}
      </ul>

      <div className="h30-webinars__foot">
        <Button
          variant="secondary"
          block
          label="Termine dem Kalender hinzufügen"
          onClick={onAddToCalendar}
        />
        <p className="t-body-sm text-muted h30-webinars__hint">
          Lädt eine .ics-Datei mit allen kommenden Terminen — inklusive Zugangslinks.
        </p>
      </div>
    </section>
  )
}
