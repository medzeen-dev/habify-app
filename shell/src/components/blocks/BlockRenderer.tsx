import { useState } from 'react'
import {
  Info, Lightbulb, Play, CalendarClock, Check, ChevronDown, MessageCircle, HelpCircle,
  Image as ImageIcon, Film, BookOpen, FileText, Mic, ExternalLink,
} from 'lucide-react'
import { Button } from '../Button'
import { inlineMd, inlineSpans } from './inline'
import type { Block } from '../../lib/lessons/types'
import './blocks.css'

/** Dispatch a typed block to its renderer (DL-083 §1). */
export function BlockRenderer({ block, id }: { block: Block; id?: string }) {
  switch (block.type) {
    case 'heading': {
      const H = block.level === 2 ? 'h2' : 'h3'
      const cls = block.level === 2 ? 't-heading-lg lb-heading--2' : 't-heading-md lb-heading--3'
      return <H id={id} className={cls}>{block.text}</H>
    }
    case 'text':
      return <div className="t-body-lg lb-text">{inlineMd(block.markdown)}</div>
    case 'quote':
      return (
        <blockquote className="lb-quote">
          <span className="lb-quote__mark" aria-hidden="true">„</span>
          <span className="t-heading-md lb-quote__text">{block.text}</span>
        </blockquote>
      )
    case 'callout':
      return (
        <aside className={`lb-callout lb-callout--${block.variant}`} role="note">
          <span className="lb-callout__icon">
            {block.variant === 'tipp' ? <Lightbulb size={24} /> : <Info size={24} />}
          </span>
          <div className="t-body-md lb-callout__body">{inlineMd(block.text)}</div>
        </aside>
      )
    case 'steps':
      return (
        <ol className="lb-steps">
          {block.items.map((it, i) => (
            <li className="lb-step" key={i}>
              <span className="lb-step__num">{i + 1}</span>
              <span className="t-body-md lb-step__text">{inlineSpans(it)}</span>
            </li>
          ))}
        </ol>
      )
    case 'divider':
      return <hr className="lb-divider" />
    case 'image':
      return (
        <figure className="lb-image">
          <div className="lb-image__frame">
            {block.src ? <img src={block.src} alt={block.caption ?? ''} /> : <ImageIcon size={40} />}
          </div>
          {block.caption && <figcaption className="t-body-sm lb-image__caption">{block.caption}</figcaption>}
        </figure>
      )
    case 'video':
      return (
        <div className="lb-video">
          {block.src ? (
            <video src={block.src} poster={block.poster} controls />
          ) : (
            <button className="lb-video__play" aria-label="Video abspielen"><Play size={28} fill="currentColor" /></button>
          )}
        </div>
      )
    case 'table':
      return (
        <div className="lb-table__scroll">
          <table className="lb-table t-body-md">
            <thead><tr>{block.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{block.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    case 'split':
      return (
        <div className={`lb-split lb-split--${block.side}`}>
          <div className="lb-split__media">{block.src ? <img src={block.src} alt="" /> : <ImageIcon size={32} />}</div>
          <div className="lb-split__body">
            <h3 className="t-heading-sm lb-split__title">{block.title}</h3>
            <p className="t-body-md lb-split__text">{inlineSpans(block.text)}</p>
          </div>
        </div>
      )
    case 'accordion':
      return <Accordion items={block.items} />
    case 'eingabe':
      return <Eingabe zweck={block.zweck} prompt={block.prompt} />
    case 'webinar':
      return (
        <div className="lb-webinar">
          <div className="t-body-sm lb-webinar__head"><CalendarClock size={20} />{block.date}</div>
          <p className="t-heading-sm lb-webinar__title">{block.title}</p>
          <div className="lb-webinar__actions">
            <Button variant="primary" label="Zum Webinar" externalIcon onClick={() => block.joinUrl && window.open(block.joinUrl, '_blank')} />
            <Button variant="secondary" label="Zum Kalender hinzufügen" />
          </div>
        </div>
      )
    case 'quellen':
      return (
        <section className="lb-quellen">
          <h3 className="t-heading-sm">Quellen</h3>
          {block.items.map((s, i) => <p className="t-body-sm" key={i}>{s}</p>)}
        </section>
      )
    case 'empfehlungen':
      return <Empfehlungen groups={block.groups} />
    default:
      return null
  }
}

function Accordion({ items }: { items: { title: string; body: string }[] }) {
  const [open, setOpen] = useState(0)
  return (
    <div className="lb-accordion">
      {items.map((it, i) => (
        <div className="lb-acc-item" key={i}>
          <button className="lb-acc-head t-heading-sm" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{it.title}</span>
            <ChevronDown size={20} className="lb-acc-chevron" style={{ transform: open === i ? 'rotate(180deg)' : undefined }} />
          </button>
          {open === i && <div className="t-body-md lb-acc-body">{inlineSpans(it.body)}</div>}
        </div>
      ))}
    </div>
  )
}

function Eingabe({ zweck, prompt }: { zweck: 'reflexion' | 'webinar-frage'; prompt: string }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const Icon = zweck === 'webinar-frage' ? HelpCircle : MessageCircle
  const eyebrow = zweck === 'webinar-frage' ? 'WEBINAR-FRAGE' : 'REFLEXION'
  const cta = zweck === 'webinar-frage' ? 'Frage absenden' : 'Antwort speichern'
  return (
    <div className="lb-eingabe">
      <button className="lb-eingabe__info" aria-label="Wie werden meine Eingaben verwendet?" onClick={() => setShowInfo((v) => !v)}>
        <Info size={18} />
      </button>
      <div className="lb-eingabe__head"><Icon size={20} style={{ color: 'var(--color-text-brand)' }} /><span className="t-label lb-eingabe__eyebrow">{eyebrow}</span></div>
      <p className="t-heading-md lb-eingabe__prompt">{prompt}</p>
      {showInfo && (
        <p className="lb-eingabe__tip">Deine Eingaben werden nur für deinen Kurs gespeichert und nicht mit deiner E-Mail verknüpft. Keine KI wertet sie aus (Tier 1).</p>
      )}
      {saved === null ? (
        <>
          <textarea className="lb-eingabe__field" placeholder="Schreib ein paar Zeilen — nur für dich." value={value} onChange={(e) => setValue(e.target.value)} />
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="primary" label={cta} onClick={() => value.trim() && setSaved(value.trim())} />
          </div>
        </>
      ) : (
        <>
          <p className="t-body-md lb-eingabe__answer">{saved}</p>
          <div className="t-body-sm lb-eingabe__saved"><Check size={16} /> Gespeichert</div>
          <Button variant="secondary" label="Bearbeiten" onClick={() => { setValue(saved); setSaved(null) }} />
        </>
      )}
    </div>
  )
}

const KIND_ICON: Record<string, typeof BookOpen> = { book: BookOpen, article: FileText, video: Film, podcast: Mic }

function Empfehlungen({ groups }: { groups: { category: string; items: { kind: string; title: string; source: string; url?: string }[] }[] }) {
  return (
    <section>
      <h3 className="t-heading-sm">Zum Weiterlesen, -sehen und -hören</h3>
      {groups.map((g, gi) => (
        <div className="lb-empf__group" key={gi}>
          <p className="t-label lb-empf__cat">{g.category.toUpperCase()}</p>
          {g.items.map((it, ii) => {
            const K = KIND_ICON[it.kind] ?? FileText
            return (
              <a className="lb-empf__row" href={it.url} target="_blank" rel="noreferrer" key={ii}>
                <K size={24} />
                <div className="lb-empf__body">
                  <div className="t-body-md lb-empf__title">{it.title}</div>
                  <div className="t-body-sm lb-empf__meta">{it.source}</div>
                </div>
                <ExternalLink size={16} className="lb-empf__ext" />
              </a>
            )
          })}
        </div>
      ))}
    </section>
  )
}
