import { useEffect, useState } from 'react'

// Interim hash routing so the entry/wizard screens are navigable/deep-linkable.
// The real Shell routing (URL pid lifecycle — which screen shows when, DL-030/031/062)
// replaces this once the backend is wired.
const ROUTES = ['einstieg', 'code', 'fehler-f', 'wizard', 'home', 'einstellungen'] as const
export type Route = (typeof ROUTES)[number]

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(h) ? h : 'einstieg'
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse)

  useEffect(() => {
    const onHash = () => setRoute(parse())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (r: Route) => {
    window.location.hash = r === 'einstieg' ? '/' : `/${r}`
  }

  return [route, navigate]
}
