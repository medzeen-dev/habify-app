import { Sparkles } from 'lucide-react'
import './FloatingCoach.css'

/**
 * Floating AI-Coach launcher — Shell-chrome layer, present on Home and all phase
 * tabs (DL-039/DL-041). Opening the chat panel (DL-071 three-tier coach) is not
 * built yet; this is the visual launcher. onOpen is a placeholder hook.
 */
export function FloatingCoach({ onOpen }: { onOpen?: () => void }) {
  return (
    <button type="button" className="h30-coachfab" aria-label="Coach öffnen" onClick={onOpen}>
      <Sparkles size={24} aria-hidden="true" />
    </button>
  )
}
