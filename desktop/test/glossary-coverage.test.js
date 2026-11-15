"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const STOP = new Set("this that when what where which with from your they have will should about into only also each more some such then than once here there other these after before because player system project event state true false string number value name time step note task answer choice used using make makes made same does done need needs keep keeps show shows open opens load loads file files code data game games level levels actor actors void return call start line item wear focus engine exec does that widget health door timer trace interact prompt unreal learning should cast public class const auto include float bool int void".split(" "));

function stringsOf(value, out) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsOf(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => stringsOf(item, out));
}

function corpus() {
  const chunks = [];
  stringsOf(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "packs", "tactical-fps.json"), "utf8")), chunks);
  for (const name of fs.readdirSync(path.join(ROOT, "content", "templates"))) {
    if (name.endsWith(".json")) stringsOf(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "templates", name), "utf8")), chunks);
  }
  chunks.push(fs.readFileSync(path.join(ROOT, "desktop", "references.js"), "utf8"));
  return chunks.join("\n");
}

test("glossary coverage scan reports frequent words that are still missing", () => {
  const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "glossary.json"), "utf8"));
  const known = new Set();
  for (const term of glossary.terms) {
    known.add(String(term.term).toLowerCase());
    for (const alias of term.aliases || []) known.add(String(alias).toLowerCase());
  }
  const counts = new Map();
  const titled = new Map();
  for (const match of corpus().matchAll(/\b[A-Za-z][A-Za-z0-9]{3,}\b/g)) {
    const word = match[0];
    const key = word.toLowerCase();
    if (STOP.has(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) titled.set(key, (titled.get(key) || 0) + 1);
  }
  const missing = [...counts.entries()]
    .filter(([word, count]) => count >= 4 && (titled.get(word) || 0) >= 2 && !known.has(word))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25);
  assert.ok(known.has("replication"));
  assert.ok(known.has("motion matching"));
  assert.ok(counts.get("replication") >= 1 || counts.get("tick") >= 1);
  const lines = missing.map(([word, count]) => `${count}\t${word}`);
  fs.mkdirSync("/tmp", { recursive: true });
  fs.writeFileSync("/tmp/glossary-coverage.txt", `${lines.join("\n")}\n`);
  console.log(`GLOSSARY_MISSING\n${lines.join("\n")}`);
});
