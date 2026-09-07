import type { ReactNode } from 'react'

// Minimal inline Markdown for Text/Callout bodies: **bold**, [label](url), and
// paragraph breaks (blank line). Deliberately tiny — prose only, no HTML.
export function inlineMd(src: string): ReactNode[] {
  return src.split(/\n{2,}/).map((para, pi) => <p key={pi}>{inlineSpans(para)}</p>)
}

export function inlineSpans(src: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(src))) {
    if (m.index > last) nodes.push(src.slice(last, m.index))
    if (m[1] !== undefined) nodes.push(<strong key={k++}>{m[1]}</strong>)
    else
      nodes.push(
        <a key={k++} href={m[3]} target="_blank" rel="noreferrer">
          {m[2]}
        </a>,
      )
    last = re.lastIndex
  }
  if (last < src.length) nodes.push(src.slice(last))
  return nodes
}
