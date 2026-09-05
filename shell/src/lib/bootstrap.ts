import { accesscontrol } from './api'
import { cacheValidatedPid, readState, resolvePid } from '../state/h30State'

export interface Bootstrap {
  pid: string | null
  valid: boolean
  reason?: 'invalid' | 'expired' | 'nopid' | 'unreachable'
  expiryDate?: string
  programmName?: string
  hasUid: boolean
}

/**
 * App-load resolution (DL-031/DL-055/DL-062): resolve the pid (URL `?pid=` wins,
 * else cached), validate it via accesscontrol, and cache it only on valid:true.
 * The caller decides the initial screen from the result.
 */
export async function bootstrap(): Promise<Bootstrap> {
  const urlPid = new URLSearchParams(window.location.search).get('pid')
  const pid = resolvePid(urlPid)
  const hasUid = !!readState().userId

  if (!pid) return { pid: null, valid: false, reason: 'nopid', hasUid }

  try {
    const ac = await accesscontrol(pid)
    if (ac.valid) {
      cacheValidatedPid(pid)
      return { pid, valid: true, programmName: ac.programmName, hasUid }
    }
    return { pid, valid: false, reason: ac.reason ?? 'invalid', expiryDate: ac.expiryDate, hasUid }
  } catch {
    // Network / Catalyst down → Fehlerseite E (DL-062).
    return { pid, valid: false, reason: 'unreachable', hasUid }
  }
}
