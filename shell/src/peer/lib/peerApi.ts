// Peer-group client contract (DL-070 → superseded for peer-group by the native
// decision: pages are native, data + email go through our own Catalyst pipeline,
// NOT Zoho Forms). This module is the client half of that contract and is
// deliberately self-contained: it shares NO code with the uid-aware Shell (no
// h30State, no localStorage) — the peer context never sees a user_id (DL-053).
//
// `pid` is taken from the URL by the caller and passed in explicitly; it is never
// read from or written to localStorage here.
//
// NOTE: /peer/enrol and /peer/exit-request are the agreed endpoint shapes; the
// Catalyst Functions behind them (store signup, send ZeptoMail confirmation, wait-
// pool matching) are built separately in the host terminal. /accesscontrol already
// exists and carries the cohort capabilities.

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export interface PeerConfig {
  allowedDomains: string[]
  exceptions: string[]
  /** ISO date of the Momentum-matching cutoff (DL-035/048), shown as {stichtag}. */
  cutoffDate?: string
}

interface AccessControlLike {
  valid?: boolean
  capabilities?: {
    allowedEmailDomains?: string[]
    manualDomainExceptions?: string[]
    peerGroupCutoffDate?: string
  }
}

/** Cohort config for the enrolment page (domains + cutoff), from accesscontrol(pid). */
export async function getPeerConfig(pid: string): Promise<PeerConfig> {
  const res = await fetch(`${BASE}/accesscontrol/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  })
  const j = (await res.json()) as AccessControlLike
  const c = j.capabilities ?? {}
  return {
    allowedDomains: c.allowedEmailDomains ?? [],
    exceptions: c.manualDomainExceptions ?? [],
    cutoffDate: c.peerGroupCutoffDate,
  }
}

/** Enrol the address on the cohort signup list. Consent is a UI gate (DL-036); we
 *  record it explicitly too. No uid is sent — peer signup is pid-only (DL-053). */
export async function enrolPeer(input: { pid: string; email: string }): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/peer/enrol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: input.pid, email: input.email.trim(), consent: true }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}

/**
 * Request an exit link for an address. Fire-and-forget by design: the page advances
 * to the confirmation view REGARDLESS of the outcome, because it must not reveal
 * whether the address is enrolled (DL-053). The backend sends the exit email only if
 * the address is actually in a group.
 */
export async function requestPeerExit(input: { email: string; pid: string | null }): Promise<void> {
  try {
    await fetch(`${BASE}/peer/exit-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: input.email.trim(), pid: input.pid }),
    })
  } catch {
    // Swallow — the confirmation view is non-revealing and must render either way.
  }
}

export type ExitConfirmResult = 'done' | 'invalid' | 'expired' | 'error'

/**
 * Confirm an exit via the one-time token from the exit email (the #/abmelden landing).
 * Unlike the request step, the outcome may be shown — the token is the secret, held
 * only by the mailbox owner (DL-086).
 */
export async function confirmPeerExit(token: string): Promise<ExitConfirmResult> {
  try {
    const res = await fetch(`${BASE}/peer/exit-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string }
    if (j.ok) return 'done'
    return j.reason === 'expired' ? 'expired' : 'invalid'
  } catch {
    return 'error'
  }
}

export interface GroupOptinState {
  ok: boolean
  open?: boolean
}

/** Read whether a 2-person group is open to a new member (opt-in-growth, DL-037). */
export async function groupOptinStatus(gt: string): Promise<GroupOptinState> {
  try {
    const res = await fetch(`${BASE}/peer/group-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gt }),
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; open?: boolean }
    return { ok: !!j.ok, open: j.open }
  } catch {
    return { ok: false }
  }
}

export interface PoolJoinResult {
  ok: boolean
  /** true when the click already produced a group (someone was waiting / a group was open). */
  matched?: boolean
}

/**
 * Enter the wait pool via the link from the "your group was dissolved" email (DL-087).
 * Entering the pool is always the participant's own act — never automatic.
 */
export async function joinPool(pt: string): Promise<PoolJoinResult> {
  try {
    const res = await fetch(`${BASE}/peer/pool-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pt }),
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; matched?: boolean }
    return { ok: !!j.ok, matched: j.matched }
  } catch {
    return { ok: false }
  }
}

/** Toggle that flag (the formation email's link, both directions — DL-037 A3). */
export async function toggleGroupOptin(gt: string): Promise<GroupOptinState> {
  try {
    const res = await fetch(`${BASE}/peer/group-optin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gt }),
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; open?: boolean }
    return { ok: !!j.ok, open: j.open }
  } catch {
    return { ok: false }
  }
}
