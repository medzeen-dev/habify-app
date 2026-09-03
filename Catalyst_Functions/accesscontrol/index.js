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
  res.status(200).json({ status: "ok", message: "accesscontrol is live" });
});

app.post("/", (req, res) => {

  const catalystApp = catalyst.initialize(req, { type: catalyst.type.applogic });

  const body = req.body || {};
  const pid = body.pid;

  if (!pid || typeof pid !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(pid)) {
    res.status(200).json({ status: "ok", valid: false, message: "Invalid or missing pid" });
    return;
  }

  const safePid = pid.replace(/'/g, "");
  const query = "SELECT pid, active FROM AccessControl WHERE pid = '" + safePid + "'";

  catalystApp.zcql().executeZCQLQuery(query)
    .then((result) => {
      if (!result || result.length === 0) {
        res.status(200).json({ status: "ok", valid: false });
        return;
      }
      const row = result[0].AccessControl;
      const activeVal = row.active;
      const isActive = (activeVal === null || activeVal === undefined || activeVal === true || activeVal === "true");
      res.status(200).json({ status: "ok", valid: isActive });
    })
    .catch((err) => {
      console.log(err);
      res.status(200).json({ status: "ok", valid: false, message: "internal error" });
    });
});

module.exports = app;
