import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../../components/Button'
import { useIsMobile } from '../../lib/useIsMobile'
import type { SettingSection } from './settingsData'

interface SettingCardProps {
  section: SettingSection
  recoveryCode?: string
  onAction?: (action: string) => void
  /** Mobile accordion: expanded on first render (DL-067 shows the first card open). */
  defaultOpen?: boolean
}

/**
 * One Einstellungen area. Desktop: an always-open card with a leading icon (DL-044).
 * Mobile: a collapsible accordion row — 64px header, title + one-line subtitle (visible
 * only while collapsed), chevron; content opens on tap (DL-067).
 */
export function SettingCard({ section, recoveryCode, onAction, defaultOpen }: SettingCardProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(defaultOpen ?? false)
  const Icon = section.icon

  const body = (
    <div className="h30-setting__body">
      {section.body.map((p, i) => (
        <p key={i} className="t-body-md h30-setting__text">
          {p}
        </p>
      ))}

      {section.showCode && (
        <div className="h30-setting__code">
          <p className="t-label h30-setting__code-label">DEIN WIEDERHERSTELLUNGSCODE</p>
          <p className="t-code h30-setting__code-value">{recoveryCode ?? '—'}</p>
        </div>
      )}

      <div className="h30-setting__actions">
        {section.actions.map((a) => (
          <Button
            key={a.action}
            variant="secondary"
            label={a.label}
            externalIcon={a.external}
            onClick={() => onAction?.(a.action)}
          />
        ))}
      </div>

      {section.hint && <p className="t-body-sm text-muted h30-setting__hint">{section.hint}</p>}
    </div>
  )

  if (isMobile) {
    const panelId = `setting-panel-${section.id}`
    return (
      <section className="h30-setting h30-setting--accordion">
        <button
          type="button"
          className="h30-setting__header"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="h30-setting__header-text">
            <span className="t-heading-sm">{section.title}</span>
            {!open && <span className="t-body-sm h30-setting__subtitle">{section.subtitle}</span>}
          </span>
          {open ? (
            <ChevronUp size={24} aria-hidden="true" className="h30-setting__chevron" />
          ) : (
            <ChevronDown size={24} aria-hidden="true" className="h30-setting__chevron" />
          )}
        </button>
        {open && (
          <div id={panelId} className="h30-setting__panel">
            {body}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="h30-setting">
      <div className="h30-setting__title">
        <Icon size={20} aria-hidden="true" className="h30-setting__icon" />
        <h2 className="t-heading-md">{section.title}</h2>
      </div>
      {body}
    </section>
  )
}
