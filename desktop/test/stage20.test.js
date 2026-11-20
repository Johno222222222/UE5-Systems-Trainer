"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { NEW_NODES, buildSystem, writeSample } = require("../nodeSample");

const REQUIRED = [
  ["GASP", "gasp"],
  ["Fog of War", "fog of war"],
  ["Throttle", "throttle"],
  ["Ballistics", "ballistics"],
  ["Reload", "reload"],
  ["Projectile", "projectile"],
  ["Economy", "economy"],
  ["Save Game", "save game"],
  ["Suspension", "suspension"],
  ["Artillery", "artillery"],
  ["Spread", "spread"],
  ["Scoring", "scoring"],
  ["Enhanced Input", "enhanced input"],
  ["AI Perception", "perception"],
];

function lessonBlob() {
  const roots = ["programs", "packs"].map((name) => path.join(__dirname, "..", "..", "content", name));
  const chunks = [];
  for (const root of roots) {
    for (const name of fs.readdirSync(root)) {
      if (!name.endsWith(".json")) continue;
      chunks.push(fs.readFileSync(path.join(root, name), "utf8"));
    }
  }
  return chunks.join("\n");
}

test("lesson concepts are in the glossary and See also links resolve", async () => {
  const glossary = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "glossary.json"), "utf8"));
  const terms = glossary.terms;
  const ids = new Set(terms.map((term) => term.id));
  const blob = lessonBlob().toLowerCase();
  for (const [name, needle] of REQUIRED) {
    const term = terms.find((item) => item.term.toLowerCase() === name.toLowerCase() || (item.aliases || []).some((alias) => alias.toLowerCase() === name.toLowerCase()));
    assert.ok(term, `${name} is missing from the glossary`);
    assert.ok(blob.includes(needle), `${name} is not in a program or course`);
    assert.ok(term.summary && term.detail, name);
    for (const see of term.see || []) assert.ok(ids.has(see), `${term.id} see ${see}`);
  }
  for (const term of terms) {
    for (const see of term.see || []) assert.ok(ids.has(see), `${term.id} see ${see}`);
  }
  const { filterGlossary, uniqueTerms } = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "glossary.mjs")).href);
  const listed = uniqueTerms(terms);
  const found = filterGlossary(listed, "replication", "");
  assert.ok(found.length > 0);
  assert.equal(found.some((item) => /line trace/i.test(item.term)), false);
  assert.equal(found.some((item) => /dormancy/i.test(item.term)), false);
});

test("each new gameplay node simulates, exports Blueprint text, and emits component C++", async () => {
  const graph = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "graph.mjs")).href);
  const sim = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "simulate.mjs")).href);
  const text = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "blueprint-text.mjs")).href);
  const system = await buildSystem();
  assert.match(system.cpp_header, /UNodeExerciseComponent : public UActorComponent/);
  assert.match(system.cpp_source, /GetOwner\(\) && GetOwner\(\)->HasAuthority\(\)/);
  assert.doesNotMatch(system.cpp_source, /if \(HasAuthority\(\)\)/);
  for (const id of NEW_NODES) {
    assert.ok(graph.CATALOG.some((item) => item.id === id), id);
    const node = graph.createNode(id, 0, 0, { id: "n" });
    assert.ok(node.pins.length >= 1, id);
    const begin = graph.createNode("begin-play", 0, 80, { id: "begin" });
    const nodes = [begin, node];
    const wires = [];
    const from = begin.pins.find((pin) => pin.dir === "out" && pin.type === "exec");
    const to = node.pins.find((pin) => pin.dir === "in" && pin.type === "exec");
    if (from && to) {
      wires.push({ id: "w", from: { node: begin.id, pin: from.id }, to: { node: node.id, pin: to.id } });
    }
    const doc = { variables: [], items: [{ id: "event", kind: "event", name: "Event Graph", nodes, wires, comments: [] }] };
    let state = sim.startSimulation(doc, doc.items[0]);
    state = sim.stepSimulation(state, doc.items[0], doc);
    if (to) state = sim.stepSimulation(state, doc.items[0], doc);
    assert.ok(state.note, id);
    const exported = text.exportBlueprintText(doc.items[0]);
    assert.match(exported.text, /Begin Object/, id);
  }
  const sample = await buildSystem();
  assert.match(sample.cpp_source, /#include "GameFramework\/DamageType.h"/);
  assert.match(sample.cpp_source, /UDamageType::StaticClass\(\)/);
  for (const id of NEW_NODES) {
    assert.match(sample.cpp_source, new RegExp(`// node:${id}\\b`), `${id} is not its own statement`);
  }
  assert.match(sample.cpp_source, /ACharacter\* Node_/);
  assert.match(sample.cpp_source, /APlayerController\* Node_/);
  assert.match(sample.cpp_source, /HasMatchingGameplayTag/);
  assert.match(sample.cpp_source, /#include "Sound\/SoundBase.h"/);
  assert.match(sample.cpp_source, /#include "NiagaraSystem.h"/);
  assert.match(sample.cpp_source, /#include "CollisionShape.h"/);
  assert.match(sample.cpp_source, /#include "GameplayTagContainer.h"/);
  assert.match(sample.cpp_source, /#include "AbilitySystemComponent.h"/);
  assert.match(sample.cpp_source, /#include "AIController.h"/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-nodes-"));
  const written = await writeSample(dir);
  assert.ok(fs.existsSync(written.uplugin));
  const cpp = fs.readdirSync(dir, { recursive: true }).map(String).filter((name) => name.endsWith(".cpp"));
  assert.ok(cpp.length >= 1);
  const pluginCpp = fs.readFileSync(path.join(dir, cpp[0]), "utf8");
  assert.match(pluginCpp, /#include "GameFramework\/DamageType.h"/);
});
