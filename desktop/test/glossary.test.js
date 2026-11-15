"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { glossaryCandidates, loadGlossary } = require("../glossary");

async function matcher() {
  return import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "glossary.mjs")).href);
}

test("the glossary ships inside the packaged app", () => {
  const pkg = require("../../package.json");
  const files = pkg.build.files.map((item) => String(item));
  assert.ok(files.some((item) => item.includes("content/glossary")), files.join(", "));
  assert.equal(pkg.build.asar, true);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-glossary-"));
  const appPath = path.join(root, "resources", "app.asar");
  const bundled = path.join(appPath, "content", "glossary");
  fs.mkdirSync(bundled, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "..", "..", "content", "glossary", "terms.json"),
    path.join(bundled, "terms.json"),
  );
  const candidates = glossaryCandidates({ appPath, resourcesPath: path.join(root, "resources") });
  assert.equal(candidates[0], path.join(appPath, "content", "glossary", "terms.json"));
  assert.ok(candidates.some((file) => file.includes(`${path.sep}app.asar${path.sep}`)));

  const previous = process.cwd();
  process.chdir(os.tmpdir());
  try {
    const loaded = loadGlossary({ appPath, resourcesPath: path.join(root, "resources") });
    assert.equal(loaded.file, path.join(appPath, "content", "glossary", "terms.json"));
    assert.ok(loaded.terms.some((term) => term.id === "game-instance-subsystem"));
    assert.deepEqual(loaded.problems, []);
  } finally {
    process.chdir(previous);
  }
});

test("glossary matches the longest whole term once, and skips noisy words", async () => {
  const { prepareGlossary, linkTerms } = await matcher();
  const terms = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "glossary", "terms.json"), "utf8")).terms;
  const phrases = prepareGlossary(terms);
  const subsystem = linkTerms("The Game Instance Subsystem outlives the Game Instance.", phrases);
  const hits = subsystem.filter((part) => part.type === "term").map((part) => part.id);
  assert.deepEqual(hits, ["game-instance-subsystem", "game-instance"]);
  assert.equal(subsystem.find((part) => part.id === "game-instance-subsystem").text, "Game Instance Subsystem");

  const once = linkTerms("Tick runs every frame. Tick is not a timer.", phrases);
  assert.equal(once.filter((part) => part.id === "tick").length, 1);

  const noisy = linkTerms("Compare this Function and restore the Class.", phrases);
  assert.equal(noisy.some((part) => part.type === "term"), false);

  const world = linkTerms("the world loads the World.", phrases);
  const worldHits = world.filter((part) => part.type === "term");
  assert.equal(worldHits.length, 1);
  assert.equal(worldHits[0].text, "World");

  const soft = linkTerms("Use a Soft Pointer instead of a hard load.", phrases);
  assert.equal(soft.find((part) => part.type === "term").id, "soft-ref");
});
