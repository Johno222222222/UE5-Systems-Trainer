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
  fs.mkdirSync(path.join(appPath, "content"), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "..", "..", "content", "glossary.json"),
    path.join(appPath, "content", "glossary.json"),
  );
  const candidates = glossaryCandidates({ appPath, resourcesPath: path.join(root, "resources") });
  assert.equal(candidates[0], path.join(appPath, "content", "glossary.json"));
  assert.ok(candidates.some((file) => file.includes(`${path.sep}app.asar${path.sep}`)));

  const previous = process.cwd();
  process.chdir(os.tmpdir());
  try {
    const loaded = loadGlossary({ appPath, resourcesPath: path.join(root, "resources") });
    assert.equal(loaded.file, path.join(appPath, "content", "glossary.json"));
    assert.ok(loaded.terms.some((term) => term.id === "game-instance-subsystem"));
    assert.deepEqual(loaded.problems, []);
  } finally {
    process.chdir(previous);
  }
});

test("glossary matches the longest whole term once, and skips noisy words", async () => {
  const { prepareGlossary, linkTerms, phrasesForTags } = await matcher();
  const terms = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "glossary.json"), "utf8")).terms;
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

  const replication = phrases.find((phrase) => phrase.id === "replication");
  assert.ok(replication.summary.length > 20);
  assert.ok(replication.see.includes("onrep"));
  assert.ok(replication.see.includes("doreplifetime"));
  const tagged = phrasesForTags(phrases, ["Motion Matching"]);
  assert.ok(tagged.some((phrase) => phrase.id === "pose-search"));
  assert.equal(tagged.some((phrase) => phrase.id === "replication"), false);
});

const SPEC_TERMS = [
  "Pose Search Database",
  "Motion Matching Database",
  "Trajectory",
  "Pose",
  "Feature Channel",
  "Schema",
  "Motion Warping",
  "Distance Matching",
  "Orientation Warping",
  "Animation Compression",
  "Blend Profile",
  "Gameplay Effect Spec",
  "Duration Policy",
  "Period",
  "Stacking",
  "Magnitude Calculation",
  "Execution Calculation",
  "Target Data",
  "Ability System Global Data",
  "Net Serialize",
  "Conditional Replication",
  "Owner Only",
  "Skip Owner",
  "Net Priority",
  "Net Cull Distance",
  "Subobject Replication",
  "Bunch",
  "Streamable Manager",
  "Curve Table",
  "Gameplay Tag Container",
  "Trigger",
  "Widget",
  "Binding",
  "MVVM",
  "EQS",
  "State Tree",
  "Rigid Body",
  "Constraint",
  "Destruction",
  "Instanced Static Mesh",
  "Virtual Shadow Maps",
  "Significance Manager",
];

const QUIET_WORDS = ["Pose", "Period", "Trigger", "Widget", "Binding", "Schema", "Constraint", "Bunch", "Stacking"];

test("every stage 2 spec term is present, and short words stay off the underline", async () => {
  const { prepareGlossary, linkTerms } = await matcher();
  const terms = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "glossary.json"), "utf8")).terms;
  const names = new Set();
  const ids = new Set();
  for (const term of terms) {
    names.add(String(term.term).toLowerCase());
    for (const alias of term.aliases || []) names.add(String(alias).toLowerCase());
    ids.add(term.id);
  }
  for (const term of terms) {
    for (const id of term.see || []) assert.ok(ids.has(id), `${term.id} -> ${id}`);
  }
  for (const name of SPEC_TERMS) {
    assert.ok(names.has(name.toLowerCase()), name);
    const term = terms.find((item) => item.term.toLowerCase() === name.toLowerCase() || (item.aliases || []).some((alias) => alias.toLowerCase() === name.toLowerCase()));
    assert.ok(term.summary, name);
    assert.ok(term.detail, name);
    assert.ok((term.tags || []).length, name);
    assert.ok((term.see || []).length, name);
  }
  for (const name of ["inventory", "damage", "replicate", "weapon", "magazine", "reserve", "clamp", "gameplay"]) {
    assert.ok(names.has(name), name);
  }
  const replication = terms.find((term) => term.id === "replication");
  assert.ok(replication.aliases.some((alias) => alias.toLowerCase() === "replicate"));
  for (const name of QUIET_WORDS) {
    const term = terms.find((item) => item.term.toLowerCase() === name.toLowerCase());
    assert.equal(term.match, "skip", name);
  }

  const phrases = prepareGlossary(terms);
  const quiet = linkTerms("Take a pose for a period, then trigger the widget binding schema constraint bunch stacking.", phrases);
  assert.equal(quiet.some((part) => part.type === "term"), false);
  const database = linkTerms("The Pose Search Database feeds the Motion Matching node.", phrases);
  assert.equal(database.find((part) => part.type === "term").id, "pose-search-database");
  const verb = linkTerms("Replicate the magazine.", phrases);
  assert.deepEqual(verb.filter((part) => part.type === "term").map((part) => part.id), ["replication", "magazine"]);
});

test("a requested word is stored once and capped", async () => {
  const { addGlossaryRequest } = await matcher();
  const first = addGlossaryRequest([], "Prediction");
  const again = addGlossaryRequest(first, "prediction");
  assert.equal(again.length, 1);
  assert.equal(again[0].word, "prediction");
  const many = Array.from({ length: 45 }, (_, index) => `Term${index}`).reduce((list, word) => addGlossaryRequest(list, word), []);
  assert.equal(many.length, 40);
});
