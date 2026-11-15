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
