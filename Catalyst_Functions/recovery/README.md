# recovery — Catalyst Advanced I/O Function

Backup/version copy of the function code as it exists in the Zoho Catalyst console. Catalyst's own code editor is the source of truth for execution; this folder exists so the code isn't only living inside the console.

## Context

- Project: Habify30 (Catalyst project ID 20116360871)
- Function ID: 22671000000019205
- Stack: Node 24, Advanced I/O (Express + `zcatalyst-sdk-node`)
- Target table: `UserRecovery` (Data Store table ID 22671000000014832)
- Purpose: generates and persists a participant `user_id` together with a human-typable recovery code, and looks up `pid`/`user_id` by recovery code, per DL-026/DL-028 "Resilience & Recovery Architecture for Web Export". Backs the case where a Web Export user loses their `localStorage` (new device, cleared browser data, etc.).
- Deliberately separate from `accesscontrol` (two-function split chosen 2026-07-10). This function does **not** check the `pid` against the `AccessControl` whitelist itself — the Web Export frontend must call `accesscontrol` first and only call `/register` here on `valid:true`. If cross-checking inside `recovery` is wanted later, that's a deliberate coupling change, not the current behaviour.
- `user_id` and `recovery_code` are both generated server-side in `/register` (not supplied by the frontend) — single source of truth for uniqueness, no client/server race on collision handling.

## Status (2026-07-10)

- Built and isolated-tested in **Development**, then deployed to **Production** the same day. Both verified end-to-end.
- GET health check: `200 {"status":"ok","message":"recovery is live"}` (Dev and Production).
- Development `/register` test matrix, all passed:
  - valid pid → `200` with generated `user_id` (UUID v4) and `recovery_code` (formatted `XXXX-XXXX`)
  - missing pid → `400`
  - invalid pid format → `400`
- Development `/recover` test matrix, all passed:
  - exact code (with hyphen) → `found:true` with `pid`/`user_id`
  - same code, lowercase, no hyphen → `found:true` (normalization strips non-alphanumerics and uppercases before lookup)
  - one character altered → checksum fails locally, `found:false`, no DB query made
  - well-formed code with valid checksum but no matching row → `found:false` (after DB lookup)
  - missing `recovery_code` → `found:false`
- Production round-trip confirmed: `/register` with `PROD_TEST_001` returned a `user_id`/`recovery_code`, and `/recover` with that exact code correctly returned the matching `pid`/`user_id`.
- CORS added 2026-07-10 (`Access-Control-Allow-Origin: https://habify30.k-a-d-o.com`, `-Methods`, `-Headers`, `OPTIONS` short-circuit) — see DL-029. Verified via live fetch in both Development and Production: response header `access-control-allow-origin: https://habify30.k-a-d-o.com` present on `/recover` responses.
- Dev URL: `https://habify30-20116360871.development.catalystserverless.eu/server/recovery/`
- Production URL: `https://habify30-20116360871.catalystserverless.eu/server/recovery/`
- Test rows: one in the Development `UserRecovery` table (pid `TEST_ACTIVE_001`), one in the Production `UserRecovery` table (pid `PROD_TEST_001`).

## Recovery code design

- Alphabet: Crockford Base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, 32 symbols, excludes I/L/O/U to avoid transcription ambiguity).
- 7 cryptographically random symbols (`crypto.randomInt`) + 1 checksum symbol = 8 symbols total.
- Checksum: `sum(index_i * (position_i + 1)) mod 32`, mapped back into the same alphabet — deliberately simpler than the official Crockford mod-37 checksum (which uses 5 symbols outside the alphabet) so the code never contains a character the user can't type on a plain keyboard. Weaker error-detection than mod-37, but sufficient for catching single-character typos, which is the goal (decision made 2026-07-10).
- Display format: `XXXX-XXXX` (first 4 / last 4, hyphen in the middle). Stored in the Data Store without the hyphen; `/recover` accepts the code with or without the hyphen, in any case.
- Client-side checksum validation is expected to also happen in the future Web Export frontend before any network call (per DL-026 rationale); `/recover` re-validates the checksum server-side too as defense in depth, avoiding a DB query for malformed/mistyped input.

## Request / response

### `POST /register`

Body: `{ "pid": "<string>" }` (same format rule as `accesscontrol`: `/^[A-Za-z0-9_-]{1,100}$/`)

Success: `200 { "status": "ok", "user_id": "<uuid>", "recovery_code": "XXXX-XXXX" }`
Failure (missing/invalid pid, or insert error after retries): `400`/`500 { "status": "error", "message": "..." }`

On a unique-constraint conflict on `user_id` or `recovery_code` (both flagged `Is Unique` in the schema), the function silently regenerates and retries the insert up to 5 times before giving up.

### `POST /recover`

Body: `{ "recovery_code": "<string>" }` (hyphen optional, case-insensitive)

Always `200`: `{ "status": "ok", "found": true, "pid": "...", "user_id": "..." }` or `{ "status": "ok", "found": false }`. Never leaks whether a malformed code, a valid-but-unknown code, or a DB error caused `found:false` — all collapse to the same response shape.

## `UserRecovery` table schema

| Column | Type | Flags | Notes |
|---|---|---|---|
| `pid` | Var Char(100) | Mandatory, Search Index | not unique — many users share a cohort pid |
| `user_id` | Var Char(100) | Mandatory, Unique, Search Index | generated by this function (UUID v4) |
| `recovery_code` | Var Char(20) | Mandatory, Unique, Search Index | generated by this function, stored without hyphen |
| `created_at` | DateTime | Mandatory | `YYYY-MM-DD HH:MM:SS`, server-generated |

## Open follow-ups

- Frontend Web Export integration: on first load without a `localStorage` `user_id`, call `/register` (only after `accesscontrol` returned `valid:true`); show the returned `recovery_code` to the user as a confirmed, non-silent operation (per DL-026). Build a recovery-code entry UI calling `/recover` for the lost-device case.
