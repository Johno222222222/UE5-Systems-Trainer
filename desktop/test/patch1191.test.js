"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { explainNode } = require("../shared/lineExplain");
const { buildTracks } = require("../tracks");
const { loadCommunityIndex } = require("../community");

const SEAM = /do not (?:broadcast|increment|subtract|add|writ|read|call|trac|replicat)\w*ing\b|does not (?:broadcast|increment|subtract|add|writ|read|call|trac|replicat)\w*ing\b|which is the fear or cost reaction reads|reads the row instead of a literal|is a use, the hit calls|Project JOHNO rules/i;

function walkJson(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkJson(full, out);
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

test("authored lesson text has no template seams", () => {
  const roots = ["content/study", "content/programs", "content/packs"].map((item) => path.join(__dirname, "..", "..", item));
  const hits = [];
  for (const root of roots) {
    for (const file of walkJson(root)) {
      const text = fs.readFileSync(file, "utf8");
      if (SEAM.test(text) || /Project JOHNO rules/.test(text)) hits.push(path.relative(path.join(__dirname, "..", ".."), file));
    }
  }
  assert.deepEqual(hits, []);
  const pkg = require(path.join(__dirname, "..", "..", "package.json"));
  assert.equal(pkg.version, "1.19.1");
});

test("the GAS effect graph wires only move to the right", () => {
  const graph = require(path.join(__dirname, "..", "..", "content", "templates", "gas-effect.json")).graph;
  const byKey = new Map(graph.nodes.map((node) => [node.key, node]));
  assert.ok(graph.wires.length >= 3);
  for (const wire of graph.wires) {
    const from = byKey.get(wire.from);
    const to = byKey.get(wire.to);
    assert.ok(to.x > from.x, `${wire.from} curls back to ${wire.to}`);
  }
  const call = byKey.get("call");
  assert.equal(graph.wires.some((wire) => wire.from === "call" && byKey.get(wire.to).y > call.y), false);
});

test("Learn labels are not sliced, and old projects skip the filler sentence", async () => {
  const learnSource = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Learn.jsx"), "utf8");
  assert.doesNotMatch(learnSource, /label\.slice\(0,\s*22\)/);
  assert.match(learnSource, /wrapLabel/);
  const learn = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "learnQuiz.mjs")).href);
  const old = learn.pictureOf({
    system_name: "Saved 11/16",
    node_graph_nodes: [
      { id: "n1", label: "Event BeginPlay", node_type: "event", inputs: [], outputs: ["exec"] },
      { id: "n2", label: "Timer Trace", node_type: "function", inputs: ["exec"], outputs: ["exec"] },
      { id: "n3", label: "Call Interact", node_type: "function", inputs: ["exec"], outputs: ["exec"], data: { function: "Interact" } },
    ],
  });
  const begin = old.whyNotes.find((item) => item.label === "Event BeginPlay");
  assert.match(begin.layman, /play session|spawned or placed|enters the world/i);
  for (const note of old.whyNotes) {
    assert.doesNotMatch(note.layman, /function step on this generated graph|does the job printed on the node/);
  }
  const named = explainNode({ label: "Call Interact", kind: "function", data: { function: "Interact" }, pins: [{ name: "Target" }] });
  assert.match(named, /Interact/);
  assert.doesNotMatch(named, /function step on this generated graph/);
});

test("the stack map sits clear of My Blueprint and can collapse", () => {
  const workspace = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "Workspace.jsx"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "index.css"), "utf8");
  assert.match(workspace, /stack-map-toggle/);
  assert.match(css, /\.stack-map\s*\{[^}]*left:\s*444px/s);
  assert.doesNotMatch(workspace, /stack-map[\s\S]{0,80}left-3/);
});

test("community copy matches the configured public repo", () => {
  const index = loadCommunityIndex();
  assert.match(index.how_to_submit, /pull request/);
  assert.match(index.how_to_submit, /ue5-systems-training-tool-packs/);
  assert.doesNotMatch(index.how_to_submit, /stays off/);
  const page = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Community.jsx"), "utf8");
  assert.match(page, /community-how/);
  assert.match(page, /enabled/);
});

test("the programs list can show every track", () => {
  const tracks = buildTracks();
  assert.equal(tracks.length, 8);
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Programs.jsx"), "utf8");
  assert.match(source, /useState\("all"\)/);
  assert.match(source, /\["all", "All"\]/);
  assert.match(source, /track-level-all/);
  assert.match(source, /genre === "all"/);
  assert.doesNotMatch(source, /Project JOHNO rules/);
});
