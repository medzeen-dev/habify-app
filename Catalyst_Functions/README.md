# Catalyst Functions — Index

Overview of all Zoho Catalyst Advanced I/O Functions backing the Habify30 Web Export resilience/recovery layer and the Zoho Forms integration. Each function has its own subfolder with a backup copy of `index.js` plus a detailed README; this file is the entry point — start here, then follow the links for implementation detail.

Catalyst's own code editor (Development/Production environments) is the source of truth for execution. These repo copies exist so the code isn't only living inside the console, and so changes are visible in diffs alongside the rest of the canonical documentation.

- Project: Habify30 (Catalyst project ID `20116360871`)
- Stack: Node 24, Advanced I/O (Express + `zcatalyst-sdk-node`)
- Architecture background: DL-026, DL-027, DL-028, DL-029 in `09_Decision_Log.md`; "Resilience & Recovery Architecture for Web Export" in `15_Technical_Architecture.md`

## Functions

| Function | Function ID | Purpose | Data Store table | Status | Detail |
|---|---|---|---|---|---|
| [`accesscontrol`](./accesscontrol/README.md) | `22671000000019199` | Validates a `pid` (cohort/client identifier) against a whitelist before granting Web Export access. Fail-closed. **Response shape extended (DL-058):** returns `{ valid, reason?, expiryDate?, programmName?, contactEmail? }` — see "Response shape" in function README and `09_Decision_Log.md` DL-058. | `AccessControl` | Dev + Prod deployed and tested; CORS added 2026-07-10; **response shape extension not yet deployed** | [README](./accesscontrol/README.md) |
| [`recovery`](./recovery/README.md) | `22671000000019205` | Generates/persists a `user_id` + human-typable recovery code (`/register`; called at Wizard Step 2 per DL-059); looks up `pid`/`user_id` by recovery code (`/recover`). **`/recover` response extended (DL-057):** returns `{ found, user_id?, pid? }` — `pid` is now returned alongside `user_id` on `found:true`. **Rate-limit on `/recover` is a non-optional build requirement (DL-057)** — see Open follow-ups below. | `UserRecovery` | Dev + Prod deployed and tested; CORS added 2026-07-10; **/recover response extension and rate-limit not yet deployed** | [README](./recovery/README.md) |
| [`zohoformswebhook`](./zohoformswebhook/README.md) | `22671000000014446` | Receives Zoho Forms POST submissions, writes a backup row to the Data Store. | `FormSubmissions` | Dev + Prod deployed and tested; custom domain `api.habify30.k-a-d-o.com` live; CORS added 2026-07-10 | [README](./zohoformswebhook/README.md) |

## Cross-function conventions

- **CORS**: all three functions send `Access-Control-Allow-Origin: https://habify30.k-a-d-o.com` (plus `-Methods` and `-Headers`) and short-circuit `OPTIONS` requests with a `200`. Added 2026-07-10 — see DL-029. Before this date the functions had no CORS headers despite DL-028/TD-005 documenting CORS as "configured"; this was a documentation-vs-implementation gap, now closed.
- **Fail-closed / always-200 contract**: `accesscontrol` and `recovery` never return a non-200 status for expected error cases (invalid input, not-found, DB error) — they return `200` with a boolean field (`valid` / `found`) instead, so the frontend only branches on that field. `zohoformswebhook` is the exception (`400`/`500` on error), since it's a server-to-server webhook receiver, not something the Web Export frontend calls directly.
- **No cross-calling**: `accesscontrol` and `recovery` do not call each other or share logic. **Sequencing rule (DL-029, clarified by DL-057):** For the normal (non-recovery) entry path, the calling frontend is responsible for sequencing — `accesscontrol` first, `/register` only on `valid:true`. **Exception — recovery path (DL-057):** when a participant enters their recovery code on the `Einstieg — Code eingeben` screen (DL-056) or on Fehlerseite Zustand F (DL-062), `/recover` is called first (without a prior `accesscontrol` gate); `accesscontrol(pid)` follows, using the `pid` returned by `/recover`. This reversal does not violate the "neither calls the other" principle — the Shell sequences the calls, not the functions themselves.
- **pid format**: `/^[A-Za-z0-9_-]{1,100}$/`, enforced identically in `accesscontrol` and `zohoformswebhook`.
- **Dev URLs**: `https://habify30-20116360871.development.catalystserverless.eu/server/<function>/`
- **Production URLs**: `https://habify30-20116360871.catalystserverless.eu/server/<function>/` (custom domain `api.habify30.k-a-d-o.com` also live, currently wired for `zohoformswebhook`)

## Open follow-ups (cross-function)

- **[Non-optional, blocking build task] Rate-limit `/recover` endpoint (DL-057).** The `/recover` endpoint is now called without a prior `accesscontrol` gate on the recovery path (DL-057). Without rate-limiting, the endpoint is exposed to brute-force recovery-code guessing. Must be implemented before the recovery path is live. Mechanism not specified — typical approaches: per-IP throttle (e.g. 5 attempts / 15 min), or a per-code attempt counter in the Data Store with a lock-out period.
- **Deploy `accesscontrol` response shape extension (DL-058).** Response must return `{ valid, reason?, expiryDate?, programmName?, contactEmail? }`. `programmName` must be added to the `AccessControl` Data Store table and seeded with `"habify30"` for existing pids.
- **Deploy `/recover` response extension (DL-057).** Response must return `{ found, user_id?, pid? }` — `pid` must be read from the `UserRecovery` record and included on `found:true`.
- Frontend Web Export integration (pid-fetch, `localStorage`, recovery-code UI, Einstieg/Wizard/Fehlerseite screens) — scoped as separate tasks, to be specified in a new chat.
- Populate the Production `AccessControl` table with real cohort/client pids per signed contract (currently only a test row exists).
- Remove Production test rows (`PROD_TEST_001` etc.) before real client data flows through these functions.
- Recheck `form.k-a-d-o.com` DNS/CDN propagation (see `zohoformswebhook/README.md`).
