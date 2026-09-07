// Home-hub view model + demo data. Copy is read verbatim from Figma "habify30
// Screens" §3 (node 1:373), never paraphrased (DL-064). Structure & rules:
// DL-039 (four-tab nav + Home as default hub), DL-045 (element inventory),
// DL-048 (only Momentum is date-gated), DL-052 (task list = deadline list),
// DL-046 (coach widget, copy frozen), DL-050 (webinars recommended, not required).
//
// This is presentational demo data: real phase/progress data is owned by DL-076
// and the cohort schedule shape is still TBD (DL-030/045). The model is shaped so
// the live data slots in later without touching the components.

export type PhaseKey = 'impuls' | 'werkstatt' | 'momentum'
export type TabKey = 'home' | PhaseKey

export interface TabModel {
  key: TabKey
  label: string
  /** active = current tab; available = reachable; locked = gated (lock icon, muted). */
  status: 'active' | 'available' | 'locked'
}

/** The four Hero states from the reference frame 1:509. */
export type HeroStateKey = 'A' | 'B' | 'C' | 'D'

export interface HeroModel {
  label: string // "Aktuelle Phase" | "Zuletzt bearbeitet"
  phaseTitle: string
  /** Which phase the CTA opens (its resume lesson, via onNavigate → App gate). */
  phase: PhaseKey
  sub: string
  ctaLabel: string
  /**
   * DL-048: the waiting note is the ONE hard date-gate — Momentum only (state D).
   * Impuls is open from invitation, Werkstatt opens progress-based, so states A–C
   * carry no note. Present only in state D.
   */
  waitingNote?: { line1: string; line2?: string }
}

export interface TaskModel {
  id: string
  title: string
  desc: string
  /** DL-052: date tag in brand colour (not red); absent = no deadline. */
  deadlineTag?: string
}

export interface WebinarModel {
  when: string
  title: string
}

export interface CoachModel {
  name?: string // DL-046, per pid; template slot when unset
  imageUrl?: string // DL-046, *.k-a-d-o.com, circle-masked
  blurb: string // DL-046, frozen copy
}

export interface HomeModel {
  tabs: TabModel[]
  hero: HeroModel
  tasks: TaskModel[]
  webinars: WebinarModel[]
  coach: CoachModel
}

/** All four Hero states, exact copy from reference frame 1:509 (states A–D). */
export const HERO_STATES: Record<HeroStateKey, HeroModel> = {
  A: {
    label: 'Aktuelle Phase',
    phaseTitle: 'Impulsphase',
    phase: 'impuls',
    sub: 'Vier Lektionen. Die erste erklärt, wie das Programm aufgebaut ist.',
    ctaLabel: 'Beginnen',
  },
  B: {
    label: 'Aktuelle Phase',
    phaseTitle: 'Impulsphase',
    phase: 'impuls',
    sub: 'Lektion 2 von 4 — Wo dein Vorsatz im Alltag hängen bleibt',
    ctaLabel: 'Weiter in der Impulsphase',
  },
  C: {
    label: 'Aktuelle Phase',
    phaseTitle: 'Veränderungswerkstatt',
    phase: 'werkstatt',
    sub: 'Die Impulsphase ist abgeschlossen. Hier erarbeitest du deinen Plan für die 30 Tage.',
    ctaLabel: 'Weiter in der Veränderungswerkstatt',
  },
  D: {
    label: 'Zuletzt bearbeitet',
    phaseTitle: 'Veränderungswerkstatt',
    phase: 'werkstatt',
    sub: 'Dein Plan steht. Die Inhalte bleiben offen, du kannst jederzeit zurück.',
    ctaLabel: 'Zurück in die Veränderungswerkstatt',
    waitingNote: {
      line1: 'Die Momentum-Phase startet am 16. September — für alle gemeinsam.',
      line2: 'Bis dahin bildet das System die Peergruppen.',
    },
  },
}

/**
 * Which Hero state the demo renders. State B is the representative "Home — Desktop"
 * frame (Impulsphase, running). Switch to 'D' to preview the Momentum-waiting info
 * block, or 'A'/'C' for the other gates.
 */
export const DEMO_HERO_STATE: HeroStateKey = 'B'

/** Task list — exact copy from 1:390. DL-052: deadline items, brand-colour tags. */
export const DEMO_TASKS: TaskModel[] = [
  {
    id: 'webinar-questions',
    title: 'Fragen für das Impuls-Webinar einreichen',
    desc: 'Optional — wir greifen sie im Webinar auf. Einreichen bis 22. Juli.',
    deadlineTag: 'Webinar 24. Juli',
  },
  {
    id: 'peer-group',
    title: 'Für eine Peergruppe anmelden',
    desc: 'Zwei bis drei Menschen, die sich gegenseitig durch die 30 Tage begleiten. Die Einteilung erfolgt am Stichtag.',
    deadlineTag: 'Bis 20. August',
  },
  {
    id: 'programme-emails',
    title: 'Programm-E-Mails abonnieren',
    desc: 'Hinweise zum Programm, etwa wenn die nächste Phase freigeschaltet ist.',
  },
]

/** Webinars — exact copy from 1:427. Only upcoming dates, no scrollbar (DL-045). */
export const DEMO_WEBINARS: WebinarModel[] = [
  { when: 'Do, 24. Juli · 10:00 – 11:30', title: 'Impuls-Webinar: Kleine Schritte, echte Wirkung' },
  { when: 'Mo, 25. August · 09:00 – 12:00', title: 'Veränderungswerkstatt (Clarity Lab)' },
  { when: 'Di, 16. September · 10:00 – 11:00', title: 'Momentum-Auftakt' },
]

export const DEMO_TABS: TabModel[] = [
  { key: 'home', label: 'Home', status: 'active' },
  { key: 'impuls', label: 'Impulsphase', status: 'available' },
  { key: 'werkstatt', label: 'Werkstattphase', status: 'locked' },
  { key: 'momentum', label: 'Momentumphase', status: 'locked' },
]

/** Empty-state line for the task list (1:533). DL-052: section disappears when empty. */
export const TASKS_EMPTY_LINE = 'Gerade nichts zu tun. Wenn etwas ansteht, findest du es hier.'

/**
 * Demo Home model. Coach name/image come from per-pid config (DL-046); a demo name
 * is used here so the widget reads naturally in preview.
 */
export const DEMO_HOME: HomeModel = {
  tabs: DEMO_TABS,
  hero: HERO_STATES[DEMO_HERO_STATE],
  tasks: DEMO_TASKS,
  webinars: DEMO_WEBINARS,
  coach: {
    name: 'Alex',
    blurb:
      'Manchmal helfen Webinare und Inhalte nicht weiter. Dafür ist dieser Termin da. Kurz, konkret, an deinem Fall.',
  },
}
