"use strict";

const fs = require("fs");
const path = require("path");

function baseName(system) {
  const gen = String(system?.cpp_header || "").match(/#include\s+"([\w]+)\.generated\.h"/);
  if (gen) return gen[1];
  const cls = String(system?.cpp_header || "").match(/class\s+(?:\w+_API\s+)?[UAF]([A-Z]\w+)/);
  const raw = cls ? cls[1] : String(system?.system_name || "System").replace(/[^A-Za-z0-9]/g, "");
  return raw || "System";
}

function moduleName(system) {
  const base = baseName(system);
  return `${base.replace(/Component$|System$|Subsystem$/, "") || base}Kit`;
}

function buildCs(module) {
  return `using UnrealBuildTool;

public class ${module} : ModuleRules
{
\tpublic ${module}(ReadOnlyTargetRules Target) : base(Target)
\t{
\t\tPCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
\t\tPublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
\t}
}
`;
}

function uplugin(module, system) {
  return JSON.stringify({
    FileVersion: 3,
    Version: 1,
    VersionName: "1.0",
    FriendlyName: system?.system_name || module,
    Description: String(system?.summary || "").slice(0, 300),
    Category: "Gameplay",
    CreatedBy: "UE5 System Architect",
    CanContainContent: false,
    IsBetaVersion: false,
    Installed: false,
    EnabledByDefault: true,
    Modules: [{ Name: module, Type: "Runtime", LoadingPhase: "Default" }],
  }, null, 2);
}

// Writes a plugin folder Unreal's BuildPlugin command can take.
function writePlugin(dir, system) {
  const module = moduleName(system);
  const base = baseName(system);
  fs.mkdirSync(path.join(dir, "Source", module, "Public"), { recursive: true });
  fs.mkdirSync(path.join(dir, "Source", module, "Private"), { recursive: true });
  fs.writeFileSync(path.join(dir, `${module}.uplugin`), uplugin(module, system));
  fs.writeFileSync(path.join(dir, "Source", module, `${module}.Build.cs`), buildCs(module));
  fs.writeFileSync(
    path.join(dir, "Source", module, "Private", `${module}Module.cpp`),
    `#include "Modules/ModuleManager.h"\n\nIMPLEMENT_MODULE(FDefaultModuleImpl, ${module})\n`,
  );
  fs.writeFileSync(path.join(dir, "Source", module, "Public", `${base}.h`), system?.cpp_header || "");
  fs.writeFileSync(path.join(dir, "Source", module, "Private", `${base}.cpp`), system?.cpp_source || "");
  return { module, uplugin: path.join(dir, `${module}.uplugin`) };
}

module.exports = { baseName, moduleName, writePlugin };
