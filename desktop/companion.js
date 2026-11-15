"use strict";

// Local link for the Unreal editor plugin. Bound to 127.0.0.1 only.
// The plugin never receives a model key. Pairing is a short code for this session.

const http = require("http");
const crypto = require("crypto");

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const GAMEPLAY = /Actor|Component|Character|Pawn|GameMode|GameState|Controller|PlayerState|Interface|HUD|Widget/i;

function pairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); }
      catch (exc) { reject(exc); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function summarizeProject(report, limit = 700) {
  const body = report && typeof report === "object" ? report : {};
  const classes = (Array.isArray(body.classes) ? body.classes : [])
    .filter((item) => item && (GAMEPLAY.test(item.name || "") || GAMEPLAY.test(item.parent || "") || GAMEPLAY.test(item.kind || "")))
    .slice(0, 24);
  const plugins = (Array.isArray(body.plugins) ? body.plugins : []).slice(0, 12);
  const parts = [
    `Engine ${body.engine || "unknown"}. Project ${body.project || "unknown"}.`,
    plugins.length ? `Plugins: ${plugins.join(", ")}.` : "",
    classes.length ? `Classes: ${classes.map((item) => `${item.name}${item.parent ? ` (${item.parent})` : ""}`).join(", ")}.` : "",
  ].filter(Boolean);
  const text = parts.join(" ");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function createCompanion() {
  let code = pairingCode();
  let token = "";
  let report = null;
  let pending = null;
  let lastResult = null;

  const server = http.createServer(async (req, res) => {
    const remote = req.socket.remoteAddress || "";
    if (!LOOPBACK.has(remote)) {
      send(res, 403, { error: "The companion link only accepts this computer." });
      return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    try {
      if (req.method === "POST" && url.pathname === "/v1/pair") {
        const body = await readBody(req);
        if (String(body.code || "").trim().toUpperCase() !== code) {
          send(res, 401, { error: "That pairing code does not match." });
          return;
        }
        token = crypto.randomBytes(16).toString("hex");
        send(res, 200, { token });
        return;
      }
      const presented = String(req.headers["x-companion-token"] || "").trim();
      if (!token || presented !== token) {
        send(res, 401, { error: "Pair this editor with the code shown in the app." });
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/status") {
        send(res, 200, { ok: true, app: "UE5 System Architect", paired: true });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/report") {
        report = await readBody(req);
        send(res, 200, { ok: true });
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/pending") {
        const command = pending;
        pending = null;
        send(res, 200, { command });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/result") {
        lastResult = await readBody(req);
        send(res, 200, { ok: true });
        return;
      }
      send(res, 404, { error: "Not found" });
    } catch {
      send(res, 400, { error: "The companion request was not valid JSON." });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        port: server.address().port,
        get code() { return code; },
        rotate() { code = pairingCode(); token = ""; return code; },
        get paired() { return !!token; },
        get report() { return report; },
        get lastResult() { return lastResult; },
        summary() { return summarizeProject(report); },
        queue(command) { pending = { id: crypto.randomBytes(4).toString("hex"), ...command }; return pending; },
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { createCompanion, summarizeProject, pairingCode };
