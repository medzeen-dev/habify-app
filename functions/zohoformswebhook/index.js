"use strict";

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// No CORS handling here — on purpose (DL-089). Two reasons, and the second is the one
// that makes it necessary rather than merely tidy:
//
// This is a webhook. Zoho Forms calls it server-to-server, so no browser ever needs a CORS
// header from it and the block was decoration from the start.
//
// But Authorized Domains are a **project** setting, not a per-function one. Once the Shell
// origin is registered — which it must be — the gateway stamps
// Access-Control-Allow-Origin on this function's responses too, for any request carrying
// that Origin. A header set here would then be a duplicate, and browsers reject a response
// with two of them even when the values match. Leaving it would plant a fault that only
// appears once an unrelated origin is authorised somewhere else.

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "zohoformswebhook is live" });
});

app.post("/", (req, res) => {

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.advancedio });

  const body = req.body || {};
  const pid = body.pid;

  if (!pid) {
    res.status(400).json({ status: "error", message: "Missing required field: pid" });
    return;
  }

  const rowData = {
    pid: String(pid),
    form_type: body.form_type ? String(body.form_type) : "unknown",
    submitted_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    raw_payload: JSON.stringify(body)
  };

  if (body.user_id) {
    rowData.user_id = String(body.user_id);
  }
  if (body.stretch_relevant !== undefined && body.stretch_relevant !== null && body.stretch_relevant !== "") {
    rowData.stretch_relevant = (body.stretch_relevant === true || body.stretch_relevant === "true");
  }

  const table = catalystApp.datastore().table("FormSubmissions");
  const insertPromise = table.insertRow(rowData);

  insertPromise
    .then((row) => {
      console.log("Inserted FormSubmissions row: " + JSON.stringify(row));
      res.status(200).json({ status: "ok", rowid: row.ROWID });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ status: "error", message: err.message || String(err) });
    });
});

module.exports = app;
