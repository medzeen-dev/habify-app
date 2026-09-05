import { Nav } from '../components/Nav'
import { Footer } from '../components/Footer'
import { SettingCard } from './settings/SettingCard'
import { SETTINGS_SECTIONS, DEMO_RECOVERY_CODE } from './settings/settingsData'
import { DEMO_TABS, type TabKey } from './home/homeData'
import { readState } from '../state/h30State'
import './Einstellungen.css'

/**
 * Einstellungen — the fourth navigation area (DL-044), separate from the four
 * programme tabs, reached via the gear. Four areas: Wiederherstellungscode ·
 * Weiteres Gerät · Programm-E-Mails · Peergruppe. Desktop shows four open cards;
 * mobile is an accordion (DL-067). Nav stays with Home marked active (Figma 1:459).
 *
 * The per-area actions (PDF/email re-save, device linking, external email + peer-group
 * pages) are stubbed here — those flows are wired separately (DL-053/DL-070).
 */
export function Einstellungen({ onNavigate }: { onNavigate?: (t: TabKey | 'einstellungen') => void }) {
  const recoveryCode = readState().recoveryCode ?? DEMO_RECOVERY_CODE

  const onAction = (action: string) => {
    // eslint-disable-next-line no-console
    console.info('[Einstellungen] action not yet wired:', action)
  }

  return (
    <div className="h30-settings">
      <Nav tabs={DEMO_TABS} onNavigate={onNavigate} />

      <main className="h30-settings__content">
        <div className="h30-settings__col">
          <h1 className="t-display h30-settings__h1">Einstellungen</h1>

          <div className="h30-settings__cards">
            {SETTINGS_SECTIONS.map((section, i) => (
              <SettingCard
                key={section.id}
                section={section}
                recoveryCode={section.showCode ? recoveryCode : undefined}
                onAction={onAction}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
