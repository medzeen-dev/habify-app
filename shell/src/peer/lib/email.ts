// Email validation for the peer-group pages (DL-036 / DL-053).
// Two jobs beyond a format check:
//  (a) typo protection — catches a bounced address before it breaks a group;
//  (b) enforcement — a valid participant must use their CORPORATE address, not a
//      private one. The pid-gate cannot see the field content, so this is where it
//      is caught. Domains come from the cohort capabilities (allowedEmailDomains +
//      manualDomainExceptions, DL-036). Second check: a plausibly-existing TLD.

export interface DomainRule {
  /** Corporate domains for the cohort, e.g. ["firma.de", "sub.firma.de"]. */
  allowedDomains: string[]
  /** Per-pid exceptions — full addresses OR bare domains (contractors, DL-036). */
  exceptions: string[]
}

export type EmailError = 'format' | 'domain' | null

// A bare format guard: local@label.tld, TLD ≥ 2 letters (rejects "gmail.c", "x@y").
const FORMAT = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase()
}

/**
 * Validate an address. When `rule` is omitted (e.g. the exit page reached without a
 * pid/config), only the format is checked — the backend re-validates authoritatively.
 */
export function validateEmail(emailRaw: string, rule?: DomainRule): EmailError {
  const email = emailRaw.trim()
  if (!FORMAT.test(email)) return 'format'
  if (!rule) return null
  const domain = domainOf(email)
  const lower = email.toLowerCase()
  const allowed =
    rule.allowedDomains.some((d) => domain === d.toLowerCase()) ||
    rule.exceptions.some((e) => {
      const x = e.toLowerCase()
      return lower === x || domain === x
    })
  return allowed ? null : 'domain'
}
