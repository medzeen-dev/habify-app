import type { ReactNode } from 'react'
import { Header } from './Header'
import { WizardProgress } from './WizardProgress'
import './WizardLayout.css'

/** Shared Wizard frame: bordered logos-only header + centred 560 column with the step indicator. */
export function WizardLayout({ step, children }: { step: 1 | 2 | 3; children: ReactNode }) {
  return (
    <div className="h30-wizard">
      <Header bordered />
      <main className="h30-wizard__content">
        <div className="h30-wizard__col">
          <WizardProgress step={step} />
          {children}
        </div>
      </main>
    </div>
  )
}
