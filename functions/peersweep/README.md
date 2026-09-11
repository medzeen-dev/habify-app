# peersweep — the scheduled peer-group sweep (DL-094)

Catalyst **Job Function** (`"type": "job"` in `catalyst-config.json`), not an HTTP route.
It has no URL — the listed `/execute` address answers 403 "HTTP Execution is not supported"
— and therefore no key to guard it. It is triggered only by Job Scheduling: one job pool,
one cron, hourly. Function ID `22671000000053571` (same in both environments).

Every piece of scheduled peer-group work runs here and nowhere else (DL-094). Product logic
is unchanged from DL-035 / DL-037 / DL-087 and lives in `../peer/README.md` under "Matching
order"; this README covers what the sweep does, how it is scheduled and the rules that keep
it correct.

## One run, two sweeps in sequence

1. **Formation** — forms 2–3 groups for every cohort whose `peer_group_cutoff_date` has
   passed and whose `CohortConfig.formed_time` is still empty. Idempotent per cohort: once
   `formed_time` is set the cohort is skipped, so running hourly is correct — the step does
   nothing until a cutoff is reached, and nothing again afterwards. A cohort with one
   enrolled member gets the "no allocation this time" mail instead of a group.
2. **Matching** — first deletes `pending` signups whose confirmation link has expired
   (consent was never completed for them), then for every *formed* cohort pairs the wait
   pool (longest waiting first, two solos into a new 2-group; a single leftover into an
   opt-in-open 2-group) and sends the 3-day broadcast where due.

Mails sent from here: formation and no-allocation, wait-pool pairing and absorption,
new-member notice, 3-day broadcast — readable texts in `TRANSACTIONAL_EMAILS.md`, strings in
`index.js`.

**Matching runs only here.** Until 2026-09-10, `/enrol-confirm` and `/pool-join` on `peer`
matched immediately on entry. They no longer do: entering the pool always means waiting for
the next sweep, up to an hour. That is the price of never pairing one person into two groups.

## Why a Job Function, and why exactly one cron

The Data Store offers no mutual exclusion — a conditional `UPDATE … WHERE group_id IS NULL`
and a unique column both break under real concurrency (habify
`Catalyst_Platform_Capabilities.md` B8, measured 2026-09-10). A Function job pool runs jobs
in parallel. So nothing in the application can stop two sweeps from overlapping; what does is
the platform's hard cap — a Job Function is killed at **15 minutes**, and the cron fires
every **60**. Two ticks cannot overlap. That is the serialisation guarantee, not `await`,
which only orders formation before matching within one run.

The `claimSignup` conditional update in `index.js` stays as a second line: it keeps a
pairing that cannot be completed from leaving a `PeerGroups` row or a group of one behind.
It is not a lock and must not be relied on as one (see its doc comment).

## Operating rules (DL-094) — not enforceable in code

- The cron interval stays **above 15 minutes** (it is 60).
- `number_of_retries` stays **0**.
- **No manual "Submit Job" while a scheduled run could be active.** That is the one way to
  put two runs on the same rows. A sanctioned out-of-schedule path is open — OQ-039.
- After every Production deployment of this function, **set its env vars again** — a
  deployment wipes them (Capabilities E2/E5). Without `ZEPTOMAIL_TOKEN` the sweep still forms
  and pairs but sends nothing; without `PEER_ORIGIN` the links in the mails are wrong. Both
  fail open, so a misconfigured sweep looks healthy from the outside.

## Job Scheduling (both environments, same IDs)

| Object | ID | Setting |
|---|---|---|
| Job Pool `peersweep` | `22671000000053574` | type *Function*, 256 MB |
| Cron `peersweep` | `22671000000051814` | `0 * * * *`, Europe/Berlin, retries 0 |

Development: cron **active** (since 2026-09-11; first scheduled tick 11:00). Production:
cron **disabled** until `ZEPTOMAIL_TOKEN` is set there (OQ-037) — an active sweep without a
token would form groups without telling anyone. The only way to change the Production cron
is another **promotion** of Job Scheduling from Development; it copies the Development state
wholesale (Capabilities E5). The former Webhook pool `peerjobs` and the crons
`peerformation` / `peermatching` are deleted.

Job parameters (`pid`, `force`) exist in the code for a named-cohort run but **do not
arrive** from the console's *Submit Job* (`allParams: {}`, measured 2026-09-11) — a manual
run touches every cohort. Test cohorts are built so that this is harmless.

## Environment variables

Set on **`peersweep`** (per environment, per function — same names as on `peer`):
`ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_FROM`, `PEER_ORIGIN`. Development has all three; Production
has `ZEPTOMAIL_FROM` and `PEER_ORIGIN` and no token (OQ-037). Values are never read back
(`Get_Function` returns them in cleartext — Capabilities E2).

## Shared core

`./_shared/peer-common.js` is a **copy** of `functions/_shared/peer-common.js` (mail via
ZeptoMail with subject prefix and footer, cohort meta, Catalyst date handling, link
paragraphs). Catalyst packs one folder per function and cannot follow a `require()` outside
it. After editing the source:

```
node functions/sync-shared.mjs          # copy into peer/ and peersweep/
node functions/sync-shared.mjs --check  # exit 1 if a copy is stale (CI / hook)
```

Commit the copies — a forgotten sync must show up as a diff, not as a silent old deploy.

## Deploy and verify

Development: `catalyst deploy --only functions:peersweep --dc eu --org 20116360871`
(usually together with `functions:peer`). Production: console deployment assistant only
(Settings → Environments → Deployments); the CLI cannot reach it. Afterwards set the env vars
again (above).

There is no HTTP route to probe. Verification of a run is the Jobs list (console → Job
Scheduling → Jobs → status *Success*/*Failure*) and its effect in the Data Store. Two
limits, both measured 2026-09-11: the cron object's `success_count` stays 0 after successful
scheduled runs — count in the Jobs list; and the application log of a Job Function is not
retrievable through the MCP (only access logs, which a Job Function does not have). The
run's summary line (`{"sweep":"ok", ms, formed, purged, results}`) has so far not been read
from anywhere; diagnosis went through what the run wrote to the Data Store. Reliable logging
for this function is an open operational question.

## Logging

One JSON line per run, `sweep: "ok"` or `"error"`, with per-cohort counts (`paired`,
`absorbed`, `waiting`, `broadcastGroups`) and the purge count. No addresses are logged.
