"use strict";

// Peer-group backend, participant-facing half (DL-053 / DL-035–037 / DL-086). pid-only
// context, NO user_id — this function never reads or writes a user_id (DL-053). Routes,
// matching the client contract (peerApi.ts):
//   POST /enrol          — put an address on the pid-scoped signup list (consent + domain enforced)
//   POST /enrol-confirm  — the double-opt-in link; only here does an address become `enrolled`
//   POST /exit-request   — email a one-time exit link IF the address is enrolled (always non-revealing)
//   POST /exit-confirm   — the emailed link's token removes the address; notifies the rest of the group
//   POST /group-status   — (DL-037) read a 2-group's open-to-new flag via its opt-in token
//   POST /group-optin    — (DL-037) toggle that flag
//   POST /pool-join      — (DL-087) dissolved group's last member enters the wait pool by link
//
// The scheduled half — group formation and wait-pool matching — lives in the Job Function
// `peersweep` (2026-09-11). It used to be /run-formation and /run-matching here, guarded
// by an ADMIN_KEY; both routes and the key are gone. Nothing in this function forms or
// matches any more.
//
// Called only from the peer-group origin (its own subdomain, DL-086); the Shell never
// calls this function. That origin has to be an Authorized Domain on the API Gateway for
// the browser's preflight to pass (DL-082 §1), and PEER_ORIGIN has to be set as a Catalyst
// env var so the emails carry working links — two separate settings, see below.
//
// Lifecycle (DL-087): exit is FINAL — it removes the address from the list and does not
// re-pool anyone. Wait-pool entry is always an active act: a late joiner's enrolment, or
// a dissolved group's last member clicking their link. Matching itself runs ONLY in the
// `peersweep` Job Function, hourly and serialised. Entering the pool therefore always means
// waiting for the next sweep.

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');
// Shared core — a COPY of functions/_shared/peer-common.js, see functions/sync-shared.mjs.
const {
  PEER_ORIGIN, validPid,
  parseCatalystDate, formatStichtag, catalystNow,
  loadCohortMeta, contactFooter, zeptoSend,
  channelParagraph, optinParagraph,
} = require('./_shared/peer-common');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PEER_ORIGIN is the peer pages' own origin. It is used ONLY to build the links that go
// into the emails (exit / opt-in / wait-pool) — no trailing slash. Without it, mails that
// carry a link are skipped rather than sent broken.
//
// It is deliberately NOT used for CORS any more (DL-082 §1). CORS is the API Gateway's
// job via Authorized Domains; measured on Development 2026-09-08, the gateway answers the
// OPTIONS preflight without invoking this function at all, and adds
// Access-Control-Allow-Origin to the real response as well. A manual header here is
// therefore not a fallback but a duplicate — the measured response carried both the
// gateway's header and this function's `access-control-allow-origin: null`, and browsers
// reject a response with multiple Access-Control-Allow-Origin headers even when the
// values match. New origin ⇒ register an Authorized Domain, do not add headers here.

/**
 * Build marker — bump this whenever a deploy's effect has to be verifiable from outside.
 *
 * "DEPLOYMENT SUCCESSFUL" does not mean the running code is the deployed code: serverless
 * keeps warm instances alive across a deploy, and `modified_time` on the function says
 * when it was written, not which build answers the next request. Without a marker the only
 * way to tell is to reconstruct it from the data a test left behind — which is guesswork
 * (2026-09-10: two concurrency tests produced defects that could not come from the new
 * code, and the question stayed open). `GET /` settles it in one call.
 *
 * Do NOT read it from a secret or an env var: `Get_Function` returns every environment
 * variable in cleartext, so anything placed there is exposed by an ordinary read.
 */
const BUILD = "2026-09-11-peersweep";

const EMAIL_FORMAT = /^[^\s@']+@[^\s@']+\.[a-z]{2,}$/i;
const TOKEN_TTL_HOURS = 24;
// Double opt-in (DL-089x, supersedes DL-086's "no enrolment double opt-in"). An address
// only reaches `enrolled` — and therefore an allocation — after its owner clicks the link.
const CONFIRM_TTL_DAYS = 7;

function parseList(val) {
  return String(val || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function domainAllowed(email, domains, exceptions) {
  if (domains.length === 0) return true; // no rule configured → server lets a well-formed address through
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (domains.includes(domain)) return true;
  return exceptions.some((e) => e === email || e === domain);
}
// --- IP rate limit for /exit-request (mirrors recovery/DL-057): it triggers an
// outbound email, so throttle it against mail-bombing an address. ---
const RL_LIMIT = 10;
const RL_TTL_HOURS = 1;
const RL_SEGMENT_ID = "22671000000014066"; // "Default"-Segment. Verifiziert 2026-09-10: Development und Production
// fuehren beide genau dieses eine Segment mit identischer ID (List_All_Segments in beiden
// Environments). Der Wert gilt also in Prod unveraendert - hier ist nichts nachzuziehen.

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

// Exit link mail (DL-053). Needs PEER_ORIGIN for a usable link, so it is skipped without it.
async function sendExitEmail(toEmail, link, meta) {
  if (!PEER_ORIGIN) { console.log("PEER_ORIGIN not set — skipping exit mail."); return; }
  const htmlbody =
    '<p>Du hast angefragt, deine habify30-Peergruppe zu verlassen.</p>' +
    '<p>Klicke auf den folgenden Link, um dich abzumelden. Erst dann wirst du aus der Gruppe entfernt ' +
    'und die anderen Gruppenmitglieder werden über deinen Austritt informiert:</p>' +
    '<p><a href="' + link + '">Abmeldung bestätigen</a></p>' +
    '<p>Der Link ist ' + TOKEN_TTL_HOURS + ' Stunden gültig. Hast du das nicht angefragt, ignoriere diese E-Mail einfach.</p>';
  await zeptoSend(toEmail, "Abmeldung aus deiner Peergruppe bestätigen", htmlbody, meta);
}

function exitNotificationBody(optinLink) {
  let body = "<p>Ein Mitglied hat eure habify30-Peergruppe verlassen.</p>" +
    "<p>Ihr könnt euch als verbleibende Gruppe weiter austauschen wie bisher.</p>";
  if (optinLink) {
    // 3 → 2: the group is now eligible for opt-in growth but never got a link at
    // formation (only 2-groups did) — it is handed over here (DL-087).
    body += optinParagraph(optinLink,
      "Ihr seid jetzt zu zweit. Wenn ihr offen für ein neues drittes Mitglied seid, könnt ihr eure Gruppe hier öffnen.");
  }
  return body;
}
function dissolvedBody(poolLink) {
  return "<p>Deine habify30-Peergruppe wurde aufgelöst: nachdem das andere Mitglied ausgetreten ist, " +
    "wärst du allein zurückgeblieben — und eine Peergruppe aus einer Person ist keine.</p>" +
    "<p>Wenn du weiterhin eine Gruppe möchtest, trag dich hier auf die Warteliste ein. " +
    "Wir ordnen dich dann einer neuen Gruppe zu:</p>" +
    "<p><a href=\"" + poolLink + "\">Auf die Warteliste setzen</a></p>" +
    "<p>Wenn du nichts tust, passiert nichts weiter — du stehst dann auf keiner Liste.</p>";
}
function confirmBody(link, stichtag) {
  return "<p>Fast geschafft — es fehlt nur noch deine Bestätigung.</p>" +
    "<p><a href=\"" + link + "\">Eintragung bestätigen</a></p>" +
    "<p><strong>Ohne diesen Klick wirst du keiner Peergruppe zugeteilt.</strong> Wir bestätigen so, dass die " +
    "Adresse wirklich dir gehört — sonst könnte ein Tippfehler dazu führen, dass deine Gruppendaten an eine " +
    "fremde Person gehen." + (stichtag ? " Die Zuteilung erfolgt am " + stichtag + "." : "") + "</p>" +
    "<p>Der Link ist " + CONFIRM_TTL_DAYS + " Tage gültig. Hast du das nicht angefragt, ignoriere diese " +
    "E-Mail einfach — ohne Bestätigung passiert nichts.</p>";
}

function waitPoolInfoBody() {
  return "<p>Du stehst jetzt auf der Warteliste für eine Peergruppe. So läuft die Zuordnung:</p><ul>" +
    "<li>Sobald eine zweite wartende Person da ist, bilden wir aus euch beiden eine Gruppe — auf eine dritte warten wir nicht.</li>" +
    "<li>Öffnet sich in der Zwischenzeit eine bestehende Zweiergruppe für ein neues Mitglied, kommst du dort dazu.</li>" +
    "<li>In beiden Fällen bekommst du sofort eine E-Mail mit den Kontaktdaten deiner Gruppe.</li>" +
    "<li>Tut sich drei Tage lang nichts, fragen wir bestehende Zweiergruppen, ob sie sich für ein neues Mitglied öffnen.</li>" +
    "</ul><p>Ehrlich gesagt: eine Zuordnung ist nicht garantiert. Trägt sich in diesem Durchlauf niemand mehr ein, " +
    "kann es leider nichts werden. Abmelden von der Warteliste kannst du dich jederzeit.</p>";
}
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "peer is live", build: BUILD });
});

// --- Enrolment (DL-036) ---
app.post("/enrol", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
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
        "SELECT allowed_email_domains, manual_domain_exceptions, formed_time, peer_group_cutoff_date FROM CohortConfig WHERE pid = '" + safePid + "'"
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
    // Double opt-in: submitting the form does NOT put anyone on the list. The address is
    // parked as `pending` and only becomes `enrolled` when its owner clicks the link in
    // the confirmation email (/enrol-confirm). Formation and matching both select
    // `status = 'enrolled'`, so a pending row can never be allocated a seat.
    //
    // DL-086 decided against this and accepted one residual risk: someone enrolling a
    // colleague unasked. That case is self-correcting — the colleague exists, gets the
    // mail, and can leave. The case that forced the reversal is the typo: a mistyped
    // address that happens to belong to a STRANGER receives the formation email, which
    // carries the other members' email addresses. That is third-party personal data
    // disclosed to an uninvolved person, and it runs against the very reason DL-086 chose
    // a native EU pipeline. It also blocks a seat that can never be freed, because the
    // exit link goes to the mistyped address too.
    const confirmToken = crypto.randomBytes(24).toString("hex");
    const confirmFields = {
      status: "pending", consent: true,
      confirm_token: confirmToken,
      confirm_token_expiry: catalystNow(CONFIRM_TTL_DAYS * 24 * 3600 * 1000),
    };

    if (existing && existing.length) {
      const row = existing[0].PeerSignups;
      // Someone already `enrolled` or `grouped` is left untouched: re-submitting the form
      // must never pull a member out of their group (DL-035). Answer ok — the response
      // stays identical for known and new addresses on purpose, because a difference would
      // turn this unauthenticated route into a membership oracle.
      if (row.status === "enrolled" || row.status === "grouped") {
        res.status(200).json({ status: "ok", ok: true });
        return;
      }
      // `pending` → re-issue: the first mail may have been lost or the link expired, and
      // re-submitting the form is how a participant asks for it again.
      // `exited` / `dissolved` → re-entry is a deliberate act (DL-087), and it has to pass
      // through confirmation again like any other enrolment.
      await table.updateRow(Object.assign({
        ROWID: row.ROWID, group_id: null,
        exit_token: null, exit_token_expiry: null, pool_token: null, waiting_since: null,
      }, confirmFields));
    } else {
      await table.insertRow(Object.assign({ pid: safePid, email: email }, confirmFields));
    }

    // No wait-pool handling here any more — it moved to /enrol-confirm, because a pending
    // address must not enter the pool or be matched.
    const meta = await loadCohortMeta(catalystApp, safePid);
    const stichtag = formatStichtag(cfg.peer_group_cutoff_date);
    await zeptoSend(email, "Bitte bestätige deine Eintragung für die Peergruppe",
      confirmBody(PEER_ORIGIN + "/?ct=" + confirmToken + "#/bestaetigen", cfg.formed_time ? null : stichtag), meta);

    res.status(200).json({ status: "ok", ok: true });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "error" });
  }
});

// The other half of the double opt-in: the link from the confirmation email. Only here
// does an address become `enrolled` and thus eligible for a seat.
//
// Unlike /enrol this route MAY report its outcome, for the same reason /exit-confirm may
// (DL-086): the one-time token is the secret and is held only by the mailbox owner, so the
// answer tells the reader about themselves and nobody about anyone else.
app.post("/enrol-confirm", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
  const token = String((req.body || {}).token || "").trim();
  if (!/^[a-f0-9]{48}$/.test(token)) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }

  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, pid, email, status, confirm_token_expiry FROM PeerSignups WHERE confirm_token = '" + token + "'"
    );
    if (!rows || rows.length === 0) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
    const row = rows[0].PeerSignups;

    // Already through — a second click on the same link, or the browser reloading the
    // landing. Confirm again rather than showing a scary error; `waiting` reports where
    // they actually stand now.
    if (row.status === "enrolled" || row.status === "grouped") {
      res.status(200).json({ status: "ok", ok: true, waiting: row.status === "enrolled" });
      return;
    }

    const expiry = parseCatalystDate(row.confirm_token_expiry);
    if (expiry && Date.now() > expiry.getTime()) {
      res.status(200).json({ status: "ok", ok: false, reason: "expired" });
      return;
    }

    const table = catalystApp.datastore().table("PeerSignups");
    await table.updateRow({
      ROWID: row.ROWID, status: "enrolled", confirm_token: null, confirm_token_expiry: null,
    });

    // Late joiner (DL-037), moved here from /enrol: confirming after the cohort was formed
    // means entering the wait pool, not the allocation. Start the waiting clock, try to
    // match immediately ("as soon as 2 solos are available"), and send the wait-pool
    // information mail ONLY if still waiting afterwards — otherwise "you are waiting"
    // would arrive seconds before "your group is set" (DL-087).
    const safePid = String(row.pid).replace(/'/g, "");
    let waiting = false;
    const cfgRows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT formed_time FROM CohortConfig WHERE pid = '" + safePid + "'"
    );
    const formed = cfgRows && cfgRows.length ? cfgRows[0].CohortConfig.formed_time : null;
    if (formed) {
      await table.updateRow({ ROWID: row.ROWID, waiting_since: catalystNow(0) });
      // No immediate match any more (2026-09-10): matching happens only in the serialised
      // cron sweep, so a late joiner is always waiting at this point and the wait-pool mail
      // is unconditional. The ordering worry it used to guard against — "you are waiting"
      // arriving seconds before "your group is set" — is gone with the immediate match.
      waiting = true;
      const meta = await loadCohortMeta(catalystApp, safePid);
      await zeptoSend(row.email, "Du stehst auf der Warteliste für eine Peergruppe", waitPoolInfoBody(), meta);
    }

    res.status(200).json({ status: "ok", ok: true, waiting: waiting });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "invalid" });
  }
});

// --- Exit request (DL-053 / DL-037): always non-revealing ---
app.post("/exit-request", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });

  if (await isRateLimited(catalystApp, req)) { res.status(200).json({ status: "ok", ok: true }); return; }

  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const pid = body.pid;
  if (!EMAIL_FORMAT.test(email)) { res.status(200).json({ status: "ok", ok: true }); return; }

  const safeEmail = email.replace(/'/g, "");
  const pidClause = validPid(pid) ? " AND pid = '" + pid.replace(/'/g, "") + "'" : "";

  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, status, pid FROM PeerSignups WHERE email = '" + safeEmail + "'" + pidClause
    );
    // Any active membership can exit — `enrolled` (pre-formation / wait-pool) as well as
    // `grouped` (after the DL-035 cutoff). Only an already-`exited` row is skipped.
    // `pending` counts as not on the list: an address that never confirmed has nothing to
    // exit from, and mailing it would defeat the purpose of the double opt-in — a mistyped
    // address belonging to a stranger would receive a second mail from us.
    const enrolled = (rows || []).map((r) => r.PeerSignups)
      .find((r) => r.status !== "exited" && r.status !== "pending");
    if (enrolled) {
      const rawToken = crypto.randomBytes(24).toString("hex"); // 48 hex chars
      await catalystApp.datastore().table("PeerSignups").updateRow({
        ROWID: enrolled.ROWID, exit_token: rawToken, exit_token_expiry: catalystNow(TOKEN_TTL_HOURS * 3600 * 1000),
      });
      const meta = await loadCohortMeta(catalystApp, enrolled.pid);
      await sendExitEmail(email, PEER_ORIGIN + "/?token=" + rawToken + "#/abmelden", meta);
    }
  } catch (err) {
    console.log(err); // swallow — response stays non-revealing
  }
  res.status(200).json({ status: "ok", ok: true });
});

// --- Exit confirm (DL-053 / DL-037): the emailed token performs the removal ---
app.post("/exit-confirm", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
  const token = String((req.body || {}).token || "").trim();
  if (!/^[a-f0-9]{48}$/.test(token)) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }

  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, status, exit_token_expiry, group_id, pid FROM PeerSignups WHERE exit_token = '" + token + "'"
    );
    if (!rows || rows.length === 0) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
    const row = rows[0].PeerSignups;

    const expiry = parseCatalystDate(row.exit_token_expiry);
    if (expiry && Date.now() > expiry.getTime()) { res.status(200).json({ status: "ok", ok: false, reason: "expired" }); return; }
    // Idempotent replay: group_id was already cleared by the first confirmation, so we
    // can no longer tell whether there was a group. Report none — the neutral wording is
    // the safe default, and this person already saw the accurate message the first time.
    if (row.status === "exited") { res.status(200).json({ status: "ok", ok: true, hadGroup: false }); return; }

    const groupId = row.group_id;
    // Remove from the group/list. Clear token + group with null (never "" — datetime).
    await catalystApp.datastore().table("PeerSignups").updateRow({
      ROWID: row.ROWID, status: "exited", group_id: null, exit_token: null, exit_token_expiry: null,
    });

    // What happens to the rest of the group (DL-037 + DL-087):
    //  - 3 → 2: stays a group, is notified, and receives an opt-in link (it never got one
    //    at formation, where only 2-groups did).
    //  - 2 → 1: a one-person group is a size DL-035 does not allow. It is dissolved and
    //    the last member gets their own mail with a LINK into the wait pool — their click,
    //    never an automatism.
    if (groupId) {
      try {
        const safeGid = String(groupId).replace(/'/g, "");
        const meta = await loadCohortMeta(catalystApp, row.pid);
        const remaining = await membersOf(catalystApp, safeGid);
        const groupRows = await catalystApp.zcql().executeZCQLQuery(
          "SELECT ROWID, optin_token FROM PeerGroups WHERE group_id = '" + safeGid + "'"
        );
        const grp = (groupRows && groupRows.length) ? groupRows[0].PeerGroups : null;

        if (remaining.length === 1) {
          const last = remaining[0];
          const poolToken = crypto.randomBytes(16).toString("hex");
          await catalystApp.datastore().table("PeerSignups").updateRow({
            ROWID: last.ROWID, status: "dissolved", group_id: null, pool_token: poolToken, waiting_since: null,
          });
          if (grp) await catalystApp.datastore().table("PeerGroups").deleteRow(grp.ROWID);
          await zeptoSend(last.email, "Deine Peergruppe wurde aufgelöst",
            dissolvedBody(PEER_ORIGIN + "/?pt=" + poolToken + "#/wartepool"), meta);
        } else {
          let optinLink = null;
          if (remaining.length === 2 && grp) {
            let tok = grp.optin_token;
            if (!tok) {
              tok = crypto.randomBytes(16).toString("hex");
              await catalystApp.datastore().table("PeerGroups").updateRow({ ROWID: grp.ROWID, optin_token: tok });
            }
            optinLink = PEER_ORIGIN + "/?gt=" + tok + "#/gruppe";
          }
          for (const o of remaining) {
            await zeptoSend(o.email, "Ein Mitglied hat eure Peergruppe verlassen", exitNotificationBody(optinLink), meta);
          }
        }
      } catch (notifyErr) {
        console.log("exit follow-up skipped:", notifyErr && notifyErr.message);
      }
    }

    // Whether this address was in a group decides what the landing page may claim. Someone
    // who left before the cutoff, or from the wait pool, has no fellow members to notify —
    // telling them otherwise describes an email that was never sent. Returning this is
    // within the model: the one-time token is the secret and is held only by the mailbox
    // owner (DL-086), so this reveals the reader's own state to the reader.
    res.status(200).json({ status: "ok", ok: true, hadGroup: !!groupId });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "invalid" });
  }
});

// --- Opt-in-growth (DL-037 A3): read + toggle a 2-person group's open-to-new flag via
// the token from the formation email. Only 2-groups have an optin_token. ---
app.post("/group-status", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
  const token = String((req.body || {}).gt || "").trim();
  if (!/^[a-f0-9]{32}$/.test(token)) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT open_to_new FROM PeerGroups WHERE optin_token = '" + token + "'"
    );
    if (!rows || rows.length === 0) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
    const v = rows[0].PeerGroups.open_to_new;
    const open = (v === true || v === "true");
    res.status(200).json({ status: "ok", ok: true, open });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "invalid" });
  }
});

app.post("/group-optin", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
  const token = String((req.body || {}).gt || "").trim();
  if (!/^[a-f0-9]{32}$/.test(token)) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, open_to_new FROM PeerGroups WHERE optin_token = '" + token + "'"
    );
    if (!rows || rows.length === 0) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
    const row = rows[0].PeerGroups;
    const cur = (row.open_to_new === true || row.open_to_new === "true");
    const next = !cur;
    await catalystApp.datastore().table("PeerGroups").updateRow({ ROWID: row.ROWID, open_to_new: next });
    res.status(200).json({ status: "ok", ok: true, open: next });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "invalid" });
  }
});

// --- Wait-pool entry via the dissolved-group link (DL-087). Entering the pool is the
// participant's own click, never automatic. Matches immediately afterwards; the wait-pool
// information mail goes out only if they are still waiting. ---
app.post("/pool-join", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
  const token = String((req.body || {}).pt || "").trim();
  if (!/^[a-f0-9]{32}$/.test(token)) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }

  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT ROWID, pid, email, status FROM PeerSignups WHERE pool_token = '" + token + "'"
    );
    if (!rows || rows.length === 0) { res.status(200).json({ status: "ok", ok: false, reason: "invalid" }); return; }
    const row = rows[0].PeerSignups;
    const safePid = String(row.pid).replace(/'/g, "");

    await catalystApp.datastore().table("PeerSignups").updateRow({
      ROWID: row.ROWID, status: "enrolled", group_id: null, pool_token: null, waiting_since: catalystNow(0),
    });

    // No immediate match any more (2026-09-10, see peersweep): the pool is worked by the
    // serialised cron sweep, so entering it always means waiting. `matched` stays in the
    // response contract and is now always false — the client already handles that branch.
    const meta = await loadCohortMeta(catalystApp, safePid);
    await zeptoSend(row.email, "Du stehst auf der Warteliste für eine Peergruppe", waitPoolInfoBody(), meta);
    res.status(200).json({ status: "ok", ok: true, matched: false });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "invalid" });
  }
});

module.exports = app;
