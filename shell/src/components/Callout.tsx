import './Callout.css'

interface CalloutProps {
  /** Mirrors the `Type` variant of the Figma component (habify30 Design System). */
  type?: 'error' | 'success' | 'neutral'
  title: string
  children: React.ReactNode
}

/**
 * Page-level notice above the content, explaining why something is not possible or what
 * just happened (DS component `Callout`). NOT for field errors — Input and Checkbox carry
 * those themselves.
 *
 * The title names the situation, the body names the way out. Without a way out there is no
 * Callout: a dead end with a border is still a dead end.
 *
 * `role="alert"` only for the error type — success and neutral are not interruptions and
 * should not be announced over whatever the user is doing.
 */
export function Callout({ type = 'neutral', title, children }: CalloutProps) {
  return (
    <div
      className={`h30-callout h30-callout--${type}`}
      role={type === 'error' ? 'alert' : undefined}
    >
      <p className="t-heading-sm h30-callout__title">{title}</p>
      <div className="t-body-md h30-callout__text">{children}</div>
    </div>
  )
}
