"use strict";

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

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

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "zohoformswebhook is live" });
});

app.post("/", (req, res) => {

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });

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
