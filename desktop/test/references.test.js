"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");
const {
  INTRO,
  catalog,
  exampleById,
  resolveConcept,
  keyDecisions,
  validateBundled,
  officialUrls,
} = require("../references");
const { assertLearningAnchors } = require("../learning");

async function loadUi() {
  return import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "references.mjs")).href);
}

function boot(fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-references-"));
  let calls = 0;
  const fetch = fetchImpl || (async () => {
    calls += 1;
    return new Response("{}", { status: 500 });
  });
  return startServer({
    dataDir,
    port: 0,
    staticDir: path.join(__dirname, "missing-ui"),
    fetchImpl: async (...args) => {
      calls += 1;
      return fetch(...args);
    },
  }).then((handle) => ({
    handle,
    dataDir,
    base: `http://127.0.0.1:${handle.port}`,
    calls: () => calls,
  }));
}

test("bundled cards, Start Here learning data, and doc links are valid", async () => {
  const data = validateBundled();
  assert.ok(data.concepts.length >= 8 && data.concepts.length <= 10);
  const ids = new Set(data.examples.map((item) => item.id));
  for (const card of data.concepts) {
    assert.ok(card.challenge.prompt, card.id);
    assert.ok(card.challenge.choices.length >= 2, card.id);
    assert.ok(card.challenge.why, card.id);
    assert.ok(card.example_ids.length >= 1, card.id);
    for (const exampleId of card.example_ids) assert.ok(ids.has(exampleId), `${card.id} -> ${exampleId}`);
    for (const link of card.learn_more) assert.ok(officialUrls().has(link.url), link.url);
  }
  const start = data.examples.find((item) => item.id === "start-here");
  assert.equal(start.kind, "example");
  assert.equal(start.complexity, "beginner");
  assert.ok(start.prerequisites.length >= 1);
  assertLearningAnchors(start.starter);
  const learning = start.starter.learning;
  assert.ok(learning.challenges.length >= 2);
  for (const item of learning.challenges) {
    assert.ok(item.choices.length >= 2);
    assert.ok(item.why_people_pick);
    assert.ok(item.reveal?.node_ids?.length || item.reveal?.lines?.length);
  }
  assert.ok(learning.why_notes.length >= 5);
  for (const note of learning.why_notes) {
    assert.ok(note.one_line && note.tradeoff && note.common_mistake, note.id);
  }
  assert.ok(learning.traps.length >= 1);
  assert.ok(learning.what_ifs.every((item) => item.variants.length >= 2));
  assert.equal(keyDecisions(start.starter).length, learning.why_notes.length);
  for (const example of data.examples) {
    assert.ok(["beginner", "intermediate", "advanced"].includes(example.complexity), example.id);
    assert.ok(Array.isArray(example.prerequisites), example.id);
    assert.ok(example.learn_more.length >= 1, example.id);
    for (const link of example.learn_more) {
      assert.match(link.url, /^https:\/\/dev\.epicgames\.com\/documentation\/en-us\/unreal-engine\//);
      assert.ok(officialUrls().has(link.url));
    }
  }
  const ui = await loadUi();
  assert.equal(ui.INTRO.is, INTRO.is);
  assert.equal(ui.INTRO.isnt, INTRO.isnt);
  assert.equal(ui.keyDecisions(start.starter).length, keyDecisions(start.starter).length);
  assert.equal(ui.keyDecisions(start.starter)[0].decision, keyDecisions(start.starter)[0].decision);
  assert.equal(ui.keyDecisions({ system_name: "Legacy" }).length, 0);
});

test("WHY concept ids resolve to a concept card, including older template ids", async () => {
  const data = catalog();
  const ui = await loadUi();
  for (const example of data.examples) {
    for (const note of example.starter.learning.why_notes) {
      const card = resolveConcept(note.concept_id);
      assert.ok(card, `${example.id} ${note.concept_id}`);
      const client = ui.resolveConcept(data.concepts, note.concept_id);
      assert.equal(client.id, card.id);
      assert.equal(client.title, card.title);
    }
  }
  assert.equal(resolveConcept("timers").id, "tick-vs-timers");
  assert.equal(resolveConcept("interfaces").id, "interface-vs-cast");
  assert.equal(resolveConcept("gas").id, "gameplay-tags");
  assert.equal(resolveConcept("line-traces").id, "line-traces");
  assert.equal(ui.resolveConcept(data.concepts, "timers").id, "tick-vs-timers");
  assert.equal(resolveConcept("not-a-concept"), null);
  assert.equal(ui.resolveConcept(data.concepts, ""), null);
});

test("no-key exploring, answering, and forking do not record a request", async () => {
  const session = await boot();
  try {
    const listed = await (await fetch(`${session.base}/api/references`)).json();
    const start = listed.examples.find((item) => item.id === "start-here");
    assert.ok(start.starter.learning.challenges[0].choices.length >= 2);
    assert.ok(start.starter.learning.parameter_impacts.every((item) => item.lines.length >= 1));
    const answered = await (await fetch(`${session.base}/api/progress/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_name: start.starter.system_name,
        challenge_index: 0,
        correct: true,
      }),
    })).json();
    assert.equal(answered.answered.length, 1);
    const usage = await (await fetch(`${session.base}/api/usage/today`)).json();
    assert.deepEqual(usage.models, {});
    const library = JSON.parse(fs.readFileSync(path.join(session.dataDir, "library.json"), "utf8"));
    assert.equal(library.usage.length, 0);
    assert.equal(session.calls(), 0);

    const before = JSON.stringify(exampleById("start-here").starter);
    const forked = await (await fetch(`${session.base}/api/examples/start-here/fork`, { method: "POST" })).json();
    assert.ok(forked.project_id);
    assert.equal(forked.system.system_name, "Character Interaction");
    const projects = await (await fetch(`${session.base}/api/projects`)).json();
    assert.ok(projects.mine.some((item) => item.project_id === forked.project_id));
    const changed = structuredClone(forked.system);
    changed.summary = "Edited copy";
    const saved = await (await fetch(`${session.base}/api/projects/${forked.project_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: changed, context: forked.context, base_version: forked.version, note: "Moved a slider locally" }),
    })).json();
    assert.equal(saved.system.summary, "Edited copy");
    const again = await (await fetch(`${session.base}/api/references`)).json();
    const bundled = again.examples.find((item) => item.id === "start-here");
    assert.equal(bundled.starter.summary, start.starter.summary);
    assert.notEqual(bundled.starter.summary, "Edited copy");
    assert.equal(JSON.stringify(exampleById("start-here").starter), before);

    const templateFork = await (await fetch(`${session.base}/api/examples/combat/fork`, { method: "POST" })).json();
    assert.equal(templateFork.system.system_name, "Advanced Combat System");
    const missing = await fetch(`${session.base}/api/examples/nope/fork`, { method: "POST" });
    assert.equal(missing.status, 404);

    const legacy = await (await fetch(`${session.base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Legacy Shield",
        system: {
          system_name: "Legacy Shield",
          summary: "Blocks.",
          blueprint_pseudocode: "Event Block",
          cpp_header: "class UShield {};",
          cpp_source: "void UShield::Block() {}",
          setup_guide: [{ step: 1, title: "Add" }],
          node_graph_nodes: [{ id: "n1", label: "Block" }],
        },
      }),
    })).json();
    const opened = await (await fetch(`${session.base}/api/projects/${legacy.project_id}`)).json();
    assert.equal(opened.system.system_name, "Legacy Shield");
    assert.equal(opened.system.learning, undefined);
    const progress = await (await fetch(`${session.base}/api/progress`)).json();
    assert.equal(progress.answered[0].system_name, "Character Interaction");

    const after = JSON.parse(fs.readFileSync(path.join(session.dataDir, "library.json"), "utf8"));
    assert.equal(after.usage.length, 0);
    assert.equal(session.calls(), 0);
  } finally {
    await session.handle.close();
  }
});
