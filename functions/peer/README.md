# peer — peer-group backend (Phase 1)

pid-only Catalyst Advanced-I/O function for the peer-group pages (DL-053 / DL-035–037 /
DL-086). **No `user_id` is ever read or written here** (DL-053). One function, three
routes; the client (`shell/src/peer/lib/peerApi.ts`) calls them through the peer origin.

## Routes
- `POST /enrol` — `{ pid, email, consent:true }` → `{ ok }`. Requires consent (DL-036),
  validates the email domain against the cohort's `CohortConfig` (server-authoritative),
  idempotent per `(pid, email)`.
- `POST /exit-request` — `{ email, pid? }` → **always** `{ ok:true }` (non-revealing,
  DL-053). If the address is enrolled, stores a one-time token and emails the exit link
  via ZeptoMail. IP-rate-limited.
- `POST /exit-confirm` — `{ token }` → `{ ok }` / `{ ok:false, reason:"invalid"|"expired" }`.
  The emailed link's token performs the removal (no-login, DL-037).

## Data Store tables (create in the Catalyst console / CLI before first use)

**`CohortConfig`** — per-cohort capabilities, read by `accesscontrol` (→ `capabilities`)
and by `/enrol`. One row per `pid`.
| column | type | notes |
|---|---|---|
| `pid` | Text | cohort id (unique) |
| `allowed_email_domains` | Text | comma-separated, e.g. `firma.de,sub.firma.de` |
| `manual_domain_exceptions` | Text | comma-separated full addresses or domains (contractors, DL-036) |
| `peer_group_cutoff_date` | DateTime (or Text ISO) | the `{stichtag}` shown on the enrolment page |

**`PeerSignups`** — the signup list. One row per `(pid, email)`.
| column | type | notes |
|---|---|---|
| `pid` | Text | |
| `email` | Text | lowercased |
| `consent` | Boolean | always true when enrolled (DL-036) |
| `status` | Text | `enrolled` \| `exited` (Phase 2 may add `waiting`) |
| `exit_token` | Text | one-time token, set on exit-request, cleared on exit-confirm |
| `exit_token_expiry` | DateTime (or Text) | token TTL (24h) |

(ROWID / CREATEDTIME / MODIFIEDTIME are provided automatically by Catalyst.)

## Environment variables (set per environment; secrets via the console/CLI, never in git)
- `PEER_ORIGIN` — the peer pages' own origin, e.g. `https://peer.habify30.k-a-d-o.com`.
  Used for CORS (here **and** in `accesscontrol`) and to build the exit link. In Dev the
  localhost regex covers the browser; set this before Prod.
- `ZEPTOMAIL_TOKEN` — ZeptoMail Send-Mail API key (**secret**). Without it, `/exit-request`
  still returns ok but sends nothing (logs a notice).
- `ZEPTOMAIL_FROM` — a verified ZeptoMail sender address.

## Deploy (host terminal)
1. Create the two Data Store tables above (Development first).
2. Set the env vars (`PEER_ORIGIN`; `ZEPTOMAIL_TOKEN`/`ZEPTOMAIL_FROM` once ZeptoMail's
   EU endpoint + DPA are confirmed — OQ-037).
3. `catalyst deploy` (functions target `peer`; `accesscontrol` is also updated — it now
   returns `capabilities` and allows the peer origin).
4. Deploy the peer frontend entry (`dist/peer.html` + assets) to its **own** Slate app /
   subdomain = `PEER_ORIGIN` (DL-086 origin isolation).

## Not in Phase 1 (DL-035/037, deferred)
Group formation at the cutoff (random 2–3 partition + formation emails), the wait-pool /
3-day broadcast / opt-in-growth matching, and notifying remaining members on exit. See
the TODO in `/exit-confirm`. These are cron/batch jobs + more ZeptoMail templates.
