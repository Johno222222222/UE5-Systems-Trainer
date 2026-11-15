"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startServer } = require("../server");
const {
  assessReply,
  buildUserText,
  codeLooksCut,
  stackSummary,
  TRUNCATED_OUTPUT_MESSAGE,
} = require("../logic");
const { isTruncatedFinish, joinModelText, outputTokenLimit } = require("../llm");

const WHOLE = {
  system_name: "Integrated",
  summary: "merged",
  blueprint_pseudocode: "Event BeginPlay",
  cpp_header: "class A {};",
  cpp_source: "void A() {}",
  setup_guide: [{ step: 1, title: "Add", detail: "d", why: "w" }],
  node_graph_nodes: [{ id: "n1", label: "Begin", node_type: "event", x: 1, y: 1, inputs: [], outputs: [] }],
  node_graph_edges: [],
};

function gemini(text, finishReason) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text }] }, finishReason }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function boot(fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-patch-"));
  const handle = await startServer({
    dataDir,
    port: 0,
    fetchImpl,
    sleep: () => Promise.resolve(),
    staticDir: path.join(__dirname, "missing-ui"),
  });
  return { handle, base: `http://127.0.0.1:${handle.port}` };
}

async function json(res) {
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

test("a length stop is recognised and a repeated tail is joined once", () => {
  assert.equal(isTruncatedFinish("MAX_TOKENS"), true);
  assert.equal(isTruncatedFinish("length"), true);
  assert.equal(isTruncatedFinish("STOP"), false);
  assert.equal(outputTokenLimit("gemini", "gemini-3.5-flash-lite"), 65536);
  assert.equal(outputTokenLimit("openai", "gpt-4.1-mini"), 32768);
  assert.ok(outputTokenLimit("gemini", "gemini-3.5-flash-lite") > 24000);
  const tail = "abcdefghijklmnopqrstuvwxyz0123456789TAIL";
  assert.equal(joinModelText(`{"cpp":"${tail}`, `${tail} more"}`), `{"cpp":"${tail} more"}`);
});

test("stacked systems go in as summaries, not chopped source", () => {
  const text = buildUserText({
    prompt: "Stack the save system with combat",
    blueprint_class: "ActorComponent",
    complexity: 50,
    modularity: 70,
    performance_vs_flexibility: 40,
    tick_rate: 0,
    network_replicated: false,
    stack_systems: [{
      system_name: "Robust Save Load Subsystem",
      summary: "slots and autosave",
      cpp_source: "UNIQUE_SOURCE_MARKER void Secret() { int hidden = 1; }",
      cpp_header: "UCLASS()\nclass USaveGameSlots {\n  UPROPERTY()\n  int32 SlotCount;\n};\n",
      modules: [{ name: "Autosave", included: true, description: "writes on a timer" }],
      tunable_parameters: [{ key: "slots", label: "Slots", value: 3, unit: "" }],
      setup_guide: [{ step: 1, title: "Create the save object" }],
    }],
    extra_modules: [],
    removed_modules: [],
    parameter_overrides: {},
  }, []);
  assert.equal(text.includes("UNIQUE_SOURCE_MARKER"), false);
  assert.match(text, /Robust Save Load Subsystem/);
  assert.match(text, /SlotCount/);
  assert.match(text, /summaries only/);
  const summary = stackSummary({ cpp_header: "class A {", cpp_source: "SECRET_BODY" });
  assert.equal(JSON.stringify(summary).includes("SECRET_BODY"), false);
});

test("unfinished C++ is not treated as a finished reply", () => {
  assert.equal(codeLooksCut({ cpp_header: "class A {", cpp_source: "void A() {}" }), true);
  assert.equal(codeLooksCut({ cpp_header: "class A {};", cpp_source: "void A() {}" }), false);
  assert.equal(assessReply('{"system_name":"A"', { truncated: true }).action, "append");
  const cut = JSON.stringify({ ...WHOLE, cpp_source: "void A() {" });
  assert.equal(assessReply(cut, { truncated: true }).action, "replace");
  assert.equal(assessReply(JSON.stringify(WHOLE), { truncated: false }).action, "accept");
});

test("a truncated reply is continued and not shown until the system is whole", async () => {
  const full = JSON.stringify(WHOLE);
  const splitAt = full.indexOf("void A() {") + "void A() {".length;
  const head = full.slice(0, splitAt);
  const tail = full.slice(splitAt);
  let calls = 0;
  const seen = [];
  const { handle, base } = await boot(async (_url, opts) => {
    calls += 1;
    const body = JSON.parse(opts.body);
    seen.push(body);
    if (calls === 1) return gemini(head, "MAX_TOKENS");
    return gemini(tail, "STOP");
  });
  try {
    await json(await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.5-flash-lite", key: "unit-test-key" }),
    }));
    const started = await json(await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Stack save and combat into one subsystem",
        stack_systems: [{ system_name: "Save", summary: "slots" }, { system_name: "Combat", summary: "hits" }],
      }),
    }));
    let job;
    for (let i = 0; i < 20; i += 1) {
      job = await json(await fetch(`${base}/api/generate/${started.job_id}`));
      if (job.status !== "running") break;
    }
    assert.equal(job.status, "done");
    assert.equal(job.result.system_name, "Integrated");
    assert.equal(job.result.cpp_source, "void A() {}");
    assert.equal(calls, 2);
    assert.equal(seen[0].generationConfig.maxOutputTokens, 65536);
    assert.match(seen[1].contents[0].parts[0].text, /cut off/);
    assert.equal(job.result.cpp_source.includes("{"), true);
  } finally {
    await handle.close();
  }
});

test("a reply that stays cut off is refused instead of shown", async () => {
  const { handle, base } = await boot(async () => gemini('{"system_name":"Cut"', "MAX_TOKENS"));
  try {
    await json(await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.5-flash-lite", key: "unit-test-key" }),
    }));
    const started = await json(await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Stack three large systems" }),
    }));
    let job;
    for (let i = 0; i < 20; i += 1) {
      job = await json(await fetch(`${base}/api/generate/${started.job_id}`));
      if (job.status !== "running") break;
    }
    assert.equal(job.status, "error");
    assert.equal(job.error_code, "truncated");
    assert.equal(job.detail, TRUNCATED_OUTPUT_MESSAGE);
    assert.equal(job.result, undefined);
  } finally {
    await handle.close();
  }
});
