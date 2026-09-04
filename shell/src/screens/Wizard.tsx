import { useState } from 'react'
import { ensureRegistered } from '../lib/register'
import { patchState } from '../state/h30State'
import { WizardWillkommen } from './wizard/WizardWillkommen'
import { WizardSichern } from './wizard/WizardSichern'
import { WizardHilfe } from './wizard/WizardHilfe'
import { WizardGeraet } from './wizard/WizardGeraet'

type Step = 'willkommen' | 'sichern' | 'hilfe' | 'geraet'

/**
 * First-use Wizard (DL-051, 3 steps). uid + recovery code are created on entering
 * step 2 (DL-059, idempotent). wizardCompleted is set on the click-through to the
 * end (DL-051) — not per step, not on the server.
 */
export function Wizard({ onRecover, onComplete }: { onRecover: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<Step>('willkommen')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [secured, setSecured] = useState(false)

  const enterSichern = () => {
    setRecoveryCode(ensureRegistered().recoveryCode) // DL-059
    setStep('sichern')
  }

  const finish = () => {
    patchState({ wizardCompleted: true }) // DL-051
    onComplete()
  }

  switch (step) {
    case 'sichern':
      return (
        <WizardSichern
          recoveryCode={recoveryCode}
          secured={secured}
          onSecured={() => setSecured(true)}
          onNext={() => setStep('geraet')}
          onHelp={() => setStep('hilfe')}
        />
      )
    case 'hilfe':
      return (
        <WizardHilfe
          recoveryCode={recoveryCode}
          onNext={() => {
            setSecured(true)
            setStep('geraet')
          }}
          onBack={() => setStep('sichern')}
        />
      )
    case 'geraet':
      return <WizardGeraet onComplete={finish} />
    default:
      return <WizardWillkommen onNext={enterSichern} onRecover={onRecover} />
  }
}
