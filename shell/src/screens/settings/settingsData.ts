import { KeyRound, TabletSmartphone, Mail, Users, type LucideIcon } from 'lucide-react'

// Einstellungen content — the fourth navigation area (DL-044): Wiederherstellungscode ·
// Weiteres Gerät hinzufügen · Programm-E-Mails · Peergruppe. No account deletion (OQ-030).
// Copy read verbatim from Figma §3 node 1:459 (DL-064); the recovery body carries the
// DL-042/051/064 frozen "Auch wir nicht" sentence — do not soften. Mobile is an accordion
// with one-line subtitles (DL-067). Peergroup + email actions leave the Shell (DL-054/DL-070).

export interface SettingAction {
  label: string
  /** Leaves the Shell → external-link icon (DL-054). */
  external?: boolean
  /** Handler key, wired by the screen. */
  action: string
}

export interface SettingSection {
  id: 'recovery' | 'device' | 'emails' | 'peergroup'
  icon: LucideIcon
  title: string
  /** One-line subtitle shown only in the collapsed accordion header on mobile (DL-067). */
  subtitle: string
  body: string[]
  /** Recovery card shows the code inline (mobile node 1:630); reused on desktop. */
  showCode?: boolean
  actions: SettingAction[]
  hint?: string
}

export const SETTINGS_SECTIONS: SettingSection[] = [
  {
    id: 'recovery',
    icon: KeyRound,
    title: 'Wiederherstellungscode',
    subtitle: 'Dein Weg zurück, wenn der Zugang verloren geht',
    body: [
      'Dein Weg zurück, wenn dein Zugang nicht mehr funktioniert — etwa wenn deine IT den Browser-Speicher leert. Bewahre ihn so auf, dass du ihn auch in vier Wochen sicher wiederfindest. Geht er verloren, kann niemand dir den Zugang wiederherstellen. Auch wir nicht.',
    ],
    showCode: true,
    actions: [
      { label: 'Als PDF speichern', action: 'recovery-pdf' },
      { label: 'Per E-Mail an mich selbst', action: 'recovery-email' },
    ],
    hint: 'Die E-Mail enthält nur den Code, keinen Anmelde-Link.',
  },
  {
    id: 'device',
    icon: TabletSmartphone,
    title: 'Weiteres Gerät hinzufügen',
    subtitle: 'Handy oder zweiten Computer verbinden',
    body: [
      'Um habify30 auch auf dem Handy oder einem zweiten Computer zu nutzen, verbindest du das weitere Gerät einmalig — über einen QR-Code oder per Link.',
    ],
    actions: [{ label: 'Gerät verbinden', action: 'device-link' }],
    hint: 'Behandle den Link wie deinen Zugang — wer ihn öffnet, ist in deinem Kurs. Er gilt nur wenige Minuten und nur einmal.',
  },
  {
    id: 'emails',
    icon: Mail,
    title: 'Programm-E-Mails',
    subtitle: 'Hinweise zum Programmverlauf abonnieren',
    body: [
      'Hinweise zum Programm, etwa wenn die nächste Phase freigeschaltet ist. Deine Adresse wird nicht mit deinem Zugang verknüpft — wir können nicht sehen, ob du angemeldet bist. Deshalb steht hier auch kein Status.',
    ],
    actions: [{ label: 'Anmelden', external: true, action: 'emails-signup' }],
    hint: 'Abbestellen jederzeit über den Link in jeder E-Mail.',
  },
  {
    id: 'peergroup',
    icon: Users,
    title: 'Peergruppe',
    subtitle: 'Eintragen oder deine Peergruppe verlassen',
    body: [
      'Die Anmeldung zu einer Peergruppe läuft über deine E-Mail-Adresse. Sie ist bewusst nicht mit deinem Kurszugang verknüpft — wir können sehen, dass deine E-Mail zu einer Gruppe gehört, aber nicht, welcher Kurszugang dahinter steckt. Die Zusammenstellung der Gruppe erfolgt nach dem Zufallsprinzip, und der Austausch innerhalb eurer Gruppe läuft über einen selbstgewählten Kanal (z. B. Teams, WhatsApp), nicht über unser System.',
      'Deshalb können wir dir hier keinen Status anzeigen — wir wissen nicht, ob du in einer Gruppe bist. Was du hier tun kannst:',
    ],
    actions: [
      { label: 'Für eine Peergruppe eintragen', external: true, action: 'peer-join' },
      { label: 'Peergruppe verlassen', external: true, action: 'peer-leave' },
    ],
  },
]

/** Recovery code shown in the card. From h30.state.recoveryCode; demo value for preview. */
export const DEMO_RECOVERY_CODE = 'H3K9-P2M7'
