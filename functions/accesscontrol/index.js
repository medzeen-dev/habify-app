"use strict";

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// No CORS handling here — on purpose (DL-082 §1). accesscontrol is called cross-origin
// by BOTH the Shell and the peer-group origin (getPeerConfig, DL-086), and CORS for both
// is the API Gateway's job via Authorized Domains. Measured on Development 2026-09-08,
// with peer-dev.habify30.k-a-d-o.com registered as an Authorized Domain:
//   OPTIONS  → answered by the gateway alone; the function is never invoked
//              (no X-Catalyst-Function-* headers on the response), so a manual OPTIONS
//              short-circuit in here could not satisfy a preflight even if we wanted it to.
//   POST/GET → the gateway adds Access-Control-Allow-Origin to the real response too.
// So a manual header here is not a fallback, it is a second header: the response carried
// both `Access-Control-Allow-Origin: <peer origin>` (gateway) and
// `access-control-allow-origin: https://habify30.k-a-d-o.com` (this function), and a
// browser rejects a response with multiple Access-Control-Allow-Origin headers —
// *including when the two values are identical*. Setting PEER_ORIGIN here would therefore
// not have fixed it, which is why this function no longer reads that variable at all.
//
// New origin ⇒ register it under Authorized Domains for that environment; do not add
// headers here. Local `npm run dev` is unaffected: the Vite proxy makes it same-origin.

// Parse a Catalyst datetime ("YYYY-MM-DD HH:mm:ss:SSS") into a Date.
// Returns null if absent/unparseable — callers treat that as "no expiry".
function parseCatalystDate(val) {
  if (!val) return null;
  const iso = String(val).replace(" ", "T").replace(/:(\d{3})$/, ".$1");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "accesscontrol is live" });
});

// Validate a pid. Fail-closed, always HTTP 200 — the frontend branches on `valid`
// only (DL-029). Response shape (DL-058):
//   { valid:false, reason:"invalid" }
//   { valid:false, reason:"expired", expiryDate }
//   { valid:true, programmName?, contactEmail? }
app.post("/", (req, res) => {

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });

  const body = req.body || {};
  const pid = body.pid;

  if (!pid || typeof pid !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(pid)) {
    res.status(200).json({ status: "ok", valid: false, reason: "invalid" });
    return;
  }

  const safePid = pid.replace(/'/g, "");
  const query = "SELECT pid, active, programm_name, contact_email, expiry_date FROM AccessControl WHERE pid = '" + safePid + "'";

  catalystApp.zcql().executeZCQLQuery(query)
    .then((result) => {
      if (!result || result.length === 0) {
        res.status(200).json({ status: "ok", valid: false, reason: "invalid" });
        return;
      }

      const row = result[0].AccessControl;

      // active is a boolean but ZCQL may hand it back as the string "true"/"false".
      const activeVal = row.active;
      const isActive = (activeVal === null || activeVal === undefined || activeVal === true || activeVal === "true");
      if (!isActive) {
        res.status(200).json({ status: "ok", valid: false, reason: "invalid" });
        return;
      }

      // Explicit-expiry check (DL-058; simplified from DL-031's computed formula).
      // Unparseable/absent expiry → not expired (never lock out on a parse error).
      const expiry = parseCatalystDate(row.expiry_date);
      if (expiry && Date.now() > expiry.getTime()) {
        res.status(200).json({
          status: "ok",
          valid: false,
          reason: "expired",
          expiryDate: expiry.toISOString().slice(0, 10)
        });
        return;
      }

      const out = { status: "ok", valid: true };
      if (row.programm_name) out.programmName = row.programm_name;   // Einstieg sub-line (DL-055)
      if (row.contact_email) out.contactEmail = row.contact_email;   // reserved (DL-058)

      // Cohort capabilities (DL-081 §3a) — stored in a separate CohortConfig table
      // (DL-086), attached here as the `capabilities` object the client expects.
      // Fail-open: any error / missing config → respond valid without capabilities.
      catalystApp.zcql().executeZCQLQuery(
        "SELECT allowed_email_domains, manual_domain_exceptions, peer_group_cutoff_date, formed_time FROM CohortConfig WHERE pid = '" + safePid + "'"
      )
        .then((cfgRows) => {
          if (cfgRows && cfgRows.length) {
            const c = cfgRows[0].CohortConfig;
            const caps = {};
            const domains = String(c.allowed_email_domains || "").split(",").map((s) => s.trim()).filter(Boolean);
            const exceptions = String(c.manual_domain_exceptions || "").split(",").map((s) => s.trim()).filter(Boolean);
            if (domains.length) caps.allowedEmailDomains = domains;
            if (exceptions.length) caps.manualDomainExceptions = exceptions;
            const cutoff = parseCatalystDate(c.peer_group_cutoff_date);
            if (cutoff) caps.peerGroupCutoffDate = cutoff.toISOString().slice(0, 10);
            else if (c.peer_group_cutoff_date) caps.peerGroupCutoffDate = String(c.peer_group_cutoff_date);
            // Has this cohort already been formed? Whoever enrols after that is a late
            // joiner and goes into the wait pool, NOT into the cutoff allocation (DL-037)
            // — the enrolment screen has to promise them something different.
            // `formed_time`, not the cutoff date, is the authority: the two come apart
            // whenever a cohort is formed early or late (a forced formation in testing,
            // a cron that ran the following night). Comparing dates on the client would be
            // right most of the time, which is the worst kind of wrong for a promise.
            if (c.formed_time) caps.peerGroupFormed = true;
            if (Object.keys(caps).length) out.capabilities = caps;
          }
          res.status(200).json(out);
        })
        .catch(() => { res.status(200).json(out); });
    })
    .catch((err) => {
      console.log(err);
      res.status(200).json({ status: "ok", valid: false, reason: "invalid", message: "internal error" });
    });
});

module.exports = app;
