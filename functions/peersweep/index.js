"use strict";

// Scheduled sweep for the peer group (DL-035 / DL-037 / DL-087) — a Catalyst JOB
// FUNCTION, not an HTTP route. One cron, hourly, triggers it through a Function job pool.
// Both sweeps run here in sequence:
//
//   1. formation  — forms 2–3 groups for every cohort whose cutoff has passed and that
//                   is not yet formed (idempotent via CohortConfig.formed_time, so running
//                   it every hour is correct: it does nothing until a cutoff is reached)
//   2. matching   — purges expired pending enrolments, pairs the wait pool, sends the
//                   3-day broadcast
//
// WHY A JOB FUNCTION, AND WHY EXACTLY ONE CRON (decided 2026-09-11, measured 2026-09-10):
// The datastore gives no mutual exclusion — a conditional UPDATE and a unique column both
// break under real concurrency (Capabilities B8). A Function job pool runs jobs in parallel
// (memory, not count). So nothing in the application can stop two sweeps overlapping; the
// only thing that does is the platform's hard execution cap: a Job Function is killed at
// 15 minutes, and the cron fires every 60. Two ticks therefore cannot overlap. THAT is the
// guarantee — not `await`, which only orders formation before matching within one run.
//
// Two rules keep it true, and both are operational, not enforced by code:
//   - the cron interval must stay above the 15-minute cap (it is 60 minutes);
//   - number_of_retries stays 0, and nobody presses "Submit Job" while a run is active.
//
// What this replaces: /run-formation and /run-matching on the `peer` function, reached by
// a Webhook pool with an absolute URL and an ADMIN_KEY in the cron body. A Job Function has
// no endpoint, so there is nothing to guard and no secret to store — and no URL that would
// point Production's cron at the Development backend.
//
// Shared helpers (mail, cohort meta, time) come from ./_shared/peer-common.js — a COPY of
// functions/_shared/peer-common.js, kept in sync by functions/sync-shared.mjs.

const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');
const {
  PEER_ORIGIN, validPid,
  parseCatalystDate, catalystNow,
  loadCohortMeta, zeptoSend,
  channelParagraph, optinParagraph,
} = require('./_shared/peer-common');

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
 * Claim a signup for a group before writing anything else.
 *
 * **This is not a lock, and must not be relied on as one.** Measured on Development
 * 2026-09-10: under real concurrency two parallel runs both reported winning the claim on
 * the same row, and one then overwrote the other's assignment. The datastore does not
 * serialise `WHERE group_id IS NULL` against a competing write. The same measurement
 * disqualified the two other candidates — a cache-segment key (`put` overwrites silently)
 * and a unique column (4 of 10 concurrent insert pairs produced duplicates in a column
 * declared unique). Catalyst offers no application-level mutual exclusion; the only
 * serialisation this system has is a job pool with max count 1.
 *
 * What it still buys, and why it stays: the claim runs *before* the group row exists, so a
 * pairing that cannot be completed leaves no PeerGroups row behind, and nobody is put in a
 * group of one. Under the serialised sweep (matchCohort's header) there is no competing
 * writer anyway — this is the second line, not the first.
 *
 * Returns true if this run got the row, false if it was already taken.
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
/**
 * **Call this from the cron sweep only.** `/run-matching` runs through the job pool
 * `peerjobs`, whose max count of 1 is the only serialisation Catalyst gives us (measured
 * 2026-09-10 — see claimSignup). Calling it from a participant-facing route puts a second
 * writer on the same wait pool, and two of those pair the same person into two groups.
 *
 * Until 2026-09-10 `/enrol-confirm` and `/pool-join` called it for an immediate match. They
 * no longer do: entering the pool now always means waiting for the next sweep. That costs
 * up to an hour of reaction time and is the price of correctness.
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
    if (!(await claimSignup(catalystApp, a.ROWID, groupId))) {
      solos.unshift(b); continue;
    }
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

// --- The two sweeps, lifted from the former /run-formation and /run-matching routes. ---

// Forms every cohort whose cutoff has passed and that is not yet formed. `onlyPid` + `force`
// forms one named cohort regardless of cutoff (manual/testing, via job params).
async function sweepFormation(catalystApp, onlyPid, force) {
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
  return formed;
}

// Purges expired pending enrolments, then pairs the wait pool of every formed cohort and
// sends the 3-day broadcast where due.
async function sweepMatching(catalystApp, onlyPid) {
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
  return { purged, results };
}


// --- Job entry point. Params (all optional, strings): pid, force ("true"). ---
module.exports = async (jobRequest, context) => {
  const t0 = Date.now();
  // `context` carries catalystHeaders; `jobRequest` does not (measured 2026-09-11 — the SDK
  // throws "unable to find the type of initialisation" on the request object).
  const catalystApp = catalyst.initialize(context);
  const rawPid = jobRequest.getJobParam ? jobRequest.getJobParam("pid") : null;
  const onlyPid = validPid(rawPid) ? String(rawPid).replace(/'/g, "") : null;
  const force = String(jobRequest.getJobParam ? jobRequest.getJobParam("force") : "") === "true";

  try {
    const formed = await sweepFormation(catalystApp, onlyPid, force);
    const { purged, results } = await sweepMatching(catalystApp, onlyPid);
    console.log(JSON.stringify({ sweep: "ok", ms: Date.now() - t0, formed, purged, results }));
    context.closeWithSuccess();
  } catch (err) {
    console.log(JSON.stringify({ sweep: "error", ms: Date.now() - t0, message: String(err && err.message) }));
    context.closeWithFailure();
  }
};
