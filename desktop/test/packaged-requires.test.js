"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const DESKTOP = path.join(ROOT, "desktop");

function walkJs(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "test") continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkJs(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function globToRegExp(pattern) {
  let source = "";
  const body = pattern.replace(/\\/g, "/");
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    const next = body[i + 1];
    if (char === "*" && next === "*") {
      if (body[i + 2] === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    if ("\\.^$+?()[]{}|".includes(char)) source += `\\${char}`;
    else source += char;
  }
  return new RegExp(`^${source}$`);
}

function packagedMatchers() {
  const patterns = require(path.join(ROOT, "package.json")).build.files;
  const positive = [];
  const negative = [];
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) negative.push(globToRegExp(pattern.slice(1)));
    else positive.push(globToRegExp(pattern));
  }
  return { positive, negative };
}

function isPackaged(rel, matchers) {
  const posix = rel.split(path.sep).join("/");
  if (matchers.negative.some((re) => re.test(posix))) return false;
  return matchers.positive.some((re) => re.test(posix));
}

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.json`, `${base}.node`, path.join(base, "index.js")];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

test("desktop requires stay inside the packaged file set", () => {
  const matchers = packagedMatchers();
  const misses = [];
  const requirePattern = /require\(\s*["'](\.[^"']+)["']\s*\)/g;
  for (const file of walkJs(DESKTOP)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(requirePattern)) {
      const resolved = resolveRelative(file, match[1]);
      const where = `${path.relative(ROOT, file)} -> ${match[1]}`;
      if (!resolved) {
        misses.push(`${where} did not resolve`);
        continue;
      }
      const rel = path.relative(ROOT, resolved);
      if (!isPackaged(rel, matchers)) misses.push(`${where} lands on unpackaged ${rel}`);
    }
  }
  assert.deepEqual(misses, []);
});
