import { useEffect, useState } from 'react'
import { PeerLayout } from '../PeerLayout'
import { confirmPeerExit, type ExitConfirmResult } from '../lib/peerApi'

// Token-landing view (DL-086): the exit email's link opens #/abmelden?token=…; this
// view POSTs the token to /peer/exit-confirm and shows the outcome. It is the fourth
// peer view beyond DL-053's three (DL-053 predates the native exit-token mechanism).
// Copy is provisional — this surface was not in the Figma peer frames.
function tokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get('token')?.trim() || ''
}

export function PeerExitDone() {
  const token = tokenFromUrl() // stable for this load; the URL does not change under us
  const [state, setState] = useState<'loading' | ExitConfirmResult>(token ? 'loading' : 'invalid')

  useEffect(() => {
    if (!token) return
    let live = true
    confirmPeerExit(token).then((r) => {
      if (live) setState(r)
    })
    return () => { live = false }
  }, [token])

  if (state === 'loading') {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Einen Moment…</h1>
        <p className="t-body-lg h30-peer__intro">Wir verarbeiten deine Abmeldung.</p>
      </PeerLayout>
    )
  }

  // Two successful outcomes, because two different things happened. Leaving a formed group
  // does notify the remaining members (DL-037: a 3-group shrinks and is told, a 2-group is
  // dissolved and its last member is mailed). Leaving before the cutoff, or from the wait
  // pool, notifies nobody — there is no group yet. The old wording claimed the notification
  // unconditionally and so described an email that, in that case, was never sent.
  if (state === 'done-group' || state === 'done-nogroup') {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Du bist abgemeldet</h1>
        {state === 'done-group' ? (
          <p className="t-body-lg h30-peer__intro">
            Deine Adresse wurde aus der Peergruppe entfernt. Die anderen Gruppenmitglieder werden über deinen Austritt
            informiert.
          </p>
        ) : (
          <p className="t-body-lg h30-peer__intro">
            Deine Adresse wurde von der Liste genommen. Du warst noch keiner Gruppe zugeteilt, es muss also niemand
            informiert werden.
          </p>
        )}
        <p className="t-body-md h30-peer__note">
          Möchtest du dich später erneut eintragen, findest du den Link unter Einstellungen in deinem Kurs.
        </p>
      </PeerLayout>
    )
  }

  const message =
    state === 'expired'
      ? 'Dieser Abmeldelink ist abgelaufen. Fordere auf der Austrittsseite einen neuen an.'
      : 'Dieser Abmeldelink ist nicht (mehr) gültig. Fordere auf der Austrittsseite einen neuen an.'

  return (
    <PeerLayout>
      <h1 className="t-display h30-peer__title">Link nicht gültig</h1>
      <p className="t-body-lg h30-peer__intro">{message}</p>
      <p className="t-body-md h30-peer__note">
        <a href="#/verlassen">Zur Austrittsseite</a>
      </p>
    </PeerLayout>
  )
}
