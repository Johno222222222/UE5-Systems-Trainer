"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const HEADER = `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Kit.generated.h"

UCLASS()
class KIT_API UKitComponent : public UActorComponent
{
	GENERATED_BODY()
public:
	void Interact();
};
`;

const SOURCE = `#include "Kit.h"\nvoid UKitComponent::Interact() {}\n`;

async function libs() {
  const root = path.join(__dirname, "..", "..", "frontend", "src", "lib");
  const graph = await import(pathToFileURL(path.join(root, "graph.mjs")).href);
  const templates = await import(pathToFileURL(path.join(root, "templates.mjs")).href);
  return { graph, templates };
}

function loadTemplate(id) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "templates", `${id}.json`), "utf8"));
}

async function emit(doc, template, mode, graphId) {
  const { graph, templates } = await libs();
  const applied = templates.applyTemplate(doc, template, { mode, graphId });
  assert.deepEqual(applied.warnings, [], applied.warnings.join("; "));
  const system = graph.commitDocument({ cpp_header: doc.cpp_header || HEADER, cpp_source: doc.cpp_source || SOURCE }, applied.doc).system;
  return { applied, system, source: system.cpp_source, header: system.cpp_header };
}

function fresh() {
  return { cpp_header: HEADER, cpp_source: SOURCE, variables: [], items: [{ id: "event", kind: "event", name: "Event Graph", nodes: [], wires: [], comments: [] }] };
}

test("every template inserts into a fresh system and an existing one without a self-assignment", async () => {
  const ids = fs.readdirSync(path.join(__dirname, "..", "..", "content", "templates")).filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, ""));
  for (const id of ids) {
    const template = loadTemplate(id);
    const blank = await emit(fresh(), template, "insert", "event");
    assert.equal(/\b(\w+) = \1;/.test(blank.source), false, `${id} fresh self-assigns`);
    for (const variable of template.variables || []) {
      assert.match(blank.header, new RegExp(`\\b${variable.name}\\b`), `${id} missing ${variable.name}`);
    }
    const existing = fresh();
    existing.variables = [{ id: "health", name: "Health", type: "float", default: "100.f" }];
    existing.cpp_header = HEADER.replace("void Interact();", "void Interact();\n\tvirtual void BeginPlay() override;");
    existing.cpp_source = `${SOURCE}\nvoid UKitComponent::BeginPlay() { Super::BeginPlay(); }\n`;
    const again = await emit(existing, template, "insert", "event");
    assert.equal(/\b(\w+) = \1;/.test(again.source), false, `${id} existing self-assigns`);
    assert.match(again.header, /\bHealth\b/);
    assert.equal((again.source.match(/void UKitComponent::BeginPlay\s*\(/g) || []).length <= 1, true, `${id} duplicated BeginPlay`);
  }
});

test("every template keeps its header first and avoids bare float suffixes", async () => {
  const { graph } = await libs();
  for (const id of fs.readdirSync(path.join(__dirname, "..", "..", "content", "templates")).filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, ""))) {
    const { source } = await emit(fresh(), loadTemplate(id), "insert", "event");
    assert.match(source, /^#include "Kit\.h"/, id);
    assert.equal(/(?<![\d.])\d+f\b/.test(source), false, `${id} has a bare float suffix`);
  }
  const begin = graph.createNode("begin-play", 0, 0, { id: "begin" });
  const once = graph.createNode("do-once", 200, 0, { id: "once" });
  const gate = graph.createNode("gate", 400, 0, { id: "gate" });
  const link = (from, to) => ({
    id: `${from.id}-${to.id}`,
    from: { node: from.id, pin: from.pins.find((pin) => pin.dir === "out" && pin.type === "exec").id },
    to: { node: to.id, pin: to.pins.find((pin) => pin.dir === "in" && pin.type === "exec").id },
  });
  const doc = {
    variables: [],
    items: [{ id: "event", kind: "event", name: "Event Graph", nodes: [begin, once, gate], wires: [link(begin, once), link(once, gate)], comments: [] }],
  };
  const system = graph.commitDocument({ cpp_header: HEADER, cpp_source: SOURCE }, doc).system;
  assert.match(system.cpp_header, /bool DoneOnce_once = false;/);
  assert.match(system.cpp_header, /bool GateOpen_gate = false;/);
  assert.match(system.cpp_source, /DoneOnce_once/);
  assert.match(system.cpp_source, /GateOpen_gate/);
  assert.match(system.cpp_source, /^#include "Kit\.h"/);
});

test("pickup adds one ammo, declares it, and binds a real overlap signature", async () => {
  const { source, header } = await emit(fresh(), loadTemplate("pickup"), "insert", "event");
  assert.match(source, /Ammo = \(Ammo \+ 1\);/);
  assert.match(source, /GraphOwner->Destroy\(\)/);
  assert.match(source, /void UKitComponent::Graph_OnComponentBeginOverlap_tpl_pickup_overlap\(UPrimitiveComponent\* OverlappedComponent, AActor\* OtherActor, UPrimitiveComponent\* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult\)/);
  assert.match(source, /OnComponentBeginOverlap\.AddDynamic\(this, &UKitComponent::Graph_OnComponentBeginOverlap_tpl_pickup_overlap\)/);
  assert.match(header, /int32 Ammo = 0;/);
  assert.match(source, /Engine\/HitResult\.h/);
  assert.doesNotMatch(source, /Ammo = Ammo;/);
});

test("the other five templates emit the math, the trace, and the timer they show", async () => {
  const health = await emit(fresh(), loadTemplate("health"), "insert", "event");
  assert.match(health.source, /Health = FMath::Clamp\(\(Health - Damage\), 0\.f, MaxHealth\);/);
  assert.match(health.source, /if \(\(Health == 0\.f\)\)/);
  assert.equal(/(?<![\d.])\d+f\b/.test(health.source), false);
  assert.match(health.source, /OnTakeAnyDamage\.AddDynamic/);
  assert.match(health.header, /float Health = 100\.f;/);

  const door = await emit(fresh(), loadTemplate("door"), "insert", "event");
  assert.match(door.source, /IsOpen = true;/);
  assert.match(door.source, /IsOpen = false;/);
  assert.match(door.header, /bool IsOpen = false;/);
  assert.match(door.header, /bool Flip_tpl_door_flip = false;/);
  assert.match(door.source, /UTimelineComponent/);
  assert.match(door.source, /FOnTimelineFloat/);
  assert.match(door.source, /FOnTimelineEvent/);
  assert.match(door.source, /PlayFromStart/);
  assert.match(door.source, /AddInterpFloat/);
  assert.match(door.source, /UCurveFloat/);
  assert.match(door.header, /TickComponent/);
  assert.match(door.source, /OnTimelineFinished_/);
  assert.match(door.source, /OnTimelineUpdate_/);
  assert.match(door.source, /^#include "Kit\.h"/);

  const interact = await emit(fresh(), loadTemplate("interact"), "insert", "event");
  assert.match(interact.source, /LineTraceSingleByChannel/);
  assert.match(interact.source, /if \(bHit_tpl_interact_trace\)/);
  assert.match(interact.source, /Cast<AActor>\(Hit_tpl_interact_trace\.GetActor\(\)\)/);
  assert.match(interact.source, /FindFunction\(TEXT\("Interact"\)\)/);

  const timer = await emit(fresh(), loadTemplate("timer"), "insert", "event");
  assert.match(timer.source, /SetTimer\(Timer_tpl_timer_arm, this, &UKitComponent::Graph_TimerTick_tpl_timer_tick, 0\.5f, true\)/);

  const ammo = await emit(fresh(), loadTemplate("tactical-ammo"), "insert", "event");
  assert.match(ammo.source, /Needed = FMath::Clamp\(Reserve, 0, \(MagSize - Magazine\)\);/);
  assert.match(ammo.source, /Magazine = \(Magazine \+ Needed\);/);
  assert.match(ammo.source, /Reserve = \(Reserve - Needed\);/);
  assert.match(ammo.header, /int32 Magazine = 10;/);
  assert.match(ammo.header, /int32 Reserve = 90;/);
});

test("timeline, dispatchers, cast, and struct pins emit the types the graph names", async () => {
  const { graph } = await libs();
  const gas = await emit(fresh(), loadTemplate("gas-effect"), "insert", "event");
  assert.match(gas.header, /DECLARE_DYNAMIC_MULTICAST_DELEGATE\(FOnEffectDelegate\)/);
  assert.match(gas.header, /BlueprintAssignable/);
  assert.match(gas.source, /OnEffect\.Broadcast\(\)/);
  assert.match(gas.source, /OnEffect\.AddDynamic\(this, &UKitComponent::/);
  assert.match(gas.header, /UFUNCTION\(\)/);

  const save = await emit(fresh(), loadTemplate("save-load"), "insert", "event");
  assert.match(save.source, /FVector Made_/);
  assert.match(save.source, /\.X =/);
  assert.match(save.source, /FHitResult Broken_/);
  assert.doesNotMatch(save.source, /FHitResult Made_/);

  const vector = graph.createNode("make-struct", 0, 0, { data: { struct: "FVector" } });
  assert.ok(vector.pins.some((pin) => pin.name === "X" && pin.dir === "in"));
  assert.ok(vector.pins.some((pin) => pin.name === "Y" && pin.dir === "in"));
  assert.ok(vector.pins.some((pin) => pin.name === "Z" && pin.dir === "in"));
  const rotator = graph.setNodeData({ nodes: [vector], wires: [] }, vector.id, { struct: "FRotator" });
  const turned = rotator.nodes[0];
  assert.deepEqual(turned.pins.filter((pin) => pin.type !== "exec" && pin.name !== "Struct").map((pin) => pin.name), ["Pitch", "Yaw", "Roll"]);
  const custom = graph.createNode("break-struct", 0, 0, { data: { struct: "FSaveSlot", members: [{ name: "Slot", type: "int" }, { name: "Flag", type: "bool" }] } });
  assert.deepEqual(custom.pins.filter((pin) => pin.dir === "out" && pin.type !== "exec").map((pin) => pin.name), ["Slot", "Flag"]);

  const cast = graph.createNode("cast-to", 0, 0, { id: "cast", data: { className: "APawn" } });
  const call = graph.createNode("interface-call", 200, 0, { id: "call", data: { function: "Interact", interface: "UStackInteractable" } });
  const begin = graph.createNode("begin-play", 0, 0, { id: "begin" });
  const link = (from, to) => ({
    id: `${from.id}-${to.id}`,
    from: { node: from.id, pin: from.pins.find((pin) => pin.dir === "out" && pin.type === "exec").id },
    to: { node: to.id, pin: to.pins.find((pin) => pin.dir === "in" && pin.type === "exec").id },
  });
  const doc = {
    cpp_header: HEADER,
    cpp_source: SOURCE,
    items: [{ id: "event", kind: "event", name: "Event Graph", nodes: [begin, cast, call], wires: [link(begin, cast), link(cast, call)] }],
  };
  const synced = graph.commitDocument({ cpp_header: HEADER, cpp_source: SOURCE }, doc).system.cpp_source;
  assert.match(synced, /APawn\* Cast_cast = Cast<APawn>/);
  assert.match(synced, /if \(Cast_cast\)/);
  assert.match(synced, /ImplementsInterface\(UStackInteractable::StaticClass\(\)\)/);
  assert.match(synced, /IStackInteractable::Execute_Interact/);
});
