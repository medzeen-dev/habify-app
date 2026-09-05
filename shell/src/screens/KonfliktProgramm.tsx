import { EntryLayout } from '../components/EntryLayout'
import { Button } from '../components/Button'
import { ContactLine } from '../components/ContactLine'
import './KonfliktProgramm.css'

interface KonfliktProgrammProps {
  programmName?: string
  onStartNew: () => void
  onKeepCurrent: () => void
}

/**
 * pid conflict: a valid URL pid differs from the cached pid (DL-031). Explicit choice,
 * never a silent switch. NOTE: no Figma design exists for this screen (DL-031 describes
 * it in prose) — copy is build-authored and needs a design + copy pass.
 */
export function KonfliktProgramm({ programmName, onStartNew, onKeepCurrent }: KonfliktProgrammProps) {
  return (
    <EntryLayout>
      <div className="h30-kopf h30-kopf--wide">
        <h1 className="h30-h1">Du hast schon ein laufendes Programm</h1>
        <p className="h30-lead">
          Dieser Link gehört zu {programmName ?? 'einem anderen Programm'}. Möchtest du dorthin
          wechseln oder mit deinem aktuellen Programm weitermachen?
        </p>
      </div>

      <div className="h30-konflikt__actions">
        <Button
          variant="primary"
          label="Neues Programm starten"
          className="h30-btn--page"
          onClick={onStartNew}
        />
        <Button
          variant="secondary"
          label="Mit aktuellem Programm weiter"
          className="h30-btn--page"
          onClick={onKeepCurrent}
        />
      </div>

      <p className="t-body-sm text-muted">
        Beim Wechsel beginnt das neue Programm von vorn. Dein bisheriger Fortschritt bleibt an deinem
        aktuellen Programm — mit dessen Link oder Wiederherstellungscode kommst du dorthin zurück.
      </p>

      <ContactLine />
    </EntryLayout>
  )
}
