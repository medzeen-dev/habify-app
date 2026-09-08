import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { PeerLayout } from '../PeerLayout'
import { groupOptinStatus, toggleGroupOptin } from '../lib/peerApi'

// Opt-in-growth landing (DL-037 A3): the formation email's link (2-person groups only)
// opens #/gruppe?gt=…; the group can open itself to a new member and close again, both
// directions. Copy is provisional — this surface was not in the Figma peer frames.
function tokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get('gt')?.trim() || ''
}

export function PeerGroupOptin() {
  const gt = tokenFromUrl()
  const [state, setState] = useState<'loading' | 'invalid' | 'ready'>(gt ? 'loading' : 'invalid')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!gt) return
    let live = true
    groupOptinStatus(gt).then((r) => {
      if (!live) return
      if (!r.ok) { setState('invalid'); return }
      setOpen(!!r.open)
      setState('ready')
    })
    return () => { live = false }
  }, [gt])

  const toggle = async () => {
    setBusy(true)
    const r = await toggleGroupOptin(gt)
    setBusy(false)
    if (r.ok) setOpen(!!r.open)
  }

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
          Dieser Link gehört zu keiner offenen Gruppe (mehr). Den Link findest du in eurer Gruppen-E-Mail.
        </p>
      </PeerLayout>
    )
  }

  return (
    <PeerLayout>
      <h1 className="t-display h30-peer__title">Eure Peergruppe</h1>
      <p className="t-body-lg h30-peer__intro">
        {open
          ? 'Eure Gruppe ist derzeit offen für ein drittes Mitglied. Sobald jemand aus dem Wartepool passt, wird die Person automatisch zugeordnet.'
          : 'Eure Gruppe ist derzeit geschlossen. Ihr könnt sie für ein drittes Mitglied öffnen — und jederzeit wieder schließen.'}
      </p>
      <div className="h30-peer__cta">
        <Button
          variant="primary"
          label={open ? 'Gruppe wieder schließen' : 'Gruppe für ein neues Mitglied öffnen'}
          disabled={busy}
          onClick={toggle}
        />
      </div>
    </PeerLayout>
  )
}
