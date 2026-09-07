// The one accessor for the Shell's client state (DL-081 §2, "one h30.state
// accessor module ... before any screen"). Every screen reads and writes through
// here — never localStorage directly — so a field change is made once and
// migration stays centralised.

import type { H30State, LessonProgress } from './types'

const STORAGE_KEY = 'h30.state'

/** Current schema version. Bump when the shape changes and add a migration step. */
export const H30_SCHEMA_VERSION = 1

function defaultState(): H30State {
  return {
    schemaVersion: H30_SCHEMA_VERSION,
    pid: null,
    userId: null,
    recoveryCode: null,
    wizardCompleted: false,
    language: null,
    progress: { lessons: {} },
    ui: {},
  }
}

/**
 * Migrate-on-read (same discipline DL-026 used for key rotation, applied to plain
 * localStorage). Unknown/older versions are upgraded field-by-field so a returning
 * participant is never broken by a shape change. For v1 we only backfill missing
 * fields against the default.
 */
function migrate(parsed: Partial<H30State> | null): H30State {
  const base = defaultState()
  if (!parsed || typeof parsed !== 'object') return base
  // Future: switch on parsed.schemaVersion to run stepwise upgrades.
  return {
    ...base,
    ...parsed,
    schemaVersion: H30_SCHEMA_VERSION,
    progress: { lessons: { ...base.progress.lessons, ...(parsed.progress?.lessons ?? {}) } },
    ui: { ...base.ui, ...(parsed.ui ?? {}) },
  }
}

/** Read the whole state. Always returns a valid object, even if storage is empty,
 *  blocked (private mode), or corrupt — the Shell must render regardless. */
export function readState(): H30State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return migrate(JSON.parse(raw) as Partial<H30State>)
  } catch {
    return defaultState()
  }
}

/** Persist the whole state. Silently no-ops if storage is unavailable. */
export function writeState(state: H30State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable/full (private mode, quota) — non-fatal by design.
  }
}

/** Shallow-merge a partial update and persist. Returns the new state. */
export function patchState(partial: Partial<H30State>): H30State {
  const next = { ...readState(), ...partial }
  writeState(next)
  return next
}

/**
 * pid resolution order (DL-031): a pid in the URL wins for this page load; the
 * cached pid is only a fallback when the URL has none. This does NOT cache — a pid
 * is cached only AFTER accesscontrol returns valid:true (see cacheValidatedPid).
 */
export function resolvePid(urlPid: string | null | undefined): string | null {
  const fromUrl = urlPid?.trim()
  if (fromUrl) return fromUrl
  return readState().pid
}

/** Cache a pid only once it has validated as valid:true (DL-031). */
export function cacheValidatedPid(pid: string): void {
  patchState({ pid })
}

// --- Lesson progress (DL-083 §6 / DL-085) ---

export function getLessonProgress(id: string): LessonProgress {
  return readState().progress.lessons[id] ?? { status: 'not-started' }
}

function updateLesson(id: string, patch: Partial<LessonProgress>): void {
  const s = readState()
  const lessons = { ...s.progress.lessons, [id]: { ...getLessonProgress(id), ...patch } }
  writeState({ ...s, progress: { lessons } })
}

/** Explicit "Lektion abschließen" (DL-060). Completion drives the Home task list
 *  (a completed deadline task disappears — DL-052/DL-085). */
export function markLessonCompleted(id: string): void {
  updateLesson(id, { status: 'completed' })
}

/** Resume pointer: the last section reached (a discrete index, DL-083 §4). */
export function setLastSection(id: string, index: number): void {
  const cur = getLessonProgress(id)
  updateLesson(id, { lastSection: index, status: cur.status === 'completed' ? 'completed' : 'in-progress' })
}
