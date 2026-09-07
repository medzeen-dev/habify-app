// Data-driven lesson loader (DL-083 §7): the lesson count is NOT hardcoded —
// lessons are discovered from files and ordered by phase + order. Physical source
// is bundled Markdown for now (OQ-036 leaves runtime storage open; the renderer is
// identical either way, so only this module changes if the source moves).
import type { Lesson, Phase } from './types'
import { parseLesson } from './parse'

// Vite bundles every .md under content/lessons as a raw string, discovered at build.
const files = import.meta.glob('../../content/lessons/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const ALL: Lesson[] = Object.values(files)
  .map((raw) => parseLesson(raw))
  .sort((a, b) =>
    a.meta.phase === b.meta.phase
      ? a.meta.order - b.meta.order
      : phaseIndex(a.meta.phase) - phaseIndex(b.meta.phase),
  )

const BY_ID = new Map(ALL.map((l) => [l.meta.id, l]))

function phaseIndex(p: Phase): number {
  return (['impuls', 'werkstatt', 'momentum'] as Phase[]).indexOf(p)
}

export function getLesson(id: string): Lesson | undefined {
  return BY_ID.get(id)
}

export function lessonsForPhase(phase: Phase): Lesson[] {
  return ALL.filter((l) => l.meta.phase === phase)
}

/** The next lesson: explicit `next` wins, else the next by order within the phase. */
export function nextLessonId(id: string): string | undefined {
  const l = BY_ID.get(id)
  if (!l) return undefined
  const explicit = typeof l.meta.next === 'string' ? l.meta.next : Array.isArray(l.meta.next) ? l.meta.next[0] : undefined
  if (explicit && BY_ID.has(explicit)) return explicit
  const siblings = lessonsForPhase(l.meta.phase)
  const i = siblings.findIndex((s) => s.meta.id === id)
  const byOrder = i >= 0 && i < siblings.length - 1 ? siblings[i + 1].meta.id : undefined
  return byOrder // existence guaranteed (it came from the loaded set)
}

/** First lesson of a phase (the resume fallback when nothing is started yet). */
export function firstLessonId(phase: Phase): string | undefined {
  return lessonsForPhase(phase)[0]?.meta.id
}
