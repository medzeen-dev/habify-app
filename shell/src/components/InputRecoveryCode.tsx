import { formatWithHyphen, normalizeCode } from '../lib/recoveryCode'
import './InputRecoveryCode.css'

interface InputRecoveryCodeProps {
  /** Normalised value (no hyphen, ≤ 8 Crockford chars). */
  value: string
  onChange: (raw: string) => void
  /** Default help; replaced by errorText when error is set (three error cases via helpText, DL-029). */
  helpText?: string
  error?: boolean
  errorText?: string
  id?: string
}

/**
 * Recovery-code input (DS component "Input — Recovery Code", node 1:72).
 * ONE field, not eight boxes (DL-042/DL-029). Code look via text/code + a
 * length-fitted 260px field + auto-hyphen after four chars. Help text never
 * points at the email (PDF is the primary path since DL-060).
 */
export function InputRecoveryCode({
  value,
  onChange,
  helpText = 'Acht Zeichen, mit oder ohne Bindestrich.',
  error = false,
  errorText,
  id = 'recovery-code',
}: InputRecoveryCodeProps) {
  const help = error && errorText ? errorText : helpText
  const fieldClass = ['h30-rc__field', 't-code', error && 'h30-rc__field--error'].filter(Boolean).join(' ')
  const helpClass = ['t-body-sm', 'h30-rc__help', error && 'h30-rc__help--error'].filter(Boolean).join(' ')

  return (
    <div className="h30-rc">
      <label className="t-label h30-rc__label" htmlFor={id}>
        Wiederherstellungscode
      </label>
      <input
        id={id}
        className={fieldClass}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={9} /* 8 chars + one hyphen */
        value={formatWithHyphen(value)}
        aria-invalid={error || undefined}
        aria-describedby={`${id}-help`}
        onChange={(e) => onChange(normalizeCode(e.target.value).substring(0, 8))}
      />
      <p id={`${id}-help`} className={helpClass}>
        {help}
      </p>
    </div>
  )
}
