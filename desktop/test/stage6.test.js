"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");
const { detectEngine, parseCompilerOutput, compilePlugin, runUatFile } = require("../engine");
const { checkConstraints, constraintText } = require("../constraints");
const { stackMap } = require("../stackMap");
const { estimateCost } = require("../cost");
const { buildUserText, normalizeSystem, TEMPLATES } = require("../logic");
const { attachStarters } = require("../templateLearning");
const { requestFor, textFromJson } = require("../llm");
const { writePlugin } = require("../pluginFiles");

const SAMPLE = {
  system_name: "Health And Damage",
  summary: "Tracks health.",
  tunable_parameters: [{ key: "max_health", label: "Max Health", value: 100, min: 1, max: 1000, step: 1, unit: "HP" }],
  modules: [{ name: "Regen", included: true, description: "restores health" }],
  blueprint_pseudocode: "Event BeginPlay\n  WHY: start full",
  cpp_header: "UCLASS()\nclass UHealth : public UActorComponent {\n  GENERATED_BODY()\npublic:\n  UPROPERTY() int32 MaxHealth;\n};\n",
  cpp_source: "void UHealth::BeginPlay() { MaxHealth = 100; }\n",
  setup_guide: [{ step: 1, title: "Add", detail: "Drop it on", why: "reusable" }],
  node_graph_nodes: [{ id: "n1", label: "Event BeginPlay", node_type: "event", x: 80, y: 120, inputs: [], outputs: ["exec"] }],
  node_graph_edges: [],
  network_notes: "Local only.",
  applied_changes: [],
  shared_attributes: ["Health"],
};

const LEARNING = {
  challenges: [
    { title: "Where it lives", detail: "On the pawn." },
    { title: "What it should not do", detail: "Do not tick." },
  ],
  why_notes: [],
  parameter_effects: [{ key: "max_health", effect: "Sets the cap." }],
};

const TEST_CODE = `#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
BEGIN_DEFINE_SPEC(FHealthSpec, "SystemArchitect.Health", EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
END_DEFINE_SPEC(FHealthSpec)
void FHealthSpec::Define() { It("starts full", [this]{ TestTrue("ok", true); }); }
#endif
`;

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function envelope(url, text) {
  const host = new URL(url).host;
  if (host.includes("anthropic")) return jsonResponse({ content: [{ type: "text", text }], stop_reason: "end_turn" });
  if (host.includes("11434")) return jsonResponse({ message: { content: text }, done: true, done_reason: "stop" });
  if (host.includes("googleapis")) return jsonResponse({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
  return jsonResponse({ choices: [{ message: { content: text }, finish_reason: "stop" }] });
}

function payloadFor(body) {
  const raw = JSON.stringify(body);
  if (raw.includes("Say OK")) return "OK";
  if (raw.includes("Write the teaching JSON")) return JSON.stringify(LEARNING);
  if (raw.includes("KNOWN ISSUES")) return JSON.stringify({ issues: [{ severity: "warning", file: ".h", line: 1, message: "Check the include.", fix: "Add CoreMinimal.h" }] });
  if (raw.includes("ISSUES:")) return JSON.stringify({ edits: [{ file: ".h", find: "int32 MaxHealth;", replace: "int32 MaxHealth = 100;", why: "default" }] });
  if (raw.includes("automation tests")) return JSON.stringify({ file_name: "HealthSpec.cpp", code: TEST_CODE, cases: ["starts full"] });
  if (raw.includes("Do not declare or define Tick")) {
    return JSON.stringify({ ...SAMPLE, confidence: "low", alternative: "Drive it with a timer instead of a tick." });
  }
  return JSON.stringify({
    ...SAMPLE,
    cpp_header: `${SAMPLE.cpp_header}\nvoid Tick(float Delta);`,
    cpp_source: "void UHealth::Tick(float) { MaxHealth = 1; }\n",
  });
}

async function boot(fetchImpl, extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-stage6-"));
  const handle = await startServer({
    dataDir,
    port: 0,
    fetchImpl,
    sleep: () => Promise.resolve(),
    staticDir: path.join(__dirname, "missing-ui"),
    ...extra,
  });
  return { handle, base: `http://127.0.0.1:${handle.port}`, dataDir };
}

async function json(res) {
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail));
    err.status = res.status;
    throw err;
  }
  return body;
}

async function waitJob(base, id) {
  let job;
  for (let i = 0; i < 40; i += 1) {
    job = await json(await fetch(`${base}/api/generate/${id}`));
    if (job.status !== "running") return job;
    await new Promise((r) => setTimeout(r, 10));
  }
  return job;
}

test("engine detection prefers 5.8, falls back to 5.7, and says when nothing is installed", () => {
  const epic = path.join("/opt", "Epic Games");
  const installed = new Set(["5.7"]);
  const exists = (file) => [...installed].some((version) => file === runUatFile(path.join(epic, `UE_${version}`), "linux"));
  const readdir = (dir) => (dir === epic ? [...installed].map((version) => `UE_${version}`) : []);
  const fallback = detectEngine({ platform: "linux", env: { HOME: "/none" }, override: "", exists, readdir });
  assert.equal(fallback.found, true);
  assert.equal(fallback.version, "5.7");
  installed.add("5.8");
  const preferred = detectEngine({ platform: "linux", env: { HOME: "/none" }, override: "", exists, readdir });
  assert.equal(preferred.version, "5.8");
  const missing = detectEngine({
    platform: "linux",
    env: { HOME: "/none" },
    override: "",
    exists: () => false,
    readdir: () => [],
  });
  assert.equal(missing.found, false);
  assert.match(missing.message, /No Unreal Engine was found/);
  const custom = "/engines/Custom";
  const customFound = detectEngine({
    platform: "linux",
    env: {},
    override: custom,
    exists: (file) => file === runUatFile(custom, "linux"),
    readdir: () => [],
  });
  assert.equal(customFound.found, true);
  assert.equal(customFound.path, custom);
});

test("a compiler log becomes issues, and a missing engine does not spawn the build tool", async () => {
  const issues = parseCompilerOutput([
    "Health.cpp(12): error C2065: 'Nope': undeclared identifier",
    "Health.h:4:1: warning: unused variable",
  ].join("\n"));
  assert.equal(issues[0].severity, "error");
  assert.equal(issues[0].line, 12);
  assert.equal(issues[1].severity, "warning");
  assert.equal(issues[1].file, ".h");

  let spawned = false;
  const none = await compilePlugin({
    system: SAMPLE,
    engineRoot: path.join(os.tmpdir(), "missing-engine"),
    platform: "linux",
    workDir: fs.mkdtempSync(path.join(os.tmpdir(), "ue5-build-")),
    spawnImpl: () => { spawned = true; throw new Error("should not spawn"); },
  });
  assert.equal(none.found, false);
  assert.equal(spawned, false);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-uat-"));
  const engine = path.join(root, "UE_5.8");
  fs.mkdirSync(path.join(engine, "Engine", "Build", "BatchFiles"), { recursive: true });
  fs.writeFileSync(runUatFile(engine, "linux"), "#!/bin/sh\n");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-work-"));
  const built = await compilePlugin({
    system: SAMPLE,
    engineRoot: engine,
    platform: "linux",
    workDir: work,
    spawnImpl: () => ({
      stdout: { on(ev, fn) { if (ev === "data") fn(Buffer.from("Health.cpp(3): error C2065: 'Nope': undeclared identifier\n")); } },
      stderr: { on() {} },
      on(ev, fn) { if (ev === "close") fn(1); },
    }),
  });
  assert.equal(built.found, true);
  assert.equal(built.version, "5.8");
  assert.equal(built.issues[0].message.includes("Nope"), true);

  const thrown = await compilePlugin({
    system: SAMPLE,
    engineRoot: engine,
    platform: "linux",
    workDir: fs.mkdtempSync(path.join(os.tmpdir(), "ue5-throw-")),
    spawnImpl: () => { throw new Error("The network path was not found."); },
  });
  assert.equal(thrown.ok, false);
  assert.match(thrown.message, /network path was not found/);
  assert.match(thrown.log, /network path was not found/);
  assert.match(thrown.issues[0].message, /network path was not found/);
});

test("export copies a plugin into the project's Plugins folder", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-game-"));
  const uproject = path.join(dir, "Game.uproject");
  fs.writeFileSync(uproject, JSON.stringify({ FileVersion: 3, EngineAssociation: "5.8" }));
  const { handle, base } = await boot(async () => jsonResponse({}));
  try {
    const copied = await json(await fetch(`${base}/api/export/to-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uproject, system: SAMPLE }),
    }));
    assert.equal(fs.existsSync(path.join(copied.path, `${copied.plugin}.uplugin`)), true);
    assert.match(fs.readFileSync(path.join(copied.path, "Source", copied.plugin, "Public", "Health.h"), "utf8"), /MaxHealth/);
  } finally {
    await handle.close();
  }
});

test("no Tick stays out of a re-synthesis when that lock is on, and a Tick is flagged", async () => {
  const prompt = buildUserText({
    prompt: "A health component",
    blueprint_class: "ActorComponent",
    complexity: 10,
    modularity: 10,
    performance_vs_flexibility: 10,
    tick_rate: 0,
    network_replicated: false,
    locks: ["no_tick"],
    extra_modules: [],
    removed_modules: [],
    parameter_overrides: {},
    change_requests: [],
    stack_systems: [],
  }, []);
  assert.match(prompt, /Do not declare or define Tick/);
  assert.equal(constraintText(["no_tick"]).includes("No Tick"), true);

  let seen = "";
  const { handle, base } = await boot(async (url, opts) => {
    const body = JSON.parse(opts.body);
    seen = JSON.stringify(body);
    return envelope(url, payloadFor(body));
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
      body: JSON.stringify({ prompt: "A health component for a character", locks: ["no_tick", "not-a-lock"] }),
    }));
    const job = await waitJob(base, started.job_id);
    assert.equal(job.status, "done");
    assert.equal(/Tick/.test(job.result.cpp_header + job.result.cpp_source), false);
    assert.deepEqual(job.result.constraint_violations, []);
    assert.match(seen, /Do not declare or define Tick/);
    const flagged = checkConstraints({
      cpp_header: "void Tick(float DeltaSeconds);",
      cpp_source: "void UHealth::Tick(float) {}",
    }, ["no_tick"]);
    assert.equal(flagged[0].id, "no_tick");
    const authority = checkConstraints({ cpp_header: "", cpp_source: "void Run() {}" }, ["server_authority"]);
    assert.equal(authority[0].id, "server_authority");
    assert.equal(checkConstraints({ cpp_header: "", cpp_source: "if (HasAuthority()) Run();" }, ["server_authority"]).length, 0);
  } finally {
    await handle.close();
  }
});

test("stacking reports a shared interface and a class clash", () => {
  const map = stackMap([
    {
      system_name: "Interaction",
      cpp_header: "class IInteractable { void Interact(); };\nclass UHealthComponent { UPROPERTY() float Health; };",
    },
    {
      system_name: "Inventory",
      cpp_header: "class IInteractable { void Interact(); };\nclass UHealthComponent { UPROPERTY() float Health; };",
    },
  ]);
  assert.ok(map.shared.some((item) => item.kind === "interface" && item.name === "IInteractable"));
  assert.ok(map.shared.some((item) => item.kind === "attribute" && item.name === "Health"));
  assert.ok(map.conflicts.some((item) => item.name === "UHealthComponent"));
});

test("a low-confidence reply keeps the alternative", () => {
  const system = normalizeSystem({ ...SAMPLE, confidence: "low", alternative: "Use a timer." }, []);
  assert.equal(system.confidence, "low");
  assert.equal(system.alternative, "Use a timer.");
  assert.equal(normalizeSystem(SAMPLE, []).confidence, "high");
  assert.equal(normalizeSystem(SAMPLE, []).alternative, "");
});

test("paid models have an estimate and local or free models do not", () => {
  const paid = estimateCost("claude-sonnet-4-5", "synthesis");
  assert.equal(paid.usd, 0.06);
  assert.match(paid.text, /About \$0\.06/);
  assert.equal(estimateCost("gemini-3.5-flash-lite", "synthesis"), null);
  assert.equal(estimateCost("llama3.2", "synthesis"), null);
});

test("Anthropic, OpenRouter, and Ollama each synthesize, teach, review, fix, and test", async () => {
  const providers = [
    { provider: "anthropic", model: "claude-haiku-4-5", host: "api.anthropic.com", header: "x-api-key" },
    { provider: "openrouter", model: "openai/gpt-4.1-mini", host: "openrouter.ai", header: "authorization" },
    { provider: "ollama", model: "llama3.2", host: "127.0.0.1:11434", header: "" },
  ];
  for (const spec of providers) {
    const seen = [];
    const { handle, base } = await boot(async (url, opts) => {
      seen.push(url);
      assert.equal(String(url).includes("unit-test-key"), false);
      const body = JSON.parse(opts.body);
      if (spec.header) assert.equal(opts.headers[spec.header] || opts.headers[spec.header[0].toUpperCase() + spec.header.slice(1)], spec.header === "authorization" ? "Bearer unit-test-key" : "unit-test-key");
      return envelope(url, payloadFor(body));
    });
    try {
      const settings = { provider: spec.provider, model: spec.model };
      if (spec.provider !== "ollama") settings.key = "unit-test-key";
      const saved = await json(await fetch(`${base}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }));
      assert.equal(JSON.stringify(saved).includes("unit-test-key"), false);
      const started = await json(await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "A health component for a character" }),
      }));
      const job = await waitJob(base, started.job_id);
      assert.equal(job.status, "done", spec.provider);
      assert.equal(job.result.system_name, "Health And Damage");
      assert.ok(seen.some((url) => url.includes(spec.host)), spec.provider);

      const learned = await json(await fetch(`${base}/api/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: job.result }),
      }));
      assert.ok(learned.learning.challenges.length >= 2);

      const review = await json(await fetch(`${base}/api/ai/review-cpp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpp_header: SAMPLE.cpp_header, cpp_source: SAMPLE.cpp_source, file_base: "Health" }),
      }));
      assert.equal(review.issues.length, 1);
      assert.equal(review.model, spec.model);

      const fixed = await json(await fetch(`${base}/api/ai/fix-cpp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpp_header: SAMPLE.cpp_header,
          cpp_source: SAMPLE.cpp_source,
          file_base: "Health",
          issues: ["Give MaxHealth a default"],
        }),
      }));
      assert.match(fixed.cpp_header, /MaxHealth = 100/);

      const tests = await json(await fetch(`${base}/api/ai/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpp_header: SAMPLE.cpp_header, cpp_source: SAMPLE.cpp_source, file_base: "Health" }),
      }));
      assert.match(tests.code, /BEGIN_DEFINE_SPEC/);
      assert.deepEqual(tests.cases, ["starts full"]);
    } finally {
      await handle.close();
    }
  }
});

test("provider requests keep the key out of the URL", () => {
  const anthropic = requestFor({
    provider: "anthropic",
    model: "claude-haiku-4-5",
    apiKey: "unit-test-key",
    system: "sys",
    user: "hi",
    maxTokens: 20,
  });
  assert.equal(anthropic.url.includes("unit-test-key"), false);
  assert.equal(anthropic.headers["x-api-key"], "unit-test-key");
  assert.equal(textFromJson("anthropic", { content: [{ text: "OK" }] }), "OK");

  const router = requestFor({
    provider: "openrouter",
    model: "openai/gpt-4.1-mini",
    apiKey: "unit-test-key",
    system: "sys",
    user: "hi",
    maxTokens: 20,
    stream: false,
  });
  assert.equal(router.url.includes("unit-test-key"), false);
  assert.equal(router.headers.Authorization, "Bearer unit-test-key");

  const local = requestFor({
    provider: "ollama",
    model: "llama3.2",
    apiKey: "local",
    system: "sys",
    user: "hi",
    maxTokens: 20,
    stream: true,
  });
  assert.match(local.url, /127\.0\.0\.1:11434/);
  assert.equal(local.body.stream, false);
  assert.equal(local.headers.Authorization, undefined);
});

test("the eight template starters pass the C++ pattern check", async () => {
  const raw = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "lib", "compileCheck.js"), "utf8");
  const shim = `function baseName(system) {
  const gen = (system.cpp_header || "").match(/#include\\s+"([\\w]+)\\.generated\\.h"/);
  if (gen) return gen[1];
  return "System";
}
function headerClasses(header) {
  const code = (header || "").replace(/\\/\\*[\\s\\S]*?\\*\\//g, "").replace(/\\/\\/.*$/gm, "");
  return [...code.matchAll(/\\b(?:class|struct)\\s+(?:\\w+_API\\s+)?([UAFIE][A-Z]\\w*)\\s*(?:final\\s*)?[:{]/g)].map((m) => m[1]);
}`;
  const file = path.join(os.tmpdir(), `ue5-stage6-check-${process.pid}.mjs`);
  fs.writeFileSync(file, raw.replace('import { baseName, headerClasses } from "./zipExport";', shim));
  const { checkSystem } = await import(pathToFileURL(file).href);
  const templates = attachStarters(TEMPLATES);
  assert.equal(templates.length, 8);
  for (const template of templates) {
    const errors = checkSystem(template.starter).filter((issue) => issue.severity === "error");
    assert.deepEqual(errors, [], template.id);
  }
});

test("the export readme says what to expect, how to make a test map, and the first errors", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "unrealHandoff.mjs")).href);
  const text = mod.unrealHandoff();
  assert.match(text, /What to expect in Unreal/);
  assert.match(text, /A minimal test map/);
  assert.match(text, /Common first errors/);
  assert.match(text, /UE 5\.8/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-plugin-"));
  const written = writePlugin(dir, SAMPLE);
  assert.equal(fs.existsSync(written.uplugin), true);
});

test("the compile route reports a missing engine without calling the build tool", async () => {
  let spawned = false;
  const { handle, base } = await boot(async () => jsonResponse({}), {
    spawnImpl: () => { spawned = true; throw new Error("no"); },
  });
  try {
    const status = await json(await fetch(`${base}/api/engine`));
    assert.equal(status.found, false);
    assert.match(status.message, /No Unreal Engine was found/);
    const compiled = await json(await fetch(`${base}/api/engine/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SAMPLE }),
    }));
    assert.equal(compiled.found, false);
    assert.equal(spawned, false);
  } finally {
    await handle.close();
  }
});
