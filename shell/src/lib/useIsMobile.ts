import { useEffect, useState } from 'react'

/** Tracks the mobile breakpoint (< 768px). Used where layout differs structurally
 *  (not just by CSS) — e.g. Einstellungen renders open cards on desktop but a
 *  collapsible accordion on mobile (DL-067). */
export function useIsMobile(query = '(max-width: 767px)'): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}
