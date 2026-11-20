"use strict";

// Loads the main-process modules from an extracted app.asar.
// Usage: node desktop/asarSmoke.js <extracted-asar-dir>

const path = require("path");

const extracted = path.resolve(process.argv[2] || "");
if (!extracted || process.argv.length < 3) {
  console.error("Pass the directory created by @electron/asar extract.");
  process.exit(1);
}

require(path.join(extracted, "desktop", "lessonStudy.js"));
require(path.join(extracted, "desktop", "tracks.js"));
require(path.join(extracted, "desktop", "server.js"));
console.log("asar smoke check passed");
