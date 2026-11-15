"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");
const { loadGraphTemplates, templateDirs } = require("../graphTemplates");

async function lib(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", name)).href);
}

function wire(graphApi, graph, fromId, fromName, toId, toName) {
  const from = graph.nodes.find((node) => node.id === fromId);
  const to = graph.nodes.find((node) => node.id === toId);
  const fromPin = from.pins.find((pin) => pin.name === fromName && pin.dir === "out");
  const toPin = to.pins.find((pin) => pin.name === toName && pin.dir === "in");
  const result = graphApi.tryWire(graph, fromId, fromPin.id, toId, toPin.id);
  assert.equal(result.ok, true, result.reason);
  return result.graph;
}

test("the simulator steps branches, loops, gates, and shared exec paths", async () => {
  const g = await lib("graph.mjs");
  const sim = await lib("simulate.mjs");
  let graph = g.emptyGraph();
  const begin = g.createNode("begin-play", 0, 0, { id: "begin" });
  const branch = g.createNode("branch", 200, 0, { id: "branch" });
  const flag = g.createNode("get-variable", 0, 160, { id: "flag", data: { variable: "Flag", varType: "bool" } });
  const yes = g.createNode("print-string", 420, 0, { id: "yes", data: { text: "Yes" } });
  const no = g.createNode("print-string", 420, 140, { id: "no", data: { text: "No" } });
  graph = [begin, branch, flag, yes, no].reduce((acc, node) => g.addNode(acc, node), graph);
  graph = wire(g, graph, "begin", "Exec", "branch", "Exec");
  graph = wire(g, graph, "flag", "Value", "branch", "Condition");
  graph = wire(g, graph, "branch", "Then", "yes", "Exec");
  graph = wire(g, graph, "branch", "Else", "no", "Exec");
  const doc = { variables: [{ name: "Flag", type: "bool", default: "true" }], items: [graph] };
  const ran = sim.runSimulation(doc, graph);
  assert.equal(ran.trace.some((step) => step.branch?.taken === "Then" && step.branch.why === "condition is true"), true);
  assert.equal(ran.state.log.at(-1), "Yes");

  let loop = g.emptyGraph();
  const start = g.createNode("begin-play", 0, 0, { id: "begin" });
  const forloop = g.createNode("forloop", 200, 0, { id: "loop" });
  const first = g.createNode("literal", 0, 160, { id: "first", data: { varType: "int", value: "0" } });
  const last = g.createNode("literal", 0, 240, { id: "last", data: { varType: "int", value: "2" } });
  const body = g.createNode("print-string", 460, 0, { id: "body", data: { text: "Body" } });
  const done = g.createNode("print-string", 460, 140, { id: "done", data: { text: "Done" } });
  loop = [start, forloop, first, last, body, done].reduce((acc, node) => g.addNode(acc, node), loop);
  loop = wire(g, loop, "begin", "Exec", "loop", "Exec");
  loop = wire(g, loop, "first", "Value", "loop", "First");
  loop = wire(g, loop, "last", "Value", "loop", "Last");
  loop = wire(g, loop, "loop", "Loop Body", "body", "Exec");
  loop = wire(g, loop, "loop", "Completed", "done", "Exec");
  const looped = sim.runSimulation({ variables: [], items: [loop] }, loop);
  assert.equal(looped.state.log.filter((line) => line === "Body").length, 3);
  assert.equal(looped.state.log.at(-1), "Done");

  const hugeLast = g.createNode("literal", 0, 300, { id: "huge", data: { varType: "int", value: "100" } });
  let capped = loop;
  capped.nodes = capped.nodes.map((node) => (node.id === "last" ? hugeLast : node));
  capped = { ...capped, wires: capped.wires.filter((item) => item.from.node !== "last") };
  capped = wire(g, capped, "huge", "Value", "loop", "Last");
  const stopped = sim.runSimulation({ variables: [], items: [capped] }, capped, { limit: 40 });
  assert.equal(stopped.state.log.filter((line) => line === "Body").length, sim.LOOP_CAP);
  assert.match(stopped.trace.map((step) => step.note).join(" "), /stopped after 8/);

  let seq = g.emptyGraph();
  const ev = g.createNode("begin-play", 0, 0, { id: "begin" });
  const sequence = g.createNode("sequence", 200, 0, { id: "seq" });
  const a = g.createNode("print-string", 460, 0, { id: "a", data: { text: "A" } });
  const b = g.createNode("print-string", 460, 140, { id: "b", data: { text: "B" } });
  seq = [ev, sequence, a, b].reduce((acc, node) => g.addNode(acc, node), seq);
  seq = wire(g, seq, "begin", "Exec", "seq", "Exec");
  seq = wire(g, seq, "seq", "Then 0", "a", "Exec");
  seq = wire(g, seq, "seq", "Then 1", "b", "Exec");
  const ordered = sim.runSimulation({ variables: [], items: [seq] }, seq);
  assert.deepEqual(ordered.state.log, ["A", "B"]);

  let onceGraph = g.emptyGraph();
  const play = g.createNode("begin-play", 0, 0, { id: "begin" });
  const once = g.createNode("do-once", 220, 0, { id: "once" });
  const printed = g.createNode("print-string", 460, 0, { id: "printed", data: { text: "Once" } });
  const again = g.createNode("custom-event", 0, 180, { id: "again", data: { name: "Again" } });
  onceGraph = [play, once, printed, again].reduce((acc, node) => g.addNode(acc, node), onceGraph);
  onceGraph = wire(g, onceGraph, "begin", "Exec", "once", "Exec");
  onceGraph = wire(g, onceGraph, "again", "Exec", "once", "Exec");
  onceGraph = wire(g, onceGraph, "once", "Completed", "printed", "Exec");
  let state = sim.runSimulation({ variables: [], items: [onceGraph] }, onceGraph, { nodeId: "begin" });
  assert.equal(state.state.log.filter((line) => line === "Once").length, 1);
  let againState = { ...state.state, status: "paused", stack: [{ nodeId: "again", wireId: null, pinId: null, depth: 0 }] };
  const notes = [];
  while (againState.status !== "done" && notes.length < 8) {
    againState = sim.stepSimulation(againState, onceGraph, { variables: [], items: [onceGraph] });
    notes.push(againState.note);
  }
  assert.equal(notes.some((note) => note === "DoOnce already ran."), true);

  let gateGraph = g.emptyGraph();
  const enter = g.createNode("begin-play", 0, 0, { id: "begin" });
  const gate = g.createNode("gate", 220, 0, { id: "gate" });
  const passed = g.createNode("print-string", 460, 0, { id: "passed", data: { text: "Passed" } });
  const opener = g.createNode("custom-event", 0, 180, { id: "open", data: { name: "OpenGate" } });
  gateGraph = [enter, gate, passed, opener].reduce((acc, node) => g.addNode(acc, node), gateGraph);
  gateGraph = wire(g, gateGraph, "begin", "Exec", "gate", "Enter");
  gateGraph = wire(g, gateGraph, "open", "Exec", "gate", "Open");
  gateGraph = wire(g, gateGraph, "gate", "Exit", "passed", "Exec");
  const closed = sim.runSimulation({ variables: [], items: [gateGraph] }, gateGraph);
  assert.equal(closed.state.log.includes("Passed"), false);
  assert.match(closed.trace.map((step) => step.note).join(" "), /Gate is closed/);
  const opened = sim.runSimulation({ variables: [], items: [gateGraph] }, gateGraph, { nodeId: "open" });
  assert.match(opened.trace.map((step) => step.note).join(" "), /Gate opened/);
  let follow = { ...opened.state, status: "paused", stack: [{ nodeId: "begin", wireId: null, pinId: null, depth: 0 }] };
  const followNotes = [];
  while (follow.status !== "done" && followNotes.length < 8) {
    follow = sim.stepSimulation(follow, gateGraph, { variables: [], items: [gateGraph] });
    followNotes.push(follow.note);
  }
  assert.equal(follow.log.includes("Passed"), true);

  let flip = g.emptyGraph();
  const startFlip = g.createNode("custom-event", 0, 0, { id: "go", data: { name: "Pulse" } });
  const flop = g.createNode("flipflop", 220, 0, { id: "flop" });
  const outA = g.createNode("print-string", 460, 0, { id: "outa", data: { text: "A" } });
  const outB = g.createNode("print-string", 460, 140, { id: "outb", data: { text: "B" } });
  const second = g.createNode("custom-event", 0, 180, { id: "second", data: { name: "Pulse2" } });
  flip = [startFlip, flop, outA, outB, second].reduce((acc, node) => g.addNode(acc, node), flip);
  flip = wire(g, flip, "go", "Exec", "flop", "Exec");
  flip = wire(g, flip, "second", "Exec", "flop", "Exec");
  flip = wire(g, flip, "flop", "A", "outa", "Exec");
  flip = wire(g, flip, "flop", "B", "outb", "Exec");
  const firstFlip = sim.runSimulation({ variables: [], items: [flip] }, flip, { nodeId: "go" });
  assert.equal(firstFlip.state.log.at(-1), "A");
  let held = firstFlip.state;
  held = { ...held, status: "paused", stack: [{ nodeId: "second", wireId: null, pinId: null, depth: 0 }] };
  const secondFlipNotes = [];
  let cursor = held;
  while (cursor.status !== "done" && secondFlipNotes.length < 8) {
    cursor = sim.stepSimulation(cursor, flip, { variables: [], items: [flip] });
    secondFlipNotes.push(cursor.note);
  }
  assert.equal(cursor.log.at(-1), "B");

  const server = g.createNode("server-rpc", 0, 0, { id: "rpc" });
  const client = g.createNode("client-rpc", 0, 80, { id: "client" });
  const auth = g.createNode("has-authority", 200, 0, { id: "auth" });
  let net = g.emptyGraph();
  net = [server, client, auth].reduce((acc, node) => g.addNode(acc, node), net);
  net = wire(g, net, "rpc", "Exec", "auth", "Exec");
  const onServer = sim.runSimulation({ variables: [], items: [net] }, net, { nodeId: "rpc" });
  assert.equal(onServer.trace.some((step) => step.role === "runs on server"), true);
  assert.match(onServer.trace.map((step) => step.note).join(" "), /Has Authority is true/);
  const onClient = sim.runSimulation({ variables: [], items: [net] }, net, { nodeId: "client", authority: false });
  assert.equal(onClient.trace.some((step) => step.role === "runs on client"), true);
});

test("graph templates load, teach, and simulate", async () => {
  const g = await lib("graph.mjs");
  const templates = await lib("templates.mjs");
  const sim = await lib("simulate.mjs");
  const loaded = loadGraphTemplates();
  assert.deepEqual(loaded.problems, []);
  assert.equal(loaded.templates.length, 6);
  const ids = loaded.templates.map((item) => item.id).sort();
  assert.deepEqual(ids, ["door", "health", "interact", "pickup", "tactical-ammo", "timer"]);
  const pkg = require("../../package.json");
  assert.ok(pkg.build.files.some((item) => String(item).includes("content/templates")));
  const dirs = templateDirs({ appPath: path.join(os.tmpdir(), "missing-app"), resourcesPath: path.join(os.tmpdir(), "missing-resources") });
  assert.equal(dirs.at(-1), path.join(__dirname, "..", "..", "content", "templates"));

  for (const template of loaded.templates) {
    const built = templates.realizeTemplate(template);
    assert.deepEqual(built.warnings, [], `${template.id}: ${built.warnings.join("; ")}`);
    assert.ok(built.graph.nodes.length >= 4, template.id);
    assert.ok(template.graph.nodes.every((node) => node.note), template.id);
  }

  const health = loaded.templates.find((item) => item.id === "health");
  const healthGraph = templates.realizeTemplate(health).graph;
  const healthDoc = { variables: health.variables, items: [healthGraph] };
  const healthRun = sim.runSimulation(healthDoc, healthGraph);
  assert.equal(healthRun.state.variables.Health, 0);
  assert.equal(healthRun.trace.some((step) => step.branch?.taken === "Then"), true);
  assert.equal(healthRun.state.log.includes("Died"), true);

  const ammo = loaded.templates.find((item) => item.id === "tactical-ammo");
  const ammoGraph = templates.realizeTemplate(ammo).graph;
  const ammoRun = sim.runSimulation({ variables: ammo.variables, items: [ammoGraph] }, ammoGraph);
  assert.equal(ammoRun.state.variables.Mag, 30);
  assert.equal(ammoRun.state.variables.Reserve, 70);
  assert.equal(ammoRun.trace.some((step) => step.branch?.taken === "Then"), true);

  let doc = g.readDocument({ cpp_header: "", cpp_source: "", node_graph_nodes: [], node_graph_edges: [] });
  const inserted = templates.applyTemplate(doc, health, { mode: "insert", graphId: "event" });
  assert.equal(inserted.warnings.length, 0);
  assert.ok(inserted.doc.variables.some((item) => item.name === "Health"));
  assert.ok(inserted.doc.items.find((item) => item.id === "event").nodes.some((node) => node.catalog === "any-damage"));
  const opened = templates.applyTemplate(doc, ammo, { mode: "new" });
  assert.equal(opened.doc.items.some((item) => item.kind === "function" && item.name === "Reload"), true);
  assert.ok(opened.doc.items.find((item) => item.id === opened.graphId).nodes.some((node) => node.catalog === "enhanced-input"));
});

test("blueprint text round-trips supported nodes and keeps unknown nodes", async () => {
  const g = await lib("graph.mjs");
  const bp = await lib("blueprint-text.mjs");
  let graph = g.emptyGraph();
  const begin = g.createNode("begin-play", 16, 24, { id: "begin" });
  const branch = g.createNode("branch", 240, 24, { id: "branch" });
  const amount = g.createNode("get-variable", 40, 180, { id: "amount", data: { variable: "Health", varType: "float" } });
  const set = g.createNode("set-variable", 480, 24, { id: "set", data: { variable: "Health", varType: "float" } });
  const add = g.createNode("add", 240, 180, { id: "add" });
  const sequence = g.createNode("sequence", 700, 24, { id: "seq" });
  const loop = g.createNode("forloop", 940, 24, { id: "loop" });
  graph = [begin, branch, amount, set, add, sequence, loop].reduce((acc, node) => g.addNode(acc, node), graph);
  graph = wire(g, graph, "begin", "Exec", "branch", "Exec");
  graph = wire(g, graph, "branch", "Then", "set", "Exec");
  graph = wire(g, graph, "amount", "Value", "add", "A");
  graph = wire(g, graph, "add", "Result", "set", "Value");
  graph = wire(g, graph, "set", "Exec", "seq", "Exec");
  graph = wire(g, graph, "seq", "Then 0", "loop", "Exec");
  const exported = bp.exportBlueprintText(graph);
  assert.match(exported.text, /Begin Object Class=\/Script\/BlueprintGraph\.K2Node_Event/);
  assert.match(exported.text, /K2Node_IfThenElse/);
  assert.match(exported.text, /K2Node_VariableSet/);
  assert.match(exported.text, /K2Node_MacroInstance/);
  assert.match(exported.text, /NodePosX=/);
  assert.match(exported.text, /NodeGuid=/);
  assert.match(exported.text, /LinkedTo=\(/);
  assert.ok(exported.warnings.some((item) => /best effort/i.test(item)));

  const imported = bp.importBlueprintText(exported.text);
  const catalogs = imported.nodes.map((node) => node.catalog).sort();
  assert.deepEqual(catalogs, ["add", "begin-play", "branch", "forloop", "get-variable", "sequence", "set-variable"]);
  const edge = (fromCat, fromPin, toCat, toPin) => imported.wires.some((wire) => {
    const from = imported.nodes.find((node) => node.id === wire.from.node);
    const to = imported.nodes.find((node) => node.id === wire.to.node);
    const fromName = from.pins.find((pin) => pin.id === wire.from.pin)?.name;
    const toName = to.pins.find((pin) => pin.id === wire.to.pin)?.name;
    return from.catalog === fromCat && fromName === fromPin && to.catalog === toCat && toName === toPin;
  });
  assert.equal(edge("begin-play", "Exec", "branch", "Exec"), true);
  assert.equal(edge("branch", "Then", "set-variable", "Exec"), true);
  assert.equal(edge("add", "Result", "set-variable", "Value"), true);
  assert.equal(edge("sequence", "Then 0", "forloop", "Exec"), true);
  assert.equal(imported.nodes.find((node) => node.catalog === "set-variable").data.variable, "Health");

  const unknown = bp.importBlueprintText(`Begin Object Class=/Script/BlueprintGraph.K2Node_MakeStruct Name="K2Node_MakeStruct_0"
   NodePosX=12
   NodePosY=18
   NodeGuid=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
   CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="execute",Direction="EGPD_Input",PinType.PinCategory="exec",PinType.PinSubCategory="",)
End Object`);
  assert.equal(unknown.nodes[0].catalog, "placeholder");
  assert.match(unknown.warnings.join(" "), /not a node this app knows/);
});

test("the graph template route serves the bundled files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-templates-"));
  const handle = await startServer({ dataDir: dir, port: 0 });
  try {
    const response = await fetch(`http://127.0.0.1:${handle.port}/api/graph-templates`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.templates.length, 6);
    assert.equal(body.problems.length, 0);
  } finally {
    await handle.close();
  }
});
