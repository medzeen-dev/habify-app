import './Input.css'

interface InputProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email'
  placeholder?: string
  error?: boolean
  /** Replaces helpText when `error` is set. */
  errorText?: string
  helpText?: string
  id?: string
  autoComplete?: string
  inputMode?: 'text' | 'email'
  onBlur?: () => void
}

/**
 * Generic labelled text/email field (DS). Sibling to InputRecoveryCode, which stays
 * its own component because of its Crockford-specific formatting. Error state mirrors
 * the recovery-code input: red border + red help line under the field.
 */
export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error = false,
  errorText,
  helpText,
  id = 'input',
  autoComplete,
  inputMode,
  onBlur,
}: InputProps) {
  const help = error && errorText ? errorText : helpText
  const fieldClass = ['h30-input__field', 't-body-md', error && 'h30-input__field--error'].filter(Boolean).join(' ')
  const helpClass = ['t-body-sm', 'h30-input__help', error && 'h30-input__help--error'].filter(Boolean).join(' ')

  return (
    <div className="h30-input">
      <label className="t-label h30-input__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={fieldClass}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        aria-invalid={error || undefined}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {help && (
        <p id={`${id}-help`} className={helpClass}>
          {help}
        </p>
      )}
    </div>
  )
}
