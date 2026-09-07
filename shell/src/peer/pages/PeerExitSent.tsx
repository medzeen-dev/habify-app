import { PeerLayout } from '../PeerLayout'

// Copy verbatim from Figma §4 — Peergruppe, "Peergruppe verlassen — B" (1:293).
// The entered address is mirrored back (the participant typed it — reveals nothing)
// so a typo is spottable. The message never states whether the address is actually
// enrolled (DL-053: otherwise the page becomes a probe for who participates).
export function PeerExitSent({ email }: { email: string }) {
  return (
    <PeerLayout>
      <h1 className="t-display h30-peer__title">Prüfe dein Postfach</h1>

      <p className="t-label h30-peer__mirror-label">ABMELDELINK ANGEFORDERT FÜR</p>
      <p className="t-heading-sm h30-peer__mirror-email">{email || '—'}</p>

      <p className="t-body-lg h30-peer__intro">
        Wenn diese Adresse in einer Peergruppe eingetragen ist, haben wir dir gerade eine Nachricht geschickt. Öffne den
        Link darin, um dich abzumelden.
      </p>
      <p className="t-body-md h30-peer__note">
        Falls keine E-Mail ankommt, prüfe die Schreibweise oben und deinen Spam-Ordner. Manchmal dauert es bis zu drei
        Minuten.
      </p>
      <p className="t-body-md h30-peer__note">
        Möchtest du dich später erneut für eine Peergruppe eintragen, findest du den Link unter Einstellungen in deinem
        Kurs.
      </p>
      <p className="t-body-sm h30-peer__footnote">
        Aus Datenschutzgründen sagen wir dir hier nicht, ob die Adresse tatsächlich eingetragen ist. Sonst könnte jeder
        aus dem Kurs herausfinden, wer an einer Peergruppe teilnimmt.
      </p>
    </PeerLayout>
  )
}
