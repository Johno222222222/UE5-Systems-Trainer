"use strict";

// Writes a UE 5.8 plugin whose component BeginPlay runs every new 1.18.0 node.
// Usage: node desktop/nodeSample.js [output-folder]
// Open that folder's .uplugin in a UE 5.8 project and compile.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { writePlugin } = require("./pluginFiles");

const NEW_NODES = [
  "sphere-trace",
  "break-hit",
  "apply-damage",
  "destroy-actor",
  "play-sound",
  "spawn-niagara",
  "set-blackboard",
  "move-to",
  "activate-ability-tag",
  "activate-ability-class",
  "apply-effect-self",
  "switch-authority",
  "get-player-character",
  "get-player-controller",
  "has-gameplay-tag",
];

async function graphLib() {
  return import(pathToFileURL(path.join(__dirname, "..", "frontend", "src", "lib", "graph.mjs")).href);
}

async function buildSystem() {
  const graph = await graphLib();
  const begin = graph.createNode("begin-play", 0, 0, { id: "begin" });
  const nodes = [begin];
  const wires = [];
  let prev = begin;
  let x = 240;
  for (const id of NEW_NODES) {
    const node = graph.createNode(id, x, 0, { id });
    nodes.push(node);
    const fromPin = (prev.pins || []).find((pin) => pin.dir === "out" && pin.type === "exec");
    const toPin = (node.pins || []).find((pin) => pin.dir === "in" && pin.type === "exec");
    if (fromPin && toPin) {
      wires.push({
        id: `${prev.id}-${node.id}`,
        from: { node: prev.id, pin: fromPin.id },
        to: { node: node.id, pin: toPin.id },
      });
      prev = node;
    }
    x += 240;
  }
  const byId = (id) => nodes.find((node) => node.id === id);
  const outPin = (node) => node.pins.find((pin) => pin.dir === "out" && pin.type !== "exec");
  const inPin = (node, name) => node.pins.find((pin) => pin.name === name);
  wires.push({
    id: "player-to-destroy",
    from: { node: "get-player-character", pin: outPin(byId("get-player-character")).id },
    to: { node: "destroy-actor", pin: inPin(byId("destroy-actor"), "Target").id },
  });
  wires.push({
    id: "controller-to-damage",
    from: { node: "get-player-controller", pin: outPin(byId("get-player-controller")).id },
    to: { node: "apply-damage", pin: inPin(byId("apply-damage"), "Damaged Actor").id },
  });
  const branch = graph.createNode("branch", x, 160, { id: "tag-branch" });
  nodes.push(branch);
  const switched = byId("switch-authority");
  wires.push({
    id: "auth-to-tag",
    from: { node: switched.id, pin: inPin(switched, "Authority").id },
    to: { node: branch.id, pin: inPin(branch, "Exec").id },
  });
  wires.push({
    id: "tag-to-branch",
    from: { node: "has-gameplay-tag", pin: outPin(byId("has-gameplay-tag")).id },
    to: { node: "tag-branch", pin: inPin(branch, "Condition").id },
  });
  const header = `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "NodeExercise.generated.h"

UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))
class UNodeExerciseComponent : public UActorComponent
{
	GENERATED_BODY()
public:
};
`;
  const doc = {
    variables: [],
    items: [{ id: "event", kind: "event", name: "Event Graph", nodes, wires, comments: [] }],
  };
  return graph.commitDocument({
    cpp_header: header,
    cpp_source: "#include \"NodeExercise.h\"\n",
    system_name: "Node Exercise",
  }, doc).system;
}

async function writeSample(dir) {
  const system = await buildSystem();
  fs.rmSync(dir, { recursive: true, force: true });
  const written = writePlugin(dir, system, { confirm: true });
  return { dir, uplugin: written.uplugin, system };
}

async function main() {
  const dir = path.resolve(process.argv[2] || path.join(process.cwd(), "NodeExercisePlugin"));
  const written = await writeSample(dir);
  console.log(written.uplugin);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { NEW_NODES, buildSystem, writeSample };
