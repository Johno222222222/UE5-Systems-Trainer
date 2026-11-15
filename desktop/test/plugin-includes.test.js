"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..", "ue-plugin", "ArchitectCompanion");

// Engine header -> module that owns it in UE 5.8. A header missing from this map fails the test.
const HEADER_MODULES = {
  "AssetRegistry/AssetRegistryModule.h": "AssetRegistry",
  "Containers/Ticker.h": "Core",
  "CoreMinimal.h": "Core",
  "Dom/JsonObject.h": "Json",
  "Engine/Blueprint.h": "Engine",
  "Framework/Commands/UIAction.h": "Slate",
  "Framework/Docking/TabManager.h": "Slate",
  "Framework/Notifications/NotificationManager.h": "Slate",
  "HAL/FileManager.h": "Core",
  "HttpManager.h": "HTTP",
  "HttpModule.h": "HTTP",
  "Interfaces/IHttpRequest.h": "HTTP",
  "Interfaces/IHttpResponse.h": "HTTP",
  "Interfaces/IPluginManager.h": "Projects",
  "Misc/App.h": "Core",
  "Misc/EngineVersion.h": "Core",
  "Misc/FileHelper.h": "Core",
  "Misc/Paths.h": "Core",
  "Modules/ModuleManager.h": "Core",
  "Serialization/JsonSerializer.h": "Json",
  "Serialization/JsonWriter.h": "Json",
  "Styling/SlateIcon.h": "SlateCore",
  "ToolMenus.h": "ToolMenus",
  "Widgets/Docking/SDockTab.h": "Slate",
  "Widgets/Input/SButton.h": "Slate",
  "Widgets/Input/SEditableTextBox.h": "Slate",
  "Widgets/Layout/SScrollBox.h": "Slate",
  "Widgets/Notifications/SNotificationList.h": "Slate",
  "Widgets/SBoxPanel.h": "Slate",
  "Widgets/SCompoundWidget.h": "Slate",
  "Widgets/Text/STextBlock.h": "Slate",
  "WorkspaceMenuStructure.h": "WorkspaceMenuStructure",
  "WorkspaceMenuStructureModule.h": "WorkspaceMenuStructure",
};

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

test("the companion plugin is editor-only and each engine include names its module", () => {
  const descriptor = JSON.parse(fs.readFileSync(path.join(root, "ArchitectCompanion.uplugin"), "utf8"));
  assert.equal(descriptor.Modules.length, 1);
  assert.equal(descriptor.Modules[0].Name, "ArchitectCompanion");
  assert.equal(descriptor.Modules[0].Type, "Editor");
  assert.equal(descriptor.Modules[0].LoadingPhase, "PostEngineInit");

  const rules = fs.readFileSync(path.join(root, "Source", "ArchitectCompanion", "ArchitectCompanion.Build.cs"), "utf8");
  const modules = new Set([...rules.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  const sources = walk(path.join(root, "Source")).filter((file) => file.endsWith(".h") || file.endsWith(".cpp"));
  const localNames = new Set(sources.map((file) => path.basename(file)));
  const seen = [];
  for (const file of sources) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/#include\s+[<"]([^">]+)[">]/g)) {
      const header = match[1];
      if (localNames.has(path.basename(header))) continue;
      const moduleName = HEADER_MODULES[header];
      assert.ok(moduleName, `${path.basename(file)} includes ${header}, which is not mapped to a UE 5.8 module`);
      assert.ok(modules.has(moduleName), `${header} belongs to ${moduleName}, which is missing from ArchitectCompanion.Build.cs`);
      seen.push(header);
    }
  }
  assert.ok(seen.includes("HttpManager.h"));
  assert.ok(seen.includes("WorkspaceMenuStructure.h"));
  assert.ok(modules.has("HTTP"));
  assert.equal(modules.has("HTTPServer"), false);
});
