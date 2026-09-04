import { generateMockCode } from './recoveryCode'
import { patchState, readState } from '../state/h30State'

/**
 * Ensure a userId + recoveryCode exist for this device (DL-059).
 * Idempotent: if a uid already exists in h30.state, it is reused — never a second
 * one (DL-059). Seat counting is based on Wizard completion, not on this call.
 *
 * STUB: generates locally. Replace with a POST to `recovery/register(pid)` once the
 * backend is wired — the server returns { uid, code } and is the source of truth.
 */
export function ensureRegistered(): { userId: string; recoveryCode: string } {
  const s = readState()
  if (s.userId && s.recoveryCode) {
    return { userId: s.userId, recoveryCode: s.recoveryCode }
  }
  const userId = crypto.randomUUID()
  const recoveryCode = generateMockCode()
  patchState({ userId, recoveryCode })
  return { userId, recoveryCode }
}
