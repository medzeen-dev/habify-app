"use strict";

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://habify30.k-a-d-o.com");
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

app.post("/recover", (req, res) => {

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });

  const body = req.body || {};
  const normalized = normalizeCode(body.recovery_code);

  if (!isValidFormat(normalized) || !isValidChecksum(normalized)) {
    res.status(200).json({ status: "ok", found: false });
    return;
  }

  const query = "SELECT pid, user_id FROM UserRecovery WHERE recovery_code = '" + normalized + "'";

  catalystApp.zcql().executeZCQLQuery(query)
    .then((result) => {
      if (!result || result.length === 0) {
        res.status(200).json({ status: "ok", found: false });
        return;
      }
      const row = result[0].UserRecovery;
      res.status(200).json({ status: "ok", found: true, pid: row.pid, user_id: row.user_id });
    })
    .catch((err) => {
      console.log(err);
      res.status(200).json({ status: "ok", found: false });
    });
});

module.exports = app;
