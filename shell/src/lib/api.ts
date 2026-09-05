import type { AccessControlResponse, RecoverResponse, RegisterResponse } from '../state/types'
import { normalizeCode } from './recoveryCode'

// In dev, calls go to '/api' (Vite proxies to Dev Catalyst — same-origin, no CORS).
// In prod, set VITE_API_BASE to https://api.habify30.k-a-d-o.com/server.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as T
}

/** accesscontrol(pid) — fail-closed, always HTTP 200, branch on `valid` only (DL-029/058). */
export function accesscontrol(pid: string): Promise<AccessControlResponse> {
  return postJson<AccessControlResponse>('/accesscontrol/', { pid })
}

/** recovery/register(pid) — creates uid + recovery code at Wizard Step 2 (DL-059). */
export async function register(pid: string): Promise<RegisterResponse> {
  const r = await postJson<{ user_id: string; recovery_code: string }>('/recovery/register', { pid })
  return { uid: r.user_id, code: normalizeCode(r.recovery_code) }
}

/** recovery/recover(code) — recovery path, called before accesscontrol (DL-057). */
export function recover(code: string): Promise<RecoverResponse> {
  return postJson<RecoverResponse>('/recovery/recover', { recovery_code: code })
}
