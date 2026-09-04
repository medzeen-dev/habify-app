import { jsPDF } from 'jspdf'
import { formatWithHyphen } from './recoveryCode'

/**
 * "Code als PDF sichern" (DL-042 primary securing path, DL-060). Generates a
 * one-page PDF with the recovery code and downloads it — fully client-side,
 * no third party. Uses jsPDF's built-in fonts (no embedding needed).
 */
export function downloadRecoveryPdf(code: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pretty = formatWithHyphen(code)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('habify30 — Wiederherstellungscode', 56, 90)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(
    [
      'Bewahre diesen Code sicher auf. Er ist der einzige Weg zurück in dein',
      'Programm, falls dein Zugang verloren geht — zum Beispiel wenn der',
      'Browser-Speicher geleert wird. Niemand kann ihn wiederherstellen, auch',
      'habify30 nicht.',
    ],
    56,
    128,
  )

  doc.setFont('courier', 'bold')
  doc.setFontSize(30)
  doc.text(pretty, 56, 230)

  doc.save('habify30-Wiederherstellungscode.pdf')
}
