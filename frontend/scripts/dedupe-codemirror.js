"use strict";

// CodeMirror breaks if webpack loads two copies of the same package.
// Yarn still nests a second copy. Remove the nested ones so the build
// uses the single copy at the top of node_modules.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "node_modules", "@codemirror");
if (!fs.existsSync(root)) process.exit(0);
for (const name of fs.readdirSync(root)) {
  const nested = path.join(root, name, "node_modules");
  if (fs.existsSync(nested)) fs.rmSync(nested, { recursive: true, force: true });
}
