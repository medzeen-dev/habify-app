# zohoformswebhook — Catalyst Advanced I/O Function

Backup/version copy of the function code as it exists in the Zoho Catalyst console. Catalyst's own code editor is the source of truth for execution; this folder exists so the code isn't only living inside the console.

## Context

- Project: Habify30 (Catalyst project ID 20116360871)
- Function ID: 22671000000014446
- Stack: Node 24, Advanced I/O (Express + `zcatalyst-sdk-node`)
- Target table: `FormSubmissions` (Data Store table ID 22671000000014073)
- Purpose: receives Zoho Forms POST submissions, writes a backup row to the Data Store (`FormSubmissions`), per DL-027/DL-028

## Status (2026-07-10)

- Deployed to **Development** and **Production**. Both verified end-to-end.
- Isolated test passed: GET health check `200`, POST test payload → `200` with `rowid` returned, row verified in Data Store with correct field mapping and `submitted_at` in the required `YYYY-MM-DD HH:MM:SS` format (not ISO 8601 — Catalyst DateTime columns reject ISO 8601).
- Dev URL: `https://habify30-20116360871.development.catalystserverless.eu/server/zohoformswebhook/`
- Production URL: `https://habify30-20116360871.catalystserverless.eu/server/zohoformswebhook/` — POST test in Production confirmed (row `15342000000018001` in `FormSubmissions`).
- Wired to a real Zoho Forms webhook and tested end-to-end via the `API_write_Test` form (Field Alias prefill → hidden fields → outbound webhook POST → this function → Data Store). Row `22671000000014458` (Development) confirms the full path works.
- `api.habify30.k-a-d-o.com` custom domain: **switched over and verified working (2026-07-10).** Catalyst Production domain mapping confirmed active; GET health check via `https://api.habify30.k-a-d-o.com/server/zohoformswebhook/` returns `200`. The `API_write_Test` form's outbound Webhook Integration URL was updated to this domain and saved.
- `form.k-a-d-o.com` (Zoho Forms custom domain): shows as **Verified** in Zoho's Control Panel → Custom Domain, and was assigned to the `API_write_Test` form (Settings → Branding → Custom Domain). However, live testing (2026-07-10) found the actual form URL under this domain returns "Page not found", and the bare domain redirects to Zoho's generic marketing site (`zoho.com/de/forms`) instead of the form portal — meaning it is not actually serving traffic yet despite the "Verified" status. Likely DNS/CDN propagation lag on Zoho's side, but needs a manual recheck (e.g. a few hours later, or via Zoho support) before relying on it. Not blocking: the webhook target switch (`api.habify30.k-a-d-o.com`) is independent of this and already confirmed working. Tracked as a ClickUp follow-up task.
- CORS added 2026-07-10 (`Access-Control-Allow-Origin: https://habify30.k-a-d-o.com`, `-Methods`, `-Headers`, `OPTIONS` short-circuit) — see DL-029. Verified via live fetch in both Development and Production: response header `access-control-allow-origin: https://habify30.k-a-d-o.com` present on GET responses.

## Fields written to `FormSubmissions`

Naming follows the canonical convention (`pid`, `user_id`, `stretch_relevant` — see DL-020/025/026/027/028), not `uid`.

| Column | Source | Notes |
|---|---|---|
| `pid` | `body.pid` | mandatory; 400 if missing |
| `user_id` | `body.user_id` | optional |
| `stretch_relevant` | `body.stretch_relevant` | optional boolean, accepts `true`/`"true"` |
| `form_type` | `body.form_type` | defaults to `"unknown"` |
| `submitted_at` | server-generated | `YYYY-MM-DD HH:MM:SS` |
| `raw_payload` | full request body | JSON string, flagged PII/ePHI in schema |

## Open follow-ups

- Recheck `form.k-a-d-o.com` (Zoho Forms side) — currently "Verified" in Zoho's Control Panel but not actually resolving to the form portal yet (see Status above). Re-test the form permalink under this domain once DNS/CDN propagation should be complete.
- Build the real production form (with actual reflection questions) using the same 3 hidden fields + Field Alias + outbound webhook pattern validated on `API_write_Test`.
