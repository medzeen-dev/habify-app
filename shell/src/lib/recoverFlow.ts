import { accesscontrol, recover } from './api'
import { cacheValidatedPid, patchState } from '../state/h30State'
import { RECOVERY_ERROR } from './recoveryCode'

export type RecoverResult = { ok: true } | { ok: false; error: string }

/**
 * Recovery path (DL-057): `/recover` first (returns pid + uid), then accesscontrol(pid).
 * On success caches the validated pid (DL-031) and restores the uid into h30.state.
 * Assumes the caller already validated the code's checksum locally (DL-029).
 */
export async function runRecover(code: string): Promise<RecoverResult> {
  try {
    const rec = await recover(code)
    if (rec.rateLimited) {
      return { ok: false, error: RECOVERY_ERROR.rateLimit }
    }
    if (!rec.found || !rec.pid || !rec.user_id) {
      return { ok: false, error: RECOVERY_ERROR.notFound }
    }
    const ac = await accesscontrol(rec.pid)
    if (!ac.valid) {
      // Recovered account, but its pid is invalid/expired. Full B/C routing follows later.
      return { ok: false, error: RECOVERY_ERROR.notFound }
    }
    cacheValidatedPid(rec.pid)
    patchState({ userId: rec.user_id })
    return { ok: true }
  } catch {
    return { ok: false, error: RECOVERY_ERROR.notFound }
  }
}
