"use strict";

/**
 * Shared core of the peer-group backend, used by two Catalyst functions:
 *   - `peer`      (Advanced I/O)  participant-facing routes
 *   - `peersweep` (Job)           the serialised scheduled sweep
 *
 * SOURCE OF TRUTH: functions/_shared/peer-common.js. Each function folder carries a copy
 * under <function>/_shared/, because Catalyst packs one folder per function and cannot
 * follow a require() outside it. Edit the source, then run
 *
 *     node functions/sync-shared.mjs
 *
 * and commit both copies. The copies are committed on purpose: the deployed state must be
 * in git, and a forgotten sync must show up as a diff, not as a silent old deploy.
 */

const PEER_ORIGIN = process.env.PEER_ORIGIN || "";

function validPid(pid) {
  return typeof pid === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(pid);
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

module.exports = {
  PEER_ORIGIN, validPid,
  parseCatalystDate, formatStichtag, catalystNow,
  loadCohortMeta, contactFooter, zeptoSend,
  channelParagraph, optinParagraph,
};
