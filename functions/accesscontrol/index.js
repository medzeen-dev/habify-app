"use strict";

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

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

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });

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
      res.status(200).json(out);
    })
    .catch((err) => {
      console.log(err);
      res.status(200).json({ status: "ok", valid: false, reason: "invalid", message: "internal error" });
    });
});

module.exports = app;
