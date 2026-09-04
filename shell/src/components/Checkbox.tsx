import { Check } from 'lucide-react'
import './Checkbox.css'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  id?: string
}

/**
 * Deliberate confirmation with consequence — never a casual form element (DS doc,
 * DL-026 "never silent"). Box 24px, label multi-line and TOP-aligned, click target =
 * box + label together. NEVER pre-checked (DL-036 for consent; DL-060 for the onboarding
 * confirmation — the participant confirms an action the UI cannot verify).
 */
export function Checkbox({ checked, onChange, label, id = 'checkbox' }: CheckboxProps) {
  return (
    <label className="h30-cb" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="h30-cb__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="h30-cb__box" aria-hidden="true">
        {checked && <Check size={16} strokeWidth={3} />}
      </span>
      <span className="t-body-md h30-cb__label">{label}</span>
    </label>
  )
}
