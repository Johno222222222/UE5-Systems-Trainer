"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");
const { TEMPLATES, normalizeSystem, buildUserText } = require("../logic");
const { attachStarters } = require("../templateLearning");
const { learningGaps, fillLearning, LEARNING_PROMPT } = require("../learning");

const SYSTEM = {
  system_name: "Health And Damage",
  summary: "Tracks health.",
  tunable_parameters: [
    { key: "max_health", label: "Max Health", value: 100 },
    { key: "regen", label: "Regen", value: 2 },
  ],
  modules: [{ name: "Regen", included: true, description: "restores health" }],
  blueprint_pseudocode: "Event BeginPlay",
  cpp_header: "class UHealth { public: int MaxHealth; };",
  cpp_source: "void UHealth::Begin() { MaxHealth = 100; }",
  setup_guide: [{ step: 1, title: "Add" }],
  node_graph_nodes: [
    { id: "n1", label: "Begin" },
    { id: "n2", label: "Set Health" },
    { id: "n3", label: "Apply Damage" },
  ],
  node_graph_edges: [],
};

function goodLearning() {
  return {
    challenges: [
      { title: "Who owns health", detail: "The component owns the number." },
      { title: "Do not tick regen", detail: "A timer is enough." },
    ],
    why_notes: [],
    parameter_effects: [
      { key: "max_health", effect: "Raises the starting pool." },
      { key: "regen", effect: "Heals more per tick of the timer." },
    ],
    prerequisites: [],
    complexity: "beginner",
    related_concepts: [],
    traps: [{ title: "Tick overuse", detail: "Regen on Tick runs when nobody is hurt." }],
    module_notes: [],
  };
}

function gemini(text, finishReason = "STOP") {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text }] }, finishReason }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function boot(fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-learn-"));
  const handle = await startServer({
    dataDir,
    port: 0,
    fetchImpl,
    sleep: () => Promise.resolve(),
    staticDir: path.join(__dirname, "missing-ui"),
  });
  return { handle, base: `http://127.0.0.1:${handle.port}` };
}

async function saveKey(base) {
  await fetch(`${base}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "gemini", model: "gemini-3.5-flash-lite", key: "unit-test-key" }),
  });
}

test("learning data must cover challenges and every parameter, then fills the gaps", () => {
  const thin = { challenges: [{ title: "Only one" }], parameter_effects: [] };
  const gaps = learningGaps(thin, SYSTEM);
  assert.ok(gaps.some((gap) => gap.includes("2 challenges")));
  assert.ok(gaps.some((gap) => gap.includes("max_health")));
  assert.ok(gaps.some((gap) => gap.includes("regen")));
  const filled = fillLearning(thin, SYSTEM);
  assert.ok(filled.challenges.length >= 2);
  assert.deepEqual(filled.parameter_effects.map((item) => item.key).sort(), ["max_health", "regen"]);
  const whole = fillLearning(goodLearning(), SYSTEM);
  assert.equal(learningGaps(whole, SYSTEM).length, 0);
});

test("the learning prompt keeps the anchors and does not ship sample answers", () => {
  assert.match(LEARNING_PROMPT, /At least 2 challenges/);
  assert.match(LEARNING_PROMPT, /anchor\.kind is "node"/);
  assert.match(LEARNING_PROMPT, /anchor\.kind is "cpp"/);
  assert.match(LEARNING_PROMPT, /parameter key you are given/);
  assert.equal(LEARNING_PROMPT.includes("the crashy version"), false);
  assert.equal(LEARNING_PROMPT.includes("Max Health"), false);
});

test("a project saved before learning still opens and can be sent back to the model", () => {
  const old = {
    system_name: "Legacy Shield",
    summary: "Blocks damage.",
    blueprint_pseudocode: "Event Block",
    cpp_header: "class UShield {};",
    cpp_source: "void UShield::Block() {}",
    setup_guide: [{ step: 1, title: "Add the component" }],
    node_graph_nodes: [{ id: "n1", label: "Block" }],
    tunable_parameters: [],
    modules: [],
  };
  const opened = normalizeSystem(old, []);
  assert.equal(opened.learning, undefined);
  assert.equal(opened.system_name, "Legacy Shield");
  const text = buildUserText({
    prompt: "Add a stamina cost to the shield",
    blueprint_class: "ActorComponent",
    complexity: 40,
    modularity: 60,
    performance_vs_flexibility: 50,
    tick_rate: 0,
    network_replicated: false,
    previous_system: opened,
    stack_systems: [],
    extra_modules: [],
    removed_modules: [],
    parameter_overrides: {},
    change_requests: ["Add a stamina cost"],
  }, []);
  assert.match(text, /Legacy Shield/);
  assert.match(text, /Add a stamina cost/);
});

test("templates carry at least 3 graph notes and 2 C++ notes on real anchors", () => {
  const templates = attachStarters(TEMPLATES);
  assert.equal(templates.length, 8);
  for (const template of templates) {
    const system = template.starter;
    assert.ok(system, template.id);
    const notes = system.learning.why_notes;
    const nodes = notes.filter((note) => note.anchor.kind === "node");
    const cpp = notes.filter((note) => note.anchor.kind === "cpp");
    assert.ok(nodes.length >= 3, template.id);
    assert.ok(cpp.length >= 2, template.id);
    const ids = new Set(system.node_graph_nodes.map((node) => node.id));
    for (const note of nodes) assert.ok(ids.has(note.anchor.node_id), `${template.id} ${note.anchor.node_id}`);
    for (const note of cpp) {
      const file = note.anchor.file === ".cpp" ? system.cpp_source : system.cpp_header;
      const line = file.split("\n")[note.anchor.line - 1];
      assert.ok(line && line.trim(), `${template.id} ${note.anchor.file}:${note.anchor.line}`);
    }
  }
});

test("synthesis stays one request and does not wait for the learning pass", async () => {
  let calls = 0;
  const { handle, base } = await boot(async () => {
    calls += 1;
    return gemini(JSON.stringify({
      system_name: "Health And Damage",
      summary: "Tracks health.",
      tunable_parameters: SYSTEM.tunable_parameters,
      modules: SYSTEM.modules,
      blueprint_pseudocode: "Event BeginPlay",
      cpp_header: "class UHealth { public: int MaxHealth; };",
      cpp_source: "void UHealth::Begin() { MaxHealth = 100; }",
      setup_guide: [{ step: 1, title: "Add", detail: "Drop it on", why: "reusable" }],
      node_graph_nodes: [{ id: "n1", label: "Begin", node_type: "event", x: 1, y: 1, inputs: [], outputs: ["exec"] }],
      node_graph_edges: [],
    }));
  });
  try {
    await saveKey(base);
    const started = await (await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A health component for a character" }),
    })).json();
    let job;
    for (let i = 0; i < 20; i += 1) {
      job = await (await fetch(`${base}/api/generate/${started.job_id}`)).json();
      if (job.status !== "running") break;
    }
    assert.equal(job.status, "done");
    assert.equal(calls, 1);
    assert.equal(job.result.learning, undefined);
  } finally {
    await handle.close();
  }
});

test("a thin learning reply is re-asked, then filled so every parameter has an effect", async () => {
  let calls = 0;
  const { handle, base } = await boot(async () => {
    calls += 1;
    if (calls === 1) return gemini(JSON.stringify({ challenges: [], parameter_effects: [], why_notes: [] }));
    return gemini(JSON.stringify(goodLearning()));
  });
  try {
    await saveKey(base);
    const res = await fetch(`${base}/api/learn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM, unreal_version: "5.8" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(calls, 2);
    assert.ok(body.learning.challenges.length >= 2);
    assert.deepEqual(body.learning.parameter_effects.map((item) => item.key).sort(), ["max_health", "regen"]);
  } finally {
    await handle.close();
  }
});

test("a failed learning pass returns an error the client can retry", async () => {
  const { handle, base } = await boot(async () => {
    throw new Error("socket hang up");
  });
  try {
    await saveKey(base);
    const res = await fetch(`${base}/api/learn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM, unreal_version: "5.8" }),
    });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.match(JSON.stringify(body), /Retry learning pass/);
  } finally {
    await handle.close();
  }
});

test("minimal help skips the learning pass and the choice sticks", async () => {
  const ui = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "learning.mjs")).href);
  const memory = new Map();
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
  };
  const store = ui.createHelpLevelStore(storage);
  assert.equal(store.get(), "learning");
  assert.equal(ui.shouldRunLearningPass(store.get()), true);
  store.set("minimal");
  const again = ui.createHelpLevelStore(storage);
  assert.equal(again.get(), "minimal");
  assert.equal(ui.shouldRunLearningPass(again.get()), false);
  assert.equal(ui.shouldRunLearningPass("standard"), true);
  assert.equal(ui.visibleWhyNotes({ learning: goodLearning() }, "minimal").length, 0);
  assert.equal(ui.visibleWhyNotes({ learning: { why_notes: goodLearning().why_notes } }, "standard").length, 0);
});
