import { useEffect, useState } from 'react'

// Interim hash routing so the entry/wizard/lesson screens are navigable/deep-linkable.
// The real Shell routing (URL pid lifecycle — DL-030/031/062) and routing-enforced
// phase gating (DL-083) replace this once the backend is wired.
const ROUTES = ['einstieg', 'code', 'fehler-f', 'wizard', 'home', 'einstellungen'] as const
export type BaseRoute = (typeof ROUTES)[number]
export type Route = BaseRoute | 'lektion'

export interface HashRoute {
  route: Route
  /** Present when route === 'lektion' — the lesson id (DL-083 deep-link, §4 resume). */
  lessonId?: string
  navigate: (r: BaseRoute) => void
  openLesson: (id: string) => void
}

function parse(): { route: Route; lessonId?: string } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const lesson = raw.match(/^lektion\/(.+)$/)
  if (lesson) return { route: 'lektion', lessonId: decodeURIComponent(lesson[1]) }
  return { route: (ROUTES as readonly string[]).includes(raw) ? (raw as BaseRoute) : 'einstieg' }
}

export function useHashRoute(): HashRoute {
  const [state, setState] = useState(parse)

  useEffect(() => {
    const onHash = () => setState(parse())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (r: BaseRoute) => {
    window.location.hash = r === 'einstieg' ? '/' : `/${r}`
  }
  const openLesson = (id: string) => {
    window.location.hash = `/lektion/${encodeURIComponent(id)}`
  }

  return { route: state.route, lessonId: state.lessonId, navigate, openLesson }
}
