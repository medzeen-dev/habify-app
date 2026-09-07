// Client state & backend-contract types for the habify30 Shell.
// Source of truth: habify canon DL-081 (client state & storage contract).
// Field-level rationale lives in the referenced DLs, not here.

/**
 * Per-cohort capabilities / config, delivered together with the accesscontrol
 * response and read once at Shell load (DL-081 §3a). The overall schema is
 * intentionally OPEN and additive (OQ-028) — only the currently-decided fields
 * are typed here; new capability fields are added here, never invented per screen.
 */
export interface Capabilities {
  programmName?: string // DL-058 (Einstieg sub-line)
  contactEmail?: string // DL-058 (reserved, not displayed)
  momentumStartDate?: string // DL-030 / DL-048 (ISO date)
  peerGroupCutoffDate?: string // DL-051 / DL-053 (ISO date)
  coachName?: string // DL-046
  coachImageUrl?: string // DL-046 (*.k-a-d-o.com, 256×256, circle-masked)
  coachingEnabled?: boolean // DL-038
  bookingsServiceId?: string // DL-038
  allowedEmailDomains?: string[] // DL-036 (pid-only contexts)
  manualDomainExceptions?: string[] // DL-036
  aiCoach?: { enabled: boolean; tier: 1 | 2 | 3 } // DL-041 / DL-071
  language?: string // OQ-028 (default language)
  clientLogo?: string // OQ-026 (mechanism open)
  // cohort schedule (webinars + phase dates): shape TBD (DL-030 / DL-045)
}

/**
 * `accesscontrol` response (DL-029 / DL-058). Fail-closed, always HTTP 200 —
 * branch on `valid` ONLY. `reason` / `expiryDate` / `programmName` / `contactEmail`
 * are display-tier and must never gate access (DL-058).
 * The capabilities object arrives on the same payload (§3a); the exact wire
 * placement is not finalised (OQ-028), so the app normalises it into `capabilities`.
 */
export interface AccessControlResponse {
  valid: boolean
  reason?: 'invalid' | 'expired'
  expiryDate?: string
  programmName?: string
  contactEmail?: string
  capabilities?: Capabilities
}

/** `recovery/register` — called at Wizard Step 2, only after valid:true (DL-059). */
export interface RegisterResponse {
  uid: string
  code: string // 8 symbols, displayed "XXXX-XXXX" (DL-029)
}

/** `recovery/recover` — recovery path: called first, before accesscontrol (DL-057). */
export interface RecoverResponse {
  found: boolean
  user_id?: string
  pid?: string
  rateLimited?: boolean // too many attempts from this IP (DL-057)
}

/** Local-only, per-device UI flags (DL-081 §2a). "dismissed" means "seen", never
 *  "subscribed" (DL-045) — no field here may imply subscription state. */
export interface H30UiFlags {
  recoveryPromptSeen?: boolean
  emailSignupTaskDismissed?: boolean
  [key: string]: boolean | undefined
}

/** Per-lesson progress (DL-083 §6 / DL-085). Completion is the explicit "abschließen"
 *  action (DL-060); a completed deadline task then disappears from Home (DL-052/DL-085). */
export interface LessonProgress {
  status: 'not-started' | 'in-progress' | 'completed'
  lastSection?: number // section index for resume (DL-083 §4)
}

/** `progress` namespace — owned by DL-076/083/085, reserved by DL-081 §6. */
export interface ProgressState {
  lessons: Record<string, LessonProgress>
}

/** The single client store, persisted under localStorage key `h30.state` (DL-081 §2). */
export interface H30State {
  schemaVersion: number
  pid: string | null // cached only after accesscontrol valid:true (DL-031)
  userId: string | null // UUID v4, from recovery/register at Wizard Step 2 (DL-059)
  recoveryCode: string | null // "XXXX-XXXX" (DL-029 / DL-059)
  wizardCompleted: boolean // set on click-through to Wizard end, never server (DL-051)
  language: string | null // null = follow navigator.language until user switches (DL-051)
  progress: ProgressState // DL-083 §6 (was reserved under DL-081 §6)
  ui: H30UiFlags
}
