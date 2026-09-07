import { useEffect, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { Nav } from '../../components/Nav'
import { Button } from '../../components/Button'
import { BlockRenderer } from '../../components/blocks/BlockRenderer'
import { getLesson, lessonsForPhase, nextLessonId } from '../../lib/lessons/loader'
import { isPhaseUnlocked } from '../../lib/lessons/gate'
import { getLessonProgress, markLessonCompleted, setLastSection } from '../../state/h30State'
import type { Block, Phase } from '../../lib/lessons/types'
import type { TabKey, TabModel } from '../home/homeData'
import './LessonView.css'

const PHASE_LABEL: Record<Phase, string> = {
  impuls: 'Impulsphase',
  werkstatt: 'Veränderungswerkstatt',
  momentum: 'Momentum',
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '')
}

/** Section anchors are derived from the H2 headings (feeds the course-nav stepper). */
function sections(blocks: Block[]): { id: string; text: string }[] {
  return blocks
    .filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading' && b.level === 2)
    .map((b) => ({ id: slug(b.text), text: b.text }))
}

function tabsFor(phase: Phase): TabModel[] {
  // Phase tabs reflect the gate (DL-048): the current phase is active, other phases
  // show available/locked per isPhaseUnlocked. (Enforcement lives on the route — App.)
  const status = (key: TabKey): TabModel['status'] => {
    if (key === phase) return 'active'
    if (key === 'home') return 'available'
    return isPhaseUnlocked(key) ? 'available' : 'locked' // key narrowed to Phase here
  }
  const mk = (key: TabKey, label: string): TabModel => ({ key, label, status: status(key) })
  return [mk('home', 'Home'), mk('impuls', 'Impulsphase'), mk('werkstatt', 'Werkstattphase'), mk('momentum', 'Momentumphase')]
}

export function LessonView({
  lessonId,
  onOpenLesson,
  onNavigate,
}: {
  lessonId: string
  onOpenLesson: (id: string) => void
  onNavigate?: (t: TabKey | 'einstellungen') => void
}) {
  const lesson = getLesson(lessonId)
  const secs = lesson ? sections(lesson.blocks) : []

  // Reading register (DL-083 §4): track the section currently under the reader,
  // restore it on open, and persist it as we scroll. `current` drives the sidebar
  // highlight; `persisted` guards against re-writing the same index every frame.
  // Keyed on `lessonId` (== meta.id) so the hooks stay above the not-found guard.
  const [current, setCurrent] = useState(0)
  const persisted = useRef(-1)

  // Mobile course-nav (DL-083): the desktop sidebar collapses <900px into a
  // bottom-sheet with a 50px grip (Figma 58:549 closed / 59:626 open).
  const [sheetOpen, setSheetOpen] = useState(false)

  // Any navigation from inside the sheet closes it.
  useEffect(() => {
    setSheetOpen(false)
  }, [lessonId])

  // Restore on open / lesson change: jump to the last section reached.
  useEffect(() => {
    const stored = getLessonProgress(lessonId).lastSection
    const target = stored != null && secs.length > 0 ? Math.min(stored, secs.length - 1) : 0
    persisted.current = target
    setCurrent(target)
    if (target > 0) document.getElementById(secs[target]?.id ?? '')?.scrollIntoView({ block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  // Scroll-spy: the current section is the last H2 whose top has crossed the
  // threshold. rAF-throttled; persists only when the index actually changes.
  useEffect(() => {
    if (secs.length === 0) return
    let raf = 0
    const measure = () => {
      raf = 0
      if (window.innerHeight === 0) return // degenerate viewport — section detection is meaningless
      const threshold = 120
      let idx = 0
      for (let i = 0; i < secs.length; i++) {
        const el = document.getElementById(secs[i].id)
        if (el && el.getBoundingClientRect().top <= threshold) idx = i
      }
      setCurrent(idx)
      if (idx !== persisted.current) {
        persisted.current = idx
        setLastSection(lessonId, idx)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, secs.length])

  if (!lesson) return <div className="h30-lesson__missing">Lektion „{lessonId}" nicht gefunden.</div>

  const { meta, blocks } = lesson
  const phaseLessons = lessonsForPhase(meta.phase)
  const next = nextLessonId(meta.id)

  const complete = () => {
    markLessonCompleted(meta.id)
    if (next) onOpenLesson(next)
    else onNavigate?.('home') // phase end handled below; fallback to home
  }

  // Course-nav content, shared by the desktop sidebar and the mobile sheet.
  // `onPick` lets the sheet close itself when a lesson or section is chosen.
  const courseNav = (onPick?: () => void) => (
    <>
      <p className="t-label h30-lesson__side-title">INHALTE</p>
      <ul className="h30-lesson__lessons">
        {phaseLessons.map((l) => (
          <li key={l.meta.id}>
            <button
              className={l.meta.id === meta.id ? 'h30-lesson__lesson is-active' : 'h30-lesson__lesson'}
              onClick={() => {
                onOpenLesson(l.meta.id)
                onPick?.()
              }}
            >
              {l.meta.order}.&nbsp; {l.meta.title}
            </button>
            {l.meta.id === meta.id && secs.length > 0 && (
              <ul className="h30-lesson__sections">
                {secs.map((s, i) => (
                  <li key={s.id}>
                    <a
                      className={i === current ? 't-body-sm is-current' : 't-body-sm'}
                      href={`#${s.id}`}
                      onClick={onPick}
                    >
                      {s.text}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  )

  return (
    <div className="h30-lesson">
      <Nav tabs={tabsFor(meta.phase)} onNavigate={onNavigate} />
      <div className="h30-lesson__body">
        <aside className="h30-lesson__side" aria-label="Kursinhalt">
          {courseNav()}
        </aside>

        <main className="h30-lesson__main">
          <article className="h30-lesson__col">
            <header className="h30-lesson__header">
              <p className="t-label h30-lesson__eyebrow">
                {PHASE_LABEL[meta.phase]} · Lektion {meta.order} von {phaseLessons.length}
              </p>
              <h1 className="t-display h30-lesson__title">{meta.title}</h1>
              <div className="h30-lesson__rule" />
              <p className="t-body-sm h30-lesson__meta">
                ca. {meta.duration} Minuten · {secs.length} Abschnitte
              </p>
            </header>

            {blocks.map((b, i) => {
              const anchor = b.type === 'heading' && b.level === 2 ? slug(b.text) : undefined
              return <BlockRenderer key={i} block={b} id={anchor} />
            })}

            {next ? (
              <div className="h30-lesson__finish">
                <Button variant="primary" label="Zur nächsten Lektion" onClick={complete} />
              </div>
            ) : (
              <div className="h30-lesson__phase-end">
                <h2 className="t-heading-lg">Geschafft — die {PHASE_LABEL[meta.phase]} ist durch</h2>
                <p className="t-body-lg">Du hast alle Lektionen dieser Phase abgeschlossen.</p>
                <div className="h30-lesson__phase-end-actions">
                  <Button variant="secondary" label="Zurück zur Startseite" onClick={() => { markLessonCompleted(meta.id); onNavigate?.('home') }} />
                  <Button variant="secondary" label="Weiter zur Werkstattphase" onClick={() => { markLessonCompleted(meta.id); onNavigate?.('werkstatt') }} />
                </div>
              </div>
            )}
          </article>
        </main>
      </div>

      {/* Mobile bottom-sheet course nav (Figma 58:549 / 59:626). Hidden ≥900px via CSS. */}
      {sheetOpen && (
        <button
          type="button"
          className="h30-lesson__scrim"
          aria-label="Kursinhalt schließen"
          onClick={() => setSheetOpen(false)}
        />
      )}
      <div className="h30-lesson__sheet" data-open={sheetOpen}>
        <button
          type="button"
          className="h30-lesson__grip"
          aria-expanded={sheetOpen}
          aria-controls="h30-course-sheet"
          onClick={() => setSheetOpen((v) => !v)}
        >
          <span className="h30-lesson__grip-bar" aria-hidden="true" />
          <span className="h30-lesson__grip-label t-label">Kursinhalt</span>
          <ChevronUp size={20} aria-hidden="true" className="h30-lesson__grip-chevron" />
        </button>
        <div id="h30-course-sheet" className="h30-lesson__sheet-body" hidden={!sheetOpen}>
          {courseNav(() => setSheetOpen(false))}
        </div>
      </div>
    </div>
  )
}
