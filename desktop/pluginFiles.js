"use strict";

const fs = require("fs");
const path = require("path");
const { modulesFor } = require("./modules");

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

function buildCs(module, modules) {
  const list = (modules || ["Core", "CoreUObject", "Engine"]).map((name) => `"${name}"`).join(", ");
  return `using UnrealBuildTool;

public class ${module} : ModuleRules
{
\tpublic ${module}(ReadOnlyTargetRules Target) : base(Target)
\t{
\t\tPCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
\t\tPublicDependencyModuleNames.AddRange(new string[] { ${list} });
\t}
}
`;
}

function uplugin(module, system, plugins) {
  const body = {
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
  };
  if (plugins?.length) body.Plugins = plugins.map((name) => ({ Name: name, Enabled: true }));
  return JSON.stringify(body, null, 2);
}

function pluginFileMap(system) {
  const module = moduleName(system);
  const base = baseName(system);
  const deps = modulesFor(`${system?.cpp_header || ""}\n${system?.cpp_source || ""}`);
  return {
    module,
    files: {
      [`${module}.uplugin`]: uplugin(module, system, deps.plugins),
      [`Source/${module}/${module}.Build.cs`]: buildCs(module, deps.modules),
      [`Source/${module}/Private/${module}Module.cpp`]: `#include "Modules/ModuleManager.h"\n\nIMPLEMENT_MODULE(FDefaultModuleImpl, ${module})\n`,
      [`Source/${module}/Public/${base}.h`]: system?.cpp_header || "",
      [`Source/${module}/Private/${base}.cpp`]: system?.cpp_source || "",
    },
  };
}

function changedFiles(dir, files) {
  const conflicts = [];
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    if (fs.readFileSync(full, "utf8") !== body) conflicts.push(rel);
  }
  return conflicts;
}

function writeMapped(dir, files) {
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
}

// Writes a plugin folder Unreal's BuildPlugin command can take.
// Existing files that differ are left alone unless confirm is true.
function writePlugin(dir, system, { confirm = false } = {}) {
  const planned = pluginFileMap(system);
  const conflicts = changedFiles(dir, planned.files);
  if (conflicts.length && !confirm) {
    const err = new Error("Some plugin files were edited in the project. Confirm before replacing them.");
    err.statusCode = 409;
    err.conflicts = conflicts;
    throw err;
  }
  writeMapped(dir, planned.files);
  return { module: planned.module, uplugin: path.join(dir, `${planned.module}.uplugin`), conflicts };
}

function listFiles(root, base = root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    if (fs.statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

function copyTree(sourceRoot, destRoot, { confirm = false } = {}) {
  const files = {};
  for (const rel of listFiles(sourceRoot)) {
    files[rel] = fs.readFileSync(path.join(sourceRoot, ...rel.split("/")), "utf8");
  }
  const conflicts = changedFiles(destRoot, files);
  if (conflicts.length && !confirm) {
    const err = new Error("The companion plugin in that project was edited. Confirm before replacing it.");
    err.statusCode = 409;
    err.conflicts = conflicts;
    throw err;
  }
  writeMapped(destRoot, files);
  return { files: Object.keys(files), conflicts };
}

function enablePlugin(uprojectPath, pluginName) {
  const parsed = JSON.parse(fs.readFileSync(uprojectPath, "utf8"));
  const plugins = Array.isArray(parsed.Plugins) ? parsed.Plugins : [];
  const existing = plugins.find((item) => item && item.Name === pluginName);
  if (existing) existing.Enabled = true;
  else plugins.push({ Name: pluginName, Enabled: true });
  parsed.Plugins = plugins;
  fs.writeFileSync(uprojectPath, JSON.stringify(parsed, null, 2));
  return parsed;
}

module.exports = { baseName, moduleName, writePlugin, pluginFileMap, changedFiles, writeMapped, copyTree, enablePlugin };
