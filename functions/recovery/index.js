"use strict";

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ALLOWED_ORIGINS = ["https://habify30.k-a-d-o.com"];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/; // Dev only (localhost Shell)

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin);
  res.header("Access-Control-Allow-Origin", allowed ? origin : ALLOWED_ORIGINS[0]);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function checksumChar(chars) {
  let sum = 0;
  for (let i = 0; i < chars.length; i++) {
    const idx = ALPHABET.indexOf(chars[i]);
    sum += idx * (i + 1);
  }
  return ALPHABET[sum % ALPHABET.length];
}

function randomCode() {
  let chars = "";
  for (let i = 0; i < 7; i++) {
    chars += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return chars + checksumChar(chars);
}

function formatCode(code) {
  return code.substring(0, 4) + "-" + code.substring(4, 8);
}

function normalizeCode(input) {
  return String(input || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function isValidFormat(code) {
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code);
}

function isValidChecksum(code) {
  const chars = code.substring(0, 7);
  const check = code.substring(7, 8);
  return checksumChar(chars) === check;
}

// --- Rate limiting for /recover (DL-057) ---
// Per-IP attempt counter in Catalyst Cache. Fail-open: if the IP can't be read or
// the cache errors, the limiter is skipped rather than blocking real users.
// Cache TTL is in HOURS (Catalyst minimum = 1h), so the window is one hour.
const RL_LIMIT = 10;      // max /recover attempts per IP per window
const RL_TTL_HOURS = 1;   // window length (cache minimum)
const RL_SEGMENT_ID = "22671000000014066"; // Dev "Default" segment. TODO: set Prod segment id before Prod deploy.

function clientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.headers["x-real-ip"] || (req.connection && req.connection.remoteAddress) || "";
}

async function isRateLimited(catalystApp, req) {
  const ip = clientIp(req);
  if (!ip) return false; // fail-open: no IP → don't block
  try {
    const seg = catalystApp.cache().segment(RL_SEGMENT_ID);
    const key = "rl:recover:" + ip;
    const cur = parseInt((await seg.getValue(key)) || "0", 10) || 0;
    if (cur >= RL_LIMIT) return true;
    await seg.put(key, String(cur + 1), RL_TTL_HOURS);
    return false;
  } catch (e) {
    console.log("ratelimit skipped:", e && e.message);
    return false; // fail-open on cache error
  }
}

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "recovery is live" });
});

app.post("/register", (req, res) => {

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });

  const body = req.body || {};
  const pid = body.pid;

  if (!pid || typeof pid !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(pid)) {
    res.status(400).json({ status: "error", message: "Missing or invalid pid" });
    return;
  }

  const table = catalystApp.datastore().table("UserRecovery");

  const attemptInsert = (attemptsLeft) => {
    const userId = crypto.randomUUID();
    const rawCode = randomCode();

    const rowData = {
      pid: String(pid),
      user_id: userId,
      recovery_code: rawCode,
      created_at: new Date().toISOString().replace("T", " ").substring(0, 19)
    };

    table.insertRow(rowData)
      .then(() => {
        res.status(200).json({
          status: "ok",
          user_id: userId,
          recovery_code: formatCode(rawCode)
        });
      })
      .catch((err) => {
        const message = (err && err.message) ? err.message : String(err);
        const isUniqueConflict = /unique/i.test(message) || /duplicate/i.test(message);
        if (isUniqueConflict && attemptsLeft > 0) {
          attemptInsert(attemptsLeft - 1);
          return;
        }
        console.log(err);
        res.status(500).json({ status: "error", message: message });
      });
  };

  attemptInsert(5);
});

app.post("/recover", async (req, res) => {

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });

  // Rate-limit (DL-057): /recover is the only endpoint reachable without a prior
  // accesscontrol gate, so it must be throttled against brute-force.
  if (await isRateLimited(catalystApp, req)) {
    res.status(200).json({ status: "ok", found: false, rateLimited: true });
    return;
  }

  const body = req.body || {};
  const normalized = normalizeCode(body.recovery_code);

  if (!isValidFormat(normalized) || !isValidChecksum(normalized)) {
    res.status(200).json({ status: "ok", found: false });
    return;
  }

  try {
    const result = await catalystApp.zcql().executeZCQLQuery(
      "SELECT pid, user_id FROM UserRecovery WHERE recovery_code = '" + normalized + "'"
    );
    if (!result || result.length === 0) {
      res.status(200).json({ status: "ok", found: false });
      return;
    }
    const row = result[0].UserRecovery;
    res.status(200).json({ status: "ok", found: true, pid: row.pid, user_id: row.user_id });
  } catch (err) {
    console.log(err);
    res.status(200).json({ status: "ok", found: false });
  }
});

module.exports = app;
