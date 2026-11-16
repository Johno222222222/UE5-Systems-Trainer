"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");

async function load(rel) {
  return import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", rel)).href);
}

const sampleResult = {
  id: "sys-rifle",
  system_name: "Tactical Rifle",
  summary: "Hitscan rifle",
  cpp_header: "class Rifle {};",
  cpp_source: "void Rifle::Fire() {}",
  blueprint_pseudocode: "Event Fire",
  modules: [{ name: "Recoil", included: true }, { name: "ADS", included: false }],
  tunable_parameters: [{ key: "Damage", label: "Damage", value: 20, min: 1, max: 100, step: 1 }],
};

test("the bar lists only sections that exist, and a new one is a registry flag", async () => {
  const shell = await load("shell.mjs");
  assert.deepEqual(shell.visibleSections().map((section) => section.id), ["home", "tools", "learn", "references", "glossary", "programs", "courses", "community"]);
  const planned = shell.SECTION_REGISTRY.filter((section) => !section.exists).map((section) => section.id);
  assert.deepEqual(planned, []);
});

test("Open in stays hidden until a second section can take a system", async () => {
  const shell = await load("shell.mjs");
  const onlyTools = shell.SECTION_REGISTRY.map((section) => (
    section.id === "learn" || section.id === "references" ? { ...section, exists: false } : section
  ));
  assert.deepEqual(shell.openInTargets(onlyTools), []);
  assert.deepEqual(shell.openInTargets(undefined, "tools").map((section) => section.id), ["learn", "references"]);
  const withReferences = shell.SECTION_REGISTRY.map((section) => (
    section.id === "references" ? { ...section, exists: true } : section
  ));
  assert.deepEqual(
    shell.openInTargets(withReferences, "tools").map((section) => section.id),
    ["learn", "references"],
  );
  assert.deepEqual(
    shell.openInTargets(withReferences, "home").map((section) => section.id),
    ["tools", "learn", "references"],
  );
});

test("an empty section offers start, load, and browse, and remembers what it had open", async () => {
  const shell = await load("shell.mjs");
  const learn = { id: "learn", label: "Learn", exists: true, screen: "placeholder", acceptsSystem: false };
  assert.equal(shell.sectionScreen(learn, {}), "empty");
  assert.deepEqual(shell.EMPTY_ACTIONS.map((action) => action.label), ["Start new", "Load saved", "Browse"]);
  const remembered = shell.rememberOpen({}, "learn", { kind: "system", id: "p1", label: "Rifle" });
  assert.equal(shell.sectionScreen(learn, remembered), "remembered");
  assert.equal(remembered.learn.label, "Rifle");

  const left = shell.switchSection({
    section: "tools",
    memory: {},
    openItem: { kind: "system", id: null, label: "Tactical Rifle" },
  }, "home");
  assert.equal(left.section, "home");
  assert.equal(left.memory.tools.label, "Tactical Rifle");
  const back = shell.switchSection({ section: "home", memory: left.memory, openItem: { kind: "dashboard", label: "Home" } }, "tools");
  assert.equal(back.memory.tools.label, "Tactical Rifle");
  assert.equal(back.memory.home.label, "Home");
});

test("home keeps the five newest projects up front and the rest reachable", async () => {
  const shell = await load("shell.mjs");
  const projects = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    project_id: `p${n}`,
    name: `System ${n}`,
    updated_at: `2026-11-0${n}T00:00:00.000Z`,
    version: n,
  }));
  const ranked = shell.rankProjects(projects);
  assert.deepEqual(ranked.prominent.map((project) => project.project_id), ["p7", "p6", "p5", "p4", "p3"]);
  assert.deepEqual(ranked.rest.map((project) => project.project_id), ["p2", "p1"]);
  assert.equal(ranked.last.project_id, "p7");
  assert.equal(shell.rankProjects([]).last, null);
});

test("workspace draft survives a section switch, and save clears the unsaved dot", async () => {
  const sessionMod = await load("workspaceSession.mjs");
  const stage = await load("stage0.mjs");
  const session = sessionMod.createWorkspaceSession();
  const draft = {
    prompt: "A tactical rifle with recoil",
    bpClass: "ActorComponent",
    complexity: 80,
    modularity: 40,
    perfFlex: 25,
    tickRate: 15,
    replicated: true,
    extra: ["Tracer"],
    newExtra: "",
    result: sampleResult,
    previousResult: null,
    notes: "Keep the kick readable",
    projectContext: "tactical FPS",
    unrealVersion: "5.7",
    setupDone: { 1: true, 3: true },
    tunable: { Damage: 42 },
    project: null,
    references: [{ file_id: "ref-1", filename: "kick.txt" }],
    ignores: [],
    fixNotes: [],
    fixLog: [],
    tab: "cpp",
    baseline: stage.blankSnapshot({ unreal_version: "5.8" }),
  };
  session.replace(draft);

  const shell = await load("shell.mjs");
  const away = shell.switchSection({
    section: "tools",
    memory: {},
    openItem: sessionMod.openItemFromDraft(session.get()),
  }, "home");
  assert.equal(away.section, "home");

  const kept = session.get();
  assert.equal(kept.result.system_name, "Tactical Rifle");
  assert.equal(kept.result.cpp_header, sampleResult.cpp_header);
  assert.equal(kept.complexity, 80);
  assert.equal(kept.modularity, 40);
  assert.equal(kept.perfFlex, 25);
  assert.equal(kept.tickRate, 15);
  assert.equal(kept.replicated, true);
  assert.equal(kept.notes, "Keep the kick readable");
  assert.equal(kept.references[0].filename, "kick.txt");
  assert.equal(kept.tunable.Damage, 42);
  assert.deepEqual(kept.extra, ["Tracer"]);
  assert.equal(kept.result.modules[0].included, true);
  assert.equal(kept.result.modules[1].included, false);
  assert.deepEqual(kept.setupDone, { 1: true, 3: true });
  assert.equal(kept.unrealVersion, "5.7");
  assert.equal(kept.tab, "cpp");

  const chip = sessionMod.systemChip(kept);
  assert.equal(chip.name, "Tactical Rifle");
  assert.equal(chip.unsaved, true);
  assert.equal(away.memory.tools.label, "Tactical Rifle");

  session.replace(sessionMod.markDraftSaved(kept));
  const saved = sessionMod.systemChip(session.get());
  assert.equal(saved.unsaved, false);
  assert.equal(saved.name, "Tactical Rifle");

  const named = { ...session.get(), project: { project_id: "p9", name: "Rifle Project" } };
  assert.equal(sessionMod.systemChip(named).name, "Rifle Project");
});

test("app version is 1.16.0 and the feedback link and update check use it", async () => {
  const shell = await load("shell.mjs");
  const stage = await load("stage0.mjs");
  const pkg = require("../../package.json");
  assert.equal(pkg.version, "1.16.0");
  assert.equal(shell.APP_VERSION, pkg.version);
  const url = new URL(stage.feedbackUrl({ version: shell.APP_VERSION, category: "Idea" }));
  assert.match(url.searchParams.get("body"), /App version: 1\.16\.0/);
  assert.equal(url.searchParams.get("body").toLowerCase().includes("mailto:"), false);

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-shell-"));
  const handle = await startServer({
    dataDir,
    port: 0,
    staticDir: path.join(__dirname, "missing-ui"),
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
  try {
    const info = await (await fetch(`http://127.0.0.1:${handle.port}/api/app`)).json();
    assert.equal(info.version, "1.16.0");
    assert.equal(info.update, null);
  } finally {
    await handle.close();
  }
});

test("a named project chip prefers the project name over the system name", async () => {
  const sessionMod = await load("workspaceSession.mjs");
  const chip = sessionMod.systemChip({
    project: { project_id: "p1", name: "Saved Rifle" },
    result: sampleResult,
    baseline: { prompt: "" },
  });
  assert.equal(chip.name, "Saved Rifle");
  assert.equal(chip.projectId, "p1");
});
