"use strict";

// Runs the local API and, when the UI has been built, serves it.
// Used for development and for checks that don't need the Electron window.
//   node desktop/dev-server.js

const os = require("os");
const path = require("path");
const { startServer } = require("./server");

const dataDir = process.env.UE5_DATA_DIR || path.join(os.homedir(), ".ue5-system-architect");
const staticDir = path.join(__dirname, "..", "frontend", "build");
const appVersion = require("../package.json").version;

startServer({
  dataDir,
  staticDir,
  port: process.env.UE5_PORT || 47321,
  appVersion,
}).then((handle) => {
  console.log(`UE5 System Architect API http://127.0.0.1:${handle.port}`);
  console.log(`Data folder ${handle.dataDir}`);
}).catch((exc) => {
  console.error(exc);
  process.exit(1);
});
