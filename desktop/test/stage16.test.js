"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { composeStack } = require("../stackMap");
const { health, ammo, interact, vital, save, inventory, exampleStacks } = require("../stackExamples");
const { unresolvedIncludes } = require("../generatedIncludes");
const { pluginFileMap } = require("../pluginFiles");
const { buildAssetPlan } = require("../realAssets");
const { loadPacks } = require("../packs");
const { startServer } = require("../server");

function filesOf(system) {
  return pluginFileMap(system).files;
}

test("stacking shares one interface, reports conflicts, and the plugin includes resolve", () => {
  const stacked = composeStack([health(), ammo(), interact()], { name: "Health + Ammo + Interact" });
  const header = stacked.system.cpp_header;
  const source = stacked.system.cpp_source;
  assert.equal((header.match(/class IStackInteractable\b/g) || []).length, 1);
  assert.equal((header.match(/class UStackInteractable\b/g) || []).length, 1);
  assert.equal(header.includes("#include \"HealthAmmoInteract.generated.h\""), true);
  assert.match(source, /^#include "HealthAmmoInteract\.h"/);
  assert.equal(/(?<![\d.])\d+f\b/.test(`${header}\n${source}`), false);
  const input = stacked.stack_map.conflicts.find((item) => item.kind === "input" && item.name === "IA_Reload");
  const replicated = stacked.stack_map.conflicts.find((item) => item.kind === "replicated" && item.name === "Health");
  assert.ok(input?.fix);
  assert.ok(replicated?.fix);
  assert.ok(stacked.stack_map.shared.some((item) => item.kind === "interface" && item.name === "IStackInteractable"));
  assert.ok(stacked.stack_map.shared.some((item) => item.kind === "tag" && item.name === "Character.Vital"));
  assert.ok(stacked.stack_map.dependencies.some((item) => item.name === "UHealthComponent" && item.base === "UActorComponent"));
  assert.equal(stacked.folder, "/Game/Architect/HealthAmmoInteract");
  const plan = buildAssetPlan(stacked.system);
  assert.equal(plan.folder, "/Game/Architect/HealthAmmoInteract");
  assert.equal(plan.confirm, false);
  assert.deepEqual(unresolvedIncludes(filesOf(stacked.system)), []);
});

test("a duplicate component is renamed so both copies can compile", () => {
  const stacked = composeStack([health(), vital()], { name: "Health + Vital" });
  const conflict = stacked.stack_map.conflicts.find((item) => item.name === "UHealthComponent");
  assert.equal(conflict.kind, "component");
  assert.match(conflict.fix, /UHealthComponent_Vital/);
  assert.match(stacked.system.cpp_header, /\bUHealthComponent_Vital\b/);
  assert.match(stacked.system.cpp_source, /\bUHealthComponent_Vital::/);
  assert.equal((stacked.system.cpp_header.match(/class IStackInteractable\b/g) || []).length, 1);
  assert.equal(/(?<![\d.])\d+f\b/.test(stacked.system.cpp_source), false);
  assert.deepEqual(unresolvedIncludes(filesOf(stacked.system)), []);
  for (const example of exampleStacks()) {
    const composed = composeStack(example.systems, { name: example.name });
    assert.deepEqual(unresolvedIncludes(filesOf(composed.system)), [], example.name);
    assert.match(composed.system.cpp_source, new RegExp(`^#include "${composed.folder.split("/").pop()}\\.h"`));
  }
});

test("the release workflow still collects five installer assets under the safe names", () => {
  const pkg = require("../../package.json");
  const workflow = fs.readFileSync(path.join(__dirname, "..", "..", ".github", "workflows", "desktop-installer.yml"), "utf8");
  assert.equal(pkg.name, "ue5-system-architect");
  assert.equal(pkg.build.appId, "app.ue5.system-architect");
  assert.equal(pkg.version, "1.19.0");
  assert.equal(pkg.build.productName.includes("/"), false);
  assert.equal(pkg.build.executableName, "UE5-Systems-Training-Tool-Generator");
  for (const target of ["win", "linux", "mac"]) {
    assert.equal(pkg.build[target].artifactName.includes("/"), false, target);
    assert.match(pkg.build[target].artifactName, /UE5-Systems-Training-Tool-Generator/);
  }
  assert.equal(pkg.build.nsis.uninstallDisplayName, "UE5 Systems Training Tool/Generator");
  assert.equal(pkg.build.linux.desktop.Name, "UE5 Systems Training Tool/Generator");
  assert.match(workflow, /release\/\*\.exe/);
  assert.match(workflow, /release\/\*\.AppImage/);
  assert.match(workflow, /release\/\*\.deb/);
  assert.match(workflow, /release\/\*\.dmg/);
  assert.match(workflow, /release\/\*\.zip/);
  assert.match(workflow, /node desktop\/winInstaller\.js/);
  assert.match(workflow, /AZURE_CLIENT_ID: \$\{\{ secrets\.AZURE_CLIENT_ID \}\}/);
  assert.match(workflow, /electron-builder --mac dmg zip/);
  assert.match(workflow, /electron-builder --linux AppImage deb/);
  assert.equal(pkg.build.win.signAndEditExecutable, false);
  assert.equal(pkg.build.win.azureSignOptions, undefined);
  const { signingEnabled, windowsBuildConfig, AZURE_SIGN } = require("../winInstaller");
  assert.equal(signingEnabled({}), false);
  const unsigned = windowsBuildConfig(pkg.build, {});
  assert.equal(unsigned.signing, false);
  assert.equal(unsigned.config.win.signAndEditExecutable, false);
  assert.equal(unsigned.config.win.artifactName, pkg.build.win.artifactName);
  assert.equal(unsigned.config.mac.artifactName, pkg.build.mac.artifactName);
  const signed = windowsBuildConfig(pkg.build, {
    AZURE_CLIENT_ID: "client",
    AZURE_TENANT_ID: "tenant",
    AZURE_CLIENT_SECRET: "secret",
  });
  assert.equal(signed.signing, true);
  assert.equal(signed.config.win.signAndEditExecutable, true);
  assert.equal(signed.config.win.azureSignOptions.endpoint, "https://eus.codesigning.azure.net/");
  assert.equal(signed.config.win.azureSignOptions.codeSigningAccountName, "ue5toolsigning");
  assert.equal(signed.config.win.azureSignOptions.certificateProfileName, "ue5tools-public");
  assert.equal(signed.config.win.azureSignOptions.TimestampRfc3161, AZURE_SIGN.TimestampRfc3161);
  assert.equal(signed.config.win.artifactName, pkg.build.win.artifactName);
  assert.equal(pkg.build.win.signAndEditExecutable, false);
  const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  assert.match(main, /app\.setName\(DATA_FOLDER_NAME\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "displayName.js"), "utf8"), /UE5 System Architect/);
});

test("foundations courses load and every template and node has context notes", async () => {
  const packs = loadPacks();
  assert.deepEqual(packs.problems, []);
  for (const id of ["gas-basics", "replication-basics", "data-driven"]) {
    const course = packs.courses.find((item) => item.id === id);
    assert.ok(course, id);
    assert.ok(course.glossary_tags.length);
    assert.ok(course.modules.length >= 4);
  }
  assert.ok(packs.programs.find((item) => item.id === "foundations"));
  assert.ok(packs.programs.find((item) => item.id === "tactical-fps").related_courses.includes("replication-basics"));

  const templateDir = path.join(__dirname, "..", "..", "content", "templates");
  const templates = fs.readdirSync(templateDir).filter((name) => name.endsWith(".json"));
  assert.ok(templates.length >= 12);
  for (const name of templates) {
    const template = JSON.parse(fs.readFileSync(path.join(templateDir, name), "utf8"));
    assert.ok(template.when_to_use, name);
    assert.ok(template.common_mistakes, name);
  }

  const graph = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "graph.mjs")).href);
  for (const entry of graph.CATALOG) {
    assert.ok(entry.whenToUse, entry.id);
    assert.ok(entry.commonMistakes, entry.id);
  }
  const node = graph.createNode("cast-to", 0, 0, { id: "cast" });
  assert.match(node.whenToUse, /Cast To/);
  const sim = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "simulate.mjs")).href);
  const event = graph.createNode("begin-play", 0, 0, { id: "begin" });
  const timer = graph.createNode("set-timer-event", 200, 0, { id: "timer", data: { seconds: 1, event: "ApplyEffect" } });
  const custom = graph.createNode("custom-event", 0, 200, { id: "apply", data: { name: "ApplyEffect" } });
  const broken = graph.createNode("break-struct", 200, 200, { id: "break" });
  const wire = (from, to) => graph.tryWire(
    { nodes: [from, to], wires: [] },
    from.id,
    from.pins.find((pin) => pin.dir === "out" && pin.type === "exec").id,
    to.id,
    to.pins.find((pin) => pin.dir === "in" && pin.type === "exec").id,
  ).graph.wires[0];
  const docGraph = {
    nodes: [event, timer, custom, broken],
    wires: [wire(event, timer), wire(custom, broken)],
  };
  const doc = { variables: [], items: [{ id: "event", kind: "event", nodes: docGraph.nodes, wires: docGraph.wires }] };
  let state = sim.startSimulation(doc, docGraph);
  let sawTimer = false;
  let sawBreak = false;
  for (let i = 0; i < 8 && state.status !== "done"; i += 1) {
    state = sim.stepSimulation(state, docGraph, doc);
    if (/Timer set/.test(state.note || "")) sawTimer = true;
    if (/Break /.test(state.note || "")) sawBreak = true;
  }
  assert.equal(sawTimer, true);
  assert.equal(sawBreak, true);
});

test("stacking every pair of templates has no compile errors", async () => {
  const { catalog } = require("../references");
  const { checkSystem } = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "compileCheck.js")).href);
  const examples = catalog().examples.filter((item) => item.starter?.cpp_header);
  assert.ok(examples.length >= 8);
  const named = examples.find((item) => item.title === "Character Interaction");
  const combat = examples.find((item) => item.title === "Advanced Combat System");
  const focus = composeStack([named.starter, combat.starter], { name: "Character Interaction + Advanced Combat System" });
  assert.match(focus.system.cpp_header, /DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam\(FOnFocusChanged, AActor\*, Focused\);/);
  assert.equal((focus.system.cpp_header.match(/DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam\(FOnFocusChanged/g) || []).length, 1);
  for (let i = 0; i < examples.length; i += 1) {
    for (let j = i + 1; j < examples.length; j += 1) {
      const stacked = composeStack([examples[i].starter, examples[j].starter], { name: `${examples[i].id}-${examples[j].id}` });
      const errors = checkSystem(stacked.system).filter((item) => item.severity === "error");
      assert.deepEqual(errors.map((item) => `${item.file}${item.line ? `:${item.line}` : ""} ${item.message}`), [], `${examples[i].title} + ${examples[j].title}`);
    }
  }
});

test("POST /api/stack returns the composed system", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-stack-"));
  const handle = await startServer({ dataDir, port: 0, staticDir: path.join(__dirname, "missing-ui"), fetchImpl: async () => new Response("{}", { status: 200 }) });
  try {
    const response = await fetch(`http://127.0.0.1:${handle.port}/api/stack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Save + Inventory", systems: [save(), inventory()] }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.folder, "/Game/Architect/SaveInventory");
    assert.match(body.system.cpp_header, /USaveComponent/);
    assert.match(body.system.cpp_header, /UInventoryComponent/);
    assert.equal(body.system.stack_map.conflicts.length, 0);
  } finally {
    await handle.close();
  }
});
