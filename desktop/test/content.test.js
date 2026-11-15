"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");
const { normalizeSystem } = require("../logic");
const { PACKS } = require("../templateLearning");
const {
  ABOUT,
  concepts,
  examples,
  forkSource,
  officialUrl,
  resolveConcept,
} = require("../content");

const OLD = {
  system_name: "Legacy Shield",
  summary: "Blocks.",
  blueprint_pseudocode: "Event Block",
  cpp_header: "class UShield {};",
  cpp_source: "void UShield::Block() {}",
  setup_guide: [{ step: 1, title: "Add" }],
  node_graph_nodes: [{ id: "n1", label: "Block" }],
  node_graph_edges: [],
};

async function boot(fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-content-"));
  let calls = 0;
  const handle = await startServer({
    dataDir,
    port: 0,
    fetchImpl: fetchImpl || (async () => {
      calls += 1;
      throw new Error("no model call expected");
    }),
    sleep: () => Promise.resolve(),
    staticDir: path.join(__dirname, "missing-ui"),
  });
  return {
    handle,
    base: `http://127.0.0.1:${handle.port}`,
    dataDir,
    calls: () => calls,
  };
}

test("bundled concepts and Start Here are complete", async () => {
  const cards = concepts();
  assert.ok(cards.length >= 8 && cards.length <= 10);
  const exampleIds = new Set(examples().map((item) => item.id));
  const templateIds = new Set(PACKS.map((pack) => pack.id));
  for (const card of cards) {
    assert.ok(card.challenge?.prompt);
    assert.ok(card.challenge.choices.length >= 2);
    assert.ok(card.challenge.answer >= 0 && card.challenge.answer < card.challenge.choices.length);
    assert.ok(card.examples.length >= 1);
    for (const link of card.examples) {
      const known = link.kind === "example" ? exampleIds.has(link.id) : templateIds.has(link.id);
      assert.equal(known, true, `${card.id} -> ${link.kind}:${link.id}`);
    }
    for (const link of card.learn_more || []) assert.equal(officialUrl(link.url), true);
  }

  const start = examples()[0];
  assert.equal(start.id, "start-here");
  const learning = start.system.learning;
  const nodes = learning.why_notes.filter((note) => note.anchor.kind === "node");
  const cpp = learning.why_notes.filter((note) => note.anchor.kind === "cpp");
  assert.ok(nodes.length >= 3);
  assert.ok(cpp.length >= 2);
  for (const note of learning.why_notes) {
    assert.ok(note.one_line && note.tradeoff && note.common_mistake);
    assert.ok(resolveConcept(note.concept_id), note.concept_id);
  }
  assert.ok(learning.challenges.length >= 2);
  assert.ok(learning.challenges[0].choices.length >= 2);
  assert.ok(learning.parameter_effects.length >= start.system.tunable_parameters.length);
  assert.ok(learning.traps.length >= 1);
  assert.ok(learning.what_ifs[0].variants.length >= 2);
  for (const param of start.system.tunable_parameters) {
    const impact = learning.parameter_impacts.find((item) => item.key === param.key);
    assert.ok(impact?.lines?.length >= 1, param.key);
  }
  assert.equal(learning.complexity, "beginner");
  assert.ok(learning.prerequisites.length >= 1);
  assert.ok(start.key_decisions.length >= 2);
  for (const link of start.learn_more) assert.equal(officialUrl(link.url), true);
  assert.match(ABOUT.is, /UE5 architecture and learning tool/);
  assert.match(ABOUT.isnt, /full game generator/);
  assert.match(ABOUT.isnt, /review/);
});

test("every teaching-note concept id resolves, including the UI map", async () => {
  const ui = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "content.mjs")).href);
  const cards = concepts();
  const ids = new Set(cards.map((card) => card.id));
  for (const pack of PACKS) {
    const system = forkSource("template", pack.id).system;
    for (const note of system.learning.why_notes) ids.add(note.concept_id);
    for (const concept of system.learning.related_concepts || []) ids.add(concept.id);
  }
  for (const id of ids) {
    const card = resolveConcept(id);
    assert.ok(card, id);
    assert.equal(ui.resolveConcept(cards, id)?.id, card.id);
  }
  assert.equal(resolveConcept("interfaces").id, "interface-vs-cast");
  assert.equal(resolveConcept("missing-concept"), null);
  assert.equal(ui.ABOUT.is, ABOUT.is);
  assert.equal(ui.ABOUT.isnt, ABOUT.isnt);
});

test("no-key browsing makes no model request, and fork leaves the original", async () => {
  const server = await boot();
  try {
    const before = JSON.parse(JSON.stringify(examples()[0].system));
    const listed = await (await fetch(`${server.base}/api/examples`)).json();
    const cards = await (await fetch(`${server.base}/api/concepts`)).json();
    assert.equal(listed.examples[0].id, "start-here");
    assert.ok(cards.concepts.length >= 8);
    const answered = await fetch(`${server.base}/api/progress/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_name: "Character Interaction", challenge_index: 0, correct: true }),
    });
    assert.equal(answered.status, 200);
    const forked = await (await fetch(`${server.base}/api/library/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "example", id: "start-here" }),
    })).json();
    assert.equal(forked.name, "Character Interaction");
    const again = await (await fetch(`${server.base}/api/library/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "template", id: "combat" }),
    })).json();
    assert.equal(again.name, "Advanced Combat System");
    const projects = await (await fetch(`${server.base}/api/projects`)).json();
    assert.equal(projects.mine.length, 2);
    forked.system.system_name = "Changed copy";
    assert.equal(examples()[0].system.system_name, before.system_name);
    assert.equal(examples()[0].system.cpp_source, before.cpp_source);
    const saved = JSON.parse(fs.readFileSync(path.join(server.dataDir, "library.json"), "utf8"));
    assert.deepEqual(saved.usage, []);
    assert.equal(server.calls(), 0);
    const opened = await (await fetch(`${server.base}/api/projects/${forked.project_id}`)).json();
    assert.equal(opened.system.learning.challenges.length >= 2, true);
    assert.notEqual(opened.system.cpp_source, "");
  } finally {
    await server.handle.close();
  }
});

test("an older project with no learning fields still opens", async () => {
  const server = await boot();
  try {
    const normalized = normalizeSystem(OLD, []);
    assert.equal(normalized.learning, undefined);
    const created = await (await fetch(`${server.base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Legacy Shield", system: normalized }),
    })).json();
    const opened = await (await fetch(`${server.base}/api/projects/${created.project_id}`)).json();
    assert.equal(opened.system.system_name, "Legacy Shield");
    assert.equal(opened.system.learning, undefined);
    const progress = await (await fetch(`${server.base}/api/progress`)).json();
    assert.deepEqual(progress.answered, []);
  } finally {
    await server.handle.close();
  }
});
