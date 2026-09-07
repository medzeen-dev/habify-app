"use strict";

// Peer-group backend (DL-053 / DL-035–037 / DL-086). pid-only context, NO user_id —
// this function never reads or writes a user_id (DL-053). Three routes, matching the
// client contract (peerApi.ts):
//   POST /enrol         — put an address on the pid-scoped signup list (consent + domain enforced)
//   POST /exit-request  — email a one-time exit link IF the address is enrolled (always non-revealing)
//   POST /exit-confirm  — the emailed link's token removes the address from the list
//
// Called only from the peer-group origin (its own subdomain, DL-086) — set PEER_ORIGIN
// as a Catalyst env var at deploy. The Shell never calls this function. Phase 1
// (interactive path): group formation, wait-pool and member notifications (DL-035/037)
// are NOT built here yet — see the TODO in /exit-confirm.

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PEER_ORIGIN = process.env.PEER_ORIGIN || "";
const ALLOWED_ORIGINS = [PEER_ORIGIN].filter(Boolean);
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/; // Dev only

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin);
  res.header("Access-Control-Allow-Origin", allowed ? origin : (ALLOWED_ORIGINS[0] || "null"));
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

const EMAIL_FORMAT = /^[^\s@']+@[^\s@']+\.[a-z]{2,}$/i;
const TOKEN_TTL_HOURS = 24;

function validPid(pid) {
  return typeof pid === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(pid);
}
function parseList(val) {
  return String(val || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function domainAllowed(email, domains, exceptions) {
  if (domains.length === 0) return true; // no rule configured → server lets a well-formed address through
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (domains.includes(domain)) return true;
  return exceptions.some((e) => e === email || e === domain);
}
function parseCatalystDate(val) {
  if (!val) return null;
  const iso = String(val).replace(" ", "T").replace(/:(\d{3})$/, ".$1");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function catalystNow(offsetMs) {
  return new Date(Date.now() + (offsetMs || 0)).toISOString().replace("T", " ").substring(0, 19);
}

// --- IP rate limit for /exit-request (mirrors recovery/DL-057): it triggers an
// outbound email, so throttle it against mail-bombing an address. ---
const RL_LIMIT = 10;
const RL_TTL_HOURS = 1;
const RL_SEGMENT_ID = "22671000000014066"; // Dev "Default" segment. TODO: Prod segment id before Prod deploy.

function clientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.headers["x-real-ip"] || (req.connection && req.connection.remoteAddress) || "";
}
async function isRateLimited(catalystApp, req) {
  const ip = clientIp(req);
  if (!ip) return false;
  try {
    const seg = catalystApp.cache().segment(RL_SEGMENT_ID);
    const key = "rl:peerexit:" + ip;
    const cur = parseInt((await seg.getValue(key)) || "0", 10) || 0;
    if (cur >= RL_LIMIT) return true;
    await seg.put(key, String(cur + 1), RL_TTL_HOURS);
    return false;
  } catch (e) {
    console.log("ratelimit skipped:", e && e.message);
    return false;
  }
}

// ZeptoMail (EU endpoint). Server-to-server; the token is a secret env var, never in
// code (DL-086). No-ops (logs) if unconfigured, so Dev without creds still behaves.
async function sendExitEmail(toEmail, link) {
  const token = process.env.ZEPTOMAIL_TOKEN;
  const from = process.env.ZEPTOMAIL_FROM;
  if (!token || !from || !PEER_ORIGIN) {
    console.log("ZeptoMail not configured (ZEPTOMAIL_TOKEN/ZEPTOMAIL_FROM/PEER_ORIGIN) — skipping send.");
    return;
  }
  // Copy is provisional — the peer emails were flagged "not decided, flagged for build"
  // (15_Technical_Architecture, DL-037). Revisit alongside the DL-035 formation email.
  const htmlbody =
    '<p>Du hast angefragt, deine habify30-Peergruppe zu verlassen.</p>' +
    '<p>Klicke auf den folgenden Link, um dich abzumelden. Erst dann wirst du aus der Gruppe entfernt ' +
    'und die anderen Gruppenmitglieder werden über deinen Austritt informiert:</p>' +
    '<p><a href="' + link + '">Abmeldung bestätigen</a></p>' +
    '<p>Der Link ist ' + TOKEN_TTL_HOURS + ' Stunden gültig. Hast du das nicht angefragt, ignoriere diese E-Mail einfach — es passiert nichts.</p>';
  try {
    const resp = await fetch("https://api.zeptomail.eu/v1.1/email", {
      method: "POST",
      headers: { "Authorization": "Zoho-enczapikey " + token, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        from: { address: from, name: "habify30" },
        to: [{ email_address: { address: toEmail } }],
        subject: "Abmeldung aus deiner Peergruppe bestätigen",
        htmlbody: htmlbody,
      }),
    });
    if (!resp.ok) console.log("ZeptoMail send failed:", resp.status, await resp.text().catch(() => ""));
  } catch (e) {
    console.log("ZeptoMail send error:", e && e.message);
  }
}

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "peer is live" });
});

// --- Enrolment (DL-036) ---
app.post("/enrol", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });
  const body = req.body || {};
  const pid = body.pid;
  const consent = body.consent;
  const email = String(body.email || "").trim().toLowerCase();

  if (!validPid(pid)) { res.status(200).json({ status: "ok", ok: false, reason: "invalid_pid" }); return; }
  if (consent !== true) { res.status(200).json({ status: "ok", ok: false, reason: "consent_required" }); return; }
  if (!EMAIL_FORMAT.test(email)) { res.status(200).json({ status: "ok", ok: false, reason: "format" }); return; }

  const safePid = pid.replace(/'/g, "");
  const safeEmail = email.replace(/'/g, "");

  try {
    const acRows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT active FROM AccessControl WHERE pid = '" + safePid + "'"
    );
    if (!acRows || acRows.length === 0) { res.status(200).json({ status: "ok", ok: false, reason: "invalid_pid" }); return; }
    const activeVal = acRows[0].AccessControl.active;
    const isActive = (activeVal === null || activeVal === undefined || activeVal === true || activeVal === "true");
    if (!isActive) { res.status(200).json({ status: "ok", ok: false, reason: "invalid_pid" }); return; }

    // Fail-open on config read (missing table / no row) → no domain rule, format-only;
    // the address still had to pass EMAIL_FORMAT above. Matches accesscontrol + client.
    let cfg = {};
    try {
      const cfgRows = await catalystApp.zcql().executeZCQLQuery(
        "SELECT allowed_email_domains, manual_domain_exceptions FROM CohortConfig WHERE pid = '" + safePid + "'"
      );
      if (cfgRows && cfgRows.length) cfg = cfgRows[0].CohortConfig;
    } catch (cfgErr) {
      console.log("CohortConfig read skipped:", cfgErr && cfgErr.message);
    }
    if (!domainAllowed(email, parseList(cfg.allowed_email_domains), parseList(cfg.manual_domain_exceptions))) {
      res.status(200).json({ status: "ok", ok: false, reason: "domain" });
      return;
    }

    const table = catalystApp.datastore().table("PeerSignups");
    const existing = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, status FROM PeerSignups WHERE pid = '" + safePid + "' AND email = '" + safeEmail + "'"
    );
    if (existing && existing.length) {
      const row = existing[0].PeerSignups;
      if (row.status !== "enrolled") {
        await table.updateRow({ ROWID: row.ROWID, status: "enrolled", consent: true, exit_token: "", exit_token_expiry: "" });
      }
      res.status(200).json({ status: "ok", ok: true });
      return;
    }
    await table.insertRow({ pid: safePid, email: email, consent: true, status: "enrolled" });
    res.status(200).json({ status: "ok", ok: true });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "error" });
  }
});

// --- Exit request (DL-053 / DL-037): always non-revealing ---
app.post("/exit-request", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });

  if (await isRateLimited(catalystApp, req)) { res.status(200).json({ status: "ok", ok: true }); return; }

  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const pid = body.pid;
  if (!EMAIL_FORMAT.test(email)) { res.status(200).json({ status: "ok", ok: true }); return; }

  const safeEmail = email.replace(/'/g, "");
  const pidClause = validPid(pid) ? " AND pid = '" + pid.replace(/'/g, "") + "'" : "";

  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, status FROM PeerSignups WHERE email = '" + safeEmail + "'" + pidClause
    );
    const enrolled = (rows || []).map((r) => r.PeerSignups).find((r) => r.status === "enrolled");
    if (enrolled) {
      const rawToken = crypto.randomBytes(24).toString("hex"); // 48 hex chars
      await catalystApp.datastore().table("PeerSignups").updateRow({
        ROWID: enrolled.ROWID, exit_token: rawToken, exit_token_expiry: catalystNow(TOKEN_TTL_HOURS * 3600 * 1000),
      });
      await sendExitEmail(email, PEER_ORIGIN + "/peer.html?token=" + rawToken + "#/abmelden");
    }
  } catch (err) {
    console.log(err); // swallow — response stays non-revealing
  }
  res.status(200).json({ status: "ok", ok: true });
});

// --- Exit confirm (DL-053 / DL-037): the emailed token performs the removal ---
app.post("/exit-confirm", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });
  const token = String((req.body || {}).token || "").trim();
  if (!/^[a-f0-9]{48}$/.test(token)) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }

  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, status, exit_token_expiry FROM PeerSignups WHERE exit_token = '" + token + "'"
    );
    if (!rows || rows.length === 0) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
    const row = rows[0].PeerSignups;

    const expiry = parseCatalystDate(row.exit_token_expiry);
    if (expiry && Date.now() > expiry.getTime()) { res.status(200).json({ status: "ok", ok: false, reason: "expired" }); return; }
    if (row.status === "exited") { res.status(200).json({ status: "ok", ok: true }); return; } // idempotent

    await catalystApp.datastore().table("PeerSignups").updateRow({
      ROWID: row.ROWID, status: "exited", exit_token: "", exit_token_expiry: "",
    });

    // TODO (Phase 2, DL-037): notify remaining group members and feed the freed slot
    // into the wait-pool / opt-in-growth matching. Pre-formation there is no group yet.

    res.status(200).json({ status: "ok", ok: true });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "invalid" });
  }
});

module.exports = app;
