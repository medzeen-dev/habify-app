import { register } from './api'
import { patchState, readState } from '../state/h30State'

/**
 * Ensure a userId + recoveryCode exist for this device (DL-059), calling
 * recovery/register(pid) on the server. Idempotent: if a uid already exists in
 * h30.state it is reused — never a second one (DL-059). Seat counting is based on
 * Wizard completion, not on this call.
 */
export async function ensureRegistered(pid: string): Promise<{ userId: string; recoveryCode: string }> {
  const s = readState()
  if (s.userId && s.recoveryCode) {
    return { userId: s.userId, recoveryCode: s.recoveryCode }
  }
  const { uid, code } = await register(pid)
  patchState({ userId: uid, recoveryCode: code })
  return { userId: uid, recoveryCode: code }
}
