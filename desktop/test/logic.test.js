"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  extractJson,
  applyEdits,
  replaceLinesLoose,
  classifyError,
  normalizeSystem,
  usageDay,
  buildUserText,
  normalizeGenerateRequest,
  promptsFor,
  normalizeUnrealVersion,
  releaseNotice,
  UNREAL_VERSIONS,
  DEFAULT_UNREAL_VERSION,
  LEGACY_UNREAL_VERSION,
} = require("../logic");
const { createSecrets } = require("../secrets");
const { requestFor } = require("../llm");

test("extractJson strips fences and surrounding prose", () => {
  const raw = "Sure!\n```json\n{\"system_name\":\"Health\"}\n```\n";
  assert.equal(extractJson(raw).system_name, "Health");
  assert.equal(extractJson("prefix {\"a\":1} suffix").a, 1);
});

test("applyEdits uses an exact unique match, then a whitespace-tolerant one", () => {
  const files = { ".h": "class A {\n  int Health;\n};\n", ".cpp": "void A::Tick() {\n    Health = 1;\n}\n" };
  const applied = applyEdits(files, [
    { file: ".h", find: "  int Health;", replace: "  int Health = 100;", why: "default" },
    { file: ".cpp", find: "Health = 1;", replace: "Health = 2;", why: "tabs differ" },
  ]);
  assert.equal(applied.length, 2);
  assert.match(files[".h"], /int Health = 100;/);
  assert.match(files[".cpp"], /Health = 2;/);
});

test("loose replace refuses an ambiguous match and can delete lines", () => {
  assert.throws(() => replaceLinesLoose("int a;\nint a;\n", "int a;", "int b;"), /found 2 times/);
  assert.equal(replaceLinesLoose("keep\ndrop me\nkeep\n", "drop me", ""), "keep\nkeep\n");
});

test("classifyError maps free-tier, quota, and overload", () => {
  const paid = classifyError(Object.assign(new Error("free_tier requests limit: 0"), { status_code: 429 }), "gemini-3.1-pro-preview");
  assert.equal(paid.code, "paid_model_required");
  assert.match(paid.message, /gemini-3.1-pro-preview/);
  assert.equal(classifyError(new Error("insufficient_quota")).code, "no_credits");
  assert.equal(classifyError(Object.assign(new Error("overloaded"), { status_code: 503 })).code, "busy");
  assert.match(classifyError(Object.assign(new Error("API key not valid"), { status_code: 400 })).message, /rejected/);
});

test("normalizeSystem rejects an empty graph and fills ids", () => {
  assert.throws(() => normalizeSystem({ system_name: "X", blueprint_pseudocode: "a", cpp_header: "b", cpp_source: "c" }, []));
  const out = normalizeSystem({
    system_name: "Health",
    blueprint_pseudocode: "Event BeginPlay",
    cpp_header: "class A {};",
    cpp_source: "void A::BeginPlay() {}",
    setup_guide: [{ step: 1, title: "Add" }],
    node_graph_nodes: [{ id: "n1" }],
  }, [{ system_name: "Stamina" }]);
  assert.equal(out.stacked_from[0], "Stamina");
  assert.ok(out.id);
});

test("buildUserText includes context, changes, and reference names", () => {
  const text = buildUserText({
    prompt: "Add a shield",
    blueprint_class: "ActorComponent",
    complexity: 10,
    modularity: 20,
    performance_vs_flexibility: 30,
    tick_rate: 0,
    network_replicated: false,
    project_context: "Multiplayer shooter",
    change_requests: ["Remove regen"],
    previous_system: { system_name: "Health", modules: [], tunable_parameters: [] },
    stack_systems: [],
    extra_modules: [],
    removed_modules: [],
    parameter_overrides: {},
    designer_notes: "",
  }, [{ filename: "Notes.md", text: "use tags" }]);
  assert.match(text, /Multiplayer shooter/);
  assert.match(text, /1\. Remove regen/);
  assert.match(text, /Notes\.md/);
  assert.match(text, /use tags/);
  assert.match(text, /TARGET ENGINE: UE 5\.8/);
  assert.match(text, /Target Unreal version: UE 5\.8/);
});

test("usage day is a Pacific calendar date", () => {
  assert.match(usageDay(new Date("2026-01-15T12:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("provider requests keep the key out of the URL", () => {
  const gemini = requestFor({
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    apiKey: "unit-test-key",
    system: "sys",
    user: "hi",
    images: [{ mime: "image/png", base64: "aaa" }],
    maxTokens: 100,
    stream: true,
  });
  assert.match(gemini.url, /streamGenerateContent/);
  assert.equal(gemini.url.includes("unit-test-key"), false);
  assert.equal(gemini.headers["x-goog-api-key"], "unit-test-key");
  assert.equal(gemini.body.contents[0].parts[1].inlineData.mimeType, "image/png");

  const mini = requestFor({
    provider: "openai", model: "gpt-4.1-mini", apiKey: "sk-test", system: "s", user: "u", maxTokens: 50, stream: false,
  });
  assert.equal(mini.body.max_tokens, 50);
  assert.equal(mini.body.temperature, 0.7);
  assert.equal(mini.headers.Authorization, "Bearer sk-test");

  const gpt5 = requestFor({
    provider: "openai", model: "gpt-5-mini", apiKey: "sk-test", system: "s", user: "u", maxTokens: 50, stream: true,
  });
  assert.equal(gpt5.body.max_completion_tokens, 50);
  assert.equal(gpt5.body.temperature, undefined);
  assert.equal(gpt5.body.stream, true);
});

test("secrets round-trip with the file cipher and a fake OS cipher", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-secrets-"));
  const file = path.join(dir, "secrets.json");
  const keyFile = path.join(dir, "secret.key");
  const secrets = createSecrets(file, keyFile, null);
  secrets.setSelection("gemini", "gemini-3.5-flash-lite");
  secrets.setKey("gemini", "AIza-local-test");
  const again = createSecrets(file, keyFile, null);
  assert.equal(again.getKey("gemini"), "AIza-local-test");
  assert.equal(again.publicView(dir).keys.gemini, true);
  assert.equal(again.publicView(dir).keys.openai, false);
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8"))).includes("AIza-local-test"), false);

  const osDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-os-"));
  const codec = {
    available: () => true,
    encrypt: (plain) => ({ encoding: "safe", payload: Buffer.from(`os:${plain}`).toString("base64") }),
    decrypt: (blob) => Buffer.from(blob.payload, "base64").toString("utf8").replace(/^os:/, ""),
  };
  const wrapped = createSecrets(path.join(osDir, "secrets.json"), path.join(osDir, "secret.key"), codec);
  wrapped.setSelection("openai", "gpt-4.1-mini");
  wrapped.setKey("openai", "sk-test");
  assert.equal(wrapped.keyStorage(), "os");
  const stored = JSON.parse(fs.readFileSync(path.join(osDir, "secrets.json"), "utf8"));
  assert.equal(stored.keys.openai.encoding, "safe");
  assert.equal(createSecrets(path.join(osDir, "secrets.json"), path.join(osDir, "secret.key"), codec).getKey("openai"), "sk-test");
});

test("prompts name the selected Unreal version and drop the old 5.4 default", () => {
  assert.deepEqual(UNREAL_VERSIONS, ["5.4", "5.5", "5.6", "5.7", "5.8"]);
  assert.equal(DEFAULT_UNREAL_VERSION, "5.8");
  assert.equal(LEGACY_UNREAL_VERSION, "5.4");
  assert.equal(normalizeUnrealVersion("UE 5.7+"), "5.7");
  assert.equal(normalizeUnrealVersion("nope"), null);

  for (const version of UNREAL_VERSIONS) {
    const prompts = promptsFor(version);
    assert.equal(prompts.version, version);
    for (const text of [prompts.system, prompts.review, prompts.fix, prompts.tests]) {
      assert.match(text, new RegExp(version.replace(".", "\\.")));
      assert.equal(text.includes("{UNREAL}"), false);
      assert.equal(text.includes("{ENGINE}"), false);
      if (version !== "5.4") assert.equal(text.includes("5.4"), false);
    }
  }
  const asked = normalizeGenerateRequest({ prompt: "A shield component", unreal_version: "5.7" });
  assert.equal(asked.unreal_version, "5.7");
  assert.equal(normalizeGenerateRequest({ prompt: "A shield component" }).unreal_version, "5.8");
  assert.equal(normalizeGenerateRequest({ prompt: "A shield component", unreal_version: "5.1" }).unreal_version, "5.8");
});

test("release notice stays quiet unless a newer tag exists", () => {
  assert.equal(releaseNotice("1.0.0", null), null);
  assert.equal(releaseNotice("1.0.0", { tag_name: "v1.0.0" }), null);
  assert.equal(releaseNotice("1.2.0", { tag_name: "v1.1.0" }), null);
  const newer = releaseNotice("1.0.0", { tag_name: "v1.1.0", html_url: "https://github.com/Johno222222222/blueprint-builder/releases/tag/v1.1.0" });
  assert.equal(newer.version, "1.1.0");
  assert.match(newer.url, /v1\.1\.0/);
});
