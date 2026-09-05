import { useEffect, useState } from 'react'
import { useHashRoute } from './lib/useHashRoute'
import { bootstrap, type Bootstrap } from './lib/bootstrap'
import { Einstieg } from './screens/Einstieg'
import { CodeEingabe } from './screens/CodeEingabe'
import { FehlerseiteF } from './screens/FehlerseiteF'
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

  // Explicit sub-routes (interim hash nav) stay reachable.
  switch (route) {
    case 'code':
      return <CodeEingabe onBack={() => navigate('einstieg')} onSuccess={() => navigate('home')} />
    case 'fehler-f':
      return <FehlerseiteF onSuccess={() => navigate('home')} />
    case 'wizard':
      return <Wizard pid={boot.pid} onRecover={() => navigate('code')} onComplete={() => navigate('home')} />
    case 'home':
      return <Home />
    default:
      break
  }

  // Default screen decided by the pid bootstrap.
  if (boot.valid) {
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

  // No pid → Fehlerseite F (DL-062). TODO: invalid → B, expired → C, unreachable → E (copy pending).
  return <FehlerseiteF onSuccess={() => navigate('home')} />
}
