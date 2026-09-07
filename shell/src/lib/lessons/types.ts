// Lesson content model for the Page-Builder (DL-083/DL-085).
// "Content is not code": lessons are Markdown + YAML frontmatter, parsed at load
// into these typed blocks and rendered by token-bound components. The block set
// mirrors the 15 Figma library blocks 1:1.

export type Phase = 'impuls' | 'werkstatt' | 'momentum'

/** Frontmatter schema (DL-083 §2). `next` is optional; default = next by order. */
export interface LessonMeta {
  id: string
  title: string
  phase: Phase
  order: number
  duration: number // minutes (estimate)
  summary: string
  next?: string | string[]
}

/** Typed content blocks (DL-083 §1 + DL-085). One renderer component per type. */
export type Block =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'text'; markdown: string }
  | { type: 'quote'; text: string }
  | { type: 'callout'; variant: 'info' | 'tipp'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'divider' }
  | { type: 'image'; src?: string; caption?: string }
  | { type: 'video'; src?: string; poster?: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'split'; side: 'links' | 'rechts'; src?: string; title: string; text: string }
  | { type: 'accordion'; items: { title: string; body: string }[] }
  | { type: 'eingabe'; zweck: 'reflexion' | 'webinar-frage'; prompt: string }
  | { type: 'webinar'; date: string; title: string; joinUrl?: string }
  | { type: 'quellen'; items: string[] }
  | {
      type: 'empfehlungen'
      groups: { category: string; items: { kind: string; title: string; source: string; url?: string }[] }[]
    }

export interface Lesson {
  meta: LessonMeta
  blocks: Block[]
}

export type LessonStatus = 'not-started' | 'in-progress' | 'completed'

/** Per-lesson progress (fills the DL-081 §6 `progress` namespace, owned by DL-076/083/085). */
export interface LessonProgress {
  status: LessonStatus
  lastSection?: number // section index for resume (DL-083 §4)
}
