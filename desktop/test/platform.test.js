"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "node_modules" || name === "ui" || name === "build") continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (/\.(js|jsx|mjs|cjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

const FILES = [
  ...walk(path.join(ROOT, "desktop")).filter((file) => !file.includes(`${path.sep}test${path.sep}`)),
  ...walk(path.join(ROOT, "frontend", "src")),
];

// A Windows-only call is allowed when the nearby lines already check the platform.
function guarded(lines, index) {
  return /process\.platform/.test(lines.slice(Math.max(0, index - 4), index + 1).join("\n"));
}

const RULES = [
  { name: "cmd or PowerShell", re: /\b(cmd|powershell|pwsh)\.exe\b/i },
  { name: "registry", re: /\b(HKCU|HKLM|HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER|reg\.exe)\b/ },
  { name: "backslash path", re: /["'`][A-Za-z]:\\\\/ },
  // A JS string UNC path is written with four backslashes: "\\\\server\\share".
  { name: "UNC path", re: /["'`]\\\\\\\\[A-Za-z][\w.-]*\\\\/ },
];

test("app code has no Windows-only paths or shells outside a platform check", () => {
  const findings = [];
  for (const file of FILES) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      for (const rule of RULES) {
        if (rule.re.test(line) && !guarded(lines, index)) {
          findings.push(`${path.relative(ROOT, file)}:${index + 1} ${rule.name}: ${trimmed.slice(0, 160)}`);
        }
      }
    });
  }
  assert.deepEqual(findings, []);
});

test("the window can be 1024px wide and uses the generated icon", () => {
  const main = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8");
  assert.match(main, /minWidth:\s*1024/);
  assert.match(main, /path\.join\(__dirname,\s*"icons",\s*"icon\.png"\)/);
  assert.equal(main.includes("\\\\"), false);
});
