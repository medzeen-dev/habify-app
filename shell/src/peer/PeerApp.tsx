import { useEffect, useState } from 'react'
import { PeerSignup } from './pages/PeerSignup'
import { PeerExitRequest } from './pages/PeerExitRequest'
import { PeerExitSent } from './pages/PeerExitSent'
import { PeerExitDone } from './pages/PeerExitDone'
import { getPeerConfig, type PeerConfig } from './lib/peerApi'

// Peer-group context (DL-053): three pid-only views, no uid, no localStorage. This
// app deliberately imports nothing from the Shell's state layer. It ships as its own
// entry (peer.html) and is deployed to its OWN origin so the browser's per-origin
// isolation makes the Shell's uid physically unreadable here (the DPO boundary).

type View = 'signup' | 'exit' | 'exit-sent' | 'exit-done'

function viewFromHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '')
  if (h.startsWith('abmelden')) return 'exit-done' // token-landing from the exit email
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

  if (view === 'exit-done') {
    return <PeerExitDone />
  }
  if (view === 'exit') {
    return <PeerExitRequest config={config} onSent={(email) => { setExitEmail(email); setView('exit-sent') }} />
  }
  if (view === 'exit-sent') {
    return <PeerExitSent email={exitEmail} />
  }
  return <PeerSignup pid={pid} config={config} />
}
