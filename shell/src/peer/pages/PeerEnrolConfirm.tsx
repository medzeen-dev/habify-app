import { useEffect, useState } from 'react'
import { PeerLayout } from '../PeerLayout'
import { confirmPeerEnrol, type EnrolConfirmResult } from '../lib/peerApi'

// Token-landing view for the double opt-in: the confirmation email's link opens
// #/bestaetigen?ct=…; this view POSTs the token to /peer/enrol-confirm and shows the
// outcome. Until that POST succeeds the address is `pending` and cannot be allocated a
// seat — which is the whole point (see the /enrol comment in functions/peer).
// Copy is build-authored: this surface has no Figma frame, it did not exist when the
// peer pages were designed.
function tokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get('ct')?.trim() || ''
}

export function PeerEnrolConfirm() {
  const token = tokenFromUrl() // stable for this load; the URL does not change under us
  const [state, setState] = useState<'loading' | EnrolConfirmResult>(token ? 'loading' : 'invalid')

  useEffect(() => {
    if (!token) return
    let live = true
    confirmPeerEnrol(token).then((r) => {
      if (live) setState(r)
    })
    return () => { live = false }
  }, [token])

  if (state === 'loading') {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Einen Moment…</h1>
        <p className="t-body-lg h30-peer__intro">Wir bestätigen deine Eintragung.</p>
      </PeerLayout>
    )
  }

  // Both success cases are confirmed enrolments; they differ in what happens next, and
  // saying the wrong one would promise an allocation that is not coming.
  if (state === 'confirmed-allocated' || state === 'confirmed-waiting') {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Eintragung bestätigt</h1>
        {state === 'confirmed-allocated' ? (
          <p className="t-body-lg h30-peer__intro">
            Deine Adresse steht jetzt auf der Liste. Zur Zuteilung bekommst du eine Info-E-Mail mit deiner Gruppe.
          </p>
        ) : (
          <p className="t-body-lg h30-peer__intro">
            Deine Adresse steht jetzt auf der Warteliste. Die Gruppen für diesen Durchlauf sind schon gebildet — sobald
            sich eine zweite wartende Person einträgt oder eine bestehende Gruppe sich öffnet, bekommst du sofort eine
            E-Mail mit den Kontaktdaten deiner Gruppe. Garantieren können wir eine Zuordnung nicht.
          </p>
        )}
      </PeerLayout>
    )
  }

  const message =
    state === 'expired'
      ? 'Dieser Bestätigungslink ist abgelaufen. Trage dich einfach erneut ein, dann schicken wir dir einen neuen.'
      : 'Dieser Bestätigungslink ist nicht (mehr) gültig. Trage dich einfach erneut ein, dann schicken wir dir einen neuen.'

  return (
    <PeerLayout>
      <h1 className="t-display h30-peer__title">Link nicht gültig</h1>
      <p className="t-body-lg h30-peer__intro">{message}</p>
    </PeerLayout>
  )
}
