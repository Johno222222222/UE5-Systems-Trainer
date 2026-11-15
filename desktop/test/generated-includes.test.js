"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { catalog } = require("../references");
const { pluginFileMap } = require("../pluginFiles");
const { unresolvedIncludes, isEngineHeader } = require("../generatedIncludes");

function assertResolved(label, map) {
  const missing = unresolvedIncludes(map.files);
  assert.deepEqual(missing, [], `${label} has an include with no header: ${missing.map((item) => item.include).join(", ")}`);
}

async function graphLibs() {
  const root = path.join(__dirname, "..", "..", "frontend", "src", "lib");
  const graph = await import(pathToFileURL(path.join(root, "graph.mjs")).href);
  const templates = await import(pathToFileURL(path.join(root, "templates.mjs")).href);
  return { graph, templates };
}

test("Character Interaction exports an Interactable interface and only resolvable includes", () => {
  const starter = catalog().examples.find((item) => item.id === "start-here").starter;
  const map = pluginFileMap(starter);
  assertResolved("Character Interaction", map);
  const files = Object.keys(map.files).sort();
  assert.deepEqual(files, [
    "CharacterInteractKit.uplugin",
    "Source/CharacterInteractKit/CharacterInteractKit.Build.cs",
    "Source/CharacterInteractKit/Private/CharacterInteractComponent.cpp",
    "Source/CharacterInteractKit/Private/CharacterInteractKitModule.cpp",
    "Source/CharacterInteractKit/Public/CharacterInteractComponent.h",
    "Source/CharacterInteractKit/Public/Interactable.h",
  ]);
  const iface = map.files["Source/CharacterInteractKit/Public/Interactable.h"];
  assert.match(iface, /UINTERFACE\(BlueprintType\)/);
  assert.match(iface, /class CHARACTERINTERACTKIT_API UInteractable : public UInterface/);
  assert.match(iface, /class CHARACTERINTERACTKIT_API IInteractable/);
  assert.match(iface, /#include "Interactable\.generated\.h"/);
  assert.match(iface, /void Interact\(AActor\* User\);/);
  const cpp = map.files["Source/CharacterInteractKit/Private/CharacterInteractComponent.cpp"];
  assert.match(cpp, /^#include "CharacterInteractComponent\.h"/);
  assert.match(cpp, /#include "CollisionQueryParams\.h"/);
  assert.doesNotMatch(cpp, /Engine\/CollisionQueryParams\.h/);
  assert.match(cpp, /#include "Interactable\.h"/);
  assert.match(cpp, /Hit\.GetActor\(\)->GetClass\(\)->ImplementsInterface\(UInteractable::StaticClass\(\)\)/);
  assert.doesNotMatch(cpp, /GetActor\(\)->ImplementsInterface\(/);
  const build = map.files["Source/CharacterInteractKit/CharacterInteractKit.Build.cs"];
  assert.match(build, /"Core"/);
  assert.match(build, /"CoreUObject"/);
  assert.match(build, /"Engine"/);
  assert.match(build, /"NetCore"/);
  const descriptor = JSON.parse(map.files["CharacterInteractKit.uplugin"]);
  assert.equal(descriptor.Modules[0].Type, "Runtime");
  assert.equal(descriptor.Modules[0].Name, "CharacterInteractKit");
});

test("no generator calls ImplementsInterface on the actor itself", () => {
  const roots = ["desktop", "frontend/src", "content"].map((dir) => path.join(__dirname, "..", "..", dir));
  const bad = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        if (name === "test" || name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (!/\.(js|mjs|json|h|cpp)$/.test(name)) continue;
      const text = fs.readFileSync(full, "utf8");
      text.split("\n").forEach((line, index) => {
        if (line.includes("->ImplementsInterface(") && !line.includes("->GetClass()->ImplementsInterface(")) {
          bad.push(`${path.relative(path.join(__dirname, "..", ".."), full)}:${index + 1}`);
        }
      });
    }
  };
  for (const root of roots) walk(root);
  assert.deepEqual(bad, []);
});

test("CollisionQueryParams.h is the UE 5.8 header", () => {
  assert.equal(isEngineHeader("CollisionQueryParams.h"), true);
  assert.equal(isEngineHeader("Engine/CollisionQueryParams.h"), false);
  const missing = unresolvedIncludes({
    "Source/X/Public/X.h": "#include \"X.generated.h\"\n",
    "Source/X/Private/X.cpp": "#include \"X.h\"\n#include \"Engine/CollisionQueryParams.h\"\n",
  });
  assert.ok(missing.some((item) => item.include === "Engine/CollisionQueryParams.h"));
});

test("every bundled example and every graph template exports includes that resolve", async () => {
  for (const example of catalog().examples) {
    assertResolved(example.id, pluginFileMap(example.starter));
  }
  const { graph, templates } = await graphLibs();
  const header = `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Kit.generated.h"

UCLASS()
class UKitComponent : public UActorComponent
{
	GENERATED_BODY()
public:
	void Interact();
};
`;
  const source = `#include "Kit.h"\nvoid UKitComponent::Interact() {}\n`;
  const ids = fs.readdirSync(path.join(__dirname, "..", "..", "content", "templates")).filter((name) => name.endsWith(".json"));
  for (const name of ids) {
    const template = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "templates", name), "utf8"));
    const doc = { cpp_header: header, cpp_source: source, variables: [], items: [{ id: "event", kind: "event", name: "Event Graph", nodes: [], wires: [], comments: [] }] };
    const applied = templates.applyTemplate(doc, template, { mode: "insert", graphId: "event" });
    assert.deepEqual(applied.warnings, [], `${template.id} ${applied.warnings.join("; ")}`);
    const system = graph.commitDocument({ cpp_header: header, cpp_source: source, graphs: applied.doc }, applied.doc).system;
    assertResolved(template.id, pluginFileMap(system));
  }
});

test("an included interface is written, and EnhancedInput is a module dependency when the code uses it", () => {
  const map = pluginFileMap({
    system_name: "Prompt",
    cpp_header: "#pragma once\n#include \"CoreMinimal.h\"\n#include \"PromptWidget.generated.h\"\nUCLASS()\nclass UPromptWidget : public UUserWidget { GENERATED_BODY() public: void Show(); };\n",
    cpp_source: "#include \"PromptWidget.h\"\n#include \"Interactable.h\"\n#include \"EnhancedInputComponent.h\"\nvoid UPromptWidget::Show() { IInteractable::Execute_Interact(nullptr, nullptr); }\n",
  });
  assertResolved("Prompt", map);
  const folder = `Source/${map.module}`;
  assert.match(map.files[`${folder}/Public/Interactable.h`], /UINTERFACE/);
  const build = map.files[`${folder}/${map.module}.Build.cs`];
  assert.match(build, /"UMG"/);
  assert.match(build, /"EnhancedInput"/);
  const descriptor = JSON.parse(map.files[`${map.module}.uplugin`]);
  assert.ok(descriptor.Plugins.some((item) => item.Name === "EnhancedInput" && item.Enabled));
});
