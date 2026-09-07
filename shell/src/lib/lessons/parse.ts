// Frontmatter + block parser (DL-083). Deliberately small — no CMS, no heavy
// markdown dependency. Prose uses plain Markdown; the rich typed blocks use a
// container-directive syntax:  :::type key=value \n ...inner... \n :::
import type { Block, Lesson, LessonMeta, Phase } from './types'

const PHASES: Phase[] = ['impuls', 'werkstatt', 'momentum']

export function parseFrontmatter(raw: string): { meta: LessonMeta; body: string } {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!m) throw new Error('Lesson is missing YAML frontmatter')
  const fm: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  const phase = fm.phase as Phase
  if (!PHASES.includes(phase)) throw new Error(`Lesson ${fm.id}: invalid phase "${fm.phase}"`)
  const next = fm.next
    ? fm.next.startsWith('[')
      ? fm.next.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
      : fm.next
    : undefined
  const meta: LessonMeta = {
    id: fm.id,
    title: fm.title,
    phase,
    order: Number(fm.order),
    duration: Number(fm.duration),
    summary: fm.summary ?? '',
    next,
  }
  return { meta, body: m[2] }
}

function attrs(header: string): Record<string, string> {
  const out: Record<string, string> = {}
  // first bare token (e.g. "info" in ":::callout info") → `variant`
  const parts = header.trim().split(/\s+/)
  for (const p of parts) {
    const kv = p.match(/^(\w+)=(.*)$/)
    if (kv) out[kv[1]] = kv[2]
    else if (!out._bare) out._bare = p
  }
  return out
}

/** Read `key: value` lines from a directive's inner block into a map. */
function innerFields(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of lines) {
    const kv = l.match(/^(\w+):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].trim()
  }
  return out
}

function directiveBlock(type: string, header: string, inner: string[]): Block | null {
  const a = attrs(header)
  const text = inner.join('\n').trim()
  switch (type) {
    case 'callout':
      return { type: 'callout', variant: a._bare === 'tipp' ? 'tipp' : 'info', text }
    case 'steps': {
      const items = inner
        .map((l) => l.replace(/^\s*(\d+\.|[-*])\s+/, '').trim())
        .filter(Boolean)
      return { type: 'steps', items }
    }
    case 'eingabe': {
      const f = innerFields(inner)
      return {
        type: 'eingabe',
        zweck: a.zweck === 'webinar-frage' ? 'webinar-frage' : 'reflexion',
        prompt: f.prompt ?? text,
      }
    }
    case 'webinar': {
      const f = innerFields(inner)
      return { type: 'webinar', date: f.date ?? '', title: f.title ?? '', joinUrl: f.url }
    }
    case 'image':
      return { type: 'image', src: a.src, caption: innerFields(inner).caption ?? (text || undefined) }
    case 'video':
      return { type: 'video', src: a.src, poster: a.poster }
    case 'quellen':
      return {
        type: 'quellen',
        items: inner.map((l) => l.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean),
      }
    case 'split': {
      const f = innerFields(inner)
      return {
        type: 'split',
        side: a.side === 'rechts' ? 'rechts' : 'links',
        src: a.src,
        title: f.title ?? '',
        text: f.text ?? '',
      }
    }
    case 'accordion': {
      // Each `### Titel` (any heading level) opens an item; the lines beneath it
      // are that item's body until the next heading.
      const items: { title: string; body: string }[] = []
      let cur: { title: string; body: string[] } | null = null
      const push = () => {
        if (cur) items.push({ title: cur.title, body: cur.body.join('\n').trim() })
      }
      for (const l of inner) {
        const h = l.match(/^\s*#{1,6}\s+(.*)$/)
        if (h) {
          push()
          cur = { title: h[1].trim(), body: [] }
        } else if (cur) {
          cur.body.push(l)
        }
      }
      push()
      return { type: 'accordion', items }
    }
    case 'empfehlungen': {
      // `## Kategorie` opens a group; `- kind | Titel | Quelle | url?` adds an item.
      // kind ∈ book · article · video · podcast (drives the row icon).
      type Item = { kind: string; title: string; source: string; url?: string }
      const groups: { category: string; items: Item[] }[] = []
      let cur: { category: string; items: Item[] } | null = null
      for (const l of inner) {
        const h = l.match(/^\s*#{1,6}\s+(.*)$/)
        if (h) {
          cur = { category: h[1].trim(), items: [] }
          groups.push(cur)
          continue
        }
        const item = l.match(/^\s*[-*]\s+(.*)$/)
        if (item && cur) {
          const [kind, title, source, url] = item[1].split('|').map((s) => s.trim())
          cur.items.push({ kind: kind ?? '', title: title ?? '', source: source ?? '', url: url || undefined })
        }
      }
      return { type: 'empfehlungen', groups }
    }
    default:
      return null
  }
}

export function parseBlocks(body: string): Block[] {
  const lines = body.split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let quote: string[] = []
  let table: string[] = []

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'text', markdown: para.join('\n').trim() })
    para = []
  }
  const flushQuote = () => {
    if (quote.length) blocks.push({ type: 'quote', text: quote.join(' ').trim() })
    quote = []
  }
  const flushTable = () => {
    if (table.length) {
      const cells = (r: string) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(table[0])
      const rows = table.slice(2).map(cells) // skip the |---| separator row
      blocks.push({ type: 'table', head, rows })
    }
    table = []
  }
  const flushAll = () => {
    flushPara()
    flushQuote()
    flushTable()
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()

    // directive container
    const dir = t.match(/^:::(\w+)\s*(.*)$/)
    if (dir) {
      flushAll()
      const inner: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== ':::') {
        inner.push(lines[i])
        i++
      }
      const b = directiveBlock(dir[1], dir[2], inner)
      if (b) blocks.push(b)
      continue
    }

    if (t === '') {
      flushAll()
      continue
    }
    if (t === '---' || t === '***') {
      flushAll()
      blocks.push({ type: 'divider' })
      continue
    }
    if (t.startsWith('### ')) {
      flushAll()
      blocks.push({ type: 'heading', level: 3, text: t.slice(4).trim() })
      continue
    }
    if (t.startsWith('## ')) {
      flushAll()
      blocks.push({ type: 'heading', level: 2, text: t.slice(3).trim() })
      continue
    }
    if (t.startsWith('> ')) {
      flushPara()
      flushTable()
      quote.push(t.slice(2).trim())
      continue
    }
    if (t.startsWith('|')) {
      flushPara()
      flushQuote()
      table.push(t)
      continue
    }
    // plain prose line
    flushQuote()
    flushTable()
    para.push(t)
  }
  flushAll()
  return blocks
}

export function parseLesson(raw: string): Lesson {
  const { meta, body } = parseFrontmatter(raw)
  return { meta, blocks: parseBlocks(body) }
}
