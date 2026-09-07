// Phase unlock rule (DL-030 / DL-048 / DL-083). The ONE source of truth for whether
// a phase is reachable — used both for the Nav tab status (display) and to enforce
// routing (a locked phase's lesson is not loadable, even via deep-link). "Locked" is
// never only a tab colour; enforcement lives on the route (App), gated by this.
import { getLessonProgress } from '../../state/h30State'
import { lessonsForPhase } from './loader'
import type { Phase } from './types'

/** A phase counts as complete when all its lessons are marked completed (DL-083 §6). */
function phaseCompleted(phase: Phase): boolean {
  const ls = lessonsForPhase(phase)
  return ls.length > 0 && ls.every((l) => getLessonProgress(l.meta.id).status === 'completed')
}

export interface GateContext {
  /** ISO date the Momentum phase opens for the cohort (DL-030 / DL-048, capabilities). */
  momentumStartDate?: string
  /** Injectable clock (tests); defaults to the real now. */
  now?: Date
}

/**
 * Fail-closed phase gate (DL-048 + homeData header):
 * - impuls: always open (reachable from invitation).
 * - werkstatt: progress-based — opens once the Impulsphase is complete.
 * - momentum: the one hard date-gate — needs the Werkstatt complete AND the cohort's
 *   momentumStartDate reached. An unknown or unparseable date keeps it locked.
 */
export function isPhaseUnlocked(phase: Phase, ctx: GateContext = {}): boolean {
  switch (phase) {
    case 'impuls':
      return true
    case 'werkstatt':
      return phaseCompleted('impuls')
    case 'momentum': {
      if (!phaseCompleted('werkstatt')) return false
      if (!ctx.momentumStartDate) return false
      const start = new Date(ctx.momentumStartDate)
      if (Number.isNaN(start.getTime())) return false
      return (ctx.now ?? new Date()) >= start
    }
  }
}
