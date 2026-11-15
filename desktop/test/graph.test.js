"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

async function graphLib() {
  return import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "graph.mjs")).href);
}

const HEADER = `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Kit.generated.h"

UCLASS(ClassGroup=(Custom))
class KIT_API UKitComponent : public UActorComponent
{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere)
	float Trace = 500.f;

	UFUNCTION(BlueprintCallable)
	void Interact();
};
`;

const SOURCE = `#include "Kit.h"

void UKitComponent::Interact()
{
}
`;

test("nodes, wires, type checks, undo, and serialization", async () => {
  const g = await graphLib();
  let graph = g.emptyGraph();
  const begin = g.createNode("begin-play", 16, 32, { id: "e1" });
  const print = g.createNode("print-string", 200, 32, { id: "p1", data: { text: "Hello" } });
  const amount = g.createNode("get-variable", 200, 120, { id: "g1", data: { variable: "Trace", varType: "float" } });
  graph = g.addNode(graph, begin);
  graph = g.addNode(graph, print);
  graph = g.addNode(graph, amount);
  assert.equal(graph.nodes.length, 3);

  const bad = g.tryWire(graph, "g1", "out-value", "p1", "in-in-string");
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /Float does not connect to String/);

  const good = g.tryWire(graph, "e1", "out-exec", "p1", "in-exec");
  assert.equal(good.ok, true);
  graph = good.graph;
  assert.equal(graph.wires.length, 1);

  const removed = g.removeParts(graph, { nodes: ["p1"] });
  assert.equal(removed.nodes.some((node) => node.id === "p1"), false);
  assert.equal(removed.wires.length, 0);

  let history = g.createHistory(graph);
  history = g.commitHistory(history, removed);
  history = g.undoHistory(history);
  assert.equal(history.present.nodes.some((node) => node.id === "p1"), true);
  history = g.redoHistory(history);
  assert.equal(history.present.nodes.some((node) => node.id === "p1"), false);

  const raw = JSON.parse(JSON.stringify(graph));
  assert.equal(g.graphText(g.normalizeGraph(raw)), g.graphText(graph));

  const fn = g.emptyGraph({ kind: "function", name: "Apply Damage", id: "fn-apply" });
  const system = g.writeEventGraph({ graphs: { schema: 1, items: [fn] }, cpp_header: HEADER, cpp_source: SOURCE }, graph);
  assert.equal(system.graphs.items.some((item) => item.kind === "function" && item.id === "fn-apply"), true);
  assert.equal(g.readEventGraph(system).nodes.length, 3);
  assert.equal(system.node_graph_edges[0].kind, "exec");
});

test("a legacy graph still loads, and the event graph writes C++ unless edits are manual", async () => {
  const g = await graphLib();
  const loaded = g.fromLegacy(
    [
      { id: "n1", label: "Timer Trace", node_type: "event", x: 40, y: 120, inputs: [], outputs: ["exec"] },
      { id: "n2", label: "Call Interact", node_type: "function", x: 280, y: 120, inputs: ["exec"], outputs: ["exec"] },
    ],
    [{ from_node: "n1", to_node: "n2", kind: "exec" }],
  );
  assert.equal(loaded.wires.length, 1);
  assert.equal(loaded.nodes[0].label, "Timer Trace");

  let graph = g.emptyGraph();
  graph = g.addNode(graph, g.createNode("begin-play", 0, 0, { id: "e1" }));
  graph = g.addNode(graph, g.createNode("print-string", 180, 0, { id: "p1", data: { text: "Hello" } }));
  graph = g.tryWire(graph, "e1", "out-exec", "p1", "in-exec").graph;
  const system = { cpp_header: HEADER, cpp_source: SOURCE, tunable_parameters: [{ key: "Trace", label: "Trace", value: 12.5 }] };
  const applied = g.commitGraphEdit(system, graph);
  assert.equal(applied.blocked, false);
  assert.match(applied.system.cpp_source, /UKitComponent::Graph_BeginPlay_e1/);
  assert.match(applied.system.cpp_source, /TEXT\("Hello"\)/);
  assert.equal(applied.system.graph_lines.p1.file, ".cpp");
  assert.ok(applied.system.graph_lines.p1.line > 1);
  const again = g.commitGraphEdit(applied.system, graph);
  assert.equal(again.system.cpp_source, applied.system.cpp_source);

  const manual = g.commitGraphEdit({ ...applied.system, manual_cpp: true, cpp_source: "manual source" }, graph);
  assert.equal(manual.blocked, true);
  assert.equal(manual.system.cpp_source, "manual source");
  assert.match(manual.preview.cpp_source, /TEXT\("Hello"\)/);

  const symbols = g.systemSymbols(system);
  assert.ok(symbols.variables.some((item) => item.name === "Trace" && item.type === "float"));
  assert.ok(symbols.functions.includes("Interact"));
});

test("lock warnings sit on the node, and the fallback explanation names what fires", async () => {
  const g = await graphLib();
  let graph = g.emptyGraph();
  graph = g.addNode(graph, g.createNode("tick", 0, 0, { id: "t1" }));
  graph = g.addNode(graph, g.createNode("print-string", 160, 0, { id: "p1" }));
  graph = g.tryWire(graph, "t1", "out-exec", "p1", "in-exec");
  graph = graph.graph;
  const tickWarnings = g.graphWarnings(graph, ["no_tick"]);
  assert.ok(tickWarnings.some((item) => item.nodeId === "t1" && item.lock === "no_tick"));
  assert.ok(tickWarnings.some((item) => item.nodeId === "p1"));

  let authority = g.emptyGraph();
  authority = g.addNode(authority, g.createNode("begin-play", 0, 0, { id: "e1" }));
  authority = g.addNode(authority, g.createNode("set-variable", 180, 0, { id: "s1", data: { variable: "Trace", varType: "float" } }));
  authority = g.tryWire(authority, "e1", "out-exec", "s1", "in-exec").graph;
  assert.ok(g.graphWarnings(authority, ["server_authority"]).some((item) => item.nodeId === "s1"));

  let safe = g.emptyGraph();
  safe = g.addNode(safe, g.createNode("server-rpc", 0, 0, { id: "r1" }));
  safe = g.addNode(safe, g.createNode("set-variable", 180, 0, { id: "s2", data: { variable: "Trace", varType: "float" } }));
  safe = g.tryWire(safe, "r1", "out-exec", "s2", "in-exec").graph;
  assert.equal(g.graphWarnings(safe, ["server_authority"]).length, 0);

  const text = g.explainGraph(graph);
  assert.match(text, /Tick fires/);
  assert.match(text, /Print String says "Hello"/);
});

test("a pointer drop connects palette nodes at different zoom levels, including a near miss and the node body", async () => {
  const g = await graphLib();
  let graph = g.emptyGraph();
  graph = g.addNode(graph, g.createNode("begin-play", 40, 80, { id: "play" }));
  graph = g.addNode(graph, g.createNode("print-string", 340, 80, { id: "print" }));
  graph = g.addNode(graph, g.createNode("get-variable", 340, 220, { id: "amount", data: { variable: "Trace", varType: "float" } }));
  const play = graph.nodes.find((node) => node.id === "play");
  const print = graph.nodes.find((node) => node.id === "print");
  const amount = graph.nodes.find((node) => node.id === "amount");
  assert.ok(play.pins.some((pin) => pin.dir === "out" && pin.type === "exec" && pin.id === "out-exec"));
  assert.ok(print.pins.some((pin) => pin.dir === "in" && pin.type === "exec" && pin.id === "in-exec"));
  assert.ok(print.pins.some((pin) => pin.type === "string"));
  const execOut = play.pins.find((pin) => pin.id === "out-exec");
  const execIn = print.pins.find((pin) => pin.id === "in-exec");
  const stringIn = print.pins.find((pin) => pin.id === "in-in-string");
  const floatOut = amount.pins.find((pin) => pin.id === "out-value");

  for (const zoom of [0.55, 1, 1.35]) {
    const pan = { x: 30, y: 48 };
    const rect = { left: 210, top: 120 };
    const scrollX = 16;
    const scrollY = 9;
    const target = g.pinCenter(print, execIn);
    const clientX = rect.left - scrollX + pan.x + target.x * zoom + 8;
    const clientY = rect.top - scrollY + pan.y + target.y * zoom - 6;
    const point = g.clientToGraphPoint({ clientX, clientY, rect, pan, zoom, scrollX, scrollY });
    const hit = g.pickWireTarget(graph, "play", execOut.id, point, { zoom });
    assert.equal(hit.ok, true, `zoom ${zoom}`);
    assert.equal(hit.pinId, "in-exec");
    assert.equal(g.tryWire(graph, "play", execOut.id, hit.nodeId, hit.pinId).ok, true);
  }

  const body = { x: print.x + 90, y: print.y + 16 };
  const bodyHit = g.pickWireTarget(graph, "play", execOut.id, body, { zoom: 0.7 });
  assert.equal(bodyHit.how, "body");
  assert.equal(bodyHit.pinId, "in-exec");

  const stringPoint = g.pinCenter(print, stringIn);
  const mismatch = g.pickWireTarget(graph, "amount", floatOut.id, stringPoint, { zoom: 1 });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.reason, /Float does not connect to String/);
});

test("functions, macros, variables, and collapse generate C++", async () => {
  const g = await graphLib();
  let doc = g.readDocument({ cpp_header: HEADER, cpp_source: SOURCE, node_graph_nodes: [], node_graph_edges: [] });
  doc = g.addFunction(doc, "ApplyDamage");
  const fnId = doc.items.find((item) => item.kind === "function").id;
  doc = g.setFunctionSignature(doc, fnId, { inputs: [{ name: "Amount", type: "float" }], outputs: [], pure: false, callable: true });
  const fn = doc.items.find((item) => item.id === fnId);
  assert.equal(fn.nodes.find((node) => node.catalog === "entry").pins.some((pin) => pin.name === "Amount"), true);
  assert.equal(fn.pure, false);
  doc = g.setFunctionSignature(doc, fnId, { inputs: [{ name: "Amount", type: "float" }], outputs: [{ name: "Left", type: "float" }], pure: true, callable: true });
  const pure = doc.items.find((item) => item.id === fnId);
  assert.equal(pure.nodes.find((node) => node.catalog === "entry").pins.some((pin) => pin.type === "exec"), false);
  const event = doc.items.find((item) => item.kind === "event");
  const call = g.placeCall(doc, fnId, 200, 40);
  event.nodes.push(call);
  const again = g.setFunctionSignature(doc, fnId, { inputs: [{ name: "Amount", type: "int" }], outputs: [{ name: "Left", type: "float" }], pure: true, callable: true });
  const updatedCall = again.items.find((item) => item.kind === "event").nodes.find((node) => node.catalog === "call-user");
  assert.equal(updatedCall.pins.some((pin) => pin.name === "Amount" && pin.type === "int"), true);

  doc = g.addVariable(again, { name: "Health", type: "float", default: "100.f", replicated: true, repNotify: true });
  doc = g.addMacro(doc, "Pulse");
  const eventGraph = doc.items.find((item) => item.kind === "event");
  eventGraph.nodes.push(g.createNode("forloop", 40, 200, { id: "loop" }));
  eventGraph.nodes.push(g.createNode("cast-to", 240, 200, { id: "cast" }));
  const loop = eventGraph.nodes.find((node) => node.id === "loop");
  const body = loop.pins.find((pin) => pin.name === "Loop Body");
  eventGraph.wires.push({ id: "wloop", from: { node: "loop", pin: body.id }, to: { node: "cast", pin: "in-exec" } });
  const collapsed = g.collapseSelection(doc, eventGraph.id, ["loop", "cast"], { kind: "function", name: "Scan" });
  assert.equal(collapsed.items.filter((item) => item.kind === "function").length, 2);
  const system = { cpp_header: HEADER, cpp_source: SOURCE, manual_cpp: false };
  const applied = g.commitDocument(system, collapsed);
  assert.match(applied.system.cpp_header, /UFUNCTION\(BlueprintPure/);
  assert.match(applied.system.cpp_header, /ReplicatedUsing=OnRep_Health/);
  assert.match(applied.system.cpp_source, /DOREPLIFETIME/);
  assert.match(applied.system.cpp_source, /OnRep_Health/);
  const locked = g.commitDocument({ ...applied.system, manual_cpp: true, cpp_source: "keep me" }, collapsed);
  assert.equal(locked.blocked, true);
  assert.equal(locked.system.cpp_source, "keep me");
  const warns = g.graphWarnings(eventGraph, [], { functions: [] });
  assert.ok(warns.some((item) => item.lock === "cast-loop"));
  assert.equal(g.refactorCheck(applied.system).pass, true);
});

test("entry exec wires to return exec, a float does not, and generated functions stay outside the event block", async () => {
  const g = await graphLib();
  let doc = g.readDocument({ cpp_header: HEADER, cpp_source: SOURCE, node_graph_nodes: [], node_graph_edges: [] });
  doc = g.addFunction(doc, "NewFunction");
  doc = g.addFunction(doc, "NewFunction");
  const names = doc.items.filter((item) => item.kind === "function").map((item) => item.name);
  assert.deepEqual(names, ["NewFunction", "NewFunction_1"]);
  assert.equal(g.renameGraph(doc, doc.items.find((item) => item.name === "NewFunction_1").id, "NewFunction").items.filter((item) => item.name === "NewFunction").length, 1);

  doc = g.addMacro(doc, "NewMacro");
  doc = g.addVariable(doc, { name: "NewVar", type: "float" });
  doc = g.addVariable(doc, { name: "NewVar", type: "bool" });
  assert.deepEqual(doc.variables.map((item) => item.name), ["NewVar", "NewVar_1"]);
  const renamed = g.updateVariable(doc, doc.variables[1].id, { name: "NewVar" });
  assert.equal(renamed.variables[1].name, "NewVar_1");

  const fn = doc.items.find((item) => item.name === "NewFunction");
  const entry = fn.nodes.find((node) => node.catalog === "entry");
  const ret = fn.nodes.find((node) => node.catalog === "return");
  const execHit = g.pickWireTarget(fn, entry.id, "out-exec", g.pinCenter(ret, ret.pins[0]), { zoom: 0.85 });
  assert.equal(execHit.ok, true);
  assert.equal(execHit.pinId, "in-exec");
  const get = g.variableNode(doc.variables[0], "get", ret.x - 160, ret.y);
  fn.nodes.push(get);
  const floatPin = get.pins.find((pin) => pin.name === "Value");
  const bad = g.pickWireTarget(fn, get.id, floatPin.id, g.pinCenter(ret, ret.pins[0]), { zoom: 1, targetNode: ret.id, targetPin: "in-exec" });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /does not connect to Execution|Execution/);

  const macro = doc.items.find((item) => item.kind === "macro");
  const inputs = macro.nodes.find((node) => node.catalog === "macro-in");
  const outputs = macro.nodes.find((node) => node.catalog === "macro-out");
  const macroHit = g.pickWireTarget(macro, inputs.id, "out-exec", { x: outputs.x + 20, y: outputs.y + 40 }, { zoom: 1 });
  assert.equal(macroHit.ok, true);
  assert.equal(macroHit.pinId, "in-exec");

  const sets = [
    ["set", "NewVar", "float", 200],
    ["setb", "Flag", "bool", 280],
    ["setv", "Pos", "vector", 360],
    ["seto", "Actor", "object", 440],
  ];
  let previous = { node: entry.id, pin: "out-exec" };
  for (const [id, variable, varType, y] of sets) {
    fn.nodes.push(g.createNode("set-variable", 240, y, { id, data: { variable, varType } }));
    fn.wires.push({ id: `w-${id}`, from: previous, to: { node: id, pin: "in-exec" } });
    previous = { node: id, pin: "out-exec" };
  }
  const applied = g.commitDocument({ cpp_header: HEADER, cpp_source: SOURCE }, doc);
  assert.match(applied.system.cpp_source, /NewVar = 0\.f;/);
  assert.doesNotMatch(applied.system.cpp_source, /NewVar = NewVar/);
  assert.match(applied.system.cpp_source, /Flag = false;/);
  assert.match(applied.system.cpp_source, /Pos = FVector::ZeroVector;/);
  assert.match(applied.system.cpp_source, /Actor = nullptr;/);
  const eventStart = applied.system.cpp_source.indexOf("// graph:begin event");
  const eventEnd = applied.system.cpp_source.indexOf("// graph:end event");
  const fnAt = applied.system.cpp_source.indexOf("void UKitComponent::NewFunction");
  assert.ok(fnAt > eventEnd || fnAt < eventStart);
  assert.match(applied.system.cpp_source, /\/\/ graph:begin function NewFunction/);
  assert.match(applied.system.cpp_header, /UFUNCTION\(BlueprintCallable, Category="Graph"\)/);
  const twice = g.commitDocument(applied.system, doc);
  assert.equal((twice.system.cpp_source.match(/void UKitComponent::NewFunction\(/g) || []).length, 1);
});

test("a float get wires to set value, an exec input keeps every wire, and a shared exec target is emitted on each path", async () => {
  const g = await graphLib();
  assert.equal(g.pinColor("float"), "#e6d24a");
  assert.notEqual(g.pinColor("float"), g.pinColor("int"));

  let doc = g.readDocument({ cpp_header: HEADER, cpp_source: SOURCE, node_graph_nodes: [], node_graph_edges: [] });
  doc = g.addVariable(doc, { name: "NewVar", type: "float" });
  doc = g.addFunction(doc, "Share");
  const variable = doc.variables.find((item) => item.name === "NewVar");
  const fn = doc.items.find((item) => item.name === "Share");
  const entry = fn.nodes.find((node) => node.catalog === "entry");
  const ret = fn.nodes.find((node) => node.catalog === "return");
  const get = g.variableNode(variable, "get", 40, 200);
  const set = g.variableNode(variable, "set", 320, 160);
  const other = g.variableNode(variable, "get", 40, 280);
  fn.nodes.push(get, set, other);
  const valueIn = set.pins.find((pin) => pin.name === "Value" && pin.dir === "in");
  const valueOut = get.pins.find((pin) => pin.name === "Value");
  assert.equal(valueIn.type, "float");
  assert.equal(g.pinColor(valueIn.type), "#e6d24a");

  const rowY = g.pinCenter(set, valueIn).y;
  const onValueRow = { x: set.x + g.GRAPH_LAYOUT.nodeW - 16, y: rowY };
  const valueHit = g.pickWireTarget(fn, get.id, valueOut.id, onValueRow, { zoom: 1, targetNode: set.id, targetPin: "in-exec" });
  assert.equal(valueHit.ok, true);
  assert.equal(valueHit.pinId, valueIn.id);
  const execRow = g.pinCenter(set, set.pins.find((pin) => pin.id === "in-exec"));
  const execHit = g.pickWireTarget(fn, get.id, valueOut.id, execRow, { zoom: 1 });
  assert.equal(execHit.ok, false);
  assert.equal(execHit.pinId, "in-exec");
  assert.match(execHit.reason, /does not connect to Execution/);

  let graph = g.tryWire(fn, get.id, valueOut.id, set.id, valueIn.id).graph;
  assert.equal(graph.wires.some((wire) => wire.to.node === set.id && wire.to.pin === valueIn.id), true);
  const otherOut = other.pins.find((pin) => pin.name === "Value");
  graph = g.tryWire(graph, other.id, otherOut.id, set.id, valueIn.id).graph;
  const intoValue = graph.wires.filter((wire) => wire.to.node === set.id && wire.to.pin === valueIn.id);
  assert.equal(intoValue.length, 1);
  assert.equal(intoValue[0].from.node, other.id);
  const fan = g.tryWire(graph, get.id, valueOut.id, set.id, valueIn.id).graph;
  const fromGet = fan.wires.filter((wire) => wire.from.node === get.id && wire.from.pin === valueOut.id);
  assert.equal(fromGet.length, 1);

  const secondSet = g.variableNode(variable, "set", 520, 160);
  graph.nodes.push(secondSet);
  const secondValue = secondSet.pins.find((pin) => pin.name === "Value" && pin.dir === "in");
  graph = g.tryWire(graph, get.id, valueOut.id, set.id, valueIn.id).graph;
  graph = g.tryWire(graph, get.id, valueOut.id, secondSet.id, secondValue.id).graph;
  assert.equal(graph.wires.filter((wire) => wire.from.node === get.id && wire.from.pin === valueOut.id).length, 2);

  graph = g.tryWire(graph, entry.id, "out-exec", ret.id, "in-exec").graph;
  graph = g.tryWire(graph, set.id, "out-exec", ret.id, "in-exec").graph;
  assert.equal(graph.wires.filter((wire) => wire.to.node === ret.id && wire.to.pin === "in-exec").length, 2);
  graph = g.tryWire(graph, entry.id, "out-exec", set.id, "in-exec").graph;
  assert.equal(graph.wires.filter((wire) => wire.from.node === entry.id && wire.from.pin === "out-exec").length, 1);
  assert.equal(graph.wires.find((wire) => wire.from.node === entry.id).to.node, set.id);
  assert.equal(graph.wires.filter((wire) => wire.to.node === ret.id && wire.to.pin === "in-exec").length, 1);

  const sequence = g.createNode("sequence", 180, 40, { id: "seq" });
  const shared = g.variableNode(variable, "set", 420, 40);
  shared.id = "shared";
  const then0 = sequence.pins.find((pin) => pin.name === "Then 0");
  const then1 = sequence.pins.find((pin) => pin.name === "Then 1");
  const sharedGraph = {
    ...graph,
    nodes: [entry, ret, sequence, shared],
    wires: [
      { id: "w-entry-seq", from: { node: entry.id, pin: "out-exec" }, to: { node: "seq", pin: "in-exec" } },
      { id: "w-then-0", from: { node: "seq", pin: then0.id }, to: { node: "shared", pin: "in-exec" } },
      { id: "w-then-1", from: { node: "seq", pin: then1.id }, to: { node: "shared", pin: "in-exec" } },
    ],
  };
  assert.equal(sharedGraph.wires.filter((wire) => wire.to.node === "shared" && wire.to.pin === "in-exec").length, 2);
  const fnDoc = {
    ...doc,
    items: doc.items.map((item) => (item.id === fn.id ? sharedGraph : item)),
  };
  const applied = g.commitDocument({ cpp_header: HEADER, cpp_source: SOURCE }, fnDoc);
  const blockStart = applied.system.cpp_source.indexOf("// graph:begin function Share");
  const blockEnd = applied.system.cpp_source.indexOf("// graph:end function Share");
  const block = applied.system.cpp_source.slice(blockStart, blockEnd);
  assert.equal((block.match(/NewVar = 0\.f;/g) || []).length, 2);

  const wiredDoc = {
    ...doc,
    items: doc.items.map((item) => (item.id === fn.id ? graph : item)),
  };
  const typed = g.updateVariable(wiredDoc, variable.id, { type: "bool" });
  const typedSet = typed.items.find((item) => item.id === fn.id).nodes.find((node) => node.id === set.id);
  const typedGet = typed.items.find((item) => item.id === fn.id).nodes.find((node) => node.id === get.id);
  assert.equal(typedSet.pins.find((pin) => pin.name === "Value").type, "bool");
  assert.equal(typedGet.pins.find((pin) => pin.name === "Value").type, "bool");
  assert.equal(g.pinColor(typedSet.pins.find((pin) => pin.name === "Value").type), g.pinColor("bool"));
  const stale = g.readDocument({
    cpp_header: HEADER,
    cpp_source: SOURCE,
    graphs: {
      schema: 1,
      variables: [{ id: variable.id, name: "NewVar", type: "int" }],
      items: [{ ...fn, id: fn.id, nodes: graph.nodes.map((node) => (node.id === set.id ? { ...node, pins: node.pins.map((pin) => (pin.name === "Value" ? { ...pin, type: "float" } : pin)) } : node)), wires: graph.wires }],
    },
  });
  assert.equal(stale.items.find((item) => item.id === fn.id).nodes.find((node) => node.id === set.id).pins.find((pin) => pin.name === "Value").type, "int");
});
