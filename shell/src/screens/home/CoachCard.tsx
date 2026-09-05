import { User } from 'lucide-react'
import { Button } from '../../components/Button'
import type { CoachModel } from './homeData'

/**
 * Coach widget (DL-045d, DL-046 — copy frozen, do not optimise). coachName and
 * coachImageUrl come per pid; the image is square, masked to a circle over a
 * brand-coloured circle (the load-error fallback). "Termin buchen" leaves the Shell
 * for Zoho Bookings (DL-038), so it carries the external-link icon (DL-054).
 */
export function CoachCard({ coach, onBook }: { coach: CoachModel; onBook?: () => void }) {
  return (
    <section className="h30-card h30-coach">
      <div className="h30-coach__avatar">
        {coach.imageUrl ? (
          <img className="h30-coach__img" src={coach.imageUrl} alt="" />
        ) : (
          <User size={32} aria-hidden="true" className="h30-coach__img-fallback" />
        )}
      </div>

      <h2 className="t-heading-md h30-coach__title">15 Minuten mit {coach.name ?? '{coachName}'}</h2>
      <p className="t-body-md h30-coach__blurb">{coach.blurb}</p>

      <Button variant="secondary" externalIcon label="Termin buchen" onClick={onBook} />
    </section>
  )
}
