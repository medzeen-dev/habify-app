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
import { Einstellungen } from './screens/Einstellungen'
import { LessonView } from './screens/lesson/LessonView'
import { lessonsForPhase, firstLessonId, getLesson } from './lib/lessons/loader'
import { isPhaseUnlocked } from './lib/lessons/gate'
import { getLessonProgress } from './state/h30State'
import type { Phase } from './lib/lessons/types'
import type { TabKey } from './screens/home/homeData'

export default function App() {
  const { route, lessonId, navigate, openLesson } = useHashRoute()
  const [boot, setBoot] = useState<Bootstrap | null>(null)

  // App-load pid resolution + accesscontrol (DL-031/055/062).
  useEffect(() => {
    bootstrap().then(setBoot)
  }, [])

  const momentumStartDate = boot?.kind === 'ok' ? boot.momentumStartDate : undefined

  // Routing-enforced phase gate (DL-030/048/083): a locked phase's lesson is not
  // loadable, even via deep-link — bounce it back to Home. Tab status is not a gate.
  useEffect(() => {
    if (route !== 'lektion' || !lessonId) return
    const lesson = getLesson(lessonId)
    if (lesson && !isPhaseUnlocked(lesson.meta.phase, { momentumStartDate })) {
      window.location.hash = '/home'
    }
    // navigate() is stable for this interim hash router; re-check on route/lesson/date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, lessonId, momentumStartDate])

  if (!boot) return null // brief splash while accesscontrol runs

  const reboot = () => {
    setBoot(null)
    bootstrap().then(setBoot)
  }
  const stripPid = () =>
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)

  // Nav targets. Phase tabs open the phase's resume lesson (DL-083): the first
  // not-completed lesson, else its first lesson.
  const resumeLesson = (phase: Phase): string | undefined => {
    const ls = lessonsForPhase(phase)
    return (ls.find((l) => getLessonProgress(l.meta.id).status !== 'completed') ?? ls[0])?.meta.id
  }
  const onNavigate = (target: TabKey | 'einstellungen') => {
    if (target === 'home' || target === 'einstellungen') navigate(target)
    else {
      if (!isPhaseUnlocked(target, { momentumStartDate })) return // gated phase — inert (DL-048)
      const id = resumeLesson(target) ?? firstLessonId(target)
      if (id) openLesson(id)
    }
  }

  // Explicit sub-routes (interim hash nav) stay reachable.
  if (route === 'lektion' && lessonId) {
    const lesson = getLesson(lessonId)
    // A locked phase renders nothing here; the gate effect above redirects to Home.
    if (lesson && !isPhaseUnlocked(lesson.meta.phase, { momentumStartDate })) return null
    return <LessonView lessonId={lessonId} onOpenLesson={openLesson} onNavigate={onNavigate} />
  }
  switch (route) {
    case 'code':
      return <CodeEingabe onBack={() => navigate('einstieg')} onSuccess={() => navigate('home')} />
    case 'fehler-f':
      return <Fehlerseite state="F" onSuccess={() => navigate('home')} />
    case 'wizard':
      return <Wizard pid={readState().pid} onRecover={() => navigate('code')} onComplete={() => navigate('home')} />
    case 'home':
      return <Home onNavigate={onNavigate} />
    case 'einstellungen':
      return <Einstellungen onNavigate={onNavigate} />
    default:
      break
  }

  if (boot.kind === 'ok') {
    return boot.hasUid ? (
      <Home onNavigate={onNavigate} />
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
