# accesscontrol — Catalyst Advanced I/O Function

Backup/version copy of the function code as it exists in the Zoho Catalyst console. Catalyst's own code editor is the source of truth for execution; this folder exists so the code isn't only living inside the console.

## Context

- Project: Habify30 (Catalyst project ID 20116360871)
- Function ID: 22671000000019199
- Stack: Node 24, Advanced I/O (Express + `zcatalyst-sdk-node`)
- Target table: `AccessControl` (Data Store table ID 22671000000014463) — pid whitelist
- Purpose: live validation of a `pid` (cohort/client identifier) against a whitelist before granting access to the Web Export, per DL-028 "Resilience & Recovery Architecture for Web Export". Fail-closed: any error, missing pid, invalid format, or unreachable DB returns `valid:false`, never an exception or 500.
- Deliberately separate from `recovery` (two-function split chosen 2026-07-10) — this function does not call or depend on `recovery`, and vice versa. The Web Export frontend is responsible for sequencing: call `accesscontrol` first, only proceed to `recovery` on `valid:true`.

## Status (2026-07-10)

- Built and isolated-tested in **Development**, then deployed to **Production** the same day. Both verified end-to-end.
- GET health check: `200 {"status":"ok","message":"accesscontrol is live"}` (Dev and Production).
- Development POST test matrix, all passed:
  - active pid (`active` unset or `true`) → `valid:true`
  - deactivated pid (`active:false`) → `valid:false`
  - unknown pid → `valid:false`
  - injection attempt (`'` in pid value) → rejected by input regex before any ZCQL query, `valid:false`
  - missing pid → `valid:false`
- Production POST test confirmed: active pid → `valid:true`, unknown pid → `valid:false`.
- CORS added 2026-07-10 (`Access-Control-Allow-Origin: https://habify30.k-a-d-o.com`, `-Methods`, `-Headers`, `OPTIONS` short-circuit) — see DL-029. Verified via live fetch in both Development and Production: response header `access-control-allow-origin: https://habify30.k-a-d-o.com` present on POST responses.
- Dev URL: `https://habify30-20116360871.development.catalystserverless.eu/server/accesscontrol/`
- Production URL: `https://habify30-20116360871.catalystserverless.eu/server/accesscontrol/`
- Test rows: `TEST_ACTIVE_001` / `TEST_INACTIVE_002` remain in the Development `AccessControl` table; `PROD_TEST_001` (active) remains in the Production `AccessControl` table.

## Request / response

POST body: `{ "pid": "<string>" }`

pid must match `/^[A-Za-z0-9_-]{1,100}$/` — anything else (missing, wrong type, disallowed characters) short-circuits to `valid:false` without touching the Data Store.

Response is always `200` with `{ status: "ok", valid: true|false }` (plus an optional `message` on the invalid-input path) — the caller should branch on `valid`, not on HTTP status, since network/server failures are also surfaced as `valid:false` by design (fail-closed).

## `AccessControl` table schema

| Column | Type | Flags | Notes |
|---|---|---|---|
| `pid` | Var Char(100) | Mandatory, Unique, Search Index | |
| `client_label` | Var Char(150) | optional | human-readable label, not read by this function |
| `seat_count` | Int | optional | contracted seats, not enforced as a hard cap by this function |
| `is_test` | Boolean | optional | not currently read by this function |
| `active` | Boolean | optional | absence or `true`/`"true"` = valid; explicit `false` = invalid |

## Open follow-ups

- Frontend Web Export integration: read `pid` from URL query param, call this function, fail closed on `valid:false` or any fetch error.
- Populate the Production `AccessControl` table with real cohort/client pids per signed contract (currently only the `PROD_TEST_001` test row exists).
