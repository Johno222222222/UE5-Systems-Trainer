"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startServer } = require("../server");

const SAMPLE = {
  system_name: "Health And Damage",
  summary: "Tracks health and applies damage.",
  tunable_parameters: [{ key: "max_health", label: "Max Health", value: 100, min: 1, max: 1000, step: 1, unit: "HP" }],
  modules: [{ name: "Regen", included: true, description: "restores health" }],
  blueprint_pseudocode: "Event BeginPlay\n  WHY: start at full health",
  cpp_header: "UCLASS()\nclass UHealth : public UActorComponent {\n  GENERATED_BODY()\npublic:\n  UPROPERTY() int32 MaxHealth;\n};\n",
  cpp_source: "void UHealth::BeginPlay() { MaxHealth = 100; }\n",
  setup_guide: [{ step: 1, title: "Add the component", detail: "Drop it on the character", why: "keeps health reusable" }],
  node_graph_nodes: [{ id: "n1", label: "Event BeginPlay", node_type: "event", x: 80, y: 120, inputs: [], outputs: ["exec"] }],
  node_graph_edges: [],
  network_notes: "Local only.",
  applied_changes: ["Set max health to 100"],
  shared_attributes: [],
};

function geminiResponse(text) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text }] } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function boot(fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-api-"));
  const handle = await startServer({
    dataDir,
    port: 0,
    fetchImpl,
    sleep: () => Promise.resolve(),
    staticDir: path.join(__dirname, "missing-ui"),
  });
  const base = `http://127.0.0.1:${handle.port}`;
  return { handle, base, dataDir };
}

async function json(res) {
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

test("generation uses the stored key, retries a busy Gemini model, and saves versions", async () => {
  let calls = 0;
  let seen = null;
  const { handle, base } = await boot(async (url, opts) => {
    calls += 1;
    seen = { url, headers: opts.headers, body: JSON.parse(opts.body) };
    if (calls < 3) {
      return new Response(JSON.stringify({ error: { message: "The model is overloaded." } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    const reply = calls === 3 ? JSON.stringify(SAMPLE) : "OK";
    return geminiResponse(reply);
  });
  try {
    const noKey = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A health component for a character" }),
    });
    assert.equal(noKey.status, 400);
    assert.equal(calls, 0);

    const settings = await json(await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.5-flash-lite", key: "unit-test-key" }),
    }));
    assert.equal(settings.keys.gemini, true);
    assert.equal(settings.key_storage, "file");
    assert.equal(JSON.stringify(settings).includes("unit-test-key"), false);

    const file = new File(["int Health = 100;\n"], "Health.h", { type: "text/plain" });
    const form = new FormData();
    form.set("kind", "reference");
    form.set("file", file);
    const uploaded = await json(await fetch(`${base}/api/files`, { method: "POST", body: form }));
    assert.equal(uploaded.filename, "Health.h");

    const started = await json(await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "A health component for a character",
        blueprint_class: "ActorComponent",
        complexity: 40,
        reference_file_ids: [uploaded.file_id],
      }),
    }));
    let job;
    for (let i = 0; i < 30; i++) {
      job = await json(await fetch(`${base}/api/generate/${started.job_id}`));
      if (job.status !== "running") break;
      await new Promise((r) => setTimeout(r, 15));
    }
    assert.equal(job.status, "done");
    assert.equal(job.result.system_name, "Health And Damage");
    assert.equal(JSON.stringify(job).includes("unit-test-key"), false);
    assert.equal(seen.url.includes("unit-test-key"), false);
    assert.equal(seen.headers["x-goog-api-key"], "unit-test-key");
    assert.match(seen.url, /generativelanguage\.googleapis\.com/);
    assert.match(seen.body.contents[0].parts[0].text, /Health\.h/);
    assert.match(seen.body.contents[0].parts[0].text, /int Health = 100/);
    assert.equal(calls, 3);

    const project = await json(await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Health", system: job.result, context: { prompt: "A health component" }, note: "First save" }),
    }));
    assert.equal(project.version, 1);
    assert.equal(project.my_role, "owner");

    const saved = await json(await fetch(`${base}/api/projects/${project.project_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: { ...job.result, summary: "Revised health" },
        context: { prompt: "A health component" },
        note: "Tuned the summary",
        base_version: 1,
        fixes: [],
      }),
    }));
    assert.equal(saved.version, 2);

    const conflict = await fetch(`${base}/api/projects/${project.project_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: job.result, context: {}, base_version: 1 }),
    });
    assert.equal(conflict.status, 409);

    const versions = await json(await fetch(`${base}/api/projects/${project.project_id}/versions`));
    assert.deepEqual(versions.versions.map((v) => v.version), [2, 1]);
    assert.equal(versions.versions[0].note, "Tuned the summary");
    const older = await json(await fetch(`${base}/api/projects/${project.project_id}/versions/1`));
    assert.equal(older.system.summary, SAMPLE.summary);
    assert.notEqual(older.system.summary, "Revised health");

    const restored = await json(await fetch(`${base}/api/projects/${project.project_id}/versions/1/restore`, { method: "POST" }));
    assert.equal(restored.version, 3);
    assert.equal(restored.system.summary, SAMPLE.summary);

    const labeled = await json(await fetch(`${base}/api/projects/${project.project_id}/versions/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Ship candidate" }),
    }));
    assert.equal(labeled.label, "Ship candidate");

    const backup = await json(await fetch(`${base}/api/library/export`));
    assert.equal(backup.format, "ue5-architect-library");
    assert.equal(backup.projects.length, 1);
    assert.ok(backup.versions.length >= 3);

    const imported = await json(await fetch(`${base}/api/library/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: backup }),
    }));
    assert.equal(imported.imported, 1);
    const list = await json(await fetch(`${base}/api/projects`));
    assert.equal(list.mine.length, 2);
    assert.equal(list.shared.length, 0);

    const usage = await json(await fetch(`${base}/api/usage/today`));
    assert.ok(usage.models["gemini-3.5-flash-lite"].used >= 3);
    assert.equal(usage.free_limits["gemini-3.5-flash-lite"], 500);

    const tested = await json(await fetch(`${base}/api/ai/test-key`, { method: "POST" }));
    assert.equal(tested.ok, true);
  } finally {
    await handle.close();
  }
});

test("fix-cpp applies a model patch and refuses a patch that does not match", async () => {
  let mode = "good";
  const { handle, base } = await boot(async () => {
    if (mode === "good") {
      return geminiResponse(JSON.stringify({
        edits: [{ file: ".h", find: "int Health;", replace: "int Health = 100;", why: "initialize" }],
      }));
    }
    return geminiResponse(JSON.stringify({
      edits: [{ file: ".h", find: "this text is not in the file", replace: "nope", why: "miss" }],
    }));
  });
  try {
    await json(await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.1-flash-lite", key: "unit-test-key" }),
    }));
    const fixed = await json(await fetch(`${base}/api/ai/fix-cpp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpp_header: "class UHealth {\n  int Health;\n};\n",
        cpp_source: "void UHealth::BeginPlay() {}\n",
        issues: ["Initialize Health"],
      }),
    }));
    assert.match(fixed.cpp_header, /int Health = 100;/);
    assert.equal(fixed.changes[0].why, "initialize");
    mode = "bad";
    const missed = await fetch(`${base}/api/ai/fix-cpp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpp_header: "class UHealth {\n  int Health;\n};\n",
        cpp_source: "void UHealth::BeginPlay() {}\n",
        issues: ["Nope"],
      }),
    });
    assert.equal(missed.status, 422);
    const detail = (await missed.json()).detail;
    assert.equal(detail.code, "patch_failed");
  } finally {
    await handle.close();
  }
});

test("openai calls use the chat completions endpoint and the bearer key", async () => {
  let seen = null;
  const { handle, base } = await boot(async (url, opts) => {
    seen = { url, headers: opts.headers, body: JSON.parse(opts.body) };
    return new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "OK" } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  try {
    await json(await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", model: "gpt-4.1-mini", key: "sk-unit" }),
    }));
    const tested = await json(await fetch(`${base}/api/ai/test-key`, {
      method: "POST",
      headers: { "X-LLM-Provider": "openai", "X-LLM-Model": "gpt-4.1", "X-LLM-Key": "sk-override" },
    }));
    assert.equal(tested.ok, true);
    assert.equal(seen.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(seen.headers.Authorization, "Bearer sk-override");
    assert.equal(seen.body.model, "gpt-4.1");
    const saved = await json(await fetch(`${base}/api/settings`));
    assert.equal(saved.provider, "openai");
    assert.equal(saved.model, "gpt-4.1-mini");
  } finally {
    await handle.close();
  }
});

test("templates, presets, and project delete stay local", async () => {
  const { handle, base } = await boot(async () => geminiResponse("OK"));
  try {
    const templates = await json(await fetch(`${base}/api/templates`));
    assert.equal(templates.templates.length, 8);
    const project = await json(await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "One",
        system: { ...SAMPLE, system_name: "One" },
        context: {},
      }),
    }));
    const other = await json(await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Two",
        system: { ...SAMPLE, system_name: "Two" },
        context: {},
      }),
    }));
    const preset = await json(await fetch(`${base}/api/bundle-presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Combat kit", plugin_name: "CombatKit", project_ids: [project.project_id, other.project_id] }),
    }));
    assert.equal(preset.mine, true);
    await json(await fetch(`${base}/api/projects/${project.project_id}`, { method: "DELETE" }));
    const list = await json(await fetch(`${base}/api/projects`));
    assert.equal(list.mine.length, 1);
    const opened = await fetch(`${base}/api/projects/${project.project_id}`);
    assert.equal(opened.status, 404);
  } finally {
    await handle.close();
  }
});
