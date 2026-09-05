import { useEffect, useState } from 'react'
import { useHashRoute } from './lib/useHashRoute'
import { bootstrap, type Bootstrap } from './lib/bootstrap'
import { patchState, readState } from './state/h30State'
import { Einstieg } from './screens/Einstieg'
import { CodeEingabe } from './screens/CodeEingabe'
import { Fehlerseite } from './screens/Fehlerseite'
import { KonfliktProgramm } from './screens/KonfliktProgramm'
import { Wizard } from './screens/Wizard'
import { Home } from './screens/Home'

export default function App() {
  const [route, navigate] = useHashRoute()
  const [boot, setBoot] = useState<Bootstrap | null>(null)

  // App-load pid resolution + accesscontrol (DL-031/055/062).
  useEffect(() => {
    bootstrap().then(setBoot)
  }, [])

  if (!boot) return null // brief splash while accesscontrol runs

  const reboot = () => {
    setBoot(null)
    bootstrap().then(setBoot)
  }
  const stripPid = () =>
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)

  // Explicit sub-routes (interim hash nav) stay reachable.
  switch (route) {
    case 'code':
      return <CodeEingabe onBack={() => navigate('einstieg')} onSuccess={() => navigate('home')} />
    case 'fehler-f':
      return <Fehlerseite state="F" onSuccess={() => navigate('home')} />
    case 'wizard':
      return <Wizard pid={readState().pid} onRecover={() => navigate('code')} onComplete={() => navigate('home')} />
    case 'home':
      return <Home />
    default:
      break
  }

  if (boot.kind === 'ok') {
    return boot.hasUid ? (
      <Home />
    ) : (
      <Einstieg
        programmName={boot.programmName}
        onNew={() => navigate('wizard')}
        onRecover={() => navigate('code')}
      />
    )
  }

  if (boot.kind === 'conflict') {
    const { urlPid } = boot
    return (
      <KonfliktProgramm
        programmName={boot.programmName}
        onStartNew={() => {
          patchState({ pid: urlPid, userId: null, recoveryCode: null }) // DL-031: switch, fresh uid
          stripPid()
          reboot()
        }}
        onKeepCurrent={() => {
          stripPid() // discard the URL pid, keep cached state
          reboot()
        }}
      />
    )
  }

  // boot.kind === 'error' → Fehlerseite state (DL-062).
  const map = { invalid: 'B', expired: 'C', unreachable: 'E', nopid: 'F' } as const
  return <Fehlerseite state={map[boot.reason]} expiryDate={boot.expiryDate} onSuccess={() => navigate('home')} />
}
