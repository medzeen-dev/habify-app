import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import './Button.css'

type Variant = 'primary' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: ReactNode
  /** Primary = the one action of the page; Secondary = equal-rank options or subordinate actions (DS component, DL-043). */
  variant?: Variant
  /** DL-054: switched on for ANY button that leaves the Shell (Lucide external-link 16px, stroke follows the label colour). */
  externalIcon?: boolean
  /** Full-width (used on mobile / stacked layouts). */
  block?: boolean
}

export function Button({
  label,
  variant = 'secondary',
  externalIcon = false,
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['h30-btn', `h30-btn--${variant}`, block && 'h30-btn--block', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      <span className="t-button">{label}</span>
      {externalIcon && <ExternalLink size={16} aria-hidden="true" className="h30-btn__ext" />}
    </button>
  )
}
