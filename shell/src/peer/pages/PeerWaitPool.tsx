import { useEffect, useState } from 'react'
import { PeerLayout } from '../PeerLayout'
import { joinPool } from '../lib/peerApi'

// Wait-pool landing (DL-087): the "your group was dissolved" email links here. Opening
// the link IS the active act of entering the pool — matching then runs immediately, so
// the page can already report that a group was found. Copy is provisional (not in Figma).
function tokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get('pt')?.trim() || ''
}

export function PeerWaitPool() {
  const pt = tokenFromUrl()
  const [state, setState] = useState<'loading' | 'waiting' | 'matched' | 'invalid'>(pt ? 'loading' : 'invalid')

  useEffect(() => {
    if (!pt) return
    let live = true
    joinPool(pt).then((r) => {
      if (!live) return
      if (!r.ok) { setState('invalid'); return }
      setState(r.matched ? 'matched' : 'waiting')
    })
    return () => { live = false }
  }, [pt])

  if (state === 'loading') {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Einen Moment…</h1>
      </PeerLayout>
    )
  }

  if (state === 'invalid') {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Link nicht gültig</h1>
        <p className="t-body-lg h30-peer__intro">
          Dieser Link ist nicht (mehr) gültig. Du findest ihn in der E-Mail, mit der wir dich über die Auflösung deiner
          Gruppe informiert haben.
        </p>
      </PeerLayout>
    )
  }

  if (state === 'matched') {
    return (
      <PeerLayout>
        <h1 className="t-display h30-peer__title">Du hast eine neue Gruppe</h1>
        <p className="t-body-lg h30-peer__intro">
          Es hat sofort gepasst — du bist bereits einer Gruppe zugeordnet. Die Kontaktdaten stehen in der E-Mail, die
          gerade an dich rausgegangen ist.
        </p>
      </PeerLayout>
    )
  }

  return (
    <PeerLayout>
      <h1 className="t-display h30-peer__title">Du stehst auf der Warteliste</h1>
      <p className="t-body-lg h30-peer__intro">
        Sobald eine zweite wartende Person da ist, bilden wir aus euch beiden eine Gruppe — auf eine dritte warten wir
        nicht. Öffnet sich vorher eine bestehende Zweiergruppe, kommst du dort dazu. In beiden Fällen bekommst du sofort
        eine E-Mail mit den Kontaktdaten.
      </p>
      <p className="t-body-md h30-peer__note">
        Tut sich drei Tage lang nichts, fragen wir bestehende Zweiergruppen, ob sie sich öffnen. Eine Zuordnung ist aber
        nicht garantiert — trägt sich in diesem Durchlauf niemand mehr ein, kann es diesmal nichts werden.
      </p>
      <p className="t-body-sm h30-peer__footnote">
        Diese Seite gehört nicht zu deinem Kurszugang. Deine E-Mail-Adresse wird nicht mit deinem Kursfortschritt
        verknüpft.
      </p>
    </PeerLayout>
  )
}
