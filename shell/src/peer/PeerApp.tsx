import { useEffect, useState } from 'react'
import { PeerSignup } from './pages/PeerSignup'
import { PeerExitRequest } from './pages/PeerExitRequest'
import { PeerExitSent } from './pages/PeerExitSent'
import { PeerExitDone } from './pages/PeerExitDone'
import { PeerGroupOptin } from './pages/PeerGroupOptin'
import { PeerWaitPool } from './pages/PeerWaitPool'
import { PeerEnrolConfirm } from './pages/PeerEnrolConfirm'
import { getPeerConfig, type PeerConfig } from './lib/peerApi'

// Peer-group context (DL-053): pid-only views, no uid, no localStorage. The three
// designed pages (enrol / exit step 1+2) plus the link landings that the emails need —
// #/abmelden (exit token), #/gruppe (opt-in growth), #/wartepool (wait-pool entry). This
// app deliberately imports nothing from the Shell's state layer. It is built on its own
// (`npm run build:peer`, peer.html emitted as that app's index.html) and deployed to its
// OWN origin — peer.habify30.k-a-d-o.com — so the browser's per-origin isolation makes
// the Shell's uid physically unreadable here (the DPO boundary, DL-086). The Shell is
// never deployed to that origin; that is what keeps the boundary structural.

type View = 'signup' | 'exit' | 'exit-sent' | 'exit-done' | 'group' | 'waitpool' | 'enrol-confirm'

function viewFromHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '')
  if (h.startsWith('bestaetigen')) return 'enrol-confirm' // token-landing from the confirmation email (double opt-in)
  if (h.startsWith('abmelden')) return 'exit-done' // token-landing from the exit email
  if (h.startsWith('gruppe')) return 'group' // opt-in-growth landing from the formation email
  if (h.startsWith('wartepool')) return 'waitpool' // wait-pool landing from the dissolved-group email
  return h.startsWith('verlassen') ? 'exit' : 'signup'
}

function pidFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('pid')?.trim() || null
}

export function PeerApp() {
  const [view, setView] = useState<View>(viewFromHash)
  const [exitEmail, setExitEmail] = useState('')
  const [config, setConfig] = useState<PeerConfig | null>(null)
  const pid = pidFromUrl()

  // Cohort config (domains + cutoff) for whichever view needs it.
  useEffect(() => {
    if (!pid) return
    let live = true
    getPeerConfig(pid)
      .then((c) => { if (live) setConfig(c) })
      .catch(() => { /* offline/backend down — pages degrade to format-only validation */ })
    return () => { live = false }
  }, [pid])

  // Hash only switches the entry view (signup vs exit). The exit→sent transition and
  // the entered email stay in memory — an email address is PII and never goes in the URL.
  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (view === 'enrol-confirm') {
    return <PeerEnrolConfirm />
  }
  if (view === 'exit-done') {
    return <PeerExitDone />
  }
  if (view === 'group') {
    return <PeerGroupOptin />
  }
  if (view === 'waitpool') {
    return <PeerWaitPool />
  }
  if (view === 'exit') {
    return <PeerExitRequest config={config} onSent={(email) => { setExitEmail(email); setView('exit-sent') }} />
  }
  if (view === 'exit-sent') {
    return <PeerExitSent email={exitEmail} />
  }
  return <PeerSignup pid={pid} config={config} />
}
