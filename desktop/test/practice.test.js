"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");
const { normalizeSystem } = require("../logic");
const { ensurePractice, parameterLines, recordAnswer, shouldShowPredict, continueCards } = require("../practice");

const SYSTEM = {
  system_name: "Health And Damage",
  cpp_header: "class UHealth {\n  int MaxHealth;\n};\n",
  cpp_source: "void UHealth::Begin() {\n  MaxHealth = 100;\n}\n",
  tunable_parameters: [{ key: "MaxHealth", label: "Max Health", value: 100 }],
  modules: [{ name: "Regen", included: true }],
  node_graph_nodes: [{ id: "n1", label: "Begin" }],
  learning: { challenges: [{ title: "Who owns health", detail: "The component." }] },
};

function gemini(text) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function boot(fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-practice-"));
  const handle = await startServer({
    dataDir,
    port: 0,
    fetchImpl: fetchImpl || (async () => gemini("A timer runs once. Tick runs every frame.")),
    sleep: () => Promise.resolve(),
    staticDir: path.join(__dirname, "missing-ui"),
  });
  return { handle, base: `http://127.0.0.1:${handle.port}`, dataDir };
}

test("minimal hides predict and a parameter maps to a real line", async () => {
  const ui = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "practice.mjs")).href);
  assert.equal(shouldShowPredict("learning"), true);
  assert.equal(shouldShowPredict("minimal"), false);
  assert.equal(ui.shouldShowPredict("minimal"), false);
  assert.equal(ui.shouldShowPredict("standard"), false);
  const lines = parameterLines(SYSTEM, "MaxHealth");
  assert.ok(lines.some((line) => line.file === ".h" && line.line === 2));
  assert.ok(ui.parameterLines(SYSTEM, "MaxHealth").some((line) => line.line === 2));
  const snake = parameterLines({ ...SYSTEM, tunable_parameters: [{ key: "max_health", label: "Max Health" }] }, "max_health");
  assert.ok(snake.some((line) => line.file === ".h" && line.line === 2));
  const practiced = ensurePractice(SYSTEM.learning, SYSTEM);
  assert.ok(practiced.challenges[0].choices.length >= 2);
  assert.ok(practiced.parameter_impacts[0].lines.length >= 1);
  assert.ok(practiced.what_ifs[0].variants.length >= 2);
});

test("an old project without practice fields still opens", () => {
  const old = normalizeSystem({
    system_name: "Legacy Shield",
    summary: "Blocks.",
    blueprint_pseudocode: "Event Block",
    cpp_header: "class UShield {};",
    cpp_source: "void UShield::Block() {}",
    setup_guide: [{ step: 1, title: "Add" }],
    node_graph_nodes: [{ id: "n1", label: "Block" }],
  }, []);
  assert.equal(old.learning, undefined);
  const practiced = ensurePractice(old.learning, old);
  assert.equal(practiced.challenges.length, 0);
  assert.doesNotThrow(() => parameterLines(old, "missing"));
});

test("progress survives backup and import", async () => {
  const source = await boot();
  const fresh = await boot();
  try {
    const saved = await (await fetch(`${source.base}/api/progress/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_name: "Health And Damage", challenge_index: 0, correct: true }),
    })).json();
    assert.equal(saved.answered.length, 1);
    assert.equal(continueCards(saved)[0].label, "Continue Health And Damage");
    const backup = await (await fetch(`${source.base}/api/library/export`)).json();
    assert.equal(backup.progress.answered[0].system_name, "Health And Damage");
    const imported = await (await fetch(`${fresh.base}/api/library/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...backup, projects: [], presets: [] }),
    })).json();
    assert.equal(imported.progress, 1);
    const again = await (await fetch(`${fresh.base}/api/progress`)).json();
    assert.equal(again.answered[0].system_name, "Health And Damage");
    assert.equal(again.practiced[0].count, 1);
  } finally {
    await source.handle.close();
    await fresh.handle.close();
  }
});

test("explaining one compare block is a single request", async () => {
  let calls = 0;
  const { handle, base } = await boot(async () => {
    calls += 1;
    return gemini("The new line resets the combo when the window is missed.");
  });
  try {
    await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.5-flash-lite", key: "unit-test-key" }),
    });
    const res = await fetch(`${base}/api/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ before: "ComboIndex++;", after: "if (Late) ComboIndex = 1;" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.explanation, /combo/);
    assert.equal(calls, 1);
  } finally {
    await handle.close();
  }
});

test("a revealed system is still there after a restart", async () => {
  const ui = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "practice.mjs")).href);
  const memory = new Map();
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
  };
  const draft = { result: SYSTEM, prompt: "A health component" };
  const reveal = { node_ids: ["n1"], lines: [{ file: ".h", line: 2 }], why_id: "n1" };
  ui.saveWorkspace(storage, draft, reveal, 1);
  const loaded = ui.loadWorkspace(storage);
  assert.equal(loaded.draft.result.system_name, "Health And Damage");
  assert.deepEqual(loaded.reveal.node_ids, ["n1"]);
  assert.equal(loaded.learnIndex, 1);
  const progress = recordAnswer(null, { system_name: "Health And Damage", challenge_index: 0, correct: true });
  assert.equal(progress.answered.length, 1);
});
