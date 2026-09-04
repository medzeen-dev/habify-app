// Recovery-code helpers, ported VERBATIM from the deployed `recovery` Catalyst
// function (habify-app/Catalyst_Functions/recovery/index.js) so client-side
// validation matches the server exactly (DL-029 checksum; DL-064: read, don't guess).
// If the server generator changes, change it here too — one algorithm, two ends.

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // excludes I, L, O, U

/** Checksum symbol over the first 7 chars: sum(index_i * (position_i + 1)) mod 32. */
export function checksumChar(chars: string): string {
  let sum = 0
  for (let i = 0; i < chars.length; i++) {
    sum += CROCKFORD_ALPHABET.indexOf(chars[i]) * (i + 1)
  }
  return CROCKFORD_ALPHABET[sum % CROCKFORD_ALPHABET.length]
}

/** Uppercase and strip anything outside the Crockford alphabet (I/L/O/U can never appear). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-HJKMNP-TV-Z]/g, '')
}

export function isValidFormat(code: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code)
}

export function isValidChecksum(code: string): boolean {
  return checksumChar(code.substring(0, 7)) === code.substring(7, 8)
}

/** Full local gate before any network call (DL-029: validate client-side first). */
export function isValidRecoveryCode(code: string): boolean {
  return isValidFormat(code) && isValidChecksum(code)
}

/** Display grouping "XXXX-XXXX". */
export function formatWithHyphen(code: string): string {
  const c = normalizeCode(code)
  return c.length > 4 ? `${c.substring(0, 4)}-${c.substring(4, 8)}` : c
}

/**
 * STUB — generate a locally-valid recovery code for the demo, until the real
 * `recovery/register` endpoint is wired (DL-059: the server generates it). This
 * only satisfies format + checksum so the Wizard UI has something real to show.
 */
export function generateMockCode(): string {
  let chars = ''
  for (let i = 0; i < 7; i++) {
    chars += CROCKFORD_ALPHABET[Math.floor(Math.random() * CROCKFORD_ALPHABET.length)]
  }
  return chars + checksumChar(chars)
}

/** The three recovery-code error strings, verbatim from Figma reference §1 node 1:1109 (DL-029/DL-057). */
export const RECOVERY_ERROR = {
  /** (1) local checksum invalid — shown immediately, no server call. */
  checksum: 'Dieser Code stimmt nicht. Prüf die Zeichen — Ziffern und Großbuchstaben, keine Leerzeichen.',
  /** (2) well-formed but not found — after the server answers; never a dead end. */
  notFound: 'Diesen Code kennen wir nicht. Er gehört möglicherweise zu einem anderen Programm.',
  /** (3) rate-limit on /recover (DL-057). */
  rateLimit: 'Zu viele Versuche. Warte ein paar Minuten und versuch es dann noch einmal.',
} as const
