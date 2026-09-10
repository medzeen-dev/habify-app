"use strict";

// Peer-group backend (DL-053 / DL-035–037 / DL-086). pid-only context, NO user_id —
// this function never reads or writes a user_id (DL-053). Three routes, matching the
// client contract (peerApi.ts):
//   POST /enrol          — put an address on the pid-scoped signup list (consent + domain enforced)
//   POST /exit-request   — email a one-time exit link IF the address is enrolled (always non-revealing)
//   POST /exit-confirm   — the emailed link's token removes the address; notifies the rest of the group
//   POST /run-formation  — (DL-035) admin-key guarded; forms 2–3 groups at the cutoff (cron)
//   POST /group-status   — (DL-037) read a 2-group's open-to-new flag via its opt-in token
//   POST /group-optin    — (DL-037) toggle that flag
//   POST /pool-join      — (DL-087) dissolved group's last member enters the wait pool by link
//   POST /run-matching   — (DL-037/087) admin-key guarded cron sweep: wait-pool matching + 3-day broadcast
//
// Called only from the peer-group origin (its own subdomain, DL-086); the Shell never
// calls this function. That origin has to be an Authorized Domain on the API Gateway for
// the browser's preflight to pass (DL-082 §1), and PEER_ORIGIN has to be set as a Catalyst
// env var so the emails carry working links — two separate settings, see below.
//
// Lifecycle (DL-087): exit is FINAL — it removes the address from the list and does not
// re-pool anyone. Wait-pool entry is always an active act: a late joiner's enrolment, or
// a dissolved group's last member clicking their link. Matching runs immediately at both
// entry points; /run-matching is the safety net and the home of the 3-day broadcast.

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');

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
const PEER_ORIGIN = process.env.PEER_ORIGIN || "";

const EMAIL_FORMAT = /^[^\s@']+@[^\s@']+\.[a-z]{2,}$/i;
const TOKEN_TTL_HOURS = 24;
// Double opt-in (DL-089x, supersedes DL-086's "no enrolment double opt-in"). An address
// only reaches `enrolled` — and therefore an allocation — after its owner clicks the link.
const CONFIRM_TTL_DAYS = 7;

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
// "2026-09-16 00:00:00" → "16. September 2026" for the mail texts. Returns null rather
// than a half-formatted string when the value is missing or unparseable — the callers
// leave the sentence out entirely in that case (same fail-open stance as the mail frame).
function formatStichtag(raw) {
  const d = parseCatalystDate(raw);
  if (!d) return null;
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return d.getDate() + ". " + months[d.getMonth()] + " " + d.getFullYear();
}

function catalystNow(offsetMs) {
  return new Date(Date.now() + (offsetMs || 0)).toISOString().replace("T", " ").substring(0, 19);
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

/**
 * Per-cohort mail context: the programme name prefixes every subject, and the contact
 * address is the "questions" route (the sender is a noreply address). Both already live
 * on AccessControl (DL-058). Fail-open: without them the mails still send, just without
 * prefix/footer.
 */
async function loadCohortMeta(catalystApp, pid) {
  const safePid = String(pid || "").replace(/'/g, "");
  if (!safePid) return { programmName: "", contactEmail: "" };
  try {
    const rows = await catalystApp.zcql().executeZCQLQuery(
      "SELECT programm_name, contact_email FROM AccessControl WHERE pid = '" + safePid + "'"
    );
    if (rows && rows.length) {
      const r = rows[0].AccessControl;
      return { programmName: r.programm_name || "", contactEmail: r.contact_email || "" };
    }
  } catch (e) {
    console.log("cohort meta skipped:", e && e.message);
  }
  return { programmName: "", contactEmail: "" };
}

function contactFooter(contactEmail) {
  if (!contactEmail) return "";
  return '<p style="color:#6a625c;font-size:13px">Diese E-Mail wird automatisch verschickt — bitte antworte nicht darauf. ' +
    'Bei Fragen wende dich an <a href="mailto:' + contactEmail + '">' + contactEmail + '</a>.</p>';
}

/**
 * ZeptoMail (EU endpoint). Server-to-server; the token is a secret env var, never in code
 * (DL-086). No-ops (logs) if unconfigured, so Dev without creds still behaves.
 * `meta` carries the cohort's programme name (subject prefix) and contact address (footer).
 */
async function zeptoSend(toEmail, subject, htmlbody, meta) {
  // ZeptoMail's console shows the Send-Mail key already carrying the scheme
  // ("Zoho-enczapikey <key>"), because that is the whole Authorization header value it
  // expects you to paste. Copying it verbatim into ZEPTOMAIL_TOKEN is therefore the
  // natural thing to do — and it doubled the scheme here, which ZeptoMail answers with
  // 401. Measured 2026-09-09 in Development, and invisible from outside: a failed send is
  // only logged, because /exit-request must stay non-revealing (DL-053). So accept both
  // shapes rather than relying on whoever sets the variable to strip the prefix.
  const rawToken = (process.env.ZEPTOMAIL_TOKEN || "").trim();
  const token = rawToken.replace(/^Zoho-enczapikey\s+/i, "");
  const from = process.env.ZEPTOMAIL_FROM;
  const m = meta || {};
  const fullSubject = m.programmName ? (m.programmName + ": " + subject) : subject;
  if (!token || !from) { console.log("ZeptoMail not configured — skipping:", fullSubject); return; }
  try {
    const resp = await fetch("https://api.zeptomail.eu/v1.1/email", {
      method: "POST",
      headers: { "Authorization": "Zoho-enczapikey " + token, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        from: { address: from, name: "habify30" },
        to: [{ email_address: { address: toEmail } }],
        subject: fullSubject,
        htmlbody: htmlbody + contactFooter(m.contactEmail),
      }),
    });
    // Log both outcomes, not just failures. /exit-request must answer {ok:true} whether or
    // not the address exists (DL-053), so the HTTP response can never carry send status —
    // the log is the only channel there is. Logging failures alone made a broken send
    // indistinguishable from a working one from every side at once (measured 2026-09-09:
    // a doubled auth scheme produced 401s that surfaced nowhere).
    if (resp.ok) console.log("ZeptoMail sent:", fullSubject);
    else console.log("ZeptoMail send failed:", resp.status, await resp.text().catch(() => ""));
  } catch (e) {
    console.log("ZeptoMail send error:", e && e.message);
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

// Fisher–Yates with a CSPRNG (DL-035: fully random assignment).
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// Partition n (>=2) into groups of 2–3 (DL-035). n%3: 0 → all 3s; 1 → leave 2+2; 2 → one 2.
function groupSizes(n) {
  const sizes = [];
  if (n < 2) return sizes;
  if (n % 3 === 0) { for (let i = 0; i < n / 3; i++) sizes.push(3); }
  else if (n % 3 === 1) { for (let i = 0; i < (n - 4) / 3; i++) sizes.push(3); sizes.push(2, 2); }
  else { for (let i = 0; i < (n - 2) / 3; i++) sizes.push(3); sizes.push(2); }
  return sizes;
}

// --- German email copy, final version reviewed by Matthias (2026-09-08).
// Every subject is prefixed with the cohort's programme name and every mail carries the
// contact-address footer — both added by zeptoSend via `meta` (DL-058 fields). ---
function channelParagraph() {
  return "<p>Meldet euch untereinander über eure E-Mail-Adressen und entscheidet euch für einen Kanal, " +
    "der für euch am besten passt (MS Teams, Messenger-App, Treffen in der Kantine). Kanal und Rhythmus " +
    "sollten so gewählt sein, dass ihr euch in der Momentumphase über kurze Updates gegenseitig motiviert, dranzubleiben.</p>";
}
function optinParagraph(optinLink, intro) {
  return "<p>" + intro + "</p>" +
    "<p><a href=\"" + optinLink + "\">Gruppe für neue Mitglieder öffnen/schließen</a></p>" +
    "<p>Über den gleichen Link könnt ihr eure Gruppe jederzeit wieder schließen.</p>";
}
function formationBody(otherEmails, optinLink) {
  const list = otherEmails.map((e) => "<li>" + e + "</li>").join("");
  let body =
    "<p>Deine Peergruppe für die Momentumphase steht — ihr begleitet euch gegenseitig durch die 30 Tage.</p>" +
    "<p>Das sind die anderen aus deiner Gruppe:</p><ul>" + list + "</ul>" +
    channelParagraph();
  if (optinLink) {
    body += optinParagraph(optinLink,
      "Aktuell seid ihr zu zweit in dieser Gruppe. Wenn ihr offen für ein drittes Mitglied seid, könnt ihr eure " +
      "Gruppe hier öffnen — so haben Nachzügler eine bessere Chance, auch noch in einer Gruppe unterzukommen.");
  }
  return body;
}
function notEnoughBody() {
  return "<p>Es haben sich noch nicht genügend Teilnehmende auf der Warteliste eingetragen, um eine Gruppe zu bilden. " +
    "Sobald jemand dazukommt, ordnen wir dich zu und du bekommst eine automatische Benachrichtigung.</p>";
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
function asyncMatchPairBody(otherEmail, optinLink) {
  let body = "<p>Es hat geklappt — du hast eine Peergruppe. Ihr seid zu zweit: jemand hat wie du auf eine Gruppe gewartet.</p>" +
    "<p>Das ist die andere Person:</p><ul><li>" + otherEmail + "</li></ul>" +
    channelParagraph();
  if (optinLink) {
    body += optinParagraph(optinLink,
      "Ihr seid zu zweit. Wenn ihr offen für ein drittes Mitglied seid, könnt ihr eure Gruppe hier öffnen.");
  }
  return body;
}
function asyncMatchJoinBody(otherEmails) {
  const list = otherEmails.map((e) => "<li>" + e + "</li>").join("");
  return "<p>Du bist in eine bestehende Peergruppe aufgenommen worden. Die beiden sind schon ein Stück zusammen unterwegs — du kommst dazu.</p>" +
    "<p>Das sind ihre E-Mail-Adressen:</p><ul>" + list + "</ul>" +
    "<p>Schreib ihnen am besten direkt, damit sie wissen, dass du da bist und sie dich in ihren Kommunikations-Kanal aufnehmen können.</p>";
}
function newMemberBody(newEmail) {
  return "<p>Eure habify30-Peergruppe hat ein neues Mitglied — ihr seid jetzt zu dritt.</p>" +
    "<p>Neu dabei:</p><ul><li>" + newEmail + "</li></ul>" +
    "<p>Nehmt die Person bitte in euren Kommunikations-Kanal auf.</p>";
}
function broadcastBody(count, optinLink) {
  const lead = count === 1
    ? "Gerade wartet eine Person auf eine Peergruppe und findet keine."
    : ("Gerade warten " + count + " Personen auf eine Peergruppe und finden keine.");
  return "<p>" + lead + "</p>" +
    "<p>Ihr seid zu zweit in eurer Gruppe. Wenn ihr euch vorstellen könntet, eine wartende Person aufzunehmen, " +
    "öffnet eure Gruppe hier — wir ordnen dann automatisch jemanden zu:</p>" +
    "<p><a href=\"" + optinLink + "\">Gruppe für ein neues Mitglied öffnen</a></p>" +
    "<p>Wenn das für euch nicht passt, ignoriere diese E-Mail einfach.</p>";
}

/**
 * Claim a signup for a group — the step that makes concurrent runs safe.
 *
 * `matchCohort` runs from three places: the cron sweep, `/pool-join` and `/exit-confirm`.
 * Only the sweep passes through the job pool, so two runs genuinely overlap as soon as two
 * people enter the wait pool at the same moment. Both then read the same solos and pair the
 * same person twice: two PeerGroups rows, one of them stranded, `group_id` overwritten by
 * whoever wrote last, and two "your group is set" mails carrying *different* opt-in links.
 *
 * A plain `updateRow` cannot prevent that — read and write are separate. A conditional
 * UPDATE can, because the datastore evaluates condition and write as one operation.
 * Measured 2026-09-10: a hit returns the row, a miss returns `[]`. That length is the whole
 * signal. (The cache segment cannot serve here: `put` overwrites an existing key silently,
 * so a cache "lock" would be handed to both runs at once.)
 *
 * Returns true if this run won the row, false if someone else was there first.
 */
async function claimSignup(catalystApp, rowid, groupId) {
  const rows = await catalystApp.zcql().executeZCQLQuery(
    "UPDATE PeerSignups SET group_id = '" + String(groupId).replace(/'/g, "") + "', status = 'grouped'" +
    " WHERE ROWID = " + String(rowid).replace(/[^0-9]/g, "") + " AND group_id IS NULL"
  );
  return !!(rows && rows.length);
}

/**
 * Give a claimed row back. Only ever called when a pairing could not be completed — the
 * `group_id` condition makes sure a run releases nothing but its own claim, even if the
 * row has meanwhile been taken over by someone else.
 */
async function releaseSignup(catalystApp, rowid, groupId) {
  await catalystApp.zcql().executeZCQLQuery(
    "UPDATE PeerSignups SET group_id = NULL, status = 'enrolled'" +
    " WHERE ROWID = " + String(rowid).replace(/[^0-9]/g, "") +
    " AND group_id = '" + String(groupId).replace(/'/g, "") + "'"
  );
}

// Form all groups for one cohort: shuffle enrolled (ungrouped) members, partition into
// 2–3, create PeerGroups rows, assign members, email everyone. Idempotent per cohort
// via CohortConfig.formed_time (set by the caller's guard).
async function formCohort(catalystApp, pid) {
  const safePid = String(pid).replace(/'/g, "");
  const meta = await loadCohortMeta(catalystApp, safePid);
  const rows = await catalystApp.zcql().executeZCQLQuery(
    "SELECT ROWID, email FROM PeerSignups WHERE pid = '" + safePid + "' AND status = 'enrolled'"
  );
  const members = (rows || []).map((r) => r.PeerSignups);
  const groups = catalystApp.datastore().table("PeerGroups");
  let formedGroups = 0;

  if (members.length >= 2) {
    shuffle(members);
    const sizes = groupSizes(members.length);
    let idx = 0;
    for (const size of sizes) {
      const grp = members.slice(idx, idx + size);
      idx += size;
      const groupId = crypto.randomBytes(8).toString("hex");   // 16 hex

      // Claim every member before the group exists. Someone a parallel run has already
      // grouped must not be pulled into a second group, and must not receive a second
      // "your group is set" mail. What is left after claiming is the real group.
      const claimed = [];
      for (const m of grp) {
        if (await claimSignup(catalystApp, m.ROWID, groupId)) claimed.push(m);
      }
      if (claimed.length < 2) {
        // A group of one is no group — hand the row back so the wait pool can use it.
        for (const m of claimed) await releaseSignup(catalystApp, m.ROWID, groupId);
        continue;
      }

      // Decided after claiming, not before: only an actual 2-group may grow, and losing a
      // member to a parallel run can turn a planned 3 into a 2.
      const optinToken = claimed.length === 2 ? crypto.randomBytes(16).toString("hex") : null;
      await groups.insertRow({ pid: safePid, group_id: groupId, open_to_new: false, optin_token: optinToken });
      for (const m of claimed) {
        const others = claimed.filter((x) => x.email !== m.email).map((x) => x.email);
        const optinLink = optinToken ? (PEER_ORIGIN + "/?gt=" + optinToken + "#/gruppe") : null;
        await zeptoSend(m.email, "Deine habify30-Peergruppe steht", formationBody(others, optinLink), meta);
      }
      formedGroups++;
    }
  } else if (members.length === 1) {
    await zeptoSend(members[0].email, "Peergruppe: diesmal keine Zuteilung", notEnoughBody(), meta);
  }

  // Mark the cohort formed (idempotency guard for the cron).
  const cc = await catalystApp.zcql().executeZCQLQuery("SELECT ROWID FROM CohortConfig WHERE pid = '" + safePid + "'");
  if (cc && cc.length) {
    await catalystApp.datastore().table("CohortConfig").updateRow({ ROWID: cc[0].CohortConfig.ROWID, formed_time: catalystNow(0) });
  }
  return { pid: safePid, members: members.length, groups: formedGroups };
}

// Read the cohort's wait pool: `enrolled` signups without a group. After formation that
// is exactly the pool (DL-087): late joiners + members of a dissolved group who opted
// back in. Never people who exited (they are `exited`) or dissolved members who have not
// clicked their link yet (they are `dissolved`).
async function readSolos(catalystApp, safePid) {
  const rows = await catalystApp.zcql().executeZCQLQuery(
    "SELECT ROWID, email, waiting_since, group_id FROM PeerSignups WHERE pid = '" + safePid + "' AND status = 'enrolled'"
  );
  const solos = (rows || []).map((r) => r.PeerSignups).filter((s) => !s.group_id);
  // Longest waiting first — fairness. (DL-035's "fully random" governs who is grouped
  // with whom at the cutoff, not the order of a queue.)
  solos.sort((a, b) => {
    const ta = parseCatalystDate(a.waiting_since);
    const tb = parseCatalystDate(b.waiting_since);
    return (ta ? ta.getTime() : 0) - (tb ? tb.getTime() : 0);
  });
  return solos;
}

async function readGroups(catalystApp, safePid) {
  const rows = await catalystApp.zcql().executeZCQLQuery(
    "SELECT ROWID, group_id, open_to_new, optin_token FROM PeerGroups WHERE pid = '" + safePid + "'"
  );
  return (rows || []).map((r) => r.PeerGroups);
}

async function membersOf(catalystApp, groupId) {
  const rows = await catalystApp.zcql().executeZCQLQuery(
    "SELECT ROWID, email FROM PeerSignups WHERE group_id = '" + String(groupId).replace(/'/g, "") + "' AND status = 'grouped'"
  );
  return (rows || []).map((r) => r.PeerSignups);
}

function isOpen(g) {
  return g.open_to_new === true || g.open_to_new === "true";
}

/**
 * Wait-pool matching for one cohort (DL-037, precedence per DL-087):
 *   1. pair two solos into a new 2-group — as soon as two are available, no waiting for a 3rd;
 *   2. only a single LEFTOVER solo goes into an opt-in-open 2-group ("if the wait pool
 *      cannot otherwise fill"). So two solos pair with each other even when an open group
 *      exists — that leaves nobody behind.
 * Returns the emails still waiting afterwards, so the caller can send the wait-pool
 * information mail to someone who has just entered and was not matched immediately.
 */
async function matchCohort(catalystApp, pid) {
  const safePid = String(pid).replace(/'/g, "");
  const meta = await loadCohortMeta(catalystApp, safePid);
  const signups = catalystApp.datastore().table("PeerSignups");
  const groupsT = catalystApp.datastore().table("PeerGroups");
  let solos = await readSolos(catalystApp, safePid);
  let paired = 0;
  let absorbed = 0;

  while (solos.length >= 2) {
    const a = solos.shift();
    const b = solos.shift();
    const groupId = crypto.randomBytes(8).toString("hex");

    // Claim both before the group is created or a single mail goes out. A half-claimed
    // pair would strand one person in a group of one, so the first claim is given back
    // if the second fails. The person who could not be claimed is gone from the pool
    // either way — a parallel run has already placed them; the other returns to the queue.
    if (!(await claimSignup(catalystApp, a.ROWID, groupId))) { solos.unshift(b); continue; }
    if (!(await claimSignup(catalystApp, b.ROWID, groupId))) {
      await releaseSignup(catalystApp, a.ROWID, groupId);
      solos.unshift(a);
      continue;
    }

    const optinToken = crypto.randomBytes(16).toString("hex"); // a new 2-group may grow
    await groupsT.insertRow({ pid: safePid, group_id: groupId, open_to_new: false, optin_token: optinToken });
    // Separate from the claim: the claim owns group_id/status and must stay conditional.
    for (const m of [a, b]) {
      await signups.updateRow({ ROWID: m.ROWID, waiting_since: null });
    }
    const optinLink = PEER_ORIGIN + "/?gt=" + optinToken + "#/gruppe";
    await zeptoSend(a.email, "Geschafft – deine habify30-Peergruppe steht nun fest", asyncMatchPairBody(b.email, optinLink), meta);
    await zeptoSend(b.email, "Geschafft – deine habify30-Peergruppe steht nun fest", asyncMatchPairBody(a.email, optinLink), meta);
    paired += 2;
  }

  if (solos.length === 1) {
    const solo = solos[0];
    for (const g of (await readGroups(catalystApp, safePid)).filter(isOpen)) {
      const members = await membersOf(catalystApp, g.group_id);
      if (members.length !== 2) continue; // only 2-groups may grow (DL-035 max size 3)
      // If the claim fails, a parallel run has already placed this person. Nothing to do
      // and nothing to undo — the group stays open for whoever comes next.
      if (!(await claimSignup(catalystApp, solo.ROWID, g.group_id))) { solos = []; break; }
      await signups.updateRow({ ROWID: solo.ROWID, waiting_since: null });
      await groupsT.updateRow({ ROWID: g.ROWID, open_to_new: false }); // now full
      await zeptoSend(solo.email, "Du bist in eine Peergruppe aufgenommen", asyncMatchJoinBody(members.map((m) => m.email)), meta);
      for (const m of members) {
        await zeptoSend(m.email, "Eure Peergruppe hat ein neues Mitglied", newMemberBody(solo.email), meta);
      }
      solos = [];
      absorbed = 1;
      break;
    }
  }

  return { paired, absorbed, waiting: solos.map((s) => s.email) };
}

/**
 * 3-day escalation (DL-037, retargeted by DL-087): if anyone has been waiting ≥3 days,
 * send ONE bundled broadcast per cohort to the 2-person groups that are NOT yet open —
 * an already-open group would have absorbed the solo automatically. Sent at most once per
 * waiting episode; the marker resets once the pool has run empty.
 */
async function broadcastIfDue(catalystApp, cohort) {
  const safePid = String(cohort.pid).replace(/'/g, "");
  const cfgT = catalystApp.datastore().table("CohortConfig");
  const solos = await readSolos(catalystApp, safePid);

  if (solos.length === 0) {
    if (cohort.last_broadcast_time && cohort.ROWID) {
      await cfgT.updateRow({ ROWID: cohort.ROWID, last_broadcast_time: null }); // episode over
    }
    return { sent: 0 };
  }
  if (cohort.last_broadcast_time) return { sent: 0 }; // already broadcast this episode

  const threshold = Date.now() - 3 * 24 * 3600 * 1000;
  const overdue = solos.filter((s) => {
    const t = parseCatalystDate(s.waiting_since);
    return t && t.getTime() <= threshold;
  });
  if (overdue.length === 0) return { sent: 0 };

  const meta = await loadCohortMeta(catalystApp, safePid);
  let sent = 0;
  for (const g of (await readGroups(catalystApp, safePid)).filter((x) => x.optin_token && !isOpen(x))) {
    const members = await membersOf(catalystApp, g.group_id);
    if (members.length !== 2) continue;
    const link = PEER_ORIGIN + "/?gt=" + g.optin_token + "#/gruppe";
    for (const m of members) {
      await zeptoSend(m.email, "Jemand wartet auf eine Peergruppe", broadcastBody(solos.length, link), meta);
    }
    sent++;
  }
  if (sent > 0 && cohort.ROWID) {
    await cfgT.updateRow({ ROWID: cohort.ROWID, last_broadcast_time: catalystNow(0) });
  }
  return { sent };
}

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "peer is live" });
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
      const m = await matchCohort(catalystApp, safePid);
      waiting = m.waiting.indexOf(row.email) !== -1;
      if (waiting) {
        const meta = await loadCohortMeta(catalystApp, safePid);
        await zeptoSend(row.email, "Du stehst auf der Warteliste für eine Peergruppe", waitPoolInfoBody(), meta);
      }
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

// --- Group formation (DL-035). Invoked by a Catalyst Cron (daily). Admin-key guarded
// so it is not publicly triggerable — the cron sends ADMIN_KEY. Forms every cohort
// whose cutoff has passed and that is not yet formed. `pid` + `force` (admin) forms one
// cohort regardless of cutoff (manual/testing). ---
app.post("/run-formation", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
  const body = req.body || {};
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || body.key !== adminKey) { res.status(403).json({ status: "error", message: "forbidden" }); return; }

  const onlyPid = validPid(body.pid) ? String(body.pid).replace(/'/g, "") : null;
  const force = body.force === true;

  try {
    let q = "SELECT pid, peer_group_cutoff_date, formed_time FROM CohortConfig";
    if (onlyPid) q += " WHERE pid = '" + onlyPid + "'";
    const cRows = await catalystApp.zcql().executeZCQLQuery(q);
    const due = (cRows || []).map((r) => r.CohortConfig).filter((c) => {
      if (c.formed_time) return false; // already formed (idempotent)
      if (onlyPid && force) return true; // manual override for a named cohort
      const cutoff = parseCatalystDate(c.peer_group_cutoff_date);
      return cutoff && Date.now() >= cutoff.getTime();
    });
    const formed = [];
    for (const c of due) formed.push(await formCohort(catalystApp, c.pid));
    res.status(200).json({ status: "ok", formed });
  } catch (err) {
    console.log(err);
    res.status(500).json({ status: "error", message: String(err && err.message) });
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

    const m = await matchCohort(catalystApp, safePid);
    const stillWaiting = m.waiting.indexOf(String(row.email).toLowerCase()) !== -1;
    if (stillWaiting) {
      const meta = await loadCohortMeta(catalystApp, safePid);
      await zeptoSend(row.email, "Du stehst auf der Warteliste für eine Peergruppe", waitPoolInfoBody(), meta);
    }
    res.status(200).json({ status: "ok", ok: true, matched: !stillWaiting });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", ok: false, reason: "invalid" });
  }
});

// --- Cron sweep (DL-037/DL-087). Matching also runs immediately at both pool entries;
// this is the safety net plus the home of the inherently time-based 3-day broadcast. ---
app.post("/run-matching", async (req, res) => {
  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });
  const body = req.body || {};
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || body.key !== adminKey) { res.status(403).json({ status: "error", message: "forbidden" }); return; }

  const onlyPid = validPid(body.pid) ? String(body.pid).replace(/'/g, "") : null;
  try {
    // Sweep away enrolments whose confirmation link has expired. These are addresses for
    // which consent was never completed — nobody ever proved the mailbox is theirs — so
    // keeping them would mean storing personal data on the strength of a form submission
    // alone. Only `pending` rows past their own expiry are touched; a confirmed member has
    // no confirm_token and can never match this.
    let purged = 0;
    try {
      const stale = await catalystApp.zcql().executeZCQLQuery(
        "SELECT ROWID, confirm_token_expiry FROM PeerSignups WHERE status = 'pending'"
      );
      const signups = catalystApp.datastore().table("PeerSignups");
      for (const r of (stale || [])) {
        const row = r.PeerSignups;
        const exp = parseCatalystDate(row.confirm_token_expiry);
        if (exp && Date.now() > exp.getTime()) { await signups.deleteRow(row.ROWID); purged++; }
      }
    } catch (purgeErr) {
      console.log("pending purge skipped:", purgeErr && purgeErr.message);
    }

    let q = "SELECT ROWID, pid, formed_time, last_broadcast_time FROM CohortConfig";
    if (onlyPid) q += " WHERE pid = '" + onlyPid + "'";
    const cRows = await catalystApp.zcql().executeZCQLQuery(q);
    // Only formed cohorts have a wait pool — before the cutoff everyone waits for formation.
    const cohorts = (cRows || []).map((r) => r.CohortConfig).filter((c) => c.formed_time);

    const results = [];
    for (const c of cohorts) {
      const m = await matchCohort(catalystApp, c.pid);
      const b = await broadcastIfDue(catalystApp, c);
      results.push({ pid: c.pid, paired: m.paired, absorbed: m.absorbed, waiting: m.waiting.length, broadcastGroups: b.sent });
    }
    res.status(200).json({ status: "ok", purged, results });
  } catch (err) {
    console.log(err);
    res.status(500).json({ status: "error", message: String(err && err.message) });
  }
});

module.exports = app;
