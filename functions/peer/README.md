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
  The emailed link's token performs the removal (no-login, DL-037). **Exit is final**
  (DL-087) — the address leaves the list and is not re-pooled. A group left with 2 members
  gets an opt-in link; a group left with 1 is dissolved and its last member is mailed a
  wait-pool link.
- `POST /pool-join` — `{ pt }` → `{ ok, matched }`. The dissolved-group link: the click is
  the active act of entering the wait pool (DL-087). Matches immediately.
- `POST /run-matching` — admin-key guarded cron sweep: wait-pool matching for every formed
  cohort + the 3-day broadcast. Matching also runs inline at both pool entries, so this is
  the safety net; the broadcast is inherently time-based and lives only here.

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
| `status` | Text | `enrolled` (on the list / in the wait pool) \| `grouped` \| `exited` (final, DL-087) \| `dissolved` (group dissolved, has not re-joined the pool yet) |
| `group_id` | Text | set at formation/matching; the group this signup belongs to |
| `pool_token` | Text | token in the dissolved-group email's wait-pool link (DL-087) |
| `waiting_since` | DateTime | set on wait-pool entry; the 3-day-broadcast clock |
| `exit_token` | Text | one-time token, set on exit-request, cleared on exit-confirm |
| `exit_token_expiry` | DateTime (or Text) | token TTL (24h) |

**`PeerGroups`** — one row per formed group (Phase 2a, DL-035). One row per `group_id`.
| column | type | notes |
|---|---|---|
| `pid` | Text | |
| `group_id` | Text | unique; referenced by `PeerSignups.group_id` |
| `open_to_new` | Boolean | opt-in-growth flag; only 2-person groups toggle it (DL-037) |
| `optin_token` | Text | token in the formation email's opt-in link (2-groups only) |

`CohortConfig` also gains **`formed_time`** (DateTime, the idempotency guard for the
formation cron) and **`last_broadcast_time`** (DateTime, so the 3-day broadcast goes out
once per waiting episode; reset when the pool runs empty).

(ROWID / CREATEDTIME / MODIFIEDTIME are provided automatically by Catalyst.)

## Environment variables

In Catalyst these are set **per function**, not per project: console → Serverless →
Functions → *(function)* → **Configuration** → Environment Variables → *Create Variable*
(per environment — pick Development/Production in the console's environment switcher).
The same tab's **Function Triggers** block is where the formation Cron is configured.

Set on **`peer`**: `ADMIN_KEY`, `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_FROM`, `PEER_ORIGIN`.
Set on **`accesscontrol`**: `PEER_ORIGIN` as well — it needs the peer origin in its own
CORS allowlist. Secrets go in the console, never in git.
- `PEER_ORIGIN` — the peer pages' own origin, e.g. `https://peer.habify30.k-a-d-o.com`.
  Used for CORS (here **and** in `accesscontrol`) and to build the exit link. In Dev the
  localhost regex covers the browser; set this before Prod.
- `ZEPTOMAIL_TOKEN` — ZeptoMail Send-Mail API key (**secret**). Without it, `/exit-request`
  still returns ok but sends nothing (logs a notice).
- `ZEPTOMAIL_FROM` — a verified ZeptoMail sender address.
- `ADMIN_KEY` — shared secret guarding `POST /run-formation` (Phase 2a). The formation
  cron sends it; without it set, `/run-formation` refuses (403). Never in git.

## Formation cron (Phase 2a, DL-035)
`POST /run-formation` forms every cohort whose `peer_group_cutoff_date` has passed and
whose `formed_time` is still empty (idempotent). Wire a **Catalyst Cron** to call it
daily with `{ "key": "<ADMIN_KEY>" }` in the body. Manual/testing: `{ "key": …, "pid":
"<pid>", "force": true }` forms one named cohort regardless of cutoff. The opt-in link
in the formation email points at `PEER_ORIGIN/peer.html?gt=<token>#/gruppe`.

## Deploy (host terminal)
1. Create the Data Store tables above (Development first).
2. Set the env vars per function as described above (`ADMIN_KEY` on `peer`; `PEER_ORIGIN`
   on `peer` **and** `accesscontrol`; `ZEPTOMAIL_TOKEN`/`ZEPTOMAIL_FROM` on `peer` once
   ZeptoMail's EU endpoint + DPA are confirmed — OQ-037).
3. `catalyst deploy` (functions target `peer`; `accesscontrol` is also updated — it now
   returns `capabilities` and allows the peer origin).
4. Deploy the peer frontend entry (`dist/peer.html` + assets) to its **own** Slate app /
   subdomain = `PEER_ORIGIN` (DL-086 origin isolation).

## Matching order (DL-037, precedence per DL-087)
1. **Pair two solos** into a new 2-group as soon as two are available — no waiting for a
   third. Longest-waiting first (fairness; DL-035's "fully random" governs the cutoff
   formation, not queue order).
2. Only a **single leftover solo** goes into an opt-in-open 2-group ("if the wait pool
   cannot otherwise fill"). So two solos pair with each other even when an open group
   exists — that way nobody is left behind.
3. A lone solo with no open group waits. After **3 days** the bundled broadcast goes to
   the 2-person groups that are **not yet open** (an open one would already have taken them).

## Crons (configured in Development)
Advanced-I/O functions are **not** cron-triggerable from the function's own Configuration
tab — that only offers the API Gateway. Crons live in the separate **Job Scheduling**
service (console → Job Scheduling), model: *Job Pool → Cron → Jobs*.

Set up in Development:
- **Job Pool `peerjobs`** — type *Webhook*, max count **1** (so two sweeps can never run
  concurrently and double-pair).
- **Cron `peerformation`** — `0 3 * * *` (Europe/Berlin) → POST `…/server/peer/run-formation`
- **Cron `peermatching`** — `0 * * * *` (Europe/Berlin) → POST `…/server/peer/run-matching`

Both carry the header `Content-Type: application/json` and the body `{"key":"<ADMIN_KEY>"}`
(the key lives in the cron config, never in git; the *Parameters* toggle stays off so the
secret is never a query string). Both were verified once via *Submit Job* → HTTP 200.

**Prod still needs the same setup** — job pool, both crons, and the env vars.

## Email copy
Final as of 2026-09-08 (reviewed by Matthias) — the readable mirror of all ten artifacts
is `EMAILS.md`; the strings in `index.js` are the technical source of truth. Every subject
is prefixed with the cohort's `programm_name` and every mail carries a footer pointing at
`contact_email` (both from `AccessControl`, DL-058) — added centrally in `zeptoSend`.
Set `ZEPTOMAIL_FROM` to **`noreply.habify30@k-a-d-o.com`**.
