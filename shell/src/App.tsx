import { useHashRoute } from './lib/useHashRoute'
import { Einstieg } from './screens/Einstieg'
import { CodeEingabe } from './screens/CodeEingabe'
import { FehlerseiteF } from './screens/FehlerseiteF'
import { Wizard } from './screens/Wizard'
import { Home } from './screens/Home'

export default function App() {
  const [route, navigate] = useHashRoute()

  // Valid recovery code → /recover then accesscontrol(pid) (DL-057). Backend wiring follows.
  const onRecoverSubmit = (code: string) =>
    console.info('[Recovery] gültiger Code — würde /recover → accesscontrol(pid) aufrufen (DL-057):', code)

  switch (route) {
    case 'code':
      return <CodeEingabe onBack={() => navigate('einstieg')} onSubmit={onRecoverSubmit} />
    case 'fehler-f':
      return <FehlerseiteF onSubmit={onRecoverSubmit} />
    case 'wizard':
      return <Wizard onRecover={() => navigate('code')} onComplete={() => navigate('home')} />
    case 'home':
      return <Home />
    default:
      return <Einstieg onNew={() => navigate('wizard')} onRecover={() => navigate('code')} />
  }
}
