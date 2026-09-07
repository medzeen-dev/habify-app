import { accesscontrol } from './api'
import { cacheValidatedPid, readState } from '../state/h30State'

export type Bootstrap =
  | { kind: 'ok'; programmName?: string; hasUid: boolean; momentumStartDate?: string }
  | { kind: 'conflict'; urlPid: string; cachedPid: string; programmName?: string }
  | { kind: 'error'; reason: 'invalid' | 'expired' | 'nopid' | 'unreachable'; expiryDate?: string }

/**
 * App-load resolution (DL-031/055/062). URL `?pid=` is authoritative for the load;
 * the cached pid is the fallback. A URL pid is cached only after accesscontrol
 * returns valid:true. A *valid* URL pid that differs from a cached pid is a conflict
 * (DL-031) — never a silent switch. An invalid URL pid is a plain access-denied (B/C),
 * regardless of any cached pid.
 */
export async function bootstrap(): Promise<Bootstrap> {
  const urlPid = new URLSearchParams(window.location.search).get('pid')?.trim() || null
  const cachedPid = readState().pid
  const hasUid = !!readState().userId

  if (!urlPid && !cachedPid) return { kind: 'error', reason: 'nopid' }

  if (urlPid) {
    try {
      const ac = await accesscontrol(urlPid)
      if (!ac.valid) {
        return { kind: 'error', reason: ac.reason ?? 'invalid', expiryDate: ac.expiryDate }
      }
      if (cachedPid && cachedPid !== urlPid) {
        return { kind: 'conflict', urlPid, cachedPid, programmName: ac.programmName }
      }
      cacheValidatedPid(urlPid)
      return { kind: 'ok', programmName: ac.programmName, hasUid, momentumStartDate: ac.capabilities?.momentumStartDate }
    } catch {
      return { kind: 'error', reason: 'unreachable' }
    }
  }

  // No URL pid → cached pid.
  try {
    const ac = await accesscontrol(cachedPid as string)
    if (!ac.valid) return { kind: 'error', reason: ac.reason ?? 'invalid', expiryDate: ac.expiryDate }
    return { kind: 'ok', programmName: ac.programmName, hasUid, momentumStartDate: ac.capabilities?.momentumStartDate }
  } catch {
    return { kind: 'error', reason: 'unreachable' }
  }
}
